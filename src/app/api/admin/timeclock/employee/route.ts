// GET /api/admin/timeclock/employee
// Drill-down stats employé pour le sheet de la vue admin "Approbation des heures".
// Auth : admin avec scope HR (super_admin / users.write / hr.write / payroll.write)
// OU manager direct (Admin.managerId = currentAdminId) OU team lead (Team.leadAdminId = currentAdminId
// d'une équipe dont l'employé est membre).
// Query : ?adminId=N&from=ISO&to=ISO
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimesheetScope } from "@/lib/services/timesheet-scope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const currentAdminId = session.user.adminId!;
  const url = new URL(req.url);
  const targetIdStr = url.searchParams.get("adminId");
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  if (!targetIdStr) {
    return NextResponse.json({ error: "adminId manquant" }, { status: 400 });
  }
  const targetId = Number(targetIdStr);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: "adminId invalide" }, { status: 400 });
  }
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(toStr) : null;

  // ── Verification du scope via le service partage (mêmes règles que la page).
  //   - Founder / HR : voit tout (founder se voit lui aussi)
  //   - Manager / team lead : doit avoir le target dans son scope
  //   - L'employe peut toujours consulter ses propres entries (targetId == self)
  const scope = await getTimesheetScope(currentAdminId);
  const isSelf = targetId === currentAdminId;
  if (!isSelf) {
    if (!scope.isFounder && !scope.isHr) {
      const allowed = scope.allowedAdminIds ?? [];
      if (!allowed.includes(targetId)) {
        return NextResponse.json({ error: "Hors de votre périmètre" }, { status: 403 });
      }
    }
  }

  const admin = await prisma.admin.findUnique({
    where: { id: targetId },
    select: {
      id: true,
      fullName: true,
      email: true,
      title: true,
      position: { select: { name: true } },
    },
  });
  if (!admin) return NextResponse.json({ error: "Introuvable" }, { status: 404 });

  const where: Record<string, unknown> = { adminId: targetId };
  if (from && to && !isNaN(from.getTime()) && !isNaN(to.getTime())) {
    where.clockIn = { gte: from, lte: to };
  }

  const entries = await prisma.timeClock.findMany({
    where,
    orderBy: { clockIn: "desc" },
    take: 500,
    include: {
      approver: { select: { fullName: true, email: true } },
      history: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      },
    },
  });

  return NextResponse.json({
    name: admin.fullName || admin.email,
    email: admin.email,
    position: admin.position?.name ?? admin.title ?? null,
    entries: JSON.parse(JSON.stringify(entries)),
  });
}

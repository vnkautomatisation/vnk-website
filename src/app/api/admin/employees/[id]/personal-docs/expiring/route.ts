// GET /api/admin/employees/[id]/personal-docs/expiring?days=60
// Liste les docs personnels de cet employé expirant dans <= N jours (1..365).
// Auth: employé propriétaire OU admin RH.
// Note : l'endpoint admin-global (tous employés) est exposé via
// l'action serveur listExpiringDocsAction.
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const actorId = session.user.adminId!;

  const { id: idStr } = await params;
  const targetId = Number(idStr);
  if (!Number.isFinite(targetId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const me = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!me) return NextResponse.json({ error: "Non autorisé" }, { status: 401 });

  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  const isHr =
    isSuper
    || (perms.users ?? []).includes("read")
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("read")
    || (perms.hr ?? []).includes("write");
  const isSelf = actorId === targetId;
  if (!isSelf && !isHr) {
    return NextResponse.json({ error: "Accès refusé" }, { status: 403 });
  }

  const daysParam = Number(req.nextUrl.searchParams.get("days") ?? "60");
  const days = Math.max(1, Math.min(365, Number.isFinite(daysParam) ? daysParam : 60));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const cutoff = new Date(today);
  cutoff.setDate(cutoff.getDate() + days);

  const docs = await prisma.employeePersonalDocument.findMany({
    where: {
      adminId: targetId,
      expiresAt: { gte: today, lte: cutoff },
      ...(isSelf || isSuper ? {} : { isPrivate: false }),
    },
    orderBy: { expiresAt: "asc" },
  });

  return NextResponse.json({
    daysAhead: days,
    docs: docs.map((d) => ({
      id: d.id,
      category: d.category,
      title: d.title,
      expiresAt: d.expiresAt,
      daysUntil: d.expiresAt
        ? Math.ceil((d.expiresAt.getTime() - today.getTime()) / 86400000)
        : null,
      isVerified: d.isVerified,
    })),
  });
}

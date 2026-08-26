// GET /api/admin/timeclock/employee
// Per-employee drill-down for the "Approbation des heures" sheet.
// Query: ?adminId=N&from=ISO&to=ISO
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimesheetScope, checkReadAccess } from "@/lib/services/timesheet-scope";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

// The panel renders every row it receives; beyond this it says so instead of
// showing a partial period in silence.
const MAX_ENTRIES = 500;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const currentAdminId = session.user.adminId!;
  const url = new URL(req.url);
  const targetIdStr = url.searchParams.get("adminId");
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  if (!targetIdStr) {
    return NextResponse.json({ error: "adminId manquant" }, { status: 400 });
  }
  const from = fromStr ? new Date(fromStr) : null;
  const to = toStr ? new Date(toStr) : null;

  const access = checkReadAccess(await getTimesheetScope(currentAdminId), targetIdStr, currentAdminId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const targetId = access.targetId;

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
    take: MAX_ENTRIES + 1,
    include: {
      approver: { select: { fullName: true, email: true } },
      history: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      },
    },
  });

  const truncated = entries.length > MAX_ENTRIES;
  if (truncated) entries.length = MAX_ENTRIES;

  return NextResponse.json({
    truncated,
    name: admin.fullName || admin.email,
    email: admin.email,
    position: admin.position?.name ?? admin.title ?? null,
    entries: JSON.parse(JSON.stringify(entries)),
  });
}

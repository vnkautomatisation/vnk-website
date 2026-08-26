// GET /api/admin/timeclock/check-overlap
// Live overlap detection for the manual entry dialog.
// Defaults to the caller's punches; `adminId` needs review authority, like
// manualTimeEntryAction.
// Query: ?from=ISO&to=ISO[&excludeId=N][&adminId=N]
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimesheetScope, checkReadAccess } from "@/lib/services/timesheet-scope";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const actorId = session.user.adminId!;
  const url = new URL(req.url);
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const excludeIdStr = url.searchParams.get("excludeId");
  const targetIdStr = url.searchParams.get("adminId");

  let adminId = actorId;
  if (targetIdStr) {
    const access = checkReadAccess(await getTimesheetScope(actorId), targetIdStr, actorId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    adminId = access.targetId;
  }

  if (!fromStr || !toStr) {
    return NextResponse.json({ overlap: false });
  }
  const from = new Date(fromStr);
  const to = new Date(toStr);
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || to <= from) {
    return NextResponse.json({ overlap: false });
  }
  const excludeId = excludeIdStr ? Number(excludeIdStr) : null;

  const overlap = await prisma.timeClock.findFirst({
    where: {
      adminId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: [
        // Closed entry overlapping [from, to]
        { AND: [{ clockOut: { not: null } }, { clockIn: { lt: to } }, { clockOut: { gt: from } }] },
        // Open entry started before `to` (may still be running)
        { clockOut: null, clockIn: { lt: to } },
      ],
    },
    select: { id: true, clockIn: true },
  });

  if (!overlap) return NextResponse.json({ overlap: false });
  return NextResponse.json({
    overlap: true,
    with: { id: overlap.id, clockIn: overlap.clockIn.toISOString() },
  });
}

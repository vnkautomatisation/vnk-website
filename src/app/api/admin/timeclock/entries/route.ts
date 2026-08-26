// GET /api/admin/timeclock/entries
// Cursor-based TimeClock pagination for the "to approve" tab and other lists.
//
// Query :
//   ?cursor=<id>     id of the last item of the previous page
//   ?take=<n>        (default 200, max 500)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  date filter on clockIn
//   ?status=pending|approved|submitted  (filtre simple)
//   ?teamId=<n>      (filtre equipe)
//   ?adminId=<n>     (employee filter, validated against the scope)
//
// Reponse : { entries: [...], nextCursor: number | null, hasMore: boolean }
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimesheetScope, timeClockScopeWhere, checkReviewAccess } from "@/lib/services/timesheet-scope";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const DEFAULT_TAKE = 200;
const MAX_TAKE = 500;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;
  const scope = await getTimesheetScope(adminId);
  const scopeWhere = timeClockScopeWhere(scope);

  const url = new URL(req.url);
  const cursorStr = url.searchParams.get("cursor");
  const takeStr = url.searchParams.get("take");
  const fromStr = url.searchParams.get("from");
  const toStr = url.searchParams.get("to");
  const status = url.searchParams.get("status"); // pending | approved | submitted | rejected
  const teamIdStr = url.searchParams.get("teamId");
  const adminIdStr = url.searchParams.get("adminId");

  const cursor = cursorStr ? Number(cursorStr) : null;
  const take = Math.min(MAX_TAKE, Math.max(1, Number(takeStr) || DEFAULT_TAKE));

  const where: Record<string, unknown> = { ...scopeWhere };

  if (fromStr && toStr) {
    const from = new Date(fromStr);
    const to = new Date(toStr + "T23:59:59");
    if (!isNaN(from.getTime()) && !isNaN(to.getTime())) {
      where.clockIn = { gte: from, lte: to };
    }
  } else if (fromStr) {
    const from = new Date(fromStr);
    if (!isNaN(from.getTime())) where.clockIn = { gte: from };
  } else if (toStr) {
    const to = new Date(toStr + "T23:59:59");
    if (!isNaN(to.getTime())) where.clockIn = { lte: to };
  }

  if (status === "approved") where.approvedAt = { not: null };
  else if (status === "pending") {
    where.approvedAt = null;
    where.submittedAt = { not: null };
  } else if (status === "submitted") where.submittedAt = { not: null };
  else if (status === "rejected") {
    where.submittedAt = null;
    where.approvedAt = null;
  }

  if (teamIdStr) {
    where.admin = { teamId: Number(teamIdStr) };
  }
  if (adminIdStr) {
    // Must NARROW the scope, never replace it.
    const access = checkReviewAccess(scope, adminIdStr, adminId);
    if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
    where.adminId = access.targetId;
  }

  // Fetch take + 1 to know whether another page exists.
  const entries = await prisma.timeClock.findMany({
    where,
    orderBy: { id: "desc" }, // stable cursor on id
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: {
      admin: {
        select: {
          id: true, fullName: true, email: true, title: true,
          team: { select: { id: true, name: true, color: true } },
        },
      },
      approver: { select: { fullName: true, email: true } },
      jobCode: { select: { id: true, code: true, label: true } },
    },
  });

  const hasMore = entries.length > take;
  const page = hasMore ? entries.slice(0, take) : entries;
  const nextCursor = hasMore ? page[page.length - 1].id : null;

  return NextResponse.json({
    entries: page.map((e) => ({
      id: e.id,
      adminId: e.adminId,
      clockIn: e.clockIn.toISOString(),
      clockOut: e.clockOut?.toISOString() ?? null,
      durationMin: e.durationMin,
      category: e.category,
      notes: e.notes,
      approvedAt: e.approvedAt?.toISOString() ?? null,
      approvedBy: e.approvedBy,
      submittedAt: e.submittedAt?.toISOString() ?? null,
      payStubId: e.payStubId,
      admin: e.admin,
      approver: e.approver,
      jobCode: e.jobCode,
    })),
    hasMore,
    nextCursor,
  });
}

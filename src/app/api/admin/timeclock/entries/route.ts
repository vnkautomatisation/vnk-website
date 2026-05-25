// GET /api/admin/timeclock/entries
// Pagination cursor-based de TimeClock pour l'onglet "À approuver" (et autres listes).
//
// Query :
//   ?cursor=<id>     (optionnel) — id du dernier element de la page precedente
//   ?take=<n>        (default 200, max 500)
//   ?from=YYYY-MM-DD&to=YYYY-MM-DD  (filtre date sur clockIn)
//   ?status=pending|approved|submitted  (filtre simple)
//   ?teamId=<n>      (filtre equipe)
//   ?adminId=<n>     (filtre employe — verifie via scope)
//
// Reponse : { entries: [...], nextCursor: number | null, hasMore: boolean }
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimesheetScope, timeClockScopeWhere } from "@/lib/services/timesheet-scope";

export const dynamic = "force-dynamic";

const DEFAULT_TAKE = 200;
const MAX_TAKE = 500;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
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
    where.adminId = Number(adminIdStr);
  }

  // Cursor : on prend `take + 1` pour savoir s'il y a plus
  const entries = await prisma.timeClock.findMany({
    where,
    orderBy: { id: "desc" }, // cursor stable sur id
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

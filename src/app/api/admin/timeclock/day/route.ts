// GET /api/admin/timeclock/day?date=YYYY-MM-DD
// One day for every admin in scope: the punches, plus those with none.
// Both lists are capped; the CSV export is the exhaustive tool.
import "server-only";
import { getTranslations } from "next-intl/server";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTimesheetScope } from "@/lib/services/timesheet-scope";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

// The panel renders every row without virtualization.
const MAX_ENTRIES = 2000;
const MAX_WITHOUT_ENTRIES = 50;

export async function GET(req: NextRequest) {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const currentAdminId = session.user.adminId!;
  const url = new URL(req.url);
  const dateParam = url.searchParams.get("date");
  if (!dateParam || !/^\d{4}-\d{2}-\d{2}$/.test(dateParam)) {
    return NextResponse.json({ error: t("parametre_date_yyyy_mm_dd_manquant_ou") }, { status: 400 });
  }

  const day = new Date(dateParam + "T00:00:00");
  if (isNaN(day.getTime())) {
    return NextResponse.json({ error: "Date invalide" }, { status: 400 });
  }
  const nextDay = new Date(day);
  nextDay.setDate(nextDay.getDate() + 1);

  const scope = await getTimesheetScope(currentAdminId);

  // Manager with no direct report: return an empty payload.
  if (!scope.isHr && (scope.allowedAdminIds ?? []).length === 0) {
    return NextResponse.json({
      entries: [], adminsWithoutEntries: [], adminsWithoutEntriesTotal: 0,
      entriesTruncated: false, date: dateParam,
    });
  }

  // Shared where: scope + exclude self (non-founder), mirroring pointage/page.tsx.
  const timeClockScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { adminId: { not: scope.excludeSelfId } } : {})
    : { adminId: { in: scope.allowedAdminIds! } };

  const adminScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { id: { not: scope.excludeSelfId } } : {})
    : { id: { in: scope.allowedAdminIds! } };

  const entries = await prisma.timeClock.findMany({
    where: {
      ...timeClockScopeWhere,
      clockIn: { gte: day, lt: nextDay },
    },
    include: {
      admin: {
        select: {
          id: true,
          fullName: true,
          email: true,
          title: true,
          avatarUrl: true,
          position: { select: { name: true } },
          team: { select: { id: true, name: true, color: true } },
        },
      },
      approver: { select: { id: true, fullName: true, email: true } },
      jobCode: { select: { id: true, code: true, label: true } },
      history: {
        orderBy: { createdAt: "desc" },
        take: 5,
        include: {
          actor: { select: { id: true, fullName: true, email: true } },
        },
      },
    },
    orderBy: [{ adminId: "asc" }, { clockIn: "asc" }],
    take: MAX_ENTRIES + 1,
  });
  const entriesTruncated = entries.length > MAX_ENTRIES;
  if (entriesTruncated) entries.length = MAX_ENTRIES;

  // Filtered and counted in SQL so the panel can say "50 of 3214".
  const adminIdsWithEntries = Array.from(new Set(entries.map((e) => e.adminId)));
  const withoutWhere = {
    ...adminScopeWhere,
    isActive: true,
    ...(adminIdsWithEntries.length > 0 ? { id: { notIn: adminIdsWithEntries } } : {}),
  };
  const [adminsWithoutEntriesTotal, adminsWithoutEntries] = await Promise.all([
    prisma.admin.count({ where: withoutWhere }),
    prisma.admin.findMany({
      where: withoutWhere,
      select: {
        id: true,
        fullName: true,
        email: true,
        avatarUrl: true,
        title: true,
        position: { select: { name: true } },
        team: { select: { id: true, name: true, color: true } },
      },
      orderBy: { fullName: "asc" },
      take: MAX_WITHOUT_ENTRIES,
    }),
  ]);

  return NextResponse.json({
    date: dateParam,
    entries: JSON.parse(JSON.stringify(entries)),
    entriesTruncated,
    adminsWithoutEntries,
    adminsWithoutEntriesTotal,
  });
}

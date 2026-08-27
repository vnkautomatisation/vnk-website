// Page admin /employes/conges — vue de gestion superviseur (pas de duplication avec mon-espace).
// Pré-calcule tous les KPIs et data tabs côté serveur pour rester scalable à 100+ employés.
//
// Tabs :
//  1) Vue d'ensemble : KPIs + prochaines absences (top 10)
//  2) À approuver : file d'attente du scope (bulk + filtres)
//  3) Calendrier équipe : Gantt 28 jours scope
//  4) Par employé : tableau avec solde + jours pris/planifiés
//  5) Analytics : taux absentéisme + répartition par type
//
// Scope : getLeavesScope (founder = tout, HR = tous-sauf-soi, manager = subordonnés+teams)
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { startOfWeek, endOfWeek } from "@/lib/week";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { LeavesAdminView } from "./leaves-admin-view";
import { getLeavesScope } from "@/lib/services/timesheet-scope";
import { getLeaveBalance } from "@/lib/services/leave-balance";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("employes_conges") };
}

const PAGE_SIZE = 50;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
}

export default async function CongesPage({
  searchParams,
}: {
  searchParams?: Promise<{ page?: string }>;
}) {
  const t = await getTranslations("admin.leaves");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const sp = (await searchParams) ?? {};
  const pageNum = Math.max(1, Number(sp.page) || 1);

  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isReviewer =
    me?.customRole?.name === "super_admin"
    || (perms.leaves ?? []).includes("write")
    || (perms.users ?? []).includes("write");

  const scope = await getLeavesScope(adminId);


  const adminScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { id: { not: scope.excludeSelfId } } : {})
    : { id: { in: scope.allowedAdminIds ?? [] } };
  const leaveScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { adminId: { not: scope.excludeSelfId } } : {})
    : { adminId: { in: scope.allowedAdminIds ?? [] } };


  if (!scope.isHr && (scope.allowedAdminIds ?? []).length === 0) {
    return (
      <LeavesAdminView
        scope={{
          isHr: scope.isHr,
          isFounder: scope.isFounder,
          allowedAdminCount: 0,
          myTeams: scope.myTeams,
        }}
        isReviewer={isReviewer}
        kpis={{
          pendingCount: 0,
          absentToday: 0,
          activeScopeCount: 0,
          absentDaysThisWeek: 0,
          absenteeismRate: 0,
          totalRemainingDays: 0,
          conflictDays: 0,
        }}
        pendingReviews={[]}
        pendingPagination={{ page: 1, pages: 1, pageSize: PAGE_SIZE, total: 0 }}
        teamLeavesUpcoming={[]}
        upcomingNext30={[]}
        employees={[]}
        absencesByType={[]}
        trailing12Months={[]}
        prevMonthAbsenteeismRate={0}
        teamStats={[]}
        next8WeeksForecast={[]}
        heatmapDays={[]}
        nowIso={new Date().toISOString()}
        activeWindows={[]}
        activePendingAppealsTotal={0}
      />
    );
  }

  const now = new Date();
  const today = startOfDay(now);
  const weekStart = startOfWeek(now);
  const weekEnd = new Date(weekStart); weekEnd.setDate(weekEnd.getDate() + 7);
  const monthStart = startOfMonth(now);
  const monthEnd = endOfMonth(now);
  const prevMonthEnd = new Date(monthStart); prevMonthEnd.setDate(0);
  const prevMonthStart = startOfMonth(prevMonthEnd);
  const horizonStart = today;
  const horizonEnd = new Date(today); horizonEnd.setDate(horizonEnd.getDate() + 28);
  const next30End = new Date(today); next30End.setDate(next30End.getDate() + 30);
  const next8WeeksEnd = new Date(today); next8WeeksEnd.setDate(next8WeeksEnd.getDate() + 56);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const trailing12Start = new Date(now.getFullYear(), now.getMonth() - 11, 1);


  const pendingTotalPromise = isReviewer
    ? prisma.leaveRequest.count({ where: { status: "pending", ...leaveScopeWhere } })
    : Promise.resolve(0);


  const [
    pendingReviews,
    pendingTotal,
    teamLeavesUpcoming,
    upcomingNext30,
    absentTodayRows,
    weekApprovedLeaves,
    monthApprovedLeaves,
    activeScopeCount,
    scopedEmployees,
    typeStatsRaw,
    activeWindowsRaw,
  ] = await Promise.all([
    isReviewer
      ? prisma.leaveRequest.findMany({
          where: { status: "pending", ...leaveScopeWhere },
          orderBy: { createdAt: "asc" },
          take: PAGE_SIZE,
          skip: (pageNum - 1) * PAGE_SIZE,
          include: {
            admin: {
              select: {
                id: true, fullName: true, email: true, avatarUrl: true,
                team: { select: { id: true, name: true, color: true } },
              },
            },
          },
        })
      : Promise.resolve([]),
    pendingTotalPromise,

    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        endDate: { gte: horizonStart },
        startDate: { lte: horizonEnd },
        ...leaveScopeWhere,
      },
      orderBy: { startDate: "asc" },
      take: 500,
      include: {
        admin: {
          select: { id: true, fullName: true, email: true, avatarUrl: true },
        },
      },
    }),

    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { gte: today, lte: next30End },
        ...leaveScopeWhere,
      },
      orderBy: { startDate: "asc" },
      take: 10,
      include: {
        admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
    }),

    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: today },
        endDate: { gte: today },
        ...leaveScopeWhere,
      },
      select: {
        id: true, adminId: true, type: true, halfDay: true,
        startDate: true, endDate: true,
        admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
      },
    }),

    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lt: weekEnd },
        endDate: { gte: weekStart },
        ...leaveScopeWhere,
      },
      select: { adminId: true, startDate: true, endDate: true, halfDay: true, daysCount: true },
    }),

    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: monthEnd },
        endDate: { gte: monthStart },
        ...leaveScopeWhere,
      },
      select: {
        adminId: true, type: true,
        startDate: true, endDate: true, halfDay: true, daysCount: true,
      },
    }),

    prisma.admin.count({ where: { ...adminScopeWhere, isActive: true } }),

    prisma.admin.findMany({
      where: { ...adminScopeWhere, isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true, fullName: true, email: true, avatarUrl: true,
        title: true, department: true,
        team: { select: { id: true, name: true, color: true } },
      },
    }),

    prisma.leaveRequest.groupBy({
      by: ["type"],
      where: {
        status: "approved",
        startDate: { gte: yearStart },
        ...leaveScopeWhere,
      },
      _sum: { daysCount: true },
      _count: { _all: true },
    }),

    prisma.vacationSelectionWindow.findMany({
      where: { status: { in: ["open", "closed", "in_review"] } },
      include: { _count: { select: { preferences: true } } },
      orderBy: { closingDate: "asc" },
    }),
  ]);


  const windowIds = activeWindowsRaw.map((w) => w.id);
  const submittedByWindow = new Map<number, number>();
  const pendingAppealsByWindow = new Map<number, number>();
  if (windowIds.length > 0) {
    const [distinctSubmissions, pendingAppealsAgg] = await Promise.all([
      Promise.all(
        activeWindowsRaw.map((w) =>
          prisma.vacationPreference.findMany({
            where: { windowId: w.id },
            select: { adminId: true },
            distinct: ["adminId"],
          }).then((rows) => ({ windowId: w.id, count: rows.length })),
        ),
      ),
      prisma.vacationPreference.groupBy({
        by: ["windowId"],
        where: { windowId: { in: windowIds }, appealStatus: "pending" },
        _count: { _all: true },
      }),
    ]);
    for (const r of distinctSubmissions) submittedByWindow.set(r.windowId, r.count);
    for (const r of pendingAppealsAgg) pendingAppealsByWindow.set(r.windowId, r._count._all);
  }

  const activeWindows = activeWindowsRaw.map((w) => ({
    id: w.id,
    name: w.name,
    status: w.status,
    openingDate: w.openingDate.toISOString(),
    closingDate: w.closingDate.toISOString(),
    coversFrom: w.coversFrom.toISOString(),
    coversTo: w.coversTo.toISOString(),
    preferencesCount: w._count.preferences,
    submittedAdmins: submittedByWindow.get(w.id) ?? 0,
    pendingAppealsCount: pendingAppealsByWindow.get(w.id) ?? 0,
  }));
  const activePendingAppealsTotal = activeWindows.reduce((s, w) => s + w.pendingAppealsCount, 0);


  const [
    trailing12Leaves,
    prevMonthLeaves,
    next8WeeksPlanned,
  ] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { gte: trailing12Start, lte: monthEnd },
        ...leaveScopeWhere,
      },
      select: { startDate: true, endDate: true, halfDay: true, daysCount: true, type: true, adminId: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: prevMonthEnd },
        endDate: { gte: prevMonthStart },
        ...leaveScopeWhere,
      },
      select: { adminId: true, startDate: true, endDate: true, halfDay: true },
    }),
    prisma.leaveRequest.findMany({
      where: {
        status: { in: ["approved", "pending"] },
        startDate: { gte: today, lte: next8WeeksEnd },
        ...leaveScopeWhere,
      },
      select: { adminId: true, startDate: true, endDate: true, daysCount: true, status: true },
    }),
  ]);


  const absentTodaySet = new Set(absentTodayRows.map((r) => r.adminId));
  const absentTodayCount = absentTodaySet.size;


  function workingDayCount(start: Date, end: Date): number {
    let n = 0;
    const cursor = new Date(Math.max(start.getTime(), weekStart.getTime()));
    cursor.setHours(0, 0, 0, 0);
    const stop = new Date(Math.min(end.getTime(), weekEnd.getTime() - 1));
    stop.setHours(0, 0, 0, 0);
    while (cursor <= stop) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) n++;
      cursor.setDate(cursor.getDate() + 1);
    }
    return n;
  }
  let absentDaysThisWeek = 0;
  for (const l of weekApprovedLeaves) {
    const days = workingDayCount(l.startDate, l.endDate);
    absentDaysThisWeek += l.halfDay ? days * 0.5 : days;
  }



  let workingDaysInMonth = 0;
  {
    const cursor = new Date(monthStart);
    while (cursor <= monthEnd) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) workingDaysInMonth++;
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  let absentDaysThisMonth = 0;

  const absentByDateMap = new Map<string, Set<number>>();
  for (const l of monthApprovedLeaves) {
    const start = new Date(Math.max(l.startDate.getTime(), monthStart.getTime()));
    start.setHours(0, 0, 0, 0);
    const end = new Date(Math.min(l.endDate.getTime(), monthEnd.getTime()));
    end.setHours(0, 0, 0, 0);
    const cursor = new Date(start);
    while (cursor <= end) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) {
        absentDaysThisMonth += l.halfDay ? 0.5 : 1;
        const key = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, "0")}-${String(cursor.getDate()).padStart(2, "0")}`;
        if (!absentByDateMap.has(key)) absentByDateMap.set(key, new Set());
        absentByDateMap.get(key)!.add(l.adminId);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }
  const absenteeismRate = activeScopeCount > 0 && workingDaysInMonth > 0
    ? Math.round((absentDaysThisMonth / (activeScopeCount * workingDaysInMonth)) * 1000) / 10
    : 0;


  let conflictDays = 0;
  if (activeScopeCount > 0) {
    const threshold = Math.max(1, Math.ceil(activeScopeCount * 0.3));
    for (const [, set] of absentByDateMap) {
      if (set.size >= threshold) conflictDays++;
    }
  }





  const balancesPerEmp = await Promise.all(
    scopedEmployees.map((e) =>
      getLeaveBalance(e.id, "vacation").catch(() => null),
    ),
  );


  const requestsByAdmin = await prisma.leaveRequest.groupBy({
    by: ["adminId", "status"],
    where: {
      ...leaveScopeWhere,
      status: { in: ["pending", "approved"] },
      startDate: { gte: new Date(now.getFullYear(), 0, 1) },
    },
    _sum: { daysCount: true },
    _count: { _all: true },
  });
  const statusByAdmin = new Map<number, { pending: number; approved: number; pendingCount: number }>();
  for (const r of requestsByAdmin) {
    if (!statusByAdmin.has(r.adminId)) statusByAdmin.set(r.adminId, { pending: 0, approved: 0, pendingCount: 0 });
    const slot = statusByAdmin.get(r.adminId)!;
    const sum = Number(r._sum.daysCount ?? 0);
    if (r.status === "pending") {
      slot.pending = sum;
      slot.pendingCount = r._count._all;
    } else if (r.status === "approved") {
      slot.approved = sum;
    }
  }


  const lastRequests = await prisma.leaveRequest.findMany({
    where: { ...leaveScopeWhere, adminId: { in: scopedEmployees.map((e) => e.id) } },
    orderBy: { createdAt: "desc" },
    distinct: ["adminId"],
    select: { adminId: true, createdAt: true, type: true, status: true, startDate: true, endDate: true },
  });
  const lastReqByAdmin = new Map(lastRequests.map((r) => [r.adminId, r]));

  const employees = scopedEmployees.map((emp, i) => {
    const balance = balancesPerEmp[i];
    const slot = statusByAdmin.get(emp.id) ?? { pending: 0, approved: 0, pendingCount: 0 };
    return {
      id: emp.id,
      fullName: emp.fullName,
      email: emp.email,
      avatarUrl: emp.avatarUrl ?? null,
      title: emp.title,
      department: emp.department,
      team: emp.team,
      vacationDaysRemaining: balance?.vacationDaysRemaining ?? 0,
      vacationDaysTaken: balance?.vacationDaysTaken ?? 0,
      vacationDaysPlanned: balance?.vacationDaysPlanned ?? 0,
      pendingApprovedDays: slot.approved,
      pendingRequestsCount: slot.pendingCount,
      lastRequest: lastReqByAdmin.get(emp.id) ?? null,
      hasPending: slot.pendingCount > 0,
      isAbsentToday: absentTodaySet.has(emp.id),
    };
  });

  const totalRemainingDays = employees.reduce((s, e) => s + (e.vacationDaysRemaining || 0), 0);


  const absencesByType = typeStatsRaw.map((t) => ({
    type: t.type,
    daysCount: Number(t._sum.daysCount ?? 0),
    requestsCount: t._count._all,
  }));



  function workingDaysBetween(s: Date, e: Date): number {
    let n = 0;
    const cur = new Date(s);
    cur.setHours(0, 0, 0, 0);
    const stop = new Date(e);
    stop.setHours(0, 0, 0, 0);
    while (cur <= stop) {
      const dow = cur.getDay();
      if (dow >= 1 && dow <= 5) n++;
      cur.setDate(cur.getDate() + 1);
    }
    return n;
  }
  const trailing12Months: Array<{ key: string; label: string; rate: number; days: number }> = [];
  for (let i = 0; i < 12; i++) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - 11 + i + 1, 0, 23, 59, 59);
    const wdInMonth = workingDaysBetween(mStart, mEnd);
    let abs = 0;
    for (const l of trailing12Leaves) {
      if (l.endDate < mStart || l.startDate > mEnd) continue;
      const s = l.startDate > mStart ? l.startDate : mStart;
      const e = l.endDate < mEnd ? l.endDate : mEnd;
      const days = workingDaysBetween(s, e);
      abs += l.halfDay ? days * 0.5 : days;
    }
    const rate = activeScopeCount > 0 && wdInMonth > 0
      ? Math.round((abs / (activeScopeCount * wdInMonth)) * 1000) / 10
      : 0;
    trailing12Months.push({
      key: `${mStart.getFullYear()}-${String(mStart.getMonth() + 1).padStart(2, "0")}`,
      label: mStart.toLocaleDateString("fr-CA", { month: "short" }),
      rate,
      days: Math.round(abs * 10) / 10,
    });
  }


  let prevMonthAbsDays = 0;
  const prevMonthWd = workingDaysBetween(prevMonthStart, prevMonthEnd);
  for (const l of prevMonthLeaves) {
    const s = l.startDate > prevMonthStart ? l.startDate : prevMonthStart;
    const e = l.endDate < prevMonthEnd ? l.endDate : prevMonthEnd;
    const days = workingDaysBetween(s, e);
    prevMonthAbsDays += l.halfDay ? days * 0.5 : days;
  }
  const prevMonthAbsenteeismRate = activeScopeCount > 0 && prevMonthWd > 0
    ? Math.round((prevMonthAbsDays / (activeScopeCount * prevMonthWd)) * 1000) / 10
    : 0;


  const teamDaysMap = new Map<number, { id: number; name: string; color: string | null; days: number; employees: number }>();

  const empTeam = new Map<number, { id: number; name: string; color: string | null } | null>();
  for (const e of scopedEmployees) empTeam.set(e.id, e.team);
  const noTeamSlot: { id: number; name: string; color: string | null; days: number; employees: number } = { id: 0, name: t("sans_equipe"), color: null, days: 0, employees: 0 };
  for (const e of scopedEmployees) {
    if (!e.team) noTeamSlot.employees++;
    else {
      const cur = teamDaysMap.get(e.team.id);
      if (cur) cur.employees++;
      else teamDaysMap.set(e.team.id, { ...e.team, days: 0, employees: 1 });
    }
  }
  for (const l of trailing12Leaves) {
    const t = empTeam.get(l.adminId);
    if (!t) noTeamSlot.days += Number(l.daysCount);
    else {
      const cur = teamDaysMap.get(t.id);
      if (cur) cur.days += Number(l.daysCount);
    }
  }
  const teamStats = Array.from(teamDaysMap.values())
    .concat(noTeamSlot.employees > 0 ? [noTeamSlot] : [])
    .sort((a, b) => b.days - a.days);


  const next8WeeksForecast: Array<{ key: string; label: string; absents: number; days: number }> = [];
  for (let i = 0; i < 8; i++) {
    const wStart = new Date(weekStart); wStart.setDate(wStart.getDate() + i * 7);
    const wEnd = new Date(wStart); wEnd.setDate(wEnd.getDate() + 6);
    const set = new Set<number>();
    let days = 0;
    for (const l of next8WeeksPlanned) {
      if (l.endDate < wStart || l.startDate > wEnd) continue;
      set.add(l.adminId);
      const s = l.startDate > wStart ? l.startDate : wStart;
      const e = l.endDate < wEnd ? l.endDate : wEnd;
      days += workingDaysBetween(s, e);
    }
    next8WeeksForecast.push({
      key: `${wStart.getFullYear()}-${String(wStart.getMonth() + 1).padStart(2, "0")}-${String(wStart.getDate()).padStart(2, "0")}`,
      label: `S${i + 1}`,
      absents: set.size,
      days,
    });
  }


  const heatmapDays: Array<{ date: string; count: number; ids: number[] }> = [];
  for (let i = 0; i < 28; i++) {
    const d = new Date(today); d.setDate(d.getDate() + i);
    const set = new Set<number>();
    for (const l of teamLeavesUpcoming) {
      if (d.getTime() >= new Date(l.startDate).getTime() && d.getTime() <= new Date(l.endDate).getTime()) {
        if (l.admin?.id != null) set.add(l.admin.id);
      }
    }
    heatmapDays.push({
      date: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
      count: set.size,
      ids: Array.from(set),
    });
  }


  const pendingCount = pendingTotal;
  const pendingPages = Math.max(1, Math.ceil(pendingCount / PAGE_SIZE));

  return (
    <LeavesAdminView
      scope={{
        isHr: scope.isHr,
        isFounder: scope.isFounder,
        allowedAdminCount: scope.isHr ? null : (scope.allowedAdminIds?.length ?? 0),
        myTeams: scope.myTeams,
      }}
      isReviewer={isReviewer}
      kpis={{
        pendingCount,
        absentToday: absentTodayCount,
        activeScopeCount,
        absentDaysThisWeek,
        absenteeismRate,
        totalRemainingDays: Math.round(totalRemainingDays * 10) / 10,
        conflictDays,
      }}
      pendingReviews={JSON.parse(JSON.stringify(pendingReviews))}
      pendingPagination={{ page: pageNum, pages: pendingPages, pageSize: PAGE_SIZE, total: pendingCount }}
      teamLeavesUpcoming={JSON.parse(JSON.stringify(teamLeavesUpcoming))}
      upcomingNext30={JSON.parse(JSON.stringify(upcomingNext30))}
      employees={JSON.parse(JSON.stringify(employees))}
      absencesByType={absencesByType}
      trailing12Months={trailing12Months}
      prevMonthAbsenteeismRate={prevMonthAbsenteeismRate}
      teamStats={teamStats}
      next8WeeksForecast={next8WeeksForecast}
      heatmapDays={heatmapDays}
      nowIso={now.toISOString()}
      activeWindows={activeWindows}
      activePendingAppealsTotal={activePendingAppealsTotal}
    />
  );
}

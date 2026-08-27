import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { startOfWeek, endOfWeek } from "@/lib/week";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimeclockView } from "./timeclock-view";
import { getHolidaysInRange } from "@/lib/services/holidays";
import { localDayKey, overtimeMinutes } from "@/lib/services/payroll-hours";
import { getTimeclockConfig } from "@/lib/services/timeclock-config";
import { checkRangeBreakCompliance } from "@/lib/services/break-compliance";
import { getTimesheetScope as getSharedTimesheetScope } from "@/lib/services/timesheet-scope";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("employes_pointage") };
}


// searchParams helpers.
function parseIntParam(v: string | undefined, def: number, min = 1, max = 1000): number {
  if (!v) return def;
  const n = parseInt(v, 10);
  if (!Number.isFinite(n)) return def;
  return Math.min(max, Math.max(min, n));
}

function parseTab(v: string | undefined): "overview" | "by-employee" | "to-approve" {
  if (v === "by-employee" || v === "to-approve") return v;
  return "overview";
}

function parseStatus(v: string | undefined): "all" | "submitted" | "pending" | "approved" | "rejected" {
  if (v === "submitted" || v === "pending" || v === "approved" || v === "rejected") return v;
  return "all";
}

export default async function PointagePage({
  searchParams,
}: {
  searchParams: Promise<{
    from?: string;
    to?: string;
    tab?: string;
    page?: string;
    pageSize?: string;
    q?: string;
    team?: string;
    department?: string;
    status?: string;
  }>;
}) {
  const t = await getTranslations("admin.timeclock");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const sp = await searchParams;
  const scope = await getSharedTimesheetScope(adminId);

  // Default period: current week (Sunday -> today).
  const now = new Date();
  const defaultFrom = startOfWeek(now);
  // A bare "YYYY-MM-DD" parses as UTC and shifts a day; force LOCAL midnight.
  const from = sp.from
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from + "T00:00:00" : sp.from)
    : defaultFrom;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : now;
  const periodFrom = !isNaN(from.getTime()) ? from : defaultFrom;
  const periodTo = !isNaN(to.getTime()) ? to : now;

  const tab = parseTab(sp.tab);
  const page = parseIntParam(sp.page, 1, 1, 9999);
  const pageSize = parseIntParam(sp.pageSize, 25, 5, 200);
  const q = (sp.q ?? "").trim();
  const teamFilter = sp.team ? parseInt(sp.team, 10) : null;
  const departmentFilter = sp.department ?? null;
  const statusFilter = parseStatus(sp.status);

  // Manager with nobody in scope: clean empty state, no queries.
  if (!scope.isHr && (scope.allowedAdminIds ?? []).length === 0) {
    return (
      <TimeclockView
        scope={{
          isHr: false,
          isFounder: scope.isFounder,
          allowedAdminCount: 0,
          myTeams: scope.myTeams,
        }}
        currentAdminId={adminId}
        periodFrom={periodFrom.toISOString()}
        periodTo={periodTo.toISOString()}
        holidays={{}}
        teams={[]}
        departments={[]}
        editRequests={[]}
        teamStats={null}
        adminKpis={null}
        tab={tab}
        page={page}
        pageSize={pageSize}
        q={q}
        teamFilter={teamFilter}
        departmentFilter={departmentFilter}
        statusFilter={statusFilter}
        overview={null}
        byEmployee={{ items: [], total: 0 }}
        toApprove={{ items: [], total: 0 }}
        approveQueue={{ rows: [], awaitingSubmission: [], upToDate: [], pastPendingCount: 0, pastPendingWeeks: 0, pastPendingLatestWeek: null }}
        employeesWithForgottenDays={[]}
      />
    );
  }

  // whereAdmin filters the Admin table, whereTimeClock the entries.
  // A non-founder never reviews their own hours.
  const adminScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { id: { not: scope.excludeSelfId } } : {})
    : { id: { in: scope.allowedAdminIds! } };
  const timeClockScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { adminId: { not: scope.excludeSelfId } } : {})
    : { adminId: { in: scope.allowedAdminIds! } };

  // Teams and departments feeding the filter selects.
  const [allTeamsForFilter, departmentsRaw] = await Promise.all([
    scope.isHr
      ? prisma.team.findMany({
          orderBy: { sortOrder: "asc" },
          select: { id: true, name: true, color: true },
        })
      : Promise.resolve(scope.myTeams),
    prisma.admin.findMany({
      where: { ...adminScopeWhere, isActive: true, department: { not: null } },
      distinct: ["department"],
      select: { department: true },
      orderBy: { department: "asc" },
    }),
  ]);
  const departments = departmentsRaw
    .map((d: { department: string | null }) => d.department)
    .filter((d): d is string => !!d);

  // Combined Admin filters, used by the per-employee pagination.
  const adminFilterWhere: Record<string, unknown> = {
    ...adminScopeWhere,
    isActive: true,
  };
  if (teamFilter != null) adminFilterWhere.teamId = teamFilter;
  if (departmentFilter) adminFilterWhere.department = departmentFilter;
  if (q) {
    // Search name, email, free-form title AND position name: "soudeur" must
    // return the welders, not only matching names.
    adminFilterWhere.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
      { title: { contains: q, mode: "insensitive" } },
      { position: { name: { contains: q, mode: "insensitive" } } },
    ];
  }

  // Every entry of the period (scope-filtered) feeding the KPIs and overview.
  // Soft ceiling at 50000; the to-approve list paginates through
  // /api/admin/timeclock/entries instead. Carries NO status/team/department
  // filter so the overview KPIs cover the whole period.
  const ENTRIES_HARD_CAP = 50000;
  const allEntries = await prisma.timeClock.findMany({
    where: { ...timeClockScopeWhere, clockIn: { gte: periodFrom, lte: periodTo } },
    orderBy: { clockIn: "desc" },
    take: ENTRIES_HARD_CAP,
    include: {
      admin: {
        select: {
          id: true,
          fullName: true,
          email: true,
          title: true,
          department: true,
          teamId: true,
          position: { select: { name: true } },
          team: { select: { id: true, name: true, color: true } },
        },
      },
      approver: { select: { fullName: true, email: true } },
      jobCode: { select: { id: true, code: true, label: true } },
    },
  });

  // to-approve tab: team/department filtered in SQL; status (day-level) and
  // the name search stay in JS, over an already reduced dataset.
  const hasFilteredScope = teamFilter != null || departmentFilter != null;
  const filteredAdminWhere: Record<string, unknown> = {};
  if (teamFilter != null) filteredAdminWhere.teamId = teamFilter;
  if (departmentFilter) filteredAdminWhere.department = departmentFilter;
  const filteredEntries = hasFilteredScope
    ? await prisma.timeClock.findMany({
        where: {
          ...timeClockScopeWhere,
          clockIn: { gte: periodFrom, lte: periodTo },
          admin: filteredAdminWhere,
        },
        orderBy: { clockIn: "desc" },
        take: ENTRIES_HARD_CAP,
        include: {
          admin: {
            select: {
              id: true,
              fullName: true,
              email: true,
              title: true,
              department: true,
              teamId: true,
              position: { select: { name: true } },
              team: { select: { id: true, name: true, color: true } },
            },
          },
          approver: { select: { fullName: true, email: true } },
          jobCode: { select: { id: true, code: true, label: true } },
        },
      })
    : allEntries; // no active filter: reuse allEntries, no extra query

  // Pending edit requests. Same rule: a non-founder never sees their own.
  const editRequestsWhere: Record<string, unknown> = { status: "pending" };
  if (scope.isHr) {
    if (scope.excludeSelfId) editRequestsWhere.adminId = { not: scope.excludeSelfId };
  } else {
    editRequestsWhere.adminId = { in: scope.allowedAdminIds! };
  }
  const editRequests = await prisma.timeClockEditRequest.findMany({
    where: editRequestsWhere,
    orderBy: { createdAt: "desc" },
    take: 100,
    include: {
      admin: { select: { id: true, fullName: true, email: true } },
    },
  });

  // ── Holidays ──
  const holidaysMap = await getHolidaysInRange(periodFrom, periodTo);
  const holidaysJson: Record<string, { name: string; isPaid: boolean; type: string }> = {};
  for (const [k, v] of holidaysMap) holidaysJson[k] = v;

  // Global and per-team KPIs.
  const totalMin = allEntries.reduce(
    (s, e) => s + (e.clockOut ? (e.durationMin ?? 0) : 0),
    0,
  );
  // Count only entries actually submitted for review, never drafts.
  const toApproveCount = allEntries.filter((e) => e.submittedAt != null && e.approvedAt == null).length;
  const approvedCount = allEntries.filter((e) => e.approvedAt).length;
  const activeAdmins = new Set(allEntries.map((e) => e.adminId)).size;

  // Overtime + break compliance. Same rules as payroll: threshold from the
  // settings, holidays counted toward the week but never paid 1.5x.
  const tcConfig = await getTimeclockConfig();
  const isPaidHoliday = (d: Date) => holidaysMap.get(localDayKey(d))?.isPaid === true;
  const overtimeMin = overtimeMinutes(
    allEntries.map((e) => ({ clockIn: e.clockIn, durationMin: e.durationMin, category: e.category })),
    (d) => localDayKey(startOfWeek(d)),
    tcConfig.overtimeWeeklyMin,
    isPaidHoliday,
  );

  const byAdmin = new Map<
    number,
    Array<{ clockIn: Date; clockOut: Date | null; durationMin: number | null; category: string; totalBreakMin?: number; paidBreakMin?: number }>
  >();
  for (const e of allEntries) {
    if (!byAdmin.has(e.adminId)) byAdmin.set(e.adminId, []);
    byAdmin.get(e.adminId)!.push({
      clockIn: e.clockIn,
      clockOut: e.clockOut,
      durationMin: e.durationMin,
      category: e.category,
      totalBreakMin: e.totalBreakMin,
      paidBreakMin: e.paidBreakMin ?? 0,
    });
  }
  let compTotal = 0;
  let compOk = 0;
  for (const [, list] of byAdmin) {
    const checks = checkRangeBreakCompliance(list);
    for (const c of checks) {
      if (c.workMin > 0) {
        compTotal++;
        if (c.compliant) compOk++;
      }
    }
  }
  const complianceRate = compTotal > 0 ? Math.round((compOk / compTotal) * 100) : 100;

  const pendingRequests = editRequests.length;

  // Scoped employees with no entry today. Mon-Fri only, 0 on weekends.
  const todayDow = now.getDay(); // 0 dim .. 6 sam
  let forgottenTodayCount = 0;
  if (todayDow >= 1 && todayDow <= 5) {
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart); todayEnd.setDate(todayEnd.getDate() + 1);
    const [scopedActive, todayEntries] = await Promise.all([
      prisma.admin.count({ where: { ...adminScopeWhere, isActive: true } }),
      prisma.timeClock.findMany({
        where: { ...timeClockScopeWhere, clockIn: { gte: todayStart, lt: todayEnd } },
        select: { adminId: true },
        distinct: ["adminId"],
      }),
    ]);
    forgottenTodayCount = Math.max(0, scopedActive - todayEntries.length);
  }

  // Past working days (Mon-Fri, today excluded) with no entry, per employee.
  type ForgottenEmployee = {
    adminId: number;
    fullName: string | null;
    email: string;
    title: string | null;
    teamId: number | null;
    teamName: string | null;
    forgottenDays: string[]; // YYYY-MM-DD
  };
  const weekStart = startOfWeek(now);
  const weekEndExclusive = new Date(weekStart); weekEndExclusive.setDate(weekEndExclusive.getDate() + 7);
  // Past working days, Monday to yesterday.
  const workDaysBeforeToday: string[] = [];
  {
    const cursor = new Date(weekStart);
    const todayStart = new Date(now); todayStart.setHours(0, 0, 0, 0);
    while (cursor < todayStart) {
      const dow = cursor.getDay();
      if (dow >= 1 && dow <= 5) {
        const y = cursor.getFullYear();
        const m = String(cursor.getMonth() + 1).padStart(2, "0");
        const d = String(cursor.getDate()).padStart(2, "0");
        workDaysBeforeToday.push(`${y}-${m}-${d}`);
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  let forgottenThisWeekCount = 0;
  const employeesWithForgottenDays: ForgottenEmployee[] = [];
  if (workDaysBeforeToday.length > 0) {
    const [allActiveEmployees, weekEntriesForForgotten] = await Promise.all([
      prisma.admin.findMany({
        where: { ...adminScopeWhere, isActive: true },
        select: {
          id: true, fullName: true, email: true, title: true,
          teamId: true, team: { select: { name: true } },
        },
      }),
      prisma.timeClock.findMany({
        where: { ...timeClockScopeWhere, clockIn: { gte: weekStart, lt: weekEndExclusive } },
        select: { adminId: true, clockIn: true },
      }),
    ]);
    const daysByAdmin = new Map<number, Set<string>>();
    for (const e of weekEntriesForForgotten) {
      const d = new Date(e.clockIn);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      if (!daysByAdmin.has(e.adminId)) daysByAdmin.set(e.adminId, new Set());
      daysByAdmin.get(e.adminId)!.add(key);
    }
    for (const emp of allActiveEmployees) {
      const days = daysByAdmin.get(emp.id) ?? new Set<string>();
      const missing = workDaysBeforeToday.filter((d) => !days.has(d));
      if (missing.length > 0) {
        forgottenThisWeekCount += missing.length;
        employeesWithForgottenDays.push({
          adminId: emp.id,
          fullName: emp.fullName,
          email: emp.email,
          title: emp.title,
          teamId: emp.teamId,
          teamName: emp.team?.name ?? null,
          forgottenDays: missing,
        });
      }
    }
    employeesWithForgottenDays.sort((a, b) => b.forgottenDays.length - a.forgottenDays.length);
  }

  // Overview: per-team stats for HR, per-direct-report for a manager.
  type TeamStat = {
    teamId: number | null;
    teamName: string;
    teamColor: string | null;
    memberCount: number;
    totalMin: number;
    toApproveCount: number;
  };
  const teamStatsMap = new Map<number | null, TeamStat>();

  // Pre-seed so every scoped team shows up even with zero hours.
  const teamMembers = await prisma.admin.findMany({
    where: { ...adminScopeWhere, isActive: true },
    select: { id: true, teamId: true, team: { select: { id: true, name: true, color: true } } },
  });
  for (const m of teamMembers) {
    const key = m.teamId ?? null;
    if (!teamStatsMap.has(key)) {
      teamStatsMap.set(key, {
        teamId: m.teamId,
        teamName: m.team?.name ?? t("sans_equipe"),
        teamColor: m.team?.color ?? null,
        memberCount: 0,
        totalMin: 0,
        toApproveCount: 0,
      });
    }
    teamStatsMap.get(key)!.memberCount += 1;
  }
  for (const e of allEntries) {
    const key = e.admin?.teamId ?? null;
    if (!teamStatsMap.has(key)) continue;
    const stat = teamStatsMap.get(key)!;
    if (e.clockOut) stat.totalMin += e.durationMin ?? 0;
    if (e.submittedAt != null && e.approvedAt == null) stat.toApproveCount += 1;
  }
  const teamStats = Array.from(teamStatsMap.values()).sort((a, b) =>
    a.teamName.localeCompare(b.teamName),
  );

  // Tab 2: per employee, server-paginated.
  const totalEmployees = await prisma.admin.count({ where: adminFilterWhere });
  const employeesPaged = await prisma.admin.findMany({
    where: adminFilterWhere,
    orderBy: { fullName: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
    select: {
      id: true,
      fullName: true,
      email: true,
      title: true,
      department: true,
      teamId: true,
      team: { select: { id: true, name: true, color: true } },
      position: { select: { name: true } },
    },
  });

  // Minutes per paginated employee; absent from allEntries means 0.
  const byEmployeeAgg = new Map<number, { totalMin: number; toApprove: number; approved: number }>();
  for (const e of allEntries) {
    if (!byEmployeeAgg.has(e.adminId)) {
      byEmployeeAgg.set(e.adminId, { totalMin: 0, toApprove: 0, approved: 0 });
    }
    const a = byEmployeeAgg.get(e.adminId)!;
    if (e.clockOut) a.totalMin += e.durationMin ?? 0;
    if (e.submittedAt != null && e.approvedAt == null) a.toApprove += 1;
    if (e.approvedAt) a.approved += 1;
  }
  const byEmployeeItems = employeesPaged.map((emp) => {
    const agg = byEmployeeAgg.get(emp.id) ?? { totalMin: 0, toApprove: 0, approved: 0 };
    let status: "approved" | "pending" | "none" = "none";
    if (agg.toApprove > 0) status = "pending";
    else if (agg.approved > 0) status = "approved";
    return {
      id: emp.id,
      fullName: emp.fullName,
      email: emp.email,
      title: emp.title,
      department: emp.department,
      team: emp.team,
      position: emp.position,
      totalMin: agg.totalMin,
      toApprove: agg.toApprove,
      approved: agg.approved,
      status,
    };
  });

  // Tab 3: to approve, aggregated per (employee, day).
  // Server-side aggregation over filteredEntries (team/department already in SQL).
  // status (day-level) and the text search remain post-hoc.
  type DayAgg = {
    key: string;
    adminId: number;
    adminName: string;
    adminEmail: string;
    teamId: number | null;
    teamName: string | null;
    department: string | null;
    date: string;
    workMin: number;
    meetingMin: number;
    trainingMin: number;
    breakMin: number;
    leaveMin: number;
    totalMin: number;
    status: "approved" | "submitted" | "pending" | "rejected" | "mixed";
    hasPending: boolean;
    entries: typeof allEntries;
  };
  const dayAggMap = new Map<string, DayAgg>();
  const LEAVE_CATS = new Set(["vacation", "sick", "parental", "bereavement"]);
  for (const e of filteredEntries) {
    if (!e.clockOut) continue; // still running: not reviewable
    if (!e.admin) continue;
    const d = new Date(e.clockIn);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const key = `${e.adminId}-${date}`;
    let agg = dayAggMap.get(key);
    if (!agg) {
      agg = {
        key,
        adminId: e.adminId,
        adminName: e.admin.fullName || e.admin.email,
        adminEmail: e.admin.email,
        teamId: e.admin.teamId ?? null,
        teamName: e.admin.team?.name ?? null,
        department: e.admin.department ?? null,
        date,
        workMin: 0,
        meetingMin: 0,
        trainingMin: 0,
        breakMin: 0,
        leaveMin: 0,
        totalMin: 0,
        status: "pending",
        hasPending: false,
        entries: [],
      };
      dayAggMap.set(key, agg);
    }
    const dur = e.durationMin ?? 0;
    agg.totalMin += dur;
    if (e.category === "work") agg.workMin += dur;
    else if (e.category === "meeting") { agg.workMin += dur; agg.meetingMin += dur; }
    else if (e.category === "training") { agg.workMin += dur; agg.trainingMin += dur; }
    else if (e.category === "break") agg.breakMin += dur;
    else if (LEAVE_CATS.has(e.category)) agg.leaveMin += dur;
    agg.entries.push(e);
  }
  // Rejected = last TimeClockHistory event is "rejected", not resubmitted.
  const filteredEntryIds = filteredEntries.map((e) => e.id);
  const recentRejects = filteredEntryIds.length > 0
    ? await prisma.timeClockHistory.findMany({
        where: { timeClockId: { in: filteredEntryIds }, event: "rejected" },
        orderBy: { createdAt: "desc" },
        distinct: ["timeClockId"],
        select: { timeClockId: true, createdAt: true },
      })
    : [];
  const lastRejectByEntry = new Map<number, Date>();
  for (const r of recentRejects) lastRejectByEntry.set(r.timeClockId, r.createdAt);
  function isCurrentlyRejected(e: { id: number; submittedAt: Date | null; approvedAt: Date | null }): boolean {
    if (e.approvedAt) return false;
    if (e.submittedAt) return false; // resubmitted after the rejection
    const rejAt = lastRejectByEntry.get(e.id);
    return rejAt != null;
  }

  for (const agg of dayAggMap.values()) {
    const states = agg.entries.map((e) => {
      if (isCurrentlyRejected(e)) return "rejected" as const;
      if (e.approvedAt) return "approved" as const;
      if (e.submittedAt) return "submitted" as const;
      return "pending" as const;
    });
    const unique = new Set(states);
    if (unique.size === 1) agg.status = states[0];
    else agg.status = "mixed";
    agg.hasPending = agg.entries.some((e) => !e.approvedAt);
    agg.entries.sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
  }
  let allDayAggs = Array.from(dayAggMap.values());
  // to-approve filters (team/department already applied in SQL)
  if (q) {
    const ql = q.toLowerCase();
    allDayAggs = allDayAggs.filter(
      (a) => a.adminName.toLowerCase().includes(ql) || a.adminEmail.toLowerCase().includes(ql),
    );
  }
  if (statusFilter !== "all") {
    if (statusFilter === "submitted") allDayAggs = allDayAggs.filter((a) => a.status === "submitted");
    else if (statusFilter === "pending") allDayAggs = allDayAggs.filter((a) => a.status === "pending");
    else if (statusFilter === "approved") allDayAggs = allDayAggs.filter((a) => a.status === "approved");
    else if (statusFilter === "rejected") allDayAggs = allDayAggs.filter((a) => a.status === "rejected");
  }
  allDayAggs.sort((a, b) => {
    if (a.date !== b.date) return b.date.localeCompare(a.date);
    return a.adminName.localeCompare(b.adminName);
  });
  const totalDayAggs = allDayAggs.length;
  const startIdx = (page - 1) * pageSize;
  const dayAggsPaged = allDayAggs.slice(startIdx, startIdx + pageSize);

  // Either query hitting its cap means the aggregate is truncated.
  const reachedEntryCap = allEntries.length >= 5000 || filteredEntries.length >= 5000;

  // Approval queue: one line per decision waiting on the reviewer.
  // One line per employee AWAITING A DECISION (submitted, unapproved) on the
  // selected period. Unpaginated on purpose: the queue only contains people
  // requiring action, which stays small even with 100+ employees.
  const SUBMITTABLE = new Set(["work", "meeting", "training"]);
  type QueueRow = {
    adminId: number;
    name: string;
    email: string;
    teamName: string | null;
    pendingIds: number[];
    pendingMin: number;
    days: number;
    weekTotalMin: number; // all closed work minutes (for the overtime badge)
  };
  const queueMap = new Map<number, QueueRow & { daySet: Set<string> }>();
  const draftMap = new Map<number, { adminId: number; name: string; email: string; draftCount: number }>();
  const weekTotals = new Map<number, number>();
  for (const e of filteredEntries) {
    if (!e.clockOut || !e.admin) continue;
    const dur = e.durationMin ?? 0;
    if (SUBMITTABLE.has(e.category)) {
      weekTotals.set(e.adminId, (weekTotals.get(e.adminId) ?? 0) + dur);
    }
    if (e.submittedAt && !e.approvedAt) {
      let row = queueMap.get(e.adminId);
      if (!row) {
        row = {
          adminId: e.adminId,
          name: e.admin.fullName || e.admin.email,
          email: e.admin.email,
          teamName: e.admin.team?.name ?? null,
          pendingIds: [],
          pendingMin: 0,
          days: 0,
          weekTotalMin: 0,
          daySet: new Set<string>(),
        };
        queueMap.set(e.adminId, row);
      }
      row.pendingIds.push(e.id);
      if (SUBMITTABLE.has(e.category)) row.pendingMin += dur;
      const d = new Date(e.clockIn);
      row.daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    } else if (!e.submittedAt && !e.approvedAt && SUBMITTABLE.has(e.category)) {
      // Draft awaiting employee submission
      let dr = draftMap.get(e.adminId);
      if (!dr) {
        dr = { adminId: e.adminId, name: e.admin.fullName || e.admin.email, email: e.admin.email, draftCount: 0 };
        draftMap.set(e.adminId, dr);
      }
      dr.draftCount++;
    }
  }
  const approveQueueRows: QueueRow[] = Array.from(queueMap.values())
    .map(({ daySet, ...row }) => ({ ...row, days: daySet.size, weekTotalMin: weekTotals.get(row.adminId) ?? 0 }))
    .sort((a, b) => a.name.localeCompare(b.name));
  // "Awaiting submission": drafts, excluding people already in the queue
  // (mixed states stay in the queue — their drafts follow later).
  const awaitingSubmission = Array.from(draftMap.values())
    .filter((d) => !queueMap.has(d.adminId))
    .sort((a, b) => a.name.localeCompare(b.name));
  // "Up to date": have entries in the period, nothing pending, nothing draft.
  const seenAdmins = new Map<number, { name: string; email: string }>();
  for (const e of filteredEntries) {
    if (e.admin && !seenAdmins.has(e.adminId)) {
      seenAdmins.set(e.adminId, { name: e.admin.fullName || e.admin.email, email: e.admin.email });
    }
  }
  const upToDate = Array.from(seenAdmins.entries())
    .filter(([id]) => !queueMap.has(id) && !draftMap.has(id))
    .map(([id, v]) => ({ adminId: id, ...v }))
    .sort((a, b) => a.name.localeCompare(b.name));

  // Past weeks with submitted-unapproved hours BEFORE the selected period —
  // the classic "forgotten week" failure. Cheap count + distinct week count.
  const pastPendingEntries = await prisma.timeClock.findMany({
    where: {
      ...timeClockScopeWhere,
      clockIn: { lt: periodFrom },
      submittedAt: { not: null },
      approvedAt: null,
      payStubId: null,
    },
    select: { clockIn: true },
    take: 500,
  });
  const pastWeekSet = new Set<string>();
  let pastLatestWs: Date | null = null;
  for (const e of pastPendingEntries) {
    const ws = startOfWeek(e.clockIn);
    pastWeekSet.add(ws.toISOString().slice(0, 10));
    if (!pastLatestWs || ws > pastLatestWs) pastLatestWs = ws;
  }
  // Local YYYY-MM-DD (toISOString would shift the day across timezones)
  const pastPendingLatestWeek = pastLatestWs
    ? `${pastLatestWs.getFullYear()}-${String(pastLatestWs.getMonth() + 1).padStart(2, "0")}-${String(pastLatestWs.getDate()).padStart(2, "0")}`
    : null;
  const approveQueue = {
    rows: approveQueueRows,
    awaitingSubmission,
    upToDate,
    pastPendingCount: pastPendingEntries.length,
    pastPendingWeeks: pastWeekSet.size,
    pastPendingLatestWeek,
  };

  return (
    <TimeclockView
      scope={{
        isHr: scope.isHr,
        isFounder: scope.isFounder,
        allowedAdminCount: scope.isHr ? null : (scope.allowedAdminIds?.length ?? 0),
        myTeams: scope.myTeams,
      }}
      currentAdminId={adminId}
      periodFrom={periodFrom.toISOString()}
      periodTo={periodTo.toISOString()}
      holidays={holidaysJson}
      teams={allTeamsForFilter.map((t) => ({ id: t.id, name: t.name, color: t.color ?? null }))}
      departments={departments}
      editRequests={JSON.parse(JSON.stringify(editRequests))}
      teamStats={teamStats}
      adminKpis={{
        totalMin,
        toApproveCount,
        approvedCount,
        activeAdmins,
        overtimeMin,
        overtimeWeeklyMin: tcConfig.overtimeWeeklyMin,
        complianceRate,
        pendingRequests,
        forgottenTodayCount,
        forgottenThisWeekCount,
      }}
      employeesWithForgottenDays={employeesWithForgottenDays}
      approveQueue={approveQueue}
      tab={tab}
      page={page}
      pageSize={pageSize}
      q={q}
      teamFilter={teamFilter}
      departmentFilter={departmentFilter}
      statusFilter={statusFilter}
      overview={{
        totalMin,
        toApproveCount,
        approvedCount,
        activeAdmins,
        teamStats,
      }}
      byEmployee={{ items: byEmployeeItems, total: totalEmployees }}
      toApprove={{ items: JSON.parse(JSON.stringify(dayAggsPaged)), total: totalDayAggs }}
      reachedEntryCap={reachedEntryCap}
    />
  );
}

import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimeclockView } from "./timeclock-view";
import { getHolidaysInRange } from "@/lib/services/holidays";
import { calculateOvertimeForEntries } from "@/lib/services/overtime";
import { checkRangeBreakCompliance } from "@/lib/services/break-compliance";
import { getTimesheetScope as getSharedTimesheetScope } from "@/lib/services/timesheet-scope";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employés — Pointage" };

function startOfWeekMonday(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  const day = n.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  n.setDate(n.getDate() + diff);
  return n;
}

// ─────────────────────────────────────────────────────────────
// Scope hierarchique extrait dans src/lib/services/timesheet-scope.ts
// pour etre reutilise par l'export CSV et tout endpoint admin.
// ─────────────────────────────────────────────────────────────

// Helpers pour parser searchParams
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
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const sp = await searchParams;
  // Utilise le service partage (meme logique reutilisee par l'export CSV).
  const scope = await getSharedTimesheetScope(adminId);

  // Periode : defaut = semaine en cours (lundi -> aujourd'hui)
  const now = new Date();
  const defaultFrom = startOfWeekMonday(now);
  const from = sp.from ? new Date(sp.from) : defaultFrom;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : now;
  const periodFrom = !isNaN(from.getTime()) ? from : defaultFrom;
  const periodTo = !isNaN(to.getTime()) ? to : now;

  // Filtres URL
  const tab = parseTab(sp.tab);
  const page = parseIntParam(sp.page, 1, 1, 9999);
  const pageSize = parseIntParam(sp.pageSize, tab === "to-approve" ? 50 : 25, 5, 200);
  const q = (sp.q ?? "").trim();
  const teamFilter = sp.team ? parseInt(sp.team, 10) : null;
  const departmentFilter = sp.department ?? null;
  const statusFilter = parseStatus(sp.status);

  // Si le manager n'a personne dans son scope, on affiche un état "vide propre"
  // sans charger de queries.
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
        openEntries={[]}
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
        employeesWithForgottenDays={[]}
      />
    );
  }

  // ── Filtre Prisma : whereAdmin pour la table Admin, whereTimeClock pour les entrées ──
  // Regle metier : un user (non-fondateur) ne voit jamais ses propres heures dans sa file
  // de revue. excludeSelfId est applique aux deux scopes (HR ou manager).
  const adminScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { id: { not: scope.excludeSelfId } } : {})
    : { id: { in: scope.allowedAdminIds! } };
  const timeClockScopeWhere: Record<string, unknown> = scope.isHr
    ? (scope.excludeSelfId ? { adminId: { not: scope.excludeSelfId } } : {})
    : { adminId: { in: scope.allowedAdminIds! } };

  // ── Récupérer la liste des équipes et départements pour les filtres ──
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

  // ── Filtres composés sur les Admin (pour la pagination employee) ──
  const adminFilterWhere: Record<string, unknown> = {
    ...adminScopeWhere,
    isActive: true,
  };
  if (teamFilter != null) adminFilterWhere.teamId = teamFilter;
  if (departmentFilter) adminFilterWhere.department = departmentFilter;
  if (q) {
    adminFilterWhere.OR = [
      { fullName: { contains: q, mode: "insensitive" } },
      { email: { contains: q, mode: "insensitive" } },
    ];
  }

  // ── Récupérer tous les entries de la période (scope filtré) pour KPI/overview ──
  // Plafond souple à 50000 (cap dur de securite, ne devrait jamais etre atteint
  // sur 1 mois). Pour la pagination en mode "liste" de la table to-approve,
  // utiliser l'endpoint /api/admin/timeclock/entries (cursor-based).
  // NOTE: `allEntries` ne porte volontairement PAS les filtres status/team/department,
  // afin que les KPIs Overview (totalMin, teamStats, byEmployeeAgg) reflètent la vraie
  // période entière indépendamment des filtres choisis dans l'onglet to-approve.
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

  // ── P2-12 : Query séparée filtrée en SQL pour l'onglet to-approve ──
  // Pousse team/department en SQL pour scaler à 100+ employés sans charger 5000 entries
  // quand on ne s'intéresse qu'à une seule équipe ou un seul département. Les filtres
  // status (sémantique d'agrégat jour) et q (recherche texte sur nom) restent
  // post-hoc en JS, mais sur un dataset déjà réduit côté DB.
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
    : allEntries; // pas de filtre actif → on réutilise allEntries (0 query supplémentaire)

  // ── Pointages ouverts (force-close) ──
  const openEntries = await prisma.timeClock.findMany({
    where: { ...timeClockScopeWhere, clockOut: null },
    orderBy: { clockIn: "asc" },
    take: 100,
    include: {
      admin: { select: { id: true, fullName: true, email: true } },
    },
  });

  // ── Demandes de modification en attente ──
  // Meme filtre : un manager/HR non-fondateur ne voit pas ses propres demandes ici.
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

  // ── KPIs globaux et par équipe ──
  const totalMin = allEntries.reduce(
    (s, e) => s + (e.clockOut ? (e.durationMin ?? 0) : 0),
    0,
  );
  // KPI : on ne compte QUE les entries effectivement soumises pour validation,
  // pas les brouillons que l'employe n'a pas encore envoyes.
  const toApproveCount = allEntries.filter((e) => e.submittedAt != null && e.approvedAt == null).length;
  const approvedCount = allEntries.filter((e) => e.approvedAt).length;
  const activeAdmins = new Set(allEntries.map((e) => e.adminId)).size;

  // Overtime + conformité pauses
  const overtimeWeeks = calculateOvertimeForEntries(
    allEntries.map((e) => ({
      clockIn: e.clockIn,
      durationMin: e.durationMin,
      category: e.category,
    })),
  );
  const overtimeMin = overtimeWeeks.reduce((s, w) => s + w.overtimeMin, 0);

  const byAdmin = new Map<
    number,
    Array<{ clockIn: Date; clockOut: Date | null; durationMin: number | null; category: string }>
  >();
  for (const e of allEntries) {
    if (!byAdmin.has(e.adminId)) byAdmin.set(e.adminId, []);
    byAdmin
      .get(e.adminId)!
      .push({ clockIn: e.clockIn, clockOut: e.clockOut, durationMin: e.durationMin, category: e.category });
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

  // Note : ancien KPI "forgottenCount" (pointages en cours depuis >12h) retiré
  // car non affiché côté UI — remplacé par forgottenTodayCount/forgottenThisWeekCount
  // qui sont visibles dans les KPIs et la section "En retard".
  const pendingRequests = editRequests.length;

  // ── KPI "Oublis aujourd'hui" ──────────────────────────────────
  // Nombre d'employés du scope qui n'ont AUCUNE entry pour la journée courante.
  // Restreint aux jours ouvrés (lundi-vendredi) ; le weekend, on retourne 0.
  // Utile pour identifier au coup d'œil les oublis du jour.
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

  // ── KPI "Pointages oubliés cette semaine" + detail par employe ──
  // Boucle sur tous les employes actifs du scope, calcule pour chacun la liste
  // des jours ouvres (lundi-vendredi) deja passes (jour courant exclu pour
  // eviter d'alerter avant la fin de journee) sans aucune entry.
  // Utilise pour : (1) KPI global semaine, (2) section "En retard" dans l'onglet
  // A approuver, (3) bouton "Signaler" -> notification a l'employe.
  type ForgottenEmployee = {
    adminId: number;
    fullName: string | null;
    email: string;
    title: string | null;
    teamId: number | null;
    teamName: string | null;
    forgottenDays: string[]; // YYYY-MM-DD
  };
  const weekStart = startOfWeekMonday(now);
  const weekEndExclusive = new Date(weekStart); weekEndExclusive.setDate(weekEndExclusive.getDate() + 7);
  // Liste des jours ouvres passes (lundi a hier ; aujourd'hui exclu)
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
    // Index : adminId -> set(YYYY-MM-DD)
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
    // Trier par plus d'oublis en premier (priorite visuelle)
    employeesWithForgottenDays.sort((a, b) => b.forgottenDays.length - a.forgottenDays.length);
  }

  // ── Vue d'ensemble : stats par équipe (HR) ou par employé direct (manager) ──
  type TeamStat = {
    teamId: number | null;
    teamName: string;
    teamColor: string | null;
    memberCount: number;
    totalMin: number;
    toApproveCount: number;
  };
  const teamStatsMap = new Map<number | null, TeamStat>();

  // Préinitialiser : on veut toutes les équipes scopées même si 0 heures
  const teamMembers = await prisma.admin.findMany({
    where: { ...adminScopeWhere, isActive: true },
    select: { id: true, teamId: true, team: { select: { id: true, name: true, color: true } } },
  });
  for (const m of teamMembers) {
    const key = m.teamId ?? null;
    if (!teamStatsMap.has(key)) {
      teamStatsMap.set(key, {
        teamId: m.teamId,
        teamName: m.team?.name ?? "Sans équipe",
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

  // ── Onglet 2 : Par employé (paginé serveur) ──
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

  // Pour chaque employé paginé, agréger ses minutes sur la période depuis allEntries.
  // Si l'employé n'a aucun entry dans allEntries, totalMin = 0.
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

  // ── Onglet 3 : À approuver (agrégation par (employé, jour)) ──
  // Aggregation côté serveur depuis filteredEntries (team/department déjà appliqués en SQL).
  // Les filtres status (sémantique d'agrégat jour) et q (recherche texte) restent post-hoc.
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
    if (!e.clockOut) continue; // pas dans la file de revue
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
  // ── Detection rejet : on regarde TimeClockHistory pour identifier les entries
  // dont le DERNIER évènement est "rejected" et qui n'ont pas été re-soumises.
  // Cela remplace l'ancienne détection via le préfixe [REJET dans les notes.
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
    if (e.submittedAt) return false; // re-soumis après rejet
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
  // Filtres pour l'onglet to-approve (team/department déjà appliqués en SQL via filteredEntries)
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

  // Si le plafond du take est atteint sur l'une des deux queries, l'agregat est
  // tronque -> on alerte l'UI.
  const reachedEntryCap = allEntries.length >= 5000 || filteredEntries.length >= 5000;

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
      openEntries={JSON.parse(JSON.stringify(openEntries))}
      teamStats={teamStats}
      adminKpis={{
        totalMin,
        toApproveCount,
        approvedCount,
        activeAdmins,
        overtimeMin,
        complianceRate,
        pendingRequests,
        forgottenTodayCount,
        forgottenThisWeekCount,
      }}
      employeesWithForgottenDays={employeesWithForgottenDays}
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

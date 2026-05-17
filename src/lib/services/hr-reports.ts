// Service · agregation des donnees du rapport RH.
// Reutilisable entre la page Server Component /admin/employes/rapports et
// les routes API d'export (PDF / CSV). Toutes les valeurs sont calculees
// pour les 12 derniers mois glissants.
import "server-only";
import { prisma } from "@/lib/prisma";

export type HrBreakdownRow = { name: string; count: number; pct: number };

export type HrReportData = {
  generatedAt: Date;
  periodLabel: string;
  headcountActive: number;
  headcountInactive: number;
  hiresLast12Months: number;
  departuresLast12Months: number;
  turnoverPct: number;
  avgTenureYears: number;
  positionsBreakdown: HrBreakdownRow[];
  teamsBreakdown: HrBreakdownRow[];
  pendingLeaves: number;
  approvedLeavesThisMonth: number;
  openCnesstCases: number;
  upcomingAnniversaries: number;
};

export async function getHrReportData(): Promise<HrReportData> {
  const today = new Date();
  const yearAgo = new Date(today.getFullYear() - 1, today.getMonth(), today.getDate());
  const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  const next30Days = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 30);

  const [
    headcountActive,
    headcountInactive,
    hiresLast12Months,
    departuresLast12Months,
    activeAdmins,
    positionsRaw,
    teamsRaw,
    pendingLeaves,
    approvedLeavesThisMonth,
    openCnesstCases,
  ] = await Promise.all([
    prisma.admin.count({ where: { isActive: true } }),
    prisma.admin.count({ where: { isActive: false } }),
    prisma.admin.count({ where: { startDate: { gte: yearAgo } } }),
    prisma.admin.count({ where: { isActive: false, endDate: { gte: yearAgo } } }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: {
        id: true,
        startDate: true,
        birthdate: true,
        position: { select: { name: true } },
        team: { select: { name: true } },
        department: true,
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true, positionId: { not: null } },
      select: { position: { select: { name: true } } },
    }),
    prisma.admin.findMany({
      where: { isActive: true, teamId: { not: null } },
      select: { team: { select: { name: true } } },
    }),
    prisma.leaveRequest.count({ where: { status: "pending" } }),
    prisma.leaveRequest.count({
      where: {
        status: "approved",
        startDate: { gte: startOfMonth, lt: endOfMonth },
      },
    }),
    prisma.cnesstIncident.count({
      where: { status: { in: ["declared", "accepted"] } },
    }),
  ]);

  // Turnover : (departs / effectif moyen) * 100
  const avgHeadcount = (headcountActive + (headcountActive + departuresLast12Months)) / 2;
  const turnoverPct = avgHeadcount > 0
    ? Number(((departuresLast12Months / avgHeadcount) * 100).toFixed(1))
    : 0;

  // Anciennete moyenne (annees) — base sur startDate des actifs
  const now = today.getTime();
  const tenuresMs = activeAdmins
    .filter((a) => a.startDate)
    .map((a) => now - new Date(a.startDate!).getTime());
  const avgTenureYears = tenuresMs.length > 0
    ? Number(((tenuresMs.reduce((s, n) => s + n, 0) / tenuresMs.length) / (365.25 * 24 * 3600 * 1000)).toFixed(1))
    : 0;

  // Repartition postes (top 10) — fallback sur "Non assigne"
  const posMap = new Map<string, number>();
  for (const a of positionsRaw) {
    const name = a.position?.name ?? "Non assigne";
    posMap.set(name, (posMap.get(name) ?? 0) + 1);
  }
  const positionsBreakdown: HrBreakdownRow[] = Array.from(posMap.entries())
    .map(([name, count]) => ({
      name,
      count,
      pct: headcountActive > 0 ? Math.round((count / headcountActive) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Repartition equipes (top 10)
  const teamMap = new Map<string, number>();
  for (const a of teamsRaw) {
    const name = a.team?.name ?? "Non assigne";
    teamMap.set(name, (teamMap.get(name) ?? 0) + 1);
  }
  const teamsBreakdown: HrBreakdownRow[] = Array.from(teamMap.entries())
    .map(([name, count]) => ({
      name,
      count,
      pct: headcountActive > 0 ? Math.round((count / headcountActive) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // Anniversaires a venir (30 prochains jours) — base sur birthdate OU startDate
  let upcomingAnniversaries = 0;
  for (const a of activeAdmins) {
    const ref = a.birthdate ?? a.startDate;
    if (!ref) continue;
    const d = new Date(ref);
    const thisYear = new Date(today.getFullYear(), d.getMonth(), d.getDate());
    const nextYear = new Date(today.getFullYear() + 1, d.getMonth(), d.getDate());
    if ((thisYear >= today && thisYear <= next30Days) ||
        (nextYear >= today && nextYear <= next30Days)) {
      upcomingAnniversaries++;
    }
  }

  return {
    generatedAt: today,
    periodLabel: "12 derniers mois",
    headcountActive,
    headcountInactive,
    hiresLast12Months,
    departuresLast12Months,
    turnoverPct,
    avgTenureYears,
    positionsBreakdown,
    teamsBreakdown,
    pendingLeaves,
    approvedLeavesThisMonth,
    openCnesstCases,
    upcomingAnniversaries,
  };
}

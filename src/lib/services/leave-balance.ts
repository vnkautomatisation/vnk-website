import "server-only";
// Service de calcul des soldes de congés (vacances, maladie, personnel).
// Conforme aux regles CNESST :
//   - Periode de reference : 1er mai N -> 30 avril N+1 (configurable via LeavePolicy)
//   - Accumulation : 4% du temps travaille avant 3 ans, 6% apres 3 ans (= 2 ou 3 sem)
//   - Carry-over : configurable par politique (jours max + duree mois)
//   - Quotas : maladie/personnel via LeavePolicy.sickDaysPerYear / personalDaysPerYear
//
// Si la migration Prisma n'a pas encore ete poussee (champs LeavePolicy /
// LeaveBalance absents), le service retombe sur l'ancienne logique calculee a la
// volee depuis LeaveRequest. Cela permet d'avoir un comportement raisonnable
// pendant la transition.
import { prisma } from "@/lib/prisma";

export type LeaveBalanceLite = {
  vacationDaysTotal: number;
  vacationDaysTaken: number;
  vacationDaysPlanned: number;
  vacationDaysRemaining: number;
  sickDaysTaken: number;
  // V2 (CNESST)
  accruedDays?: number;
  carriedOverDays?: number;
  policyName?: string;
};

// Periode de reference CNESST : 1er mai N -> 30 avril N+1.
// Si date < 1er mai, on prend l'annee precedente comme debut.
export function getCurrentReferencePeriod(date: Date = new Date(), monthStart = 5): { start: Date; end: Date } {
  const year = date.getMonth() + 1 >= monthStart ? date.getFullYear() : date.getFullYear() - 1;
  const start = new Date(year, monthStart - 1, 1);
  const end = new Date(year + 1, monthStart - 1, 0, 23, 59, 59);
  return { start, end };
}

// Tenure en annees a une date donnee
function tenureYears(hireDate: Date | null, at: Date = new Date()): number {
  if (!hireDate) return 0;
  return Math.floor((at.getTime() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000));
}

// Charge la politique applicable (default si pas assignee). null si pas de politique en base.
async function getPolicyFor(adminId: number): Promise<{
  id: number;
  referenceMonthStart: number;
  accrualRateBelow3y: number;
  accrualRateAbove3y: number;
  vacationNoticeDays: number;
  carryOverDays: number;
  carryOverMonths: number;
  sickDaysPerYear: number | null;
  personalDaysPerYear: number | null;
  name: string;
} | null> {
  try {
    const me = await prisma.admin.findUnique({ where: { id: adminId } });
    const policyId = (me as unknown as { leavePolicyId?: number | null } | null)?.leavePolicyId ?? null;
    if (policyId) {
      const row = await (prisma as unknown as { leavePolicy: { findUnique: (args: { where: { id: number } }) => Promise<unknown> } })
        .leavePolicy.findUnique({ where: { id: policyId } });
      if (row) return normalizePolicy(row);
    }
    const def = await (prisma as unknown as { leavePolicy: { findFirst: (args: { where: { isDefault: boolean } }) => Promise<unknown> } })
      .leavePolicy.findFirst({ where: { isDefault: true } });
    if (def) return normalizePolicy(def);
  } catch {
    // table absente -> retour null, le caller utilisera le fallback legacy
  }
  return null;
}

function normalizePolicy(row: unknown): {
  id: number;
  referenceMonthStart: number;
  accrualRateBelow3y: number;
  accrualRateAbove3y: number;
  vacationNoticeDays: number;
  carryOverDays: number;
  carryOverMonths: number;
  sickDaysPerYear: number | null;
  personalDaysPerYear: number | null;
  name: string;
} {
  const r = row as Record<string, unknown>;
  return {
    id: Number(r.id ?? 0),
    referenceMonthStart: Number(r.referenceMonthStart ?? r.reference_month_start ?? 5),
    accrualRateBelow3y: Number(r.accrualRateBelow3y ?? r.accrual_rate_below_3y ?? 4),
    accrualRateAbove3y: Number(r.accrualRateAbove3y ?? r.accrual_rate_above_3y ?? 6),
    vacationNoticeDays: Number(r.vacationNoticeDays ?? r.vacation_notice_days ?? 7),
    carryOverDays: Number(r.carryOverDays ?? r.carry_over_days ?? 0),
    carryOverMonths: Number(r.carryOverMonths ?? r.carry_over_months ?? 12),
    sickDaysPerYear: r.sickDaysPerYear != null ? Number(r.sickDaysPerYear) : (r.sick_days_per_year != null ? Number(r.sick_days_per_year) : null),
    personalDaysPerYear: r.personalDaysPerYear != null ? Number(r.personalDaysPerYear) : (r.personal_days_per_year != null ? Number(r.personal_days_per_year) : null),
    name: String(r.name ?? "Defaut"),
  };
}

async function loadBalanceRow(adminId: number, type: string, periodStart: Date): Promise<{
  id: number;
  accruedDays: number;
  takenDays: number;
  plannedDays: number;
  carriedOverDays: number;
  quotaDays: number | null;
} | null> {
  try {
    const row = await (prisma as unknown as { leaveBalance: { findFirst: (args: unknown) => Promise<unknown> } })
      .leaveBalance.findFirst({
        where: { adminId, type, periodStart },
      });
    if (!row) return null;
    const r = row as Record<string, unknown>;
    return {
      id: Number(r.id),
      accruedDays: Number(r.accruedDays ?? 0),
      takenDays: Number(r.takenDays ?? 0),
      plannedDays: Number(r.plannedDays ?? 0),
      carriedOverDays: Number(r.carriedOverDays ?? 0),
      quotaDays: r.quotaDays != null ? Number(r.quotaDays) : null,
    };
  } catch {
    return null;
  }
}

// Garantit l'existence d'un row LeaveBalance pour adminId/type/period. Cree si absent.
export async function getOrCreateBalance(adminId: number, type: string, periodStart: Date, periodEnd: Date, quotaDays: number | null = null): Promise<{ id: number } | null> {
  try {
    const existing = await loadBalanceRow(adminId, type, periodStart);
    if (existing) return { id: existing.id };
    const created = await (prisma as unknown as { leaveBalance: { create: (args: { data: Record<string, unknown> }) => Promise<{ id: number }> } })
      .leaveBalance.create({
        data: {
          adminId,
          type,
          periodStart,
          periodEnd,
          accruedDays: 0,
          takenDays: 0,
          plannedDays: 0,
          carriedOverDays: 0,
          quotaDays,
        },
      });
    return { id: created.id };
  } catch {
    return null;
  }
}

// Calcule l'accumulation pour une semaine donnee + cree l'entree LeaveAccrual.
// Appele par le cron hebdomadaire. Idempotent par (adminId, weekStart, balanceId).
export async function accrueWeek(adminId: number, weekStart: Date, hoursWorked: number): Promise<{ accruedDays: number } | null> {
  try {
    const me = await prisma.admin.findUnique({ where: { id: adminId }, select: { startDate: true, createdAt: true } });
    if (!me) return null;
    const tenure = tenureYears(me.startDate ?? me.createdAt, weekStart);
    const policy = await getPolicyFor(adminId);
    const rate = (tenure >= 3 ? (policy?.accrualRateAbove3y ?? 6) : (policy?.accrualRateBelow3y ?? 4)) / 100;

    // 1 jour CNESST = 8h equivalent, le pourcentage s'applique sur le temps travaille
    const accruedHours = hoursWorked * rate;
    const accruedDays = accruedHours / 8;

    const period = getCurrentReferencePeriod(weekStart, policy?.referenceMonthStart ?? 5);
    const bal = await getOrCreateBalance(adminId, "vacation", period.start, period.end);
    if (!bal) return null;

    await (prisma as unknown as { leaveAccrual: { upsert: (args: unknown) => Promise<unknown> } })
      .leaveAccrual.upsert({
        where: { adminId_weekStart_balanceId: { adminId, weekStart, balanceId: bal.id } },
        update: { hoursWorked, accruedDays },
        create: { adminId, weekStart, balanceId: bal.id, hoursWorked, accruedDays },
      });

    // Recalcule total accruedDays sur le balance
    const accruals = await (prisma as unknown as { leaveAccrual: { findMany: (args: unknown) => Promise<{ accruedDays: number }[]> } })
      .leaveAccrual.findMany({ where: { balanceId: bal.id } });
    const totalAccrued = accruals.reduce((sum, a) => sum + Number(a.accruedDays), 0);
    await (prisma as unknown as { leaveBalance: { update: (args: unknown) => Promise<unknown> } })
      .leaveBalance.update({ where: { id: bal.id }, data: { accruedDays: totalAccrued } });
    return { accruedDays };
  } catch {
    return null;
  }
}

// Synchronise plannedDays / takenDays d'un LeaveBalance suite a un evenement sur LeaveRequest.
// Appele depuis hr-leaves.ts apres create/update/review/cancel.
export async function syncBalanceForRequest(
  adminId: number,
  type: string,
  request: { id: number; daysCount: number; status: string },
  event: "create" | "update" | "review" | "cancel",
  previousDays?: number,
): Promise<void> {
  try {
    const policy = await getPolicyFor(adminId);
    const period = getCurrentReferencePeriod(new Date(), policy?.referenceMonthStart ?? 5);
    const bal = await getOrCreateBalance(adminId, type, period.start, period.end);
    if (!bal) return;

    // Recalcule full : on agrege toutes les demandes vacation de la periode courante
    const reqs = await prisma.leaveRequest.findMany({
      where: {
        adminId,
        type,
        startDate: { lte: period.end },
        endDate: { gte: period.start },
        status: { in: ["pending", "approved"] },
      },
      select: { status: true, daysCount: true, endDate: true },
    });
    const now = new Date();
    let taken = 0;
    let planned = 0;
    for (const r of reqs) {
      const d = Number(r.daysCount);
      if (r.status === "approved" && r.endDate < now) taken += d;
      else if (r.status === "approved") planned += d;
      else if (r.status === "pending") planned += d;
    }
    await (prisma as unknown as { leaveBalance: { update: (args: unknown) => Promise<unknown> } })
      .leaveBalance.update({ where: { id: bal.id }, data: { takenDays: taken, plannedDays: planned } });
  } catch {
    // Pas grave si le balance n'existe pas encore
  }
  // Supprime les warnings non-used
  void event;
  void previousDays;
  void request;
}

export async function getLeaveBalance(adminId: number, type: "vacation" | "sick" | "personal" = "vacation"): Promise<LeaveBalanceLite> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { startDate: true, createdAt: true },
  });
  if (!admin) {
    return {
      vacationDaysTotal: 0, vacationDaysTaken: 0, vacationDaysPlanned: 0, vacationDaysRemaining: 0, sickDaysTaken: 0,
    };
  }

  const policy = await getPolicyFor(adminId);
  const tenure = tenureYears(admin.startDate ?? admin.createdAt);
  const period = getCurrentReferencePeriod(new Date(), policy?.referenceMonthStart ?? 5);

  // Tentative V2 : LeaveBalance existe ?
  const balRow = await loadBalanceRow(adminId, type, period.start);
  if (balRow) {
    const accrued = balRow.accruedDays + balRow.carriedOverDays;
    const remaining = Math.max(0, accrued - balRow.takenDays - balRow.plannedDays);
    return {
      vacationDaysTotal: Math.round(accrued * 100) / 100,
      vacationDaysTaken: Math.round(balRow.takenDays * 100) / 100,
      vacationDaysPlanned: Math.round(balRow.plannedDays * 100) / 100,
      vacationDaysRemaining: Math.round(remaining * 100) / 100,
      sickDaysTaken: 0, // TODO : enrichir avec le balance "sick" si demande
      accruedDays: Math.round(balRow.accruedDays * 100) / 100,
      carriedOverDays: Math.round(balRow.carriedOverDays * 100) / 100,
      policyName: policy?.name,
    };
  }

  // Fallback legacy : calcul a la volee depuis LeaveRequest
  const yearStart = new Date(period.start);
  const yearEnd = new Date(period.end);
  const vacationDaysTotal = tenure >= 3 ? 15 : 10;

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      adminId,
      status: { in: ["approved", "pending"] },
      startDate: { gte: yearStart, lte: yearEnd },
    },
    select: { type: true, status: true, daysCount: true, endDate: true },
  });

  const now = new Date();
  let vacationDaysTaken = 0;
  let vacationDaysPlanned = 0;
  let sickDaysTaken = 0;
  for (const l of leaves) {
    const days = Number(l.daysCount);
    if (l.type === "vacation" && l.status === "approved") {
      if (l.endDate < now) vacationDaysTaken += days;
      else vacationDaysPlanned += days;
    } else if (l.type === "vacation" && l.status === "pending") {
      vacationDaysPlanned += days;
    } else if (l.type === "sick" && l.status === "approved" && l.endDate < now) {
      sickDaysTaken += days;
    }
  }
  return {
    vacationDaysTotal,
    vacationDaysTaken,
    vacationDaysPlanned,
    vacationDaysRemaining: Math.max(0, vacationDaysTotal - vacationDaysTaken - vacationDaysPlanned),
    sickDaysTaken,
    policyName: policy?.name,
  };
}

// Carry-over : a executer en debut de nouvelle periode (cron annuel le 1er mai)
export async function applyCarryOver(adminId: number, oldPeriodStart: Date): Promise<{ carried: number } | null> {
  try {
    const policy = await getPolicyFor(adminId);
    const carryMax = policy?.carryOverDays ?? 0;
    if (carryMax <= 0) return { carried: 0 };
    const oldBal = await loadBalanceRow(adminId, "vacation", oldPeriodStart);
    if (!oldBal) return { carried: 0 };
    const remaining = Math.max(0, oldBal.accruedDays + oldBal.carriedOverDays - oldBal.takenDays - oldBal.plannedDays);
    const carried = Math.min(remaining, carryMax);
    if (carried <= 0) return { carried: 0 };
    const newPeriod = getCurrentReferencePeriod(new Date(), policy?.referenceMonthStart ?? 5);
    const newBal = await getOrCreateBalance(adminId, "vacation", newPeriod.start, newPeriod.end);
    if (!newBal) return { carried: 0 };
    await (prisma as unknown as { leaveBalance: { update: (args: unknown) => Promise<unknown> } })
      .leaveBalance.update({ where: { id: newBal.id }, data: { carriedOverDays: carried } });
    return { carried };
  } catch {
    return null;
  }
}

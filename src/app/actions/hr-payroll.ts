"use server";
// Pay periods and pay stub generation.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getTimeclockConfig } from "@/lib/services/timeclock-config";
import { getHolidaysInRange } from "@/lib/services/holidays";
import { unauthorized, forbidden } from "@/lib/refusals";
import {
  splitPayrollMinutes, paidHours, grossPay, localDayKey,
  regularMinutesByWeek, holidayIndemnity, overtimeMinutes, storedDayToLocal,
} from "@/lib/services/payroll-hours";
import { calculateDeductions, periodsPerYear } from "@/lib/services/payroll-deductions";
import { startOfWeek } from "@/lib/week";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requirePayrollWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return (isSuper || (perms.payroll ?? []).includes("write")) ? adminId : null;
}

// ── Create a pay period ────────────────────────────────────
const periodSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  payDate: z.string(),
});

export async function createPayPeriodAction(input: z.infer<typeof periodSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requirePayrollWrite();
  if (!adminId) return unauthorized();
  const parsed = periodSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  const pay = new Date(parsed.data.payDate);
  if (end < start) return { success: false, error: "Date de fin avant date de début" };

  const p = await prisma.payPeriod.create({
    data: { startDate: start, endDate: end, payDate: pay, status: "open" },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "pay_period", entityId: p.id });
  revalidatePath("/admin/employes/paie");
  return { success: true, data: { id: p.id } };
}

// One stub per employee with approved, unbilled hours in the period.
// Rate comes from their active contract; hours are split by
// payroll-hours.ts and deductions computed by payroll-deductions.ts.
export async function generatePayStubsAction(
  input: { periodId: number },
): Promise<Result<{ stubsCreated: number; provisionalRates: boolean }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return unauthorized();

  const period = await prisma.payPeriod.findUnique({ where: { id: input.periodId } });
  if (!period) return { success: false, error: "Période introuvable" };
  if (period.status !== "open") return { success: false, error: "Période non ouverte" };

  // The period bounds are @db.Date columns: their calendar days, read locally,
  // so punches are matched against the days the payroll actually covers.
  const periodStart = storedDayToLocal(period.startDate);
  const periodEnd = storedDayToLocal(period.endDate);
  const periodEndExcl = new Date(periodEnd);
  periodEndExcl.setDate(periodEndExcl.getDate() + 1);
  const payYear = storedDayToLocal(period.payDate).getFullYear();

  // Approved punches in the period that are not yet on a stub.
  const clocks = await prisma.timeClock.findMany({
    where: {
      clockIn: { gte: periodStart, lt: periodEndExcl },
      clockOut: { not: null },
      approvedAt: { not: null },
      payStubId: null,
    },
    select: { id: true, adminId: true, clockIn: true, durationMin: true, category: true },
  });
  // Threshold comes from the time clock settings, not a constant.
  const { overtimeWeeklyMin: overtimeThreshold } = await getTimeclockConfig();
  // Hours worked on a paid public holiday are paid at double time.
  const holidays = await getHolidaysInRange(periodStart, periodEnd);
  const hasPaidHoliday = [...holidays.values()].some((h) => h.isPaid);
  // A shutdown week with a holiday in it still owes the indemnity, so an empty
  // period is only truly empty when no holiday falls in it either.
  if (clocks.length === 0 && !hasPaidHoliday) {
    return { success: false, error: "Aucun pointage approuvé à facturer" };
  }
  const isPaidHoliday = (d: Date) => holidays.get(localDayKey(d))?.isPaid === true;
  const weekKeyOf = (d: Date) => localDayKey(startOfWeek(d));

  // Group by employee.
  const byAdmin = new Map<number, typeof clocks>();
  for (const c of clocks) {
    if (!byAdmin.has(c.adminId)) byAdmin.set(c.adminId, []);
    byAdmin.get(c.adminId)!.push(c);
  }

  // Paid holidays falling in the period. A holiday NOT worked is owed an
  // indemnity based on the 4 complete weeks preceding the holiday's week,
  // so those weeks are loaded once, only when there is a holiday to pay.
  const paidHolidayDates = [...holidays.entries()]
    .filter(([, h]) => h.isPaid)
    .map(([day]) => {
      const [y, m, d] = day.split("-").map(Number);
      return new Date(y, m - 1, d);
    });
  const lookbackByAdmin = new Map<number, typeof clocks>();
  if (paidHolidayDates.length > 0) {
    // An employee with no punch in the period is still owed the indemnity, so
    // they need a stub too. Without this they were simply skipped.
    const contracted = await prisma.employeeContract.findMany({
      where: { status: { in: ["active", "signed_employer"] } },
      select: { adminId: true },
      distinct: ["adminId"],
    });
    for (const c of contracted) {
      if (!byAdmin.has(c.adminId)) byAdmin.set(c.adminId, []);
    }

    const earliest = paidHolidayDates.reduce((a, b) => (b < a ? b : a));
    const lookbackFrom = new Date(startOfWeek(earliest));
    lookbackFrom.setDate(lookbackFrom.getDate() - 28);
    const priorClocks = await prisma.timeClock.findMany({
      where: {
        adminId: { in: [...byAdmin.keys()] },
        clockIn: { gte: lookbackFrom, lt: startOfWeek(earliest) },
        clockOut: { not: null },
      },
      select: { id: true, adminId: true, clockIn: true, durationMin: true, category: true },
    });
    for (const c of priorClocks) {
      if (!lookbackByAdmin.has(c.adminId)) lookbackByAdmin.set(c.adminId, []);
      lookbackByAdmin.get(c.adminId)!.push(c);
    }
  }

  // Statutory contributions are capped per calendar year: what the employee was
  // already paid this year decides how much room is left under each maximum.
  const yearStart = new Date(Date.UTC(payYear, 0, 1));
  const ytdStubs = await prisma.payStub.findMany({
    where: {
      adminId: { in: [...byAdmin.keys()] },
      periodId: { not: period.id },
      period: { payDate: { gte: yearStart, lt: period.payDate } },
    },
    select: { adminId: true, grossPay: true },
  });
  const ytdGrossByAdmin = new Map<number, number>();
  for (const st of ytdStubs) {
    ytdGrossByAdmin.set(st.adminId, (ytdGrossByAdmin.get(st.adminId) ?? 0) + Number(st.grossPay));
  }
  const periods = periodsPerYear(periodStart, periodEnd);
  let usedProvisionalRates = false;

  let stubsCreated = 0;
  for (const [adminId, entries] of byAdmin) {
    // Rate comes from the active contract.
    const contract = await prisma.employeeContract.findFirst({
      where: { adminId, status: { in: ["active", "signed_employer"] } },
      orderBy: { startDate: "desc" },
    });
    if (!contract) continue;
    const hourlyRate = contract.hourlyRate ? Number(contract.hourlyRate)
      : contract.salaryAnnual ? Number(contract.salaryAnnual) / 2080
        : 0;
    if (hourlyRate <= 0) continue;

    const split = splitPayrollMinutes(entries, isPaidHoliday);
    const hours = paidHours(
      split,
      overtimeMinutes(split.overtimeBase, weekKeyOf, overtimeThreshold, isPaidHoliday),
    );

    // Indemnity for every paid holiday the employee did NOT work.
    const workedDays = new Set(entries.filter((e) => (e.durationMin ?? 0) > 0).map((e) => localDayKey(e.clockIn)));
    const prior = lookbackByAdmin.get(adminId) ?? [];
    let indemnity = 0;
    for (const day of paidHolidayDates) {
      if (workedDays.has(localDayKey(day))) continue;
      const weekOfHoliday = startOfWeek(day);
      const from = new Date(weekOfHoliday);
      from.setDate(from.getDate() - 28);
      const base = regularMinutesByWeek(
        prior.filter((e) => e.clockIn >= from && e.clockIn < weekOfHoliday),
        (d) => localDayKey(startOfWeek(d)),
        overtimeThreshold,
      );
      indemnity += holidayIndemnity(base, hourlyRate);
    }
    indemnity = Math.round(indemnity * 100) / 100;

    const gross = Math.round((grossPay(hours, hourlyRate) + indemnity) * 100) / 100;

    // Nothing owed: no empty stub.
    if (gross <= 0) continue;

    const das = calculateDeductions({
      gross,
      ytdGross: ytdGrossByAdmin.get(adminId) ?? 0,
      periodsPerYear: periods,
      year: payYear,
    });
    if (das.provisionalRates) usedProvisionalRates = true;
    const netPay = Math.round((gross - das.total) * 100) / 100;

    const stub = await prisma.payStub.upsert({
      where: { periodId_adminId: { periodId: period.id, adminId } },
      create: {
        periodId: period.id,
        adminId,
        hoursRegular: hours.regular,
        hoursOvertime: hours.overtime,
        hoursVacation: hours.vacation,
        hoursSick: hours.sick,
        hoursHoliday: hours.holiday,
        holidayIndemnity: indemnity,
        rate: hourlyRate,
        grossPay: gross,
        deductionRrq: das.qpp,
        deductionAe: das.ei,
        deductionRqap: das.qpip,
        deductionFederal: das.federal,
        deductionProvincial: das.provincial,
        netPay,
      },
      update: {
        hoursRegular: hours.regular,
        hoursOvertime: hours.overtime,
        hoursVacation: hours.vacation,
        hoursSick: hours.sick,
        hoursHoliday: hours.holiday,
        holidayIndemnity: indemnity,
        rate: hourlyRate,
        grossPay: gross,
        deductionRrq: das.qpp,
        deductionAe: das.ei,
        deductionRqap: das.qpip,
        deductionFederal: das.federal,
        deductionProvincial: das.provincial,
        netPay,
      },
      select: { id: true },
    });

    // Attach the punches to the stub.
    await prisma.timeClock.updateMany({
      where: { id: { in: entries.map((e) => e.id) } },
      data: { payStubId: stub.id },
    });
    stubsCreated++;
  }

  if (stubsCreated === 0) return { success: false, error: "Aucun montant à verser sur cette période" };

  await logAudit({ adminId: actorId, action: "create", entityType: "pay_stubs_bulk", entityId: period.id, changes: { stubsCreated } });
  revalidatePath("/admin/employes/paie");
  return { success: true, data: { stubsCreated, provisionalRates: usedProvisionalRates } };
}

export async function lockPayPeriodAction(input: { id: number }): Promise<Result> {
  const adminId = await requirePayrollWrite();
  if (!adminId) return unauthorized();
  await prisma.payPeriod.update({
    where: { id: input.id },
    data: { status: "locked", lockedAt: new Date() },
  });
  await logAudit({ adminId, action: "update", entityType: "pay_period", entityId: input.id, changes: { locked: true } });
  revalidatePath("/admin/employes/paie");
  return { success: true };
}

export async function markPayPeriodPaidAction(input: { id: number }): Promise<Result> {
  const adminId = await requirePayrollWrite();
  if (!adminId) return unauthorized();
  await prisma.payPeriod.update({
    where: { id: input.id },
    data: { status: "paid", paidAt: new Date() },
  });
  await prisma.payStub.updateMany({
    where: { periodId: input.id },
    data: { releasedAt: new Date() },
  });

  // Tell every employee their stub is available.
  const stubs = await prisma.payStub.findMany({
    where: { periodId: input.id },
    select: { adminId: true, netPay: true },
  });
  await Promise.all(
    stubs.map((s) =>
      prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: s.adminId,
          type: "success",
          title: "Nouveau bulletin de paie disponible",
          body: `Net : ${Number(s.netPay).toFixed(2)} $`,
          link: "/admin/mon-espace/paie",
          icon: "wallet",
        },
      }).catch(() => null),
    ),
  );

  await logAudit({ adminId, action: "update", entityType: "pay_period", entityId: input.id, changes: { paid: true } });
  revalidatePath("/admin/employes/paie");
  return { success: true };
}

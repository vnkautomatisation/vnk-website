import "server-only";
import { prisma } from "@/lib/prisma";

export type LeaveBalance = {
  vacationDaysTotal: number;       // 10 ou 15 selon ancienneté
  vacationDaysTaken: number;       // approved + endDate passé
  vacationDaysPlanned: number;     // approved + endDate futur ou pending
  vacationDaysRemaining: number;   // total - taken - planned
  sickDaysTaken: number;           // approved sick cette année
};

export async function getLeaveBalance(adminId: number): Promise<LeaveBalance> {
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { startDate: true, createdAt: true },
  });
  if (!admin) return { vacationDaysTotal: 0, vacationDaysTaken: 0, vacationDaysPlanned: 0, vacationDaysRemaining: 0, sickDaysTaken: 0 };

  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const yearEnd = new Date(now.getFullYear(), 11, 31, 23, 59, 59);

  // Ancienneté en années (fallback createdAt si startDate absent)
  const hireDate = admin.startDate ?? admin.createdAt;
  const tenureYears = hireDate
    ? Math.floor((now.getTime() - hireDate.getTime()) / (365.25 * 24 * 60 * 60 * 1000))
    : 0;
  const vacationDaysTotal = tenureYears >= 3 ? 15 : 10;

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      adminId,
      status: { in: ["approved", "pending"] },
      startDate: { gte: yearStart, lte: yearEnd },
    },
    select: { type: true, status: true, daysCount: true, endDate: true },
  });

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
  };
}

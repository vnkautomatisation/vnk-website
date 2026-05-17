import "server-only";
import { prisma } from "@/lib/prisma";

/**
 * Calcule le nombre de jours ouvrables entre 2 dates (inclus),
 * en excluant les weekends et les jours fériés QC.
 */
export async function calculateWorkingDays(startDate: Date, endDate: Date): Promise<number> {
  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
  if (start > end) return 0;

  const holidays = await prisma.holiday.findMany({
    where: { date: { gte: start, lte: end } },
    select: { date: true },
  });
  const holidaySet = new Set(holidays.map((h) => h.date.toISOString().slice(0, 10)));

  let count = 0;
  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    const key = cursor.toISOString().slice(0, 10);
    if (dow !== 0 && dow !== 6 && !holidaySet.has(key)) {
      count++;
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

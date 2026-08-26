import "server-only";
import { prisma } from "@/lib/prisma";

export type HolidayInfo = { name: string; isPaid: boolean; type: string };

// `Holiday.date` is a @db.Date column, so Prisma hands it back at UTC midnight.
// Reading it with the local getters shifts it a day back anywhere west of
// Greenwich - which put every holiday badge, and the double-time pay, on the
// wrong day. Its calendar day is the UTC one.
function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** The same calendar day as a LOCAL midnight Date, to compare with punches. */
export function holidayLocalDate(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/** A local Date as the UTC midnight its calendar day is stored under. */
function toStoredDay(d: Date): Date {
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
}

// Map of "YYYY-MM-DD" -> HolidayInfo for the holidays in the range.
export async function getHolidaysInRange(from: Date, to: Date): Promise<Map<string, HolidayInfo>> {
  const rows = await prisma.holiday.findMany({
    where: { date: { gte: toStoredDay(from), lte: toStoredDay(to) } },
    select: { date: true, name: true, isPaid: true, type: true },
  });
  const map = new Map<string, HolidayInfo>();
  for (const r of rows) {
    map.set(isoDay(r.date), { name: r.name, isPaid: r.isPaid, type: r.type });
  }
  return map;
}

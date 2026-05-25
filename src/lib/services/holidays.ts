import "server-only";
import { prisma } from "@/lib/prisma";

export type HolidayInfo = { name: string; isPaid: boolean; type: string };

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Retourne une Map<"YYYY-MM-DD", HolidayInfo> pour les jours feries dans la plage.
export async function getHolidaysInRange(from: Date, to: Date): Promise<Map<string, HolidayInfo>> {
  const rows = await prisma.holiday.findMany({
    where: { date: { gte: from, lte: to } },
    select: { date: true, name: true, isPaid: true, type: true },
  });
  const map = new Map<string, HolidayInfo>();
  for (const r of rows) {
    map.set(isoDay(r.date), { name: r.name, isPaid: r.isPaid, type: r.type });
  }
  return map;
}

// POST /api/cron/leave-accrual
// Accumulation hebdomadaire des soldes de conges (CNESST).
// Pour chaque admin actif :
//   - Recupere les heures travaillees (TimeClock approuves) de la semaine passee
//   - Appelle accrueWeek() qui met a jour LeaveAccrual + LeaveBalance
//
// A executer chaque lundi matin via Railway cron :
//   curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://<APP>.up.railway.app/api/cron/leave-accrual
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accrueWeek } from "@/lib/services/leave-balance";

export const dynamic = "force-dynamic";

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

// Sunday of last week (project week convention: Sunday -> Saturday)
function lastSundayUTC(): Date {
  const now = new Date();
  const dow = now.getUTCDay(); // 0 = Sunday
  const thisSunday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - dow));
  const lastSunday = new Date(thisSunday);
  lastSunday.setUTCDate(lastSunday.getUTCDate() - 7);
  return lastSunday;
}

export async function POST(req: Request) {
  if (!authorize(req)) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const weekStart = lastSundayUTC();
  const weekEnd = new Date(weekStart);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7);

  const admins = await prisma.admin.findMany({ where: { isActive: true }, select: { id: true } });

  let processed = 0;
  for (const a of admins) {
    const tcs = await prisma.timeClock.findMany({
      where: {
        adminId: a.id,
        clockIn: { gte: weekStart, lt: weekEnd },
        approvedAt: { not: null },
      },
      select: { durationMin: true },
    });
    const totalMin = tcs.reduce((s, t) => s + (t.durationMin ?? 0), 0);
    const hoursWorked = totalMin / 60;
    if (hoursWorked > 0) {
      await accrueWeek(a.id, weekStart, hoursWorked).catch(() => null);
      processed++;
    }
  }

  return NextResponse.json({ success: true, weekStart: weekStart.toISOString().slice(0, 10), processed });
}

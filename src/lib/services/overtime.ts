import "server-only";
import { startOfWeek, endOfWeek } from "@/lib/week";

// Heures supplementaires QC : seuil par defaut 40h/semaine.
// Semaine projet : dimanche -> samedi (cf. src/lib/week.ts).
// Le taux x1.5 sera applique cote generation paie (pas ici).

export type WeekOvertimeCheck = {
  weekStart: Date;
  weekEnd: Date;
  workMin: number;
  overtimeMin: number;
};

export type EntryForOvertime = {
  clockIn: Date;
  durationMin: number | null;
  category: string;
};

const WORK_CATEGORIES = new Set(["work", "meeting", "training"]);
const DEFAULT_THRESHOLD_MIN = 40 * 60;

function weekKey(d: Date): string {
  const s = startOfWeek(d);
  return `${s.getFullYear()}-${String(s.getMonth() + 1).padStart(2, "0")}-${String(s.getDate()).padStart(2, "0")}`;
}

// Pour un total deja calcule sur une semaine.
export function calculateOvertimeForWeek(
  workMinPerWeek: number,
  threshold: number = DEFAULT_THRESHOLD_MIN,
): number {
  return Math.max(0, workMinPerWeek - threshold);
}

// Regroupe les entries par semaine (dimanche/samedi) et calcule l'overtime de chaque.
export function calculateOvertimeForEntries(
  entries: EntryForOvertime[],
  threshold: number = DEFAULT_THRESHOLD_MIN,
): WeekOvertimeCheck[] {
  const byWeek = new Map<string, { weekStart: Date; weekEnd: Date; workMin: number }>();
  for (const e of entries) {
    if (!WORK_CATEGORIES.has(e.category)) continue;
    const dur = e.durationMin ?? 0;
    if (dur <= 0) continue;
    const key = weekKey(e.clockIn);
    if (!byWeek.has(key)) {
      byWeek.set(key, {
        weekStart: startOfWeek(e.clockIn),
        weekEnd: endOfWeek(e.clockIn),
        workMin: 0,
      });
    }
    byWeek.get(key)!.workMin += dur;
  }
  const out: WeekOvertimeCheck[] = [];
  for (const [, w] of byWeek) {
    out.push({
      weekStart: w.weekStart,
      weekEnd: w.weekEnd,
      workMin: w.workMin,
      overtimeMin: calculateOvertimeForWeek(w.workMin, threshold),
    });
  }
  out.sort((a, b) => a.weekStart.getTime() - b.weekStart.getTime());
  return out;
}

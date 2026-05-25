import "server-only";

// Norme CNESST QC : 30 min de pause apres 5h consecutives de travail.
// On considere conforme si workMin >= 300 min (5h) implique breakMin >= 30 min,
// ou bien si workMin < 300 min (pas obligatoire).

export type BreakComplianceCheck = {
  date: string;          // YYYY-MM-DD
  workMin: number;       // work + meeting + training
  breakMin: number;      // break (pause)
  compliant: boolean;
  reason?: string;
};

export type EntryForCompliance = {
  clockIn: Date;
  clockOut: Date | null;
  durationMin: number | null;
  category: string;
};

const WORK_CATEGORIES = new Set(["work", "meeting", "training"]);
const BREAK_CATEGORIES = new Set(["break"]);

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Pour une seule journee : aggrege workMin et breakMin et retourne le verdict.
export function checkDayBreakCompliance(entries: EntryForCompliance[]): BreakComplianceCheck {
  if (entries.length === 0) {
    return { date: "", workMin: 0, breakMin: 0, compliant: true };
  }
  const date = isoDay(entries[0].clockIn);
  let workMin = 0;
  let breakMin = 0;
  for (const e of entries) {
    const dur = e.durationMin ?? 0;
    if (WORK_CATEGORIES.has(e.category)) workMin += dur;
    else if (BREAK_CATEGORIES.has(e.category)) breakMin += dur;
  }
  if (workMin >= 300 && breakMin < 30) {
    return {
      date,
      workMin,
      breakMin,
      compliant: false,
      reason: "Plus de 5h travaillees sans pause de 30 min (norme CNESST)",
    };
  }
  return { date, workMin, breakMin, compliant: true };
}

// Calcule la conformite pour chaque journee d'une semaine ou periode.
export function checkRangeBreakCompliance(entries: EntryForCompliance[]): BreakComplianceCheck[] {
  const byDay = new Map<string, EntryForCompliance[]>();
  for (const e of entries) {
    const key = isoDay(e.clockIn);
    if (!byDay.has(key)) byDay.set(key, []);
    byDay.get(key)!.push(e);
  }
  const out: BreakComplianceCheck[] = [];
  for (const [, dayEntries] of byDay) {
    out.push(checkDayBreakCompliance(dayEntries));
  }
  out.sort((a, b) => a.date.localeCompare(b.date));
  return out;
}

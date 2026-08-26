// Approved punches -> paid hour buckets. Pure, so the money math is testable.

export type EntryForPayroll = {
  clockIn: Date;
  durationMin: number | null;
  category: string;
};

/** Categories that count as time worked. "break" is never paid. */
const WORK_CATEGORIES = new Set(["work", "meeting", "training"]);

export const OVERTIME_MULTIPLIER = 1.5;
/** QC: a paid public holiday worked is paid at double time. */
export const HOLIDAY_MULTIPLIER = 2;

export type MinuteSplit = {
  /** Worked, excluding paid holidays. Overtime is taken out of this. */
  work: number;
  holiday: number;
  vacation: number;
  sick: number;
  /** Every worked entry, holidays included: they count toward the threshold. */
  overtimeBase: EntryForPayroll[];
};

/** A @db.Date arrives at UTC midnight; this is its calendar day, local. */
export function storedDayToLocal(d: Date): Date {
  return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

export function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Split a period's entries into pay buckets. */
export function splitPayrollMinutes(
  entries: EntryForPayroll[],
  isPaidHoliday: (day: Date) => boolean,
): MinuteSplit {
  const split: MinuteSplit = { work: 0, holiday: 0, vacation: 0, sick: 0, overtimeBase: [] };
  for (const e of entries) {
    const min = e.durationMin ?? 0;
    if (e.category === "vacation") { split.vacation += min; continue; }
    if (e.category === "sick") { split.sick += min; continue; }
    if (!WORK_CATEGORIES.has(e.category)) continue;
    split.overtimeBase.push(e);
    if (isPaidHoliday(e.clockIn)) { split.holiday += min; continue; }
    split.work += min;
  }
  return split;
}

export type PaidHours = {
  regular: number;
  overtime: number;
  holiday: number;
  vacation: number;
  sick: number;
};

export function paidHours(split: MinuteSplit, overtimeMin: number): PaidHours {
  // Capped at the non-holiday minutes: an hour already paid 2x is never also
  // paid 1.5x, even when the week ran past the threshold.
  const overtime = Math.min(overtimeMin, split.work);
  return {
    regular: (split.work - overtime) / 60,
    overtime: overtime / 60,
    holiday: split.holiday / 60,
    vacation: split.vacation / 60,
    sick: split.sick / 60,
  };
}

export function grossPay(hours: PaidHours, hourlyRate: number): number {
  return hourlyRate * (
    hours.regular
    + hours.overtime * OVERTIME_MULTIPLIER
    + hours.holiday * HOLIDAY_MULTIPLIER
    + hours.vacation
    + hours.sick
  );
}

// ── Overtime ───────────────────────────────────────────────────────────────

/** Weekly overtime, capped at the week's non-holiday minutes. */
export function overtimeMinutes(
  entries: EntryForPayroll[],
  weekKeyOf: (d: Date) => string,
  overtimeWeeklyMin: number,
  isPaidHoliday: (d: Date) => boolean = () => false,
): number {
  const weeks = new Map<string, { all: number; nonHoliday: number }>();
  for (const e of entries) {
    if (!WORK_CATEGORIES.has(e.category)) continue;
    const key = weekKeyOf(e.clockIn);
    const w = weeks.get(key) ?? { all: 0, nonHoliday: 0 };
    const min = e.durationMin ?? 0;
    w.all += min;
    if (!isPaidHoliday(e.clockIn)) w.nonHoliday += min;
    weeks.set(key, w);
  }
  let total = 0;
  for (const [, w] of weeks) {
    total += Math.min(Math.max(0, w.all - overtimeWeeklyMin), w.nonHoliday);
  }
  return total;
}

// ── Paid holiday NOT worked: LNT art. 62, 1/20 of the 4 preceding weeks ──

export const HOLIDAY_INDEMNITY_DIVISOR = 20;

/** Regular minutes per week, capped so overtime never inflates the indemnity. */
export function regularMinutesByWeek(
  entries: EntryForPayroll[],
  weekKeyOf: (d: Date) => string,
  overtimeWeeklyMin: number,
): number {
  const perWeek = new Map<string, number>();
  for (const e of entries) {
    if (!WORK_CATEGORIES.has(e.category)) continue;
    const k = weekKeyOf(e.clockIn);
    perWeek.set(k, (perWeek.get(k) ?? 0) + (e.durationMin ?? 0));
  }
  let total = 0;
  for (const [, min] of perWeek) total += Math.min(min, overtimeWeeklyMin);
  return total;
}

/** One holiday's indemnity, from the 4 preceding weeks of regular time. */
export function holidayIndemnity(regularMinutes: number, hourlyRate: number): number {
  return (regularMinutes / 60) * hourlyRate / HOLIDAY_INDEMNITY_DIVISOR;
}

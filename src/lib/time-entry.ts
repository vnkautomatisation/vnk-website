// Single source of truth for time-entry arithmetic. Floors everywhere.

/** Accepts Prisma rows (Date) and serialized payloads (ISO string). */
export type TimeLike = Date | string;

export type TimingInput = {
  clockIn: TimeLike;
  clockOut?: TimeLike | null;
  /** Unpaid breaks, deducted from worked time. */
  totalBreakMin?: number | null;
  /** Paid short breaks: tracked, never deducted. */
  paidBreakMin?: number | null;
  /** Persisted worked minutes, when the entry comes from the database. */
  durationMin?: number | null;
  /** Number of punches this entry replaced (null = not a merge). */
  mergedFrom?: number | null;
  /** Gap minutes between those punches, counted as break. */
  mergedGapMin?: number | null;
};

const ms = (t: TimeLike): number => (t instanceof Date ? t : new Date(t)).getTime();

/** Widest gap a merge may bridge; beyond it the time was not worked. */
export const MERGE_MAX_GAP_MIN = 15;

/** Whole minutes between two instants, never negative. Floored, like the rest. */
export function minutesBetween(from: TimeLike, to: TimeLike): number {
  return Math.max(0, Math.floor((ms(to) - ms(from)) / 60_000));
}

/** Gross bracket in minutes, floored. */
export function grossMin(clockIn: TimeLike, clockOut: TimeLike): number;
export function grossMin(clockIn: TimeLike, clockOut?: TimeLike | null): number | null;
export function grossMin(clockIn: TimeLike, clockOut?: TimeLike | null): number | null {
  if (!clockOut) return null;
  return minutesBetween(clockIn, clockOut);
}

/** Time actually worked: gross minus unpaid breaks, never negative. */
export function workedMin(clockIn: TimeLike, clockOut: TimeLike, totalBreakMin?: number | null): number;
export function workedMin(clockIn: TimeLike, clockOut?: TimeLike | null, totalBreakMin?: number | null): number | null;
export function workedMin(
  clockIn: TimeLike,
  clockOut?: TimeLike | null,
  totalBreakMin?: number | null,
): number | null {
  const gross = grossMin(clockIn, clockOut);
  if (gross == null) return null;
  return Math.max(0, gross - (totalBreakMin ?? 0));
}

/** The break state of a shift that is still open. */
export type OpenBreakState = {
  pausedAt?: TimeLike | null;
  /** "paid" = short break, tracked but never deducted. Anything else = meal. */
  pausedKind?: string | null;
  totalBreakMin?: number | null;
  paidBreakMin?: number | null;
};

/** Close a running pause, sending its minutes to the right bucket. */
export function closeRunningBreak(open: OpenBreakState, at: TimeLike): {
  totalBreakMin: number;
  paidBreakMin: number;
  addedMin: number;
} {
  let totalBreakMin = open.totalBreakMin ?? 0;
  let paidBreakMin = open.paidBreakMin ?? 0;
  let addedMin = 0;
  if (open.pausedAt) {
    addedMin = minutesBetween(open.pausedAt, at);
    if (open.pausedKind === "paid") paidBreakMin += addedMin;
    else totalBreakMin += addedMin;
  }
  return { totalBreakMin, paidBreakMin, addedMin };
}

export type EntryTiming = {
  gross: number | null;
  breakMin: number;
  paidBreakMin: number;
  /** Recomputed from the punches. */
  worked: number | null;
  /** As persisted, when available. */
  stored: number | null;
  /** Whether the stored value still adds up against the bracket. */
  isCoherent: boolean;
  isMerged: boolean;
  mergedCount: number;
  mergedGapMin: number;
};

export function entryTiming(entry: TimingInput): EntryTiming {
  const breakMin = entry.totalBreakMin ?? 0;
  const gross = grossMin(entry.clockIn, entry.clockOut);
  const worked = workedMin(entry.clockIn, entry.clockOut, breakMin);
  const stored = entry.durationMin ?? null;
  const mergedCount = entry.mergedFrom ?? 0;
  // One minute of rounding slack per merged punch.
  const tolerance = Math.max(1, mergedCount);
  return {
    gross,
    breakMin,
    paidBreakMin: entry.paidBreakMin ?? 0,
    worked,
    stored,
    isCoherent: gross != null && stored != null && Math.abs(worked! - stored) <= tolerance,
    isMerged: mergedCount > 0,
    mergedCount,
    mergedGapMin: entry.mergedGapMin ?? 0,
  };
}

/** Minutes -> "XhMM". Zero is explicit: a dash reads as missing data. */
export function fmtMin(mins: number | null | undefined): string {
  if (mins == null) return "—";
  if (mins <= 0) return "0h00";
  return `${Math.floor(mins / 60)}h${String(mins % 60).padStart(2, "0")}`;
}

/** Precise bracket for short shifts, where "0h00" would hide the truth. */
export function fmtBracket(clockIn: TimeLike, clockOut?: TimeLike | null): string {
  if (!clockOut) return "—";
  const sec = Math.max(0, Math.floor((ms(clockOut) - ms(clockIn)) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${String(sec % 60).padStart(2, "0")}s`;
  return `${Math.floor(sec / 3600)}h${String(Math.floor((sec % 3600) / 60)).padStart(2, "0")}`;
}

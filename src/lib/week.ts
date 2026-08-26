// Project-wide week convention: SUNDAY -> SATURDAY.
// Applies to EVERYTHING week-based: calendar grids, payroll week, KPI hours,
// overtime grouping, weekly submission/approval, cron windows.
// Single source of truth — do not reimplement week math locally.
// (Isomorphic: safe to import from client components and server code.)

/** Returns the Sunday 00:00:00.000 of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  n.setDate(n.getDate() - n.getDay()); // getDay(): 0 = Sunday
  return n;
}

/** Returns the Saturday 23:59:59.999 of the week containing `d`. */
export function endOfWeek(d: Date): Date {
  const e = startOfWeek(d);
  e.setDate(e.getDate() + 6);
  e.setHours(23, 59, 59, 999);
  return e;
}

/** Day index within the project week: 0 = Sunday ... 6 = Saturday. */
export function dayIndexInWeek(d: Date): number {
  return d.getDay();
}

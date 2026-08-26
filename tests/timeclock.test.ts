// Unit tests for the timeclock module's pure logic.
// Run with: npm test
//
// These cover the paths a founder session can never reach through the UI:
// every refusal in the scope rules, and the time arithmetic that used to be
// re-implemented in each action, route and component.
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  grossMin, workedMin, minutesBetween, entryTiming, fmtMin, fmtBracket,
  closeRunningBreak, MERGE_MAX_GAP_MIN,
} from "../src/lib/time-entry";
import {
  checkReadAccess, checkReviewAccess, type ScopeLike,
} from "../src/lib/services/timesheet-access";
import {
  splitPayrollMinutes, paidHours, grossPay, regularMinutesByWeek, overtimeMinutes,
  holidayIndemnity, localDayKey, storedDayToLocal,
} from "../src/lib/services/payroll-hours";
import {
  calculateDeductions, periodsPerYear,
} from "../src/lib/services/payroll-deductions";
import { getPayrollRates } from "../src/lib/services/payroll-rates";

const iso = (h: number, m: number, s = 0) =>
  new Date(2026, 7, 25, h, m, s).toISOString();

// ── Time arithmetic ───────────────────────────────────────────

test("grossMin floors and never goes negative", () => {
  assert.equal(grossMin(iso(9, 0), iso(17, 0)), 480);
  assert.equal(grossMin(iso(20, 16, 36), iso(20, 50, 14)), 33); // 33m38s
  assert.equal(grossMin(iso(17, 0), iso(9, 0)), 0);
  assert.equal(grossMin(iso(9, 0), null), null);
});

test("workedMin deducts unpaid breaks", () => {
  assert.equal(workedMin(iso(9, 0), iso(17, 0), 60), 420);
  assert.equal(workedMin(iso(20, 16, 36), iso(20, 50, 14), 5), 28);
  // A break longer than the bracket cannot produce negative worked time.
  assert.equal(workedMin(iso(9, 0), iso(9, 30), 60), 0);
  assert.equal(workedMin(iso(9, 0), null, 30), null);
});

test("minutesBetween is the single rounding rule", () => {
  assert.equal(minutesBetween(iso(9, 0), iso(9, 0, 59)), 0);
  assert.equal(minutesBetween(iso(9, 0), iso(9, 1)), 1);
  assert.equal(minutesBetween(iso(9, 1), iso(9, 0)), 0);
});

test("entryTiming flags a stored duration that no longer adds up", () => {
  const coherent = entryTiming({
    clockIn: iso(20, 16, 36), clockOut: iso(20, 50, 14),
    totalBreakMin: 5, durationMin: 28,
  });
  assert.equal(coherent.gross, 33);
  assert.equal(coherent.worked, 28);
  assert.equal(coherent.isCoherent, true);

  // Legacy merge: the gap between punches was never recorded as a break.
  const legacy = entryTiming({
    clockIn: iso(8, 0), clockOut: iso(17, 0),
    totalBreakMin: 0, durationMin: 120,
  });
  assert.equal(legacy.isCoherent, false);
});

test("entryTiming allows one minute of drift per merged punch", () => {
  const base = { clockIn: iso(9, 0), clockOut: iso(9, 30), totalBreakMin: 0 };
  // Not merged: a 2-minute gap is incoherent.
  assert.equal(entryTiming({ ...base, durationMin: 28 }).isCoherent, false);
  // Merged from 3 punches: up to 3 minutes of flooring drift is expected.
  assert.equal(entryTiming({ ...base, durationMin: 28, mergedFrom: 3 }).isCoherent, true);
});

test("entryTiming exposes merge provenance from columns, not notes", () => {
  const t = entryTiming({
    clockIn: iso(9, 0), clockOut: iso(10, 0),
    totalBreakMin: 8, durationMin: 52, mergedFrom: 2, mergedGapMin: 8,
  });
  assert.equal(t.isMerged, true);
  assert.equal(t.mergedCount, 2);
  assert.equal(t.mergedGapMin, 8);
  assert.equal(entryTiming({ clockIn: iso(9, 0) }).isMerged, false);
});

test("paid breaks are tracked but never deducted", () => {
  const t = entryTiming({
    clockIn: iso(9, 0), clockOut: iso(17, 0),
    totalBreakMin: 30, paidBreakMin: 15, durationMin: 450,
  });
  assert.equal(t.worked, 450);
  assert.equal(t.paidBreakMin, 15);
  assert.equal(t.isCoherent, true);
});

test("formatters", () => {
  assert.equal(fmtMin(0), "0h00");
  assert.equal(fmtMin(28), "0h28");
  assert.equal(fmtMin(485), "8h05");
  assert.equal(fmtMin(null), "—");
  assert.equal(fmtBracket(iso(9, 0), iso(9, 0, 45)), "45s");
  assert.equal(fmtBracket(iso(9, 0), iso(9, 9, 6)), "9m 06s");
  assert.equal(fmtBracket(iso(9, 0), null), "—");
});

test("the merge gap ceiling is shared by server and UI", () => {
  assert.equal(MERGE_MAX_GAP_MIN, 15);
});

// ── Closing a running break ───────────────────────────────────

test("a meal break is deducted, a paid break is not", () => {
  const openMeal = { pausedAt: iso(12, 0), pausedKind: "meal", totalBreakMin: 0, paidBreakMin: 0 };
  assert.deepEqual(closeRunningBreak(openMeal, iso(12, 30)),
    { totalBreakMin: 30, paidBreakMin: 0, addedMin: 30 });

  // The kiosk used to push this into totalBreakMin, deducting paid time.
  const openPaid = { pausedAt: iso(10, 0), pausedKind: "paid", totalBreakMin: 0, paidBreakMin: 0 };
  assert.deepEqual(closeRunningBreak(openPaid, iso(10, 15)),
    { totalBreakMin: 0, paidBreakMin: 15, addedMin: 15 });
});

test("closing adds to the minutes already banked", () => {
  const open = { pausedAt: iso(15, 0), pausedKind: "meal", totalBreakMin: 30, paidBreakMin: 10 };
  assert.deepEqual(closeRunningBreak(open, iso(15, 10)),
    { totalBreakMin: 40, paidBreakMin: 10, addedMin: 10 });
});

test("no running pause leaves the totals untouched", () => {
  const open = { pausedAt: null, totalBreakMin: 45, paidBreakMin: 15 };
  assert.deepEqual(closeRunningBreak(open, iso(17, 0)),
    { totalBreakMin: 45, paidBreakMin: 15, addedMin: 0 });
  assert.deepEqual(closeRunningBreak({}, iso(17, 0)),
    { totalBreakMin: 0, paidBreakMin: 0, addedMin: 0 });
});

test("an unknown pause kind is treated as a meal", () => {
  const open = { pausedAt: iso(12, 0), pausedKind: null, totalBreakMin: 0 };
  assert.equal(closeRunningBreak(open, iso(12, 20)).totalBreakMin, 20);
});

test("ending the day on a paid break keeps the worked time whole", () => {
  const open = { clockIn: iso(9, 0), pausedAt: iso(16, 45), pausedKind: "paid", totalBreakMin: 30, paidBreakMin: 0 };
  const closed = closeRunningBreak(open, iso(17, 0));
  assert.equal(workedMin(open.clockIn, iso(17, 0), closed.totalBreakMin), 450); // 8h - 30m meal
  assert.equal(closed.paidBreakMin, 15);
});

// ── Scope access ──────────────────────────────────────────────

const scope = (over: Partial<ScopeLike>): ScopeLike => ({
  isHr: false, isFounder: false, allowedAdminIds: [], ...over,
});
const founder = scope({ isHr: true, isFounder: true, allowedAdminIds: null });
const hr = scope({ isHr: true, allowedAdminIds: null });
const manager = scope({ allowedAdminIds: [10, 11] });
const noReports = scope({ allowedAdminIds: [] });

test("anyone may read their own entries", () => {
  assert.deepEqual(checkReadAccess(hr, 2, 2), { ok: true, targetId: 2 });
  assert.deepEqual(checkReadAccess(manager, 3, 3), { ok: true, targetId: 3 });
  assert.deepEqual(checkReadAccess(noReports, 4, 4), { ok: true, targetId: 4 });
});

test("nobody reviews their own hours except the founder", () => {
  assert.equal(checkReviewAccess(hr, 2, 2).ok, false);
  assert.equal(checkReviewAccess(manager, 3, 3).ok, false);
  assert.deepEqual(checkReviewAccess(founder, 1, 1), { ok: true, targetId: 1 });
});

test("a manager is confined to their reports", () => {
  assert.equal(checkReadAccess(manager, 11, 3).ok, true);
  assert.equal(checkReviewAccess(manager, 11, 3).ok, true);

  const denied = checkReadAccess(manager, 99, 3);
  assert.equal(denied.ok, false);
  assert.equal(denied.ok === false && denied.status, 403);
  assert.equal(checkReviewAccess(manager, 99, 3).ok, false);
  assert.equal(checkReadAccess(noReports, 10, 4).ok, false);
});

test("founder and HR reach everyone", () => {
  assert.equal(checkReadAccess(founder, 99, 1).ok, true);
  assert.equal(checkReviewAccess(founder, 99, 1).ok, true);
  assert.equal(checkReadAccess(hr, 99, 2).ok, true);
});

test("a malformed adminId is rejected before any query", () => {
  for (const bad of ["abc", -5, 0, 1.5, "", null, undefined, NaN, Infinity]) {
    const r = checkReadAccess(manager, bad as never, 3);
    assert.equal(r.ok, false, `expected refusal for ${String(bad)}`);
    assert.equal(r.ok === false && r.status, 400, `expected 400 for ${String(bad)}`);
  }
});

// ── Payroll buckets: 1x / 1.5x / 2x ─────────────────────────────────────────

const day = (d: number, h = 8) => new Date(2026, 6, d, h, 0, 0);
const punch = (d: number, min: number, category = "work") => ({
  clockIn: day(d), durationMin: min, category,
});
// 2026-07-01, Canada Day.
const july1 = (d: Date) => d.getMonth() === 6 && d.getDate() === 1;
const noHoliday = () => false;

test("holiday minutes are their own bucket but still count toward the week", () => {
  const split = splitPayrollMinutes([punch(1, 480), punch(2, 480)], july1);
  assert.equal(split.holiday, 480);
  assert.equal(split.work, 480);
  // Both entries count toward the weekly threshold.
  assert.equal(split.overtimeBase.length, 2);
});

test("a 48h week with 8h on a holiday pays 8h at 1.5x and 8h at 2x", () => {
  // Mon-Sat 8h each, the holiday among them: 48h total.
  const entries = [punch(1, 480), ...[6, 7, 8, 9, 10].map((d) => punch(d, 480))];
  const split = splitPayrollMinutes(entries, july1);
  // Weekly total 2880 min, threshold 2400 -> 480 min of overtime.
  const hours = paidHours(split, 2880 - 2400);
  assert.deepEqual(
    { r: hours.regular, o: hours.overtime, h: hours.holiday },
    { r: 32, o: 8, h: 8 },
  );
  assert.equal(grossPay(hours, 20), 32 * 20 + 8 * 30 + 8 * 40);
});

test("break entries are never paid", () => {
  const split = splitPayrollMinutes([punch(2, 480), punch(2, 30, "break")], noHoliday);
  assert.equal(split.work, 480);
  assert.equal(split.overtimeBase.length, 1);
});

test("vacation and sick keep their own buckets", () => {
  const split = splitPayrollMinutes(
    [punch(2, 480, "vacation"), punch(3, 240, "sick"), punch(1, 480, "meeting")],
    july1,
  );
  assert.deepEqual(
    { v: split.vacation, s: split.sick, h: split.holiday, w: split.work },
    { v: 480, s: 240, h: 480, w: 0 },
  );
});

test("overtime never exceeds the worked minutes", () => {
  const split = splitPayrollMinutes([punch(2, 300)], noHoliday);
  assert.equal(paidHours(split, 600).overtime, 5);
  assert.equal(paidHours(split, 600).regular, 0);
});

test("gross pays 1x, 1.5x and 2x", () => {
  // 38h regular + 2h overtime + 8h holiday at 20$/h.
  const hours = { regular: 38, overtime: 2, holiday: 8, vacation: 0, sick: 0 };
  assert.equal(grossPay(hours, 20), 38 * 20 + 2 * 30 + 8 * 40);
});

test("overtime never eats into the hours already paid double", () => {
  // Only the holiday was worked: no matter the overtime figure, none applies.
  const split = splitPayrollMinutes([punch(1, 480)], july1);
  const hours = paidHours(split, 480);
  assert.equal(hours.overtime, 0);
  assert.equal(hours.holiday, 8);
  assert.equal(grossPay(hours, 20), 8 * 40);
});

// ── Holiday indemnity (LNT art. 62) ─────────────────────────────────────────

test("indemnity is 1/20 of the preceding weeks' regular wages", () => {
  // 4 weeks at 40h, 20$/h = 3200$ -> 160$.
  const weeks = [5, 12, 19, 26].flatMap((d) => [punch(d, 2400)]);
  const base = regularMinutesByWeek(weeks, (dt) => localDayKey(dt), 2400);
  assert.equal(base, 4 * 2400);
  assert.equal(holidayIndemnity(base, 20), 160);
});

test("overtime never inflates the indemnity", () => {
  // A 60h week still counts as 40h in the base.
  const base = regularMinutesByWeek([punch(5, 3600)], (dt) => localDayKey(dt), 2400);
  assert.equal(base, 2400);
});

test("a new hire with no history gets no indemnity, not a crash", () => {
  assert.equal(holidayIndemnity(regularMinutesByWeek([], (dt) => localDayKey(dt), 2400), 25), 0);
});

// ── Source deductions ───────────────────────────────────────────────────────

test("deductions stay within the pay and leave a net", () => {
  const d = calculateDeductions({ gross: 2000, ytdGross: 0, periodsPerYear: 26, year: 2025 });
  assert.ok(d.total > 0 && d.total < 2000);
  assert.ok(d.federal > 0 && d.provincial > 0);
  assert.equal(d.provisionalRates, false);
});

test("QPP stops at the yearly maximum", () => {
  const early = calculateDeductions({ gross: 3000, ytdGross: 0, periodsPerYear: 26, year: 2025 });
  const late = calculateDeductions({ gross: 3000, ytdGross: 200_000, periodsPerYear: 26, year: 2025 });
  assert.ok(early.qpp > 0);
  assert.equal(late.qpp, 0);
  assert.equal(late.ei, 0);
  assert.equal(late.qpip, 0);
});

test("the period crossing a cap contributes only up to it", () => {
  // 2025 EI: 65 700$ insurable at 1.31%.
  const d = calculateDeductions({ gross: 2000, ytdGross: 65_000, periodsPerYear: 26, year: 2025 });
  assert.equal(d.ei, Math.round(700 * 0.0131 * 100) / 100);
});

test("a low pay owes no income tax", () => {
  // 400$ every two weeks = 10 400$/year, under both basic personal amounts.
  const d = calculateDeductions({ gross: 400, ytdGross: 0, periodsPerYear: 26, year: 2025 });
  assert.equal(d.federal, 0);
  assert.equal(d.provincial, 0);
  assert.ok(d.qpp > 0);
});

test("tax rises with income", () => {
  const low = calculateDeductions({ gross: 1500, ytdGross: 0, periodsPerYear: 26, year: 2025 });
  const high = calculateDeductions({ gross: 6000, ytdGross: 0, periodsPerYear: 26, year: 2025 });
  assert.ok(high.federal / 6000 > low.federal / 1500);
});

test("an undefined year falls back and is flagged provisional", () => {
  assert.equal(calculateDeductions({ gross: 2000, ytdGross: 0, periodsPerYear: 26, year: 2031 }).provisionalRates, true);
});

test("zero pay deducts nothing", () => {
  const d = calculateDeductions({ gross: 0, ytdGross: 40_000, periodsPerYear: 26, year: 2025 });
  assert.equal(d.total, 0);
});

test("period count follows the period length", () => {
  assert.equal(periodsPerYear(new Date(2026, 0, 1), new Date(2026, 0, 7)), 52);
  assert.equal(periodsPerYear(new Date(2026, 0, 1), new Date(2026, 0, 14)), 26);
  assert.equal(periodsPerYear(new Date(2026, 0, 1), new Date(2026, 0, 31)), 12);
});

test("overtime counts holiday hours toward the week, then caps at the rest", () => {
  const wkOf = (d: Date) => `${d.getFullYear()}-${Math.floor(d.getDate() / 7)}`;
  // 48h in one week, 8h of it on the holiday.
  const entries = [punch(1, 480), ...[2, 3, 4, 5, 6].map((d) => punch(d, 480))];
  assert.equal(overtimeMinutes(entries, wkOf, 2400, july1), 480);
  // Same 48h with no holiday: identical overtime.
  assert.equal(overtimeMinutes(entries, wkOf, 2400, noHoliday), 480);
});

test("a week made only of holiday hours has no overtime", () => {
  const wkOf = () => "w";
  const entries = [punch(1, 480), punch(1, 480), punch(1, 480), punch(1, 480), punch(1, 480), punch(1, 480)];
  assert.equal(overtimeMinutes(entries, wkOf, 2400, july1), 0);
});

// ── Date-only columns ───────────────────────────────────────────────────────

test("a @db.Date column keeps its calendar day", () => {
  // Prisma hands a date-only column back at UTC midnight. Read with the local
  // getters it lands a day early west of Greenwich, which put every holiday
  // badge - and the double-time pay - on the wrong day.
  const stored = new Date("2026-07-01T00:00:00.000Z");
  assert.equal(localDayKey(storedDayToLocal(stored)), "2026-07-01");
  assert.equal(storedDayToLocal(stored).getHours(), 0);
});

test("period bounds survive the same conversion", () => {
  const start = storedDayToLocal(new Date("2026-06-28T00:00:00.000Z"));
  const end = storedDayToLocal(new Date("2026-07-11T00:00:00.000Z"));
  assert.equal(localDayKey(start), "2026-06-28");
  assert.equal(localDayKey(end), "2026-07-11");
  assert.equal(periodsPerYear(start, end), 26);
});

// ── Statutory parameters ────────────────────────────────────────────────────

test("the 2026 table reproduces the published maximums", () => {
  const r = getPayrollRates(2026);
  assert.equal(r.provisional, false);
  const qppMax = (r.qpp.maxPensionable - r.qpp.basicExemption) * r.qpp.rate;
  assert.equal(Math.round(qppMax * 100) / 100, 4479.30);
  assert.equal(Math.round(r.qpip.maxInsurable * r.qpip.rate * 100) / 100, 442.90);
  assert.equal(Math.round(r.ei.maxInsurable * r.ei.rate * 100) / 100, 895.70);
  // The base and additional halves must add up to the total rate.
  assert.ok(r.qpp.baseRate < r.qpp.rate);
});

test("the 2025 table reproduces its own maximums", () => {
  const r = getPayrollRates(2025);
  assert.equal(r.provisional, false);
  const qppMax = (r.qpp.maxPensionable - r.qpp.basicExemption) * r.qpp.rate;
  assert.equal(Math.round(qppMax * 100) / 100, 4339.20);
});

test("an unlisted year falls back and says so", () => {
  const r = getPayrollRates(2031);
  assert.equal(r.provisional, true);
  assert.equal(r.year, 2031);
});

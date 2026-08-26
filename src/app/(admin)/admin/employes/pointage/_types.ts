// Shared types for the admin timeclock module.
import { fmtBracket } from "@/lib/time-entry";

export type Entry = {
  id: number;
  adminId: number;
  clockIn: string;
  clockOut: string | null;
  durationMin: number | null;
  category: string;
  notes: string | null;
  pausedAt: string | null;
  totalBreakMin: number;
  /** Paid short-break minutes (tracked, NOT deducted). Optional: absent on stale payloads. */
  paidBreakMin?: number;
  /** Kind of the RUNNING pause: "meal" | "paid" | null. */
  pausedKind?: string | null;
  jobCodeId: number | null;
  isManual: boolean;
  approvedBy: number | null;
  approvedAt: string | null;
  submittedAt: string | null;
  payStubId: number | null;
  admin?: { id: number; fullName: string | null; email: string; title?: string | null; position?: { name: string } | null };
  approver?: { fullName: string | null; email: string } | null;
  jobCode?: { id: number; code: string; label: string } | null;
  history?: HistoryEvent[];
  /** GPS punch capture (optional feature, settings hr_pointage). */
  clockInLat?: number | null;
  clockInLng?: number | null;
  clockOutLat?: number | null;
  clockOutLng?: number | null;
  /** "web" (default) | "kiosk" */
  source?: string;
  /** Number of punches this entry replaced. Null/absent = not a merge. */
  mergedFrom?: number | null;
  /** Gap minutes between the merged punches, counted as break time. */
  mergedGapMin?: number | null;
  restoredFromSnapshotId?: number | null;
};

export type HistoryEvent = {
  id: number;
  event: "approved" | "unapproved" | "rejected" | "edited" | "force_closed" | string;
  reason: string | null;
  createdAt: string;
  actor?: { id: number; fullName: string | null; email: string } | null;
};

export type ForgottenEmployee = {
  adminId: number;
  fullName: string | null;
  email: string;
  title: string | null;
  teamId: number | null;
  teamName: string | null;
  forgottenDays: string[]; // YYYY-MM-DD
};

export type ManualCategory = "work" | "meeting" | "training";

export type ManualEntry = {
  date: string;          // YYYY-MM-DD
  startTime: string;     // HH:MM
  endTime: string;       // HH:MM
  category: ManualCategory;
  notes: string;
};

// Gross bracket, breaks included. Use fmtDuration(durationMin) for worked time.
export const formatShiftDuration = fmtBracket;

// Types partages du module pointage admin.
// Extraits de timeclock-view.tsx pour reutilisation par les composants
// distincts (_components/*).

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

// ─── Helpers de formatage durée (utilises par plusieurs composants extraits) ────
export function formatShiftDuration(clockIn: string, clockOut: string | null): string {
  if (!clockOut) return "—";
  const sec = Math.max(0, Math.floor((new Date(clockOut).getTime() - new Date(clockIn).getTime()) / 1000));
  if (sec < 60) return `${sec}s`;
  if (sec < 3600) return `${Math.floor(sec / 60)}m ${(sec % 60).toString().padStart(2, "0")}s`;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${h}h${m.toString().padStart(2, "0")}`;
}

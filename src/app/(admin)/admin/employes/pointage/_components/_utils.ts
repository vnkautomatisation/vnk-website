// Pure helpers (no hooks, no JSX) shared by the extracted components.

// YYYY-MM-DD key of an ISO timestamp, used to group by day.
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Local 00:00:00.000, used by the period presets.
export function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

export { fmtMin as fmtDuration } from "@/lib/time-entry";

// Uppercase the FIRST letter only; CSS `capitalize` would also capitalize
// the month, which is wrong in French.
export function capFirst(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

// 24h "HH:MM", the module's single time format (fr-CA gives "13 h 17").
export function fmtTime(d: string | Date): string {
  const t = typeof d === "string" ? new Date(d) : d;
  return `${String(t.getHours()).padStart(2, "0")}:${String(t.getMinutes()).padStart(2, "0")}`;
}

// Per-person avatar tint: stable hash of the name -> soft pastel palette.
const AVATAR_PALETTE = [
  "bg-sky-100 text-sky-700",
  "bg-emerald-100 text-emerald-700",
  "bg-violet-100 text-violet-700",
  "bg-amber-100 text-amber-800",
  "bg-rose-100 text-rose-700",
  "bg-cyan-100 text-cyan-700",
  "bg-indigo-100 text-indigo-700",
  "bg-teal-100 text-teal-700",
];
export function avatarColor(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return AVATAR_PALETTE[h % AVATAR_PALETTE.length];
}

// Badge colors per time entry category, with the key of its label. The label
// itself is resolved at render: this map lives outside any component, where
// useTranslations cannot be called.
export const CAT_LABEL: Record<string, { key: string; color: string }> = {
  work: { key: "cat_work", color: "bg-emerald-100 text-emerald-700" },
  break: { key: "cat_break", color: "bg-blue-100 text-blue-700" },
  meeting: { key: "cat_meeting", color: "bg-violet-100 text-violet-700" },
  training: { key: "cat_training", color: "bg-amber-100 text-amber-700" },
  sick: { key: "cat_sick", color: "bg-red-100 text-red-700" },
  vacation: { key: "cat_vacation", color: "bg-cyan-100 text-cyan-700" },
  parental: { key: "cat_parental", color: "bg-pink-100 text-pink-700" },
  bereavement: { key: "cat_bereavement", color: "bg-slate-100 text-slate-700" },
};

/** The label of a category, falling back to the raw value for an unknown one. */
export function catLabel(t: (k: string) => string, category: string): string {
  const cat = CAT_LABEL[category];
  return cat ? t(cat.key) : category;
}

// System stubs written into the employee-owned notes field. The leaves module
// links its entries by parsing "[CONGE AUTO - LeaveRequest #N]", so the value
// has to stay in the column, but it must never reach the reader.
const SYSTEM_STUB = /\[(CONGÉ AUTO - LeaveRequest #\d+|REJET[^\]]*|ANNULATION APPROBATION[^\]]*)\]/g;

export function displayNotes(notes: string | null | undefined): string | null {
  if (!notes) return null;
  const cleaned = notes.replace(SYSTEM_STUB, "").replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : cleaned;
}

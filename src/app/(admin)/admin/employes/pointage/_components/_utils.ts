// Helpers purs (pas de hooks, pas de JSX) extraits de timeclock-view.tsx
// pour reutilisation par les composants extraits (_components/*).
// Refactor #87 — extraction des panels & rows.

// Cle YYYY-MM-DD d'un timestamp ISO (utilise pour grouper par jour).
export function dayKey(iso: string): string {
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Date a 00:00:00.000 locale (utilise par les presets de periode).
export function startOfDay(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  return n;
}

// Total agrege (en minutes) → "Xh MM" ; null/0 → "—".
export function fmtDuration(mins: number | null): string {
  if (mins == null || mins <= 0) return "—";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${h}h${m.toString().padStart(2, "0")}`;
}

// Label CSS d'une categorie de pointage (badges).
export const CAT_LABEL: Record<string, { label: string; color: string }> = {
  work: { label: "Travail", color: "bg-emerald-100 text-emerald-700" },
  break: { label: "Pause", color: "bg-blue-100 text-blue-700" },
  meeting: { label: "Réunion", color: "bg-violet-100 text-violet-700" },
  training: { label: "Formation", color: "bg-amber-100 text-amber-700" },
  sick: { label: "Maladie", color: "bg-red-100 text-red-700" },
  vacation: { label: "Vacances", color: "bg-cyan-100 text-cyan-700" },
  parental: { label: "Parental", color: "bg-pink-100 text-pink-700" },
  bereavement: { label: "Décès", color: "bg-slate-100 text-slate-700" },
};

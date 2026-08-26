"use client";

// VNK KPI tile: soft pastel palette with a navy accent.
// Used by the admin overview and the employee timesheet.
import type { LucideIcon } from "lucide-react";

export function StatBox({
  label, value, accent, onClick, hint, icon: Icon,
}: {
  label: string;
  value: string;
  accent: "emerald" | "blue" | "amber" | "red" | "neutral";
  onClick?: () => void;
  hint?: string;
  icon?: LucideIcon;
}) {
  const map = {
    emerald: { bg: "bg-emerald-50/60", border: "border-emerald-200", value: "text-emerald-800", icon: "text-emerald-600" },
    blue:    { bg: "bg-sky-50/60",     border: "border-sky-200",     value: "text-sky-800",     icon: "text-sky-600" },
    amber:   { bg: "bg-amber-50/60",   border: "border-amber-200",   value: "text-amber-800",   icon: "text-amber-700" },
    red:     { bg: "bg-red-50/60",     border: "border-red-200",     value: "text-red-800",     icon: "text-red-600" },
    neutral: { bg: "bg-card",          border: "border-border",      value: "text-[#0F2D52]",   icon: "text-[#0F2D52]" },
  };
  const c = map[accent];
  const baseCls = `rounded-lg border p-3 ${c.bg} ${c.border}`;
  const inner = (
    <>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
        {Icon && <Icon className={`h-3.5 w-3.5 ${c.icon}`} />}
      </div>
      <p className={`text-2xl font-bold tabular-nums ${c.value}`}>{value}</p>
      {hint && <p className="text-[10px] mt-0.5 text-muted-foreground">{hint}</p>}
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={`${baseCls} text-left transition-shadow hover:shadow-md hover:border-[#0F2D52]/40 focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30`}
      >
        {inner}
      </button>
    );
  }
  return <div className={baseCls}>{inner}</div>;
}

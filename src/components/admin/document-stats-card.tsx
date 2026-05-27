"use client";
// ─────────────────────────────────────────────────────────
// DocumentStatsCard — KPI card pour les dashboards documents
//
// Style cohérent avec StatBox / BalanceKpiCard : palette pastel
// adoucie + accent navy VNK. Cliquable optionnel.
// ─────────────────────────────────────────────────────────
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type Accent = "success" | "warning" | "danger" | "info" | "navy";

const ACCENT_MAP: Record<
  Accent,
  { bg: string; border: string; value: string; icon: string; iconBg: string }
> = {
  success: {
    bg: "bg-emerald-50/60",
    border: "border-emerald-200",
    value: "text-emerald-800",
    icon: "text-emerald-700",
    iconBg: "bg-emerald-100",
  },
  warning: {
    bg: "bg-amber-50/60",
    border: "border-amber-200",
    value: "text-amber-800",
    icon: "text-amber-700",
    iconBg: "bg-amber-100",
  },
  danger: {
    bg: "bg-red-50/60",
    border: "border-red-200",
    value: "text-red-800",
    icon: "text-red-700",
    iconBg: "bg-red-100",
  },
  info: {
    bg: "bg-sky-50/60",
    border: "border-sky-200",
    value: "text-sky-800",
    icon: "text-sky-700",
    iconBg: "bg-sky-100",
  },
  navy: {
    bg: "bg-[#0F2D52]/5",
    border: "border-[#0F2D52]/20",
    value: "text-[#0F2D52]",
    icon: "text-[#0F2D52]",
    iconBg: "bg-[#0F2D52]/10",
  },
};

export function DocumentStatsCard({
  label,
  value,
  icon: Icon,
  accent,
  hint,
  onClick,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent: Accent;
  hint?: string;
  onClick?: () => void;
  className?: string;
}) {
  const c = ACCENT_MAP[accent];

  const inner = (
    <>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground truncate">
          {label}
        </span>
        <div
          className={cn(
            "h-7 w-7 rounded-md flex items-center justify-center shrink-0",
            c.iconBg
          )}
        >
          <Icon className={cn("h-3.5 w-3.5", c.icon)} />
        </div>
      </div>
      <p className={cn("text-2xl font-bold tabular-nums leading-tight", c.value)}>
        {value}
      </p>
      {hint && (
        <p className="text-[10px] mt-1 text-muted-foreground truncate">{hint}</p>
      )}
    </>
  );

  const baseCls = cn(
    "rounded-lg border p-3 sm:p-4",
    c.bg,
    c.border,
    className
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          baseCls,
          "text-left transition-shadow hover:shadow-md hover:border-[#0F2D52]/40 focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30 w-full"
        )}
      >
        {inner}
      </button>
    );
  }
  return <div className={baseCls}>{inner}</div>;
}

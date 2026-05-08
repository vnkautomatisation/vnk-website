"use client";
import type { LucideIcon } from "lucide-react";
import { TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "@/lib/utils";
import Link from "next/link";

export function StatCard({
  label,
  value,
  icon: Icon,
  accent = "bg-blue-500",
  delta,
  deltaLabel,
  href,
  className,
}: {
  label: string;
  value: string | number;
  icon: LucideIcon;
  accent?: string;
  delta?: number;
  deltaLabel?: string;
  href?: string;
  className?: string;
}) {
  const content = (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 sm:p-5 transition-all",
        href && "vnk-card-hover cursor-pointer",
        className
      )}
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={cn(
            "h-10 w-10 sm:h-11 sm:w-11 rounded-lg flex items-center justify-center text-white shrink-0",
            accent
          )}
        >
          <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground truncate">
            {label}
          </p>
          <p className="text-lg sm:text-xl font-bold tracking-tight truncate">
            {value}
          </p>
        </div>
      </div>
      {(delta !== undefined || deltaLabel) && (
        <div className="mt-3 flex items-center gap-1.5 text-xs font-medium">
          {delta !== undefined && delta !== 0 && (
            <>
              {delta > 0 ? (
                <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
              ) : (
                <TrendingDown className="h-3.5 w-3.5 text-red-500" />
              )}
              <span className={delta > 0 ? "text-emerald-600" : "text-red-500"}>
                {delta > 0 ? "+" : ""}
                {delta}%
              </span>
            </>
          )}
          {deltaLabel && (
            <span className="text-muted-foreground truncate">{deltaLabel}</span>
          )}
        </div>
      )}
    </div>
  );

  if (href) {
    return <Link href={href}>{content}</Link>;
  }
  return content;
}

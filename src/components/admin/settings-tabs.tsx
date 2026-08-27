"use client";
// Shared tab bar: navy underline on desktop.
// On mobile a short set becomes a segmented control instead of a scrolling
// strip - three choices that scroll read as broken, not as intentional.
// Longer sets keep the strip, with fade edges and no visible scrollbar.
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

/** Number of tabs up to which the mobile view uses a segmented control. */
const SEGMENTED_MAX = 4;
const GRID_COLS: Record<number, string> = { 1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-3", 4: "grid-cols-4" };

export type TabItem<T extends string = string> = {
  key: T;
  label: string;
  /** Used in the segmented view, where each cell is a third of the screen. */
  shortLabel?: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  dot?: boolean; // notification dot
};

export function SettingsTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  ariaLabel,
  dense = false,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
  ariaLabel?: string;
  /** Segmented at every width, for use inside a pinned bar. */
  dense?: boolean;
}) {
  const segmented = dense || tabs.length <= SEGMENTED_MAX;
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Overflow detection and scroll position.
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const update = () => {
      setShowLeftFade(el.scrollLeft > 4);
      setShowRightFade(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      el.removeEventListener("scroll", update);
      ro.disconnect();
    };
  }, [tabs.length]);

  // Scroll the active tab into view, for programmatic changes.
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <div className={cn("relative", dense ? "sm:border-b" : "border-b", className)}>
      {/* Left fade */}
      {showLeftFade && !segmented && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10"
        />
      )}
      {/* Right fade */}
      {showRightFade && !segmented && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10"
        />
      )}

      <div
        ref={scrollRef}
        role="tablist"
        aria-label={ariaLabel}
        className={cn(
          "-mb-px [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
          segmented
            ? cn("grid gap-1 rounded-xl bg-muted/70 p-1", GRID_COLS[tabs.length], !dense && "sm:flex sm:gap-1 sm:rounded-none sm:bg-transparent sm:p-0")
            : "flex gap-1 overflow-x-auto",
        )}
      >
        {tabs.map((t) => {
          const Icon = t.icon;
          const isActive = t.key === active;
          return (
            <button
              key={t.key}
              ref={isActive ? activeRef : undefined}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              onClick={() => onChange(t.key)}
              className={cn(
                "text-sm font-medium flex items-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2D52]/30",
                segmented
                  ? cn(
                      "min-w-0 justify-center gap-1 rounded-lg px-1.5",
                      dense ? "py-1" : "py-2 sm:justify-start sm:rounded-none sm:rounded-t-md sm:border-b-2 sm:px-4 sm:py-2.5",
                      isActive
                        ? cn("bg-background text-[#0F2D52] shadow-sm", !dense && "sm:bg-transparent sm:shadow-none sm:border-[#0F2D52]")
                        : cn("text-muted-foreground hover:text-foreground", !dense && "sm:border-transparent sm:hover:border-border"),
                    )
                  : cn(
                      "px-4 py-2.5 border-b-2 focus-visible:rounded-t-md",
                      isActive
                        ? "border-[#0F2D52] text-[#0F2D52]"
                        : "border-transparent text-muted-foreground hover:text-foreground hover:border-border",
                    ),
              )}
            >
              {Icon && <Icon className={cn("h-4 w-4 shrink-0", segmented && "hidden", !dense && "sm:block")} />}
              <span className={cn("text-xs sm:text-sm", segmented && "truncate")}>
                {segmented && t.shortLabel
                  ? (dense ? t.shortLabel : (<><span className="sm:hidden">{t.shortLabel}</span><span className="hidden sm:inline">{t.label}</span></>))
                  : t.label}
              </span>
              {t.count !== undefined && (
                <>
                  <span className={cn(
                    "shrink-0 tabular-nums text-[10px] font-semibold text-muted-foreground",
                    segmented ? (dense ? "" : "sm:hidden") : "hidden",
                  )}>
                    {t.count > 99 ? "99+" : t.count}
                  </span>
                  <Badge variant="secondary" className={cn("text-[10px] ml-0.5 px-1.5 py-0 shrink-0", segmented && (dense ? "hidden" : "hidden sm:inline-flex"))}>
                    {t.count}
                  </Badge>
                </>
              )}
              {t.dot && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

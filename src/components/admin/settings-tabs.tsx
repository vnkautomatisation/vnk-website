"use client";
// ─────────────────────────────────────────────────────────
// SettingsTabs — barre d'onglets harmonisée pour les pages settings.
// Style : navy underline VNK, badges secondaires, scroll horizontal mobile.
// + fade gradients indicateurs scroll + auto-scroll vers actif + role=tablist
// ─────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

export type TabItem<T extends string = string> = {
  key: T;
  label: string;
  icon?: React.ComponentType<{ className?: string }>;
  count?: number;
  dot?: boolean; // pastille de notification
};

export function SettingsTabs<T extends string>({
  tabs,
  active,
  onChange,
  className,
  ariaLabel,
}: {
  tabs: TabItem<T>[];
  active: T;
  onChange: (key: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);
  const [showLeftFade, setShowLeftFade] = useState(false);
  const [showRightFade, setShowRightFade] = useState(false);

  // Détection débordement + position scroll
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

  // Auto-scroll vers l'onglet actif (utile si on change via raccourci/programmatique)
  useEffect(() => {
    const el = activeRef.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
  }, [active]);

  return (
    <div className={cn("relative border-b", className)}>
      {/* Fade gauche */}
      {showLeftFade && (
        <div
          aria-hidden
          className="pointer-events-none absolute left-0 top-0 bottom-0 w-8 bg-gradient-to-r from-background to-transparent z-10"
        />
      )}
      {/* Fade droite */}
      {showRightFade && (
        <div
          aria-hidden
          className="pointer-events-none absolute right-0 top-0 bottom-0 w-8 bg-gradient-to-l from-background to-transparent z-10"
        />
      )}

      <div
        ref={scrollRef}
        role="tablist"
        aria-label={ariaLabel}
        className="flex gap-1 overflow-x-auto -mb-px scrollbar-thin"
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
                "px-4 py-2.5 text-sm font-medium border-b-2 flex items-center gap-2 whitespace-nowrap transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0F2D52]/30 focus-visible:rounded-t-md",
                isActive
                  ? "border-[#0F2D52] text-[#0F2D52]"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              {Icon && <Icon className="h-4 w-4" />}
              <span>{t.label}</span>
              {t.count !== undefined && (
                <Badge variant="secondary" className="text-[10px] ml-0.5 px-1.5 py-0">
                  {t.count}
                </Badge>
              )}
              {t.dot && <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

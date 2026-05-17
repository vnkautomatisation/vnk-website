"use client";
// ─────────────────────────────────────────────────────────
// SettingsPageShell — wrapper standardisé pour toutes les pages
// dans /admin/settings/*. Fournit :
//   - Header avec back link (icône + titre + sous-titre + actions)
//   - Sticky compact bar au scroll (pattern dashboard finance)
//   - Container avec espacement standard
//
// Usage :
//   <SettingsPageShell
//     icon={Users}
//     iconColor="bg-rose-500"
//     title="Équipe"
//     subtitle="Comptes employés, rôles et postes"
//     backHref="/admin/settings"
//     actions={<Button>Action</Button>}
//     stickyBadges={[
//       { label: "12 actifs", color: "text-emerald-600" },
//       { label: "3 désactivés", color: "text-muted-foreground" },
//     ]}
//   >
//     {children}
//   </SettingsPageShell>
// ─────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

export type StickyBadge = {
  label: string;
  color?: string; // tailwind text-*
};

export function SettingsPageShell({
  icon: Icon,
  iconColor: _iconColor, // déprécié sur le hero (uniformité visuelle navy/white) — gardé pour compatibilité signature
  title,
  subtitle,
  backHref = "/admin/settings",
  badge,
  actions,
  stickyBadges,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  iconColor?: string; // ex: "bg-rose-500"
  title: string;
  subtitle?: string;
  backHref?: string;
  badge?: React.ReactNode; // badge à côté du titre
  actions?: React.ReactNode; // boutons / search à droite
  stickyBadges?: StickyBadge[]; // info affichée dans la barre sticky
  children: React.ReactNode;
}) {
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div className="space-y-5">
      {/* ── Hero navy gradient ───────────────────────────── */}
      <div className="relative bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-5 text-white overflow-hidden">
        {/* Pattern décoratif subtil en fond */}
        <div
          aria-hidden
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage:
              "radial-gradient(circle at 80% 20%, rgba(255,255,255,0.4) 0%, transparent 50%)",
          }}
        />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-start gap-3.5 min-w-0">
            <Link
              href={backHref}
              className="mt-1.5 text-white/60 hover:text-white transition-colors -ml-1"
              aria-label="Retour"
            >
              <ChevronLeft className="h-5 w-5" />
            </Link>
            <div className="h-12 w-12 rounded-lg flex items-center justify-center shrink-0 shadow-lg ring-2 ring-white/15 bg-white/10 backdrop-blur">
              <Icon className="h-6 w-6 text-white" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl sm:text-2xl font-bold tracking-tight">{title}</h1>
                {badge}
              </div>
              {subtitle && (
                <p className="text-white/75 text-sm mt-1">{subtitle}</p>
              )}
            </div>
          </div>
          {actions && (
            <div className="flex items-center gap-2 shrink-0 [&_button]:bg-white/10 [&_button]:hover:bg-white/20 [&_button]:text-white [&_button]:border-white/20 [&_button]:backdrop-blur">
              {actions}
            </div>
          )}
        </div>
      </div>

      {/* Sentinel + Sticky compact bar (apparaît au scroll) */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      {stickyBadges && stickyBadges.length > 0 && (
        <div
          className={cn(
            "sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-all",
            scrolled
              ? "bg-background/95 backdrop-blur shadow-sm border-b"
              : "bg-transparent pointer-events-none opacity-0 -translate-y-2"
          )}
        >
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Icon className="h-4 w-4" />
              {title}
            </span>
            {stickyBadges.map((b, i) => (
              <span key={i} className={cn("font-medium", b.color ?? "text-muted-foreground")}>
                {b.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── Contenu ──────────────────────────────────────── */}
      {children}
    </div>
  );
}

"use client";
// Sidebar latérale partagée pour les modules (Mon espace, Employés).
// Caractéristiques :
//   - Multi-open : plusieurs groupes peuvent rester ouverts simultanément
//   - Groupe avec icône thématique propre (groupIcon)
//   - Active page : barre navy à gauche (4px) + fond plus marqué + texte bold
//   - Bouton "tout replier / tout déplier" en haut
//   - Badge nombre d'items quand groupe replié (pour savoir ce qu'on cache)
//   - Desktop : sticky, scroll interne propre
//   - Mobile : Sheet drawer dédié
//   - A11y : aria-current="page", role="navigation", aria-expanded
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useMemo } from "react";
import { ChevronDown, Menu, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number | null;
};
export type NavSection = {
  group: string;
  groupIcon?: React.ComponentType<{ className?: string }>;
  items: NavItem[];
};

type Props = {
  moduleLabel: string;          // "Mon espace" | "Employés"
  moduleIcon: React.ComponentType<{ className?: string }>;
  moduleTagline?: string;        // "VNK · Self-service"
  sections: NavSection[];
  storageKey: string;            // pour persister état collapsé groupes
};

export function ModuleSidebarNav({ moduleLabel, moduleIcon: ModuleIcon, moduleTagline, sections, storageKey }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Logique ACCORDEON : un seul groupe ouvert a la fois.
  // Ouvrir un groupe ferme automatiquement les autres. Le groupe contenant
  // la page active reste toujours visible (force-ouvert via isGroupOpen).
  // v3 = nouvelle cle pour invalider tout ancien state d'une version multi-open.
  const accordionKey = `${storageKey}.v3`;

  const allGroupNames = useMemo(() => sections.map((s) => s.group), [sections]);

  // Page active + groupe actif.
  // On calcule UN SEUL activeHref pour tout le module (single source of truth).
  // Sans ca, "/admin/employes" (Liste) matche aussi quand on est sur /admin/employes/anniversaires
  // car le check "moreSpecific" interne a isActive ne voit que les items du meme groupe.
  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const activeHref = useMemo(() => {
    // 1. Exact match prioritaire
    const exact = allItems.find((it) => it.href === pathname);
    if (exact) return exact.href;
    // 2. Sinon : prefix le plus long qui matche pathname
    let best: string | null = null;
    for (const it of allItems) {
      if (pathname === it.href || pathname.startsWith(it.href + "/")) {
        if (!best || it.href.length > best.length) best = it.href;
      }
    }
    return best;
  }, [pathname, allItems]);
  const activeItem = allItems.find((it) => it.href === activeHref);
  const activeGroup = sections.find((s) => s.items.some((it) => it.href === activeHref));

  // Init : aucun groupe explicitement ouvert. Le groupe ACTIF est force-ouvert
  // par isGroupOpen() (UX : on doit toujours voir ou on est).
  // Server-stable (vide -> meme rendu cote serveur et client avant hydration).
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydratation : charger preference user depuis localStorage
  useEffect(() => {
    setHydrated(true);
    try {
      const raw = localStorage.getItem(accordionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string | null;
        if (parsed && allGroupNames.includes(parsed)) setOpenGroup(parsed);
      }
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accordionKey]);

  const persist = (next: string | null) => {
    try { localStorage.setItem(accordionKey, JSON.stringify(next)); } catch { /* ignore */ }
  };

  // ACCORDEON : ouvrir un groupe ferme tous les autres. Re-cliquer ferme.
  const toggleGroup = (group: string) => {
    setOpenGroup((prev) => {
      const next = prev === group ? null : group;
      persist(next);
      return next;
    });
  };

  // Le groupe ACTIF est toujours visiblement ouvert (UX : on doit voir ou on est).
  // Sinon, seul le groupe explicitement ouvert l'est.
  const isGroupOpen = (group: string, section: NavSection) => {
    if (section === activeGroup) return true;
    return openGroup === group;
  };

  // Fermer le drawer mobile à la navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll quand drawer ouvert
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  return (
    <>
      {/* ─── Mobile : bouton menu + breadcrumb compact ───
          STICKY juste sous la topbar admin (64px) : reste accessible meme apres scroll.
          z-[15] pour passer au-dessus du contenu mais sous la topbar (z-30) et le drawer (z-60).
          backdrop-blur + bg semi-opaque pour bien lire par-dessus le contenu scroll. */}
      <div className="lg:hidden sticky top-[64px] z-[15] mb-3 flex items-center justify-between gap-2 p-2.5 rounded-lg border bg-card/95 backdrop-blur-md shadow-sm">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-[#0F2D52] transition"
          aria-label={`Ouvrir le menu ${moduleLabel}`}
        >
          <Menu className="h-4 w-4" />
          <ModuleIcon className="h-4 w-4 text-[#0F2D52]" />
          <span className="font-semibold">{moduleLabel}</span>
        </button>
        {activeItem && (
          <span className="text-xs text-[#0F2D52] inline-flex items-center gap-1 truncate min-w-0 font-medium">
            <activeItem.icon className="h-3 w-3 shrink-0" />
            <span className="truncate">{activeItem.label}</span>
          </span>
        )}
      </div>

      {/* ─── Mobile drawer ─── */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden
          />
          <div className="relative ml-auto w-[85%] max-w-[320px] bg-card flex flex-col shadow-2xl pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
            <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 py-3 flex items-center justify-between shrink-0">
              <div>
                {moduleTagline && (
                  <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{moduleTagline}</p>
                )}
                <h2 className="font-bold text-sm flex items-center gap-2 mt-0.5">
                  <ModuleIcon className="h-4 w-4" />
                  {moduleLabel}
                </h2>
              </div>
              <button
                onClick={() => setMobileOpen(false)}
                className="h-8 w-8 rounded-md hover:bg-white/10 flex items-center justify-center"
                aria-label="Fermer le menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav
              aria-label={`Navigation ${moduleLabel}`}
              className="flex-1 overflow-y-auto p-2 overscroll-contain"
            >
              {sections.map((section, idx) => (
                <NavGroup
                  key={section.group}
                  section={section}
                  activeHref={activeHref}
                  isActiveGroup={section === activeGroup}
                  open={!hydrated || isGroupOpen(section.group, section)}
                  onToggle={() => toggleGroup(section.group)}
                  isFirst={idx === 0}
                />
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* ─── Desktop sidebar ─── */}
      <nav
        aria-label={`Navigation ${moduleLabel}`}
        className="hidden lg:block lg:sticky lg:top-[80px] lg:self-start"
      >
        <div className="rounded-lg border bg-card overflow-hidden flex flex-col lg:max-h-[calc(100vh-6rem)]">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 py-3 shrink-0">
            {moduleTagline && (
              <p className="text-[10px] uppercase tracking-wider font-semibold opacity-80">{moduleTagline}</p>
            )}
            <h2 className="font-bold text-sm flex items-center gap-2 mt-0.5">
              <ModuleIcon className="h-4 w-4" />
              {moduleLabel}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto admin-sidebar-scroll p-2">
            {sections.map((section, idx) => (
              <NavGroup
                key={section.group}
                section={section}
                activeHref={activeHref}
                isActiveGroup={section === activeGroup}
                open={!hydrated || isGroupOpen(section.group, section)}
                onToggle={() => toggleGroup(section.group)}
                isFirst={idx === 0}
              />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

function NavGroup({
  section, activeHref, isActiveGroup, open, onToggle, isFirst,
}: {
  section: NavSection;
  activeHref: string | null;
  isActiveGroup: boolean;
  open: boolean;
  onToggle: () => void;
  isFirst: boolean;
}) {
  const GroupIcon = section.groupIcon;
  const itemCount = section.items.length;

  return (
    <div className={cn(
      // Separateur horizontal au-dessus de chaque groupe (sauf le premier)
      // pour bien distinguer ou un groupe finit et ou l'autre commence.
      !isFirst && "mt-2 pt-2 border-t border-border/50",
    )}>
      {/* ─── Header de GROUPE : style nettement distinct des items ─── */}
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-1.5 py-1 rounded-md transition group/header",
          // Typo distinctive : tres petit, ALLCAPS, letter-spacing tres large, gras
          "text-[10px] uppercase tracking-[0.14em] font-bold",
          isActiveGroup
            ? "text-[#0F2D52]"
            : "text-muted-foreground/70 hover:text-foreground"
        )}
        aria-expanded={open}
      >
        {GroupIcon && (
          <GroupIcon className={cn(
            "h-3.5 w-3.5 shrink-0",
            isActiveGroup ? "text-[#0F2D52]" : "text-muted-foreground/60 group-hover/header:text-foreground"
          )} />
        )}
        <span className="flex-1 text-left truncate">{section.group}</span>
        {!open && itemCount > 0 && (
          <span className="text-[9px] font-bold text-muted-foreground bg-muted rounded-full h-4 min-w-[16px] px-1 inline-flex items-center justify-center normal-case tracking-normal">
            {itemCount}
          </span>
        )}
        <ChevronDown className={cn(
          "h-3 w-3 shrink-0 transition-transform text-muted-foreground/60",
          !open && "-rotate-90"
        )} />
      </button>

      {/* ─── Sous-pages : nettement indentees + bordure verticale claire ─── */}
      {open && (
        <ul className="mt-1 ml-[7px] pl-2 border-l border-border space-y-0.5">
          {section.items.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            return (
              <li key={item.href} className="relative">
                {/* Barre verticale navy qui CHEVAUCHE la border-l du <ul> quand actif */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute -left-[9px] top-1 bottom-1 w-[2px] rounded-r-sm bg-[#0F2D52]"
                  />
                )}
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] transition",
                    active
                      ? "bg-[#0F2D52]/10 text-[#0F2D52] font-semibold"
                      : "text-foreground/75 hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className={cn(
                    "h-4 w-4 shrink-0",
                    active ? "text-[#0F2D52]" : "text-muted-foreground"
                  )} />
                  <span className="truncate flex-1">{item.label}</span>
                  {item.badge != null && item.badge !== 0 && (
                    <span className={cn(
                      "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
                      active ? "bg-[#0F2D52] text-white" : "bg-[#0F2D52]/15 text-[#0F2D52]"
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

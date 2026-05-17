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
import { ChevronDown, Menu, X, ChevronsUpDown, ChevronsDownUp } from "lucide-react";
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

function isActive(pathname: string, href: string, items: NavItem[]): boolean {
  // Pour le lien racine (ex: /admin/employes), exact match seulement
  // si pas d'autre item du même groupe ne matche.
  if (pathname === href) return true;
  if (href.endsWith("/") || href === "/admin/employes" || href === "/admin/mon-espace") {
    // Vérifier qu'aucun autre item plus spécifique ne matche
    const moreSpecific = items.some(
      (i) => i.href !== href && i.href.length > href.length && pathname.startsWith(i.href)
    );
    return !moreSpecific && pathname.startsWith(href);
  }
  return pathname.startsWith(href);
}

export function ModuleSidebarNav({ moduleLabel, moduleIcon: ModuleIcon, moduleTagline, sections, storageKey }: Props) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  const [hydrated, setHydrated] = useState(false);

  // Charger état collapsed depuis localStorage
  useEffect(() => {
    setHydrated(true);
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) setCollapsedGroups(new Set(JSON.parse(raw) as string[]));
    } catch { /* ignore */ }
  }, [storageKey]);

  const persistCollapsed = (next: Set<string>) => {
    try { localStorage.setItem(storageKey, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
  };

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      persistCollapsed(next);
      return next;
    });
  };

  // Page active + groupe actif (toujours développé)
  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const activeItem = allItems.find((it) => isActive(pathname, it.href, allItems));
  const activeGroup = sections.find((s) => s.items.some((it) => isActive(pathname, it.href, s.items)));

  // Expand all / collapse all
  const allCollapsed = sections.every((s) => collapsedGroups.has(s.group) || s === activeGroup);
  const someExpanded = sections.some((s) => !collapsedGroups.has(s.group));
  const toggleAll = () => {
    if (someExpanded) {
      // tout replier (sauf groupe actif)
      const next = new Set(sections.map((s) => s.group));
      if (activeGroup) next.delete(activeGroup.group);
      setCollapsedGroups(next);
      persistCollapsed(next);
    } else {
      // tout déplier
      const next = new Set<string>();
      setCollapsedGroups(next);
      persistCollapsed(next);
    }
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
      {/* ─── Mobile : bouton menu + breadcrumb compact ─── */}
      <div className="lg:hidden mb-3 flex items-center justify-between gap-2 p-3 rounded-lg border bg-card">
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
            <div className="px-3 py-2 border-b shrink-0">
              <button
                type="button"
                onClick={toggleAll}
                className="text-[11px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1 transition"
              >
                {someExpanded ? <ChevronsDownUp className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3" />}
                {someExpanded ? "Tout replier" : "Tout déplier"}
              </button>
            </div>
            <nav
              aria-label={`Navigation ${moduleLabel}`}
              className="flex-1 overflow-y-auto p-2 overscroll-contain"
            >
              {sections.map((section) => (
                <NavGroup
                  key={section.group}
                  section={section}
                  pathname={pathname}
                  isActiveGroup={section === activeGroup}
                  collapsed={hydrated && collapsedGroups.has(section.group) && section !== activeGroup}
                  onToggle={() => toggleGroup(section.group)}
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

          {/* Toolbar : Tout déplier / replier */}
          <div className="px-3 py-1.5 border-b shrink-0 flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Navigation</span>
            <button
              type="button"
              onClick={toggleAll}
              className="text-[11px] text-muted-foreground hover:text-[#0F2D52] inline-flex items-center gap-1 transition"
              aria-label={someExpanded ? "Tout replier" : "Tout déplier"}
              title={someExpanded ? "Tout replier" : "Tout déplier"}
            >
              {someExpanded ? <ChevronsDownUp className="h-3 w-3" /> : <ChevronsUpDown className="h-3 w-3" />}
              <span>{someExpanded ? "Replier" : "Déplier"}</span>
            </button>
          </div>

          <div className="flex-1 overflow-y-auto admin-sidebar-scroll p-2">
            {sections.map((section) => (
              <NavGroup
                key={section.group}
                section={section}
                pathname={pathname}
                isActiveGroup={section === activeGroup}
                collapsed={hydrated && collapsedGroups.has(section.group) && section !== activeGroup}
                onToggle={() => toggleGroup(section.group)}
              />
            ))}
          </div>
        </div>
      </nav>
    </>
  );
}

function NavGroup({
  section, pathname, isActiveGroup, collapsed, onToggle,
}: {
  section: NavSection;
  pathname: string;
  isActiveGroup: boolean;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const GroupIcon = section.groupIcon;
  // Compte d'items quand replié (utile pour ne pas oublier ce qu'on cache)
  const itemCount = section.items.length;

  return (
    <div className="mb-2 last:mb-0">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-[11px] uppercase tracking-wider font-semibold transition",
          isActiveGroup
            ? "text-[#0F2D52] bg-[#0F2D52]/5"
            : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
        )}
        aria-expanded={!collapsed}
      >
        {GroupIcon && (
          <GroupIcon className={cn("h-3.5 w-3.5 shrink-0", isActiveGroup ? "text-[#0F2D52]" : "text-muted-foreground")} />
        )}
        <span className="flex-1 text-left truncate">{section.group}</span>
        {collapsed && (
          <span className="text-[9px] font-bold text-muted-foreground/70 bg-muted/60 rounded px-1.5 py-0.5 normal-case tracking-normal">
            {itemCount}
          </span>
        )}
        <ChevronDown className={cn("h-3 w-3 shrink-0 transition-transform", collapsed && "-rotate-90")} />
      </button>
      {!collapsed && (
        <div className="space-y-0.5 mt-1">
          {section.items.map((item) => {
            const active = isActive(pathname, item.href, section.items);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex items-center gap-2 pl-3 pr-2 py-2 rounded-md text-sm transition",
                  active
                    ? "bg-[#0F2D52]/12 text-[#0F2D52] font-bold"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                )}
              >
                {/* Barre verticale navy à gauche quand actif */}
                {active && (
                  <span
                    aria-hidden
                    className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-sm bg-[#0F2D52]"
                  />
                )}
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#0F2D52]" : "text-muted-foreground")} />
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
            );
          })}
        </div>
      )}
    </div>
  );
}

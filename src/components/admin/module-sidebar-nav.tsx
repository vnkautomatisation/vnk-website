"use client";
// Sidebar latérale partagée pour les modules (Mon espace, Employés).
// Caractéristiques :
//   - Desktop : sticky, hauteur limitée à viewport, scroll interne propre
//   - Desktop : groupes collapsibles avec mémoire localStorage
//   - Mobile : Sheet drawer dédié (bouton "Menu du module") OR scroll horizontal restructuré
//   - A11y : aria-current="page", role="navigation", labels
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

  const toggleGroup = (group: string) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(group)) next.delete(group); else next.add(group);
      try { localStorage.setItem(storageKey, JSON.stringify(Array.from(next))); } catch { /* ignore */ }
      return next;
    });
  };

  // Auto-expand le groupe contenant la page active
  const activeGroup = sections.find((s) =>
    s.items.some((it) => isActive(pathname, it.href, s.items))
  );

  // Fermer le drawer mobile à la navigation
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Lock body scroll quand drawer ouvert
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  const allItems = sections.flatMap((s) => s.items);
  const activeItem = allItems.find((it) => isActive(pathname, it.href, allItems));

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
          <span className="text-xs text-muted-foreground inline-flex items-center gap-1 truncate min-w-0">
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
            <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 py-3 flex items-center justify-between">
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
              {sections.map((section) => (
                <NavGroup
                  key={section.group}
                  section={section}
                  pathname={pathname}
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

          <div className="flex-1 overflow-y-auto admin-sidebar-scroll p-2">
            {sections.map((section) => (
              <NavGroup
                key={section.group}
                section={section}
                pathname={pathname}
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
  section, pathname, collapsed, onToggle,
}: {
  section: NavSection;
  pathname: string;
  collapsed: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="mb-3 last:mb-0">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground hover:text-foreground transition"
        aria-expanded={!collapsed}
      >
        <span>{section.group}</span>
        <ChevronDown className={cn("h-3 w-3 transition-transform", collapsed && "-rotate-90")} />
      </button>
      {!collapsed && (
        <div className="space-y-0.5">
          {section.items.map((item) => {
            const active = isActive(pathname, item.href, section.items);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-md text-sm transition",
                  active
                    ? "bg-[#0F2D52]/10 text-[#0F2D52] font-semibold"
                    : "text-foreground/80 hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", active ? "text-[#0F2D52]" : "text-muted-foreground")} />
                <span className="truncate flex-1">{item.label}</span>
                {item.badge != null && item.badge !== 0 && (
                  <span className="text-[10px] font-semibold bg-[#0F2D52] text-white px-1.5 py-0.5 rounded-full">
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

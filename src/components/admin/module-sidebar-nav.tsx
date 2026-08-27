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
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.ui");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);





  const accordionKey = `${storageKey}.v3`;

  const allGroupNames = useMemo(() => sections.map((s) => s.group), [sections]);





  const allItems = useMemo(() => sections.flatMap((s) => s.items), [sections]);
  const activeHref = useMemo(() => {

    const exact = allItems.find((it) => it.href === pathname);
    if (exact) return exact.href;

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




  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);


  useEffect(() => {
    setHydrated(true);
    try {
      const raw = localStorage.getItem(accordionKey);
      if (raw) {
        const parsed = JSON.parse(raw) as string | null;
        if (parsed && allGroupNames.includes(parsed)) setOpenGroup(parsed);
      }
    } catch { /* ignore */ }

  }, [accordionKey]);

  const persist = (next: string | null) => {
    try { localStorage.setItem(accordionKey, JSON.stringify(next)); } catch { /* ignore */ }
  };


  const toggleGroup = (group: string) => {
    setOpenGroup((prev) => {
      const next = prev === group ? null : group;
      persist(next);
      return next;
    });
  };



  const isGroupOpen = (group: string, section: NavSection) => {
    if (section === activeGroup) return true;
    return openGroup === group;
  };


  useEffect(() => { setMobileOpen(false); }, [pathname]);


  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
      return () => { document.body.style.overflow = ""; };
    }
  }, [mobileOpen]);

  return (
    <>
      {/* ─── Mobile : bouton menu + breadcrumb compact ───
          STICKY top-[64px] z-25 (sous topbar z-30) pour rester visible au scroll.
          Le mini-header de page se positionne ensuite a top-[108px] sur mobile
          (64 topbar + 44 sub-header). HAUTEUR FIXE h-11 (44px).
          Les marges negatives -mx annulent le padding du parent (.p-4 / sm:.p-5
          dans admin/layout) pour que la barre s'etende d'un bord a l'autre.
          PORTAL TARGET (#vnk-module-nav-extra) : les pages peuvent injecter
          des KPIs / badges / contenus contextuels dans cette zone centrale
          via createPortal, evitant ainsi une deuxieme sticky bar empilee. */}
      <div className="lg:hidden sticky top-[64px] z-[25] -mx-4 sm:-mx-5 px-4 sm:px-5 h-11 bg-card flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex items-center gap-2 text-sm font-medium hover:text-[#0F2D52] transition shrink-0"
          aria-label={t("ouvrir_menu", { module: moduleLabel })}
        >
          <Menu className="h-4 w-4" />
          <ModuleIcon className="h-4 w-4 text-[#0F2D52]" />
          <span className="font-semibold">{moduleLabel}</span>
        </button>
        {/* Slot extras (KPIs page-specific via portal).
            justify-start : les KPIs flow naturellement apres t("mon_espace").
            overflow-x-auto + min-w-0 : scroll horizontal si depasse. */}
        <div
          id="vnk-module-nav-extra"
          className="flex-1 min-w-0 flex items-center justify-start gap-x-3 overflow-x-auto no-scrollbar"
        />
        {activeItem && (
          <span className="text-xs text-[#0F2D52] inline-flex items-center gap-1 truncate min-w-0 font-medium shrink-0">
            <activeItem.icon className="h-3 w-3 shrink-0" />
            {/* Label cache sur petits ecrans (<480px) pour liberer la place
                au slot extras (KPIs page-specific). L'icone seule suffit
                comme indicateur visuel de la page active (lib utility 480). */}
            <span className="hidden min-[480px]:inline truncate">{activeItem.label}</span>
          </span>
        )}
      </div>


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
                aria-label={t("fermer_menu")}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav
              aria-label={t("navigation_module", { module: moduleLabel })}
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


      <nav
        aria-label={t("navigation_module", { module: moduleLabel })}
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
  const t = useTranslations("admin.ui");
  const GroupIcon = section.groupIcon;
  const itemCount = section.items.length;

  return (
    <div className={cn(


      !isFirst && "mt-2 pt-2 border-t border-border/50",
    )}>

      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "w-full flex items-center gap-2 px-1.5 py-1 rounded-md transition group/header",

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


      {open && (
        <ul className="mt-1 ml-[7px] pl-2 border-l border-border space-y-0.5">
          {section.items.map((item) => {
            const active = item.href === activeHref;
            const Icon = item.icon;
            return (
              <li key={item.href} className="relative">

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

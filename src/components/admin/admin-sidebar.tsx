"use client";
// Sidebar admin — pattern Wix avec nesting récursif (3+ niveaux) :
// - Items directs au niveau racine
// - Groupes cliquables avec chevron, expansion inline
// - Sous-groupes (récursif) supportés à n'importe quelle profondeur
// - Hover sur groupe (fermé) → flyout panel à droite via portal
// - Mode compact (icon-only) toggle en bas
// - Auto-expand du groupe contenant l'item actif
// - Etat persisté localStorage
// - Responsive : drawer mobile <1024px, sidebar fixe ≥1024px
import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Menu,
  X,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  DashboardIcon,
  WorkflowIcon,
  ClientsIcon,
  OperationsIcon,
  MandatesIcon,
  RequestsIcon,
  CalendarIcon,
  QuotesIcon,
  InvoicesIcon,
  CommunicationIcon,
  MessagesIcon,
  TemplatesIcon,
  DocumentsIcon,
  LegalIcon,
  ContractsIcon,
  DisputesIcon,
  FinanceGroupIcon,
  FinanceSummaryIcon,
  PaymentsGroupIcon,
  TransactionsIcon,
  ReconciliationIcon,
  RefundsIcon,
  SettlementsIcon,
  PayoutsIcon,
  ReceiptsIcon,
  AccountingGroupIcon,
  ExpensesIcon,
  FxRatesIcon,
  TaxDeclarationsIcon,
  AuditTrailIcon,
  ProfileIcon,
  SettingsIcon,
} from "./sidebar-icons";

type NavLeaf = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

type NavGroup = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  children: NavEntry[]; // ← récursif : peut contenir leaf ou group
};

type NavEntry = NavLeaf | NavGroup;

function isGroup(e: NavEntry): e is NavGroup {
  return "children" in e;
}

const NAV: NavEntry[] = [
  { key: "dashboard", icon: DashboardIcon, href: "/admin" },
  { key: "workflow", icon: WorkflowIcon, href: "/admin/workflow" },
  { key: "clients", icon: ClientsIcon, href: "/admin/clients" },
  {
    key: "operations_group",
    icon: OperationsIcon,
    children: [
      { key: "mandates", icon: MandatesIcon, href: "/admin/mandates" },
      { key: "requests", icon: RequestsIcon, href: "/admin/requests" },
      { key: "calendar", icon: CalendarIcon, href: "/admin/calendar" },
      { key: "quotes", icon: QuotesIcon, href: "/admin/quotes" },
      { key: "invoices", icon: InvoicesIcon, href: "/admin/invoices" },
    ],
  },
  {
    key: "communication_group",
    icon: CommunicationIcon,
    children: [
      { key: "messages", icon: MessagesIcon, href: "/admin/messages" },
      { key: "message_templates", icon: TemplatesIcon, href: "/admin/message-templates" },
      { key: "documents", icon: DocumentsIcon, href: "/admin/documents" },
    ],
  },
  {
    key: "legal_group",
    icon: LegalIcon,
    children: [
      { key: "contracts", icon: ContractsIcon, href: "/admin/contracts" },
      { key: "disputes", icon: DisputesIcon, href: "/admin/disputes" },
    ],
  },
  {
    key: "finance_group",
    icon: FinanceGroupIcon,
    children: [
      { key: "finance_summary", icon: FinanceSummaryIcon, href: "/admin/finance" },
      // Sous-groupe : Paiements et flux
      {
        key: "payments_group",
        icon: PaymentsGroupIcon,
        children: [
          { key: "all_payments", icon: TransactionsIcon, href: "/admin/finance/payments" },
          { key: "settlements", icon: SettlementsIcon, href: "/admin/finance/settlements" },
          { key: "payouts", icon: PayoutsIcon, href: "/admin/finance/payouts" },
          { key: "receipts", icon: ReceiptsIcon, href: "/admin/finance/receipts" },
          { key: "transactions", icon: TransactionsIcon, href: "/admin/transactions" },
          { key: "reconciliation", icon: ReconciliationIcon, href: "/admin/finance/reconciliation" },
          { key: "refunds", icon: RefundsIcon, href: "/admin/refunds" },
        ],
      },
      // Sous-groupe : Comptabilité
      {
        key: "accounting_group",
        icon: AccountingGroupIcon,
        children: [
          { key: "expenses", icon: ExpensesIcon, href: "/admin/expenses" },
          { key: "fx_rates", icon: FxRatesIcon, href: "/admin/finance/fx" },
          { key: "tax_declarations", icon: TaxDeclarationsIcon, href: "/admin/tax-declarations" },
        ],
      },
    ],
  },
  { key: "audit_trail", icon: AuditTrailIcon, href: "/admin/audit-trail" },
  { key: "profile", icon: ProfileIcon, href: "/admin/profile" },
  { key: "settings", icon: SettingsIcon, href: "/admin/settings" },
];

export type SidebarCounts = {
  unreadMessages?: number;
  overdueInvoices?: number;
  pendingQuotes?: number;
  pendingContracts?: number;
  activeMandates?: number;
  newRequests?: number;
  openDisputes?: number;
  todayAppointments?: number;
};

const BADGE_MAP: Record<string, keyof SidebarCounts> = {
  messages: "unreadMessages",
  invoices: "overdueInvoices",
  quotes: "pendingQuotes",
  contracts: "pendingContracts",
  mandates: "activeMandates",
  requests: "newRequests",
  disputes: "openDisputes",
  calendar: "todayAppointments",
};

// Récursif : somme tous les badges descendants
function entryBadgeSum(entry: NavEntry, counts: SidebarCounts): number {
  if (!isGroup(entry)) {
    const k = BADGE_MAP[entry.key];
    return k ? counts[k] ?? 0 : 0;
  }
  return entry.children.reduce((sum, c) => sum + entryBadgeSum(c, counts), 0);
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
function saveJson(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* noop */ }
}

// Trouve récursivement la chaîne de groupes contenant le path actif
// Retourne ['finance_group', 'payments_group'] si /admin/transactions est actif
function findAncestorGroupKeys(entries: NavEntry[], pathname: string, ancestors: string[] = []): string[] | null {
  for (const e of entries) {
    if (!isGroup(e)) {
      const active = e.href === "/admin" ? pathname === "/admin" : pathname === e.href || pathname.startsWith(e.href + "/");
      if (active) return ancestors;
      continue;
    }
    const result = findAncestorGroupKeys(e.children, pathname, [...ancestors, e.key]);
    if (result) return result;
  }
  return null;
}

function isLeafActive(href: string, pathname: string): boolean {
  return href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/");
}

export function AdminSidebar({ counts = {} }: { counts?: SidebarCounts }) {
  const t = useTranslations("admin.sidebar");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const [compact, setCompactState] = useState(false);
  useEffect(() => { setCompactState(loadJson("admin.sidebar.compact", false)); }, []);
  const setCompact = (v: boolean) => { setCompactState(v); saveJson("admin.sidebar.compact", v); };

  const [openGroups, setOpenGroupsState] = useState<string[]>([]);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    const stored = loadJson<string[] | null>("admin.sidebar.openGroups", null);
    if (stored) {
      setOpenGroupsState(stored);
    } else {
      // Premier passage : ouvrir tous les ancêtres du path actif
      const ancestors = findAncestorGroupKeys(NAV, pathname) ?? [];
      setOpenGroupsState(ancestors);
    }
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const setOpenGroups = (groups: string[]) => {
    setOpenGroupsState(groups);
    saveJson("admin.sidebar.openGroups", groups);
  };
  const toggleGroup = (key: string) => {
    setOpenGroups(openGroups.includes(key) ? openGroups.filter((k) => k !== key) : [...openGroups, key]);
  };

  // Auto-ouvrir tous les ancêtres du path actif lors de la navigation
  useEffect(() => {
    if (!hydrated) return;
    const ancestors = findAncestorGroupKeys(NAV, pathname);
    if (!ancestors || ancestors.length === 0) return;
    const missing = ancestors.filter((k) => !openGroups.includes(k));
    if (missing.length > 0) {
      setOpenGroups([...openGroups, ...missing]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, hydrated]);

  return (
    <>
      {/* Desktop sidebar (≥ 1024px) */}
      <aside
        className={cn(
          "hidden lg:flex fixed top-[64px] left-0 bottom-0 z-20 flex-col border-r bg-card transition-[width] duration-200",
          compact ? "w-[64px]" : "w-[240px]",
        )}
        aria-label="Navigation admin"
      >
        <SidebarContent
          pathname={pathname}
          t={t}
          counts={counts}
          compact={compact}
          openGroups={openGroups}
          toggleGroup={toggleGroup}
        />
        <button
          type="button"
          onClick={() => setCompact(!compact)}
          className="border-t h-10 flex items-center justify-center text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          aria-label={compact ? "Étendre" : "Réduire"}
          title={compact ? "Étendre la sidebar" : "Réduire la sidebar"}
        >
          {compact ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
        </button>
      </aside>

      {/* Mobile/tablet portrait hamburger (< 1024px) */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-[18px] left-4 z-40 flex h-9 w-9 items-center justify-center rounded-md bg-white/10 text-white hover:bg-white/20 transition-colors"
        aria-label="Menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[85%] max-w-[300px] bg-card flex flex-col">
            <div className="h-[64px] px-5 flex items-center justify-between border-b">
              <span className="font-bold text-sm">Navigation</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="h-9 w-9 rounded-md hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              t={t}
              counts={counts}
              compact={false}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}

function SidebarContent({
  pathname,
  t,
  counts = {},
  compact,
  openGroups,
  toggleGroup,
  onNavigate,
}: {
  pathname: string;
  t: (key: string) => string;
  counts?: SidebarCounts;
  compact: boolean;
  openGroups: string[];
  toggleGroup: (key: string) => void;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto py-2 px-2" aria-label="Navigation principale">
      <ul className="space-y-0.5">
        {NAV.map((entry) => (
          <NavRow
            key={entry.key}
            entry={entry}
            pathname={pathname}
            t={t}
            counts={counts}
            compact={compact}
            depth={0}
            openGroups={openGroups}
            toggleGroup={toggleGroup}
            onNavigate={onNavigate}
          />
        ))}
      </ul>
    </nav>
  );
}

// Render récursif : décide si leaf ou group
function NavRow({
  entry,
  pathname,
  t,
  counts = {},
  compact,
  depth,
  openGroups,
  toggleGroup,
  onNavigate,
}: {
  entry: NavEntry;
  pathname: string;
  t: (key: string) => string;
  counts?: SidebarCounts;
  compact: boolean;
  depth: number;
  openGroups: string[];
  toggleGroup: (key: string) => void;
  onNavigate?: () => void;
}) {
  if (isGroup(entry)) {
    return (
      <GroupRow
        group={entry}
        pathname={pathname}
        t={t}
        counts={counts}
        compact={compact}
        depth={depth}
        isOpen={openGroups.includes(entry.key)}
        onToggle={() => toggleGroup(entry.key)}
        openGroups={openGroups}
        toggleGroup={toggleGroup}
        onNavigate={onNavigate}
      />
    );
  }
  return (
    <LeafRow
      item={entry}
      pathname={pathname}
      t={t}
      counts={counts}
      compact={compact}
      depth={depth}
      onNavigate={onNavigate}
    />
  );
}

function GroupRow({
  group,
  pathname,
  t,
  counts = {},
  compact,
  depth,
  isOpen,
  onToggle,
  openGroups,
  toggleGroup,
  onNavigate,
}: {
  group: NavGroup;
  pathname: string;
  t: (key: string) => string;
  counts?: SidebarCounts;
  compact: boolean;
  depth: number;
  isOpen: boolean;
  onToggle: () => void;
  openGroups: string[];
  toggleGroup: (key: string) => void;
  onNavigate?: () => void;
}) {
  const Icon = group.icon;
  const hasActive = group.children.some((c) => {
    if (isGroup(c)) {
      return findAncestorGroupKeys([c], pathname) !== null;
    }
    return isLeafActive(c.href, pathname);
  });
  const badge = entryBadgeSum(group, counts);
  const label = t(group.key);

  // Hover flyout via portal
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const [flyoutPos, setFlyoutPos] = useState<{ top: number; left: number } | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const showFlyout = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setFlyoutPos({ top: rect.top, left: rect.right + 6 });
    }
  };
  const hideFlyoutLater = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setFlyoutPos(null), 180);
  };
  useEffect(() => () => { if (closeTimer.current) clearTimeout(closeTimer.current); }, []);

  // Flyout actif si : compact OU (groupe fermé en mode normal)
  const flyoutEligible = compact || !isOpen;

  // Indentation par niveau (level 0 = racine, level 1 = enfant d'un groupe, etc.)
  const indentClass = depth === 0 ? "" : depth === 1 ? "ml-2" : "ml-4";

  return (
    <li className="relative">
      <button
        ref={buttonRef}
        type="button"
        onClick={onToggle}
        onMouseEnter={flyoutEligible ? showFlyout : undefined}
        onMouseLeave={flyoutEligible ? hideFlyoutLater : undefined}
        title={compact ? label : undefined}
        className={cn(
          "flex w-full items-center rounded-lg text-sm transition-colors relative",
          compact ? "h-9 w-9 mx-auto justify-center" : "gap-3 px-3 py-2",
          !compact && indentClass,
          hasActive && !isOpen ? "bg-[#0F2D52]/10 text-[#0F2D52] font-medium" : "text-foreground hover:bg-muted",
        )}
        aria-expanded={isOpen}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!compact && (
          <>
            <span className="flex-1 text-left truncate">{label}</span>
            {badge > 0 && (
              <span className="text-[10px] font-semibold rounded-full bg-red-500 text-white px-1.5 min-w-[18px] text-center shrink-0">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
            {isOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
          </>
        )}
        {compact && badge > 0 && (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
        )}
      </button>

      {/* Enfants — inline expansion (mode normal + groupe ouvert) */}
      {isOpen && !compact && (
        <ul className={cn(
          "mt-0.5 space-y-0.5 border-l border-border",
          depth === 0 ? "ml-[1.1rem]" : "ml-[1.5rem]",
        )}>
          {group.children.map((child) => (
            <NavRow
              key={child.key}
              entry={child}
              pathname={pathname}
              t={t}
              counts={counts}
              compact={false}
              depth={depth + 1}
              openGroups={openGroups}
              toggleGroup={toggleGroup}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}

      {/* Flyout — portal vers body pour eviter le clipping par overflow */}
      {flyoutPos && flyoutEligible && typeof document !== "undefined" && createPortal(
        <div
          className="fixed bg-card border rounded-lg shadow-xl p-1 min-w-[220px] z-[60]"
          style={{ top: flyoutPos.top, left: flyoutPos.left }}
          onMouseEnter={showFlyout}
          onMouseLeave={hideFlyoutLater}
        >
          <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b mb-1 flex items-center gap-1.5">
            <Icon className="h-3 w-3" />
            {label}
          </p>
          <ul className="space-y-0.5">
            {group.children.map((child) => (
              <FlyoutNavRow
                key={child.key}
                entry={child}
                pathname={pathname}
                t={t}
                counts={counts}
                onNavigate={() => { setFlyoutPos(null); onNavigate?.(); }}
              />
            ))}
          </ul>
        </div>,
        document.body,
      )}
    </li>
  );
}

// Version flyout récursive : sub-groups apparaissent en sub-flyout au hover
function FlyoutNavRow({
  entry,
  pathname,
  t,
  counts = {},
  onNavigate,
}: {
  entry: NavEntry;
  pathname: string;
  t: (key: string) => string;
  counts?: SidebarCounts;
  onNavigate?: () => void;
}) {
  if (!isGroup(entry)) {
    return (
      <LeafRow
        item={entry}
        pathname={pathname}
        t={t}
        counts={counts}
        compact={false}
        depth={0}
        onNavigate={onNavigate}
      />
    );
  }

  // Sub-group dans flyout : inline expansion au clic, pas de sous-flyout pour rester simple
  const Icon = entry.icon;
  const label = t(entry.key);
  const [open, setOpen] = useState(false);
  const badge = entryBadgeSum(entry, counts);

  return (
    <li>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-muted transition-colors"
      >
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 text-left truncate">{label}</span>
        {badge > 0 && (
          <span className="text-[10px] font-semibold rounded-full bg-red-500 text-white px-1.5 min-w-[18px] text-center shrink-0">
            {badge > 99 ? "99+" : badge}
          </span>
        )}
        {open ? <ChevronDown className="h-3 w-3 text-muted-foreground" /> : <ChevronRight className="h-3 w-3 text-muted-foreground" />}
      </button>
      {open && (
        <ul className="ml-4 mt-0.5 space-y-0.5 border-l border-border pl-1">
          {entry.children.map((child) => (
            <FlyoutNavRow
              key={child.key}
              entry={child}
              pathname={pathname}
              t={t}
              counts={counts}
              onNavigate={onNavigate}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function LeafRow({
  item,
  pathname,
  t,
  counts = {},
  compact,
  depth,
  onNavigate,
}: {
  item: NavLeaf;
  pathname: string;
  t: (key: string) => string;
  counts?: SidebarCounts;
  compact: boolean;
  depth: number;
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const active = isLeafActive(item.href, pathname);
  const countKey = BADGE_MAP[item.key];
  const badgeValue = countKey ? counts[countKey] : undefined;
  const label = t(item.key);
  const indentClass = depth === 0 ? "" : depth === 1 ? "ml-2" : "ml-4";

  return (
    <li>
      <Link
        href={item.href}
        onClick={onNavigate}
        title={compact ? label : undefined}
        className={cn(
          "flex items-center rounded-lg text-sm transition-colors relative",
          compact ? "h-9 w-9 mx-auto justify-center" : "gap-3 px-3 py-2",
          !compact && indentClass,
          active
            ? "bg-[#0F2D52] text-white font-medium shadow-sm"
            : "text-foreground hover:bg-muted",
        )}
        aria-current={active ? "page" : undefined}
      >
        <Icon className="h-4 w-4 shrink-0" />
        {!compact && (
          <>
            <span className="flex-1 truncate">{label}</span>
            {badgeValue && badgeValue > 0 ? (
              <span
                className={cn(
                  "text-[10px] font-semibold rounded-full px-1.5 min-w-[18px] text-center shrink-0",
                  active ? "bg-white/20 text-white" : "bg-red-500 text-white",
                )}
                aria-label={`${badgeValue} nouveau(x)`}
              >
                {badgeValue > 99 ? "99+" : badgeValue}
              </span>
            ) : null}
          </>
        )}
        {compact && badgeValue && badgeValue > 0 ? (
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full bg-red-500" />
        ) : null}
      </Link>
    </li>
  );
}

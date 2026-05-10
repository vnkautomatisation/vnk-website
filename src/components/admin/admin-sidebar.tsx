"use client";
// Sidebar admin — meme style que portal-sidebar
// Se positionne sous le topbar (top-[64px]), items actifs en navy
import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Workflow,
  Users,
  Briefcase,
  Inbox,
  Calendar,
  FileText,
  Receipt,
  MessageSquare,
  Zap,
  FolderOpen,
  FileSignature,
  AlertCircle,
  CreditCard,
  RotateCcw,
  TrendingUp,
  Wallet,
  FileBarChart,
  UserCircle,
  Settings,
  Menu,
  X,
} from "lucide-react";

type NavItem = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

type NavGroup = { key: string; items: NavItem[] };

const GROUPS: NavGroup[] = [
  {
    key: "accueil",
    items: [
      { key: "dashboard", icon: LayoutDashboard, href: "/admin" },
      { key: "workflow", icon: Workflow, href: "/admin/workflow" },
    ],
  },
  {
    key: "clients_group",
    items: [{ key: "clients", icon: Users, href: "/admin/clients" }],
  },
  {
    key: "operations_group",
    items: [
      { key: "mandates", icon: Briefcase, href: "/admin/mandates" },
      { key: "requests", icon: Inbox, href: "/admin/requests" },
      { key: "calendar", icon: Calendar, href: "/admin/calendar" },
      { key: "quotes", icon: FileText, href: "/admin/quotes" },
      { key: "invoices", icon: Receipt, href: "/admin/invoices" },
    ],
  },
  {
    key: "communication_group",
    items: [
      { key: "messages", icon: MessageSquare, href: "/admin/messages" },
      { key: "message_templates", icon: Zap, href: "/admin/message-templates" },
      { key: "documents", icon: FolderOpen, href: "/admin/documents" },
    ],
  },
  {
    key: "legal_group",
    items: [
      { key: "contracts", icon: FileSignature, href: "/admin/contracts" },
      { key: "disputes", icon: AlertCircle, href: "/admin/disputes" },
    ],
  },
  {
    key: "finance_group",
    items: [
      { key: "transactions", icon: CreditCard, href: "/admin/transactions" },
      { key: "refunds", icon: RotateCcw, href: "/admin/refunds" },
      { key: "finance_summary", icon: TrendingUp, href: "/admin/finance" },
      { key: "expenses", icon: Wallet, href: "/admin/expenses" },
      { key: "tax_declarations", icon: FileBarChart, href: "/admin/tax-declarations" },
    ],
  },
  {
    key: "system_group",
    items: [
      { key: "profile", icon: UserCircle, href: "/admin/profile" },
      { key: "settings", icon: Settings, href: "/admin/settings" },
    ],
  },
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

export function AdminSidebar({ counts = {} }: { counts?: SidebarCounts }) {
  const t = useTranslations("admin.sidebar");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar — sous le topbar */}
      <aside
        className="hidden lg:flex fixed top-[64px] left-0 bottom-0 z-20 w-[240px] flex-col border-r bg-card"
        aria-label="Navigation admin"
      >
        <SidebarNav pathname={pathname} t={t} counts={counts} />
      </aside>

      {/* Mobile hamburger — dans le topbar */}
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
            <SidebarNav
              pathname={pathname}
              t={t}
              counts={counts}
              onNavigate={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}
    </>
  );
}

function SidebarNav({
  pathname,
  t,
  counts = {},
  onNavigate,
}: {
  pathname: string;
  t: (key: string) => string;
  counts?: SidebarCounts;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex-1 overflow-y-auto p-3 space-y-4" aria-label="Navigation principale">
      {GROUPS.map((group) => (
        <div key={group.key}>
          <div className="px-3 text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-1.5">
            {t(group.key)}
          </div>
          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = item.href === "/admin"
                ? pathname === "/admin"
                : pathname === item.href || pathname.startsWith(item.href + "/");
              const countKey = BADGE_MAP[item.key];
              const badgeValue = countKey ? counts[countKey] : undefined;
              return (
                <li key={item.key}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors",
                      active
                        ? "bg-[#0F2D52] text-white font-medium shadow-sm"
                        : "text-foreground hover:bg-muted"
                    )}
                    aria-current={active ? "page" : undefined}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="flex-1 truncate">{t(item.key)}</span>
                    {badgeValue && badgeValue > 0 ? (
                      <span
                        className={cn(
                          "h-2.5 w-2.5 rounded-full shrink-0",
                          active ? "bg-white/70" : "bg-red-500"
                        )}
                      />
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}

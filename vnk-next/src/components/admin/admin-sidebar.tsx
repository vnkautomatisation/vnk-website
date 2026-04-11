"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
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
  badge?: number;
};

type NavGroup = {
  key: string;
  items: NavItem[];
};

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

export function AdminSidebar() {
  const t = useTranslations("admin.sidebar");
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside
        className={cn(
          "hidden lg:flex fixed top-0 left-0 bottom-0 z-40",
          "w-[240px] flex-col border-r bg-card"
        )}
        aria-label={t("dashboard")}
      >
        <SidebarContent pathname={pathname} t={t} />
      </aside>

      {/* ── Mobile menu trigger ─────────────────────────── */}
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 flex h-11 w-11 items-center justify-center rounded-lg bg-card border shadow-sm"
        aria-label={t("dashboard")}
      >
        <Menu className="h-5 w-5" />
      </button>

      {/* ── Mobile drawer ──────────────────────────────── */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside
            className={cn(
              "lg:hidden fixed top-0 left-0 bottom-0 z-50",
              "w-[280px] flex-col border-r bg-card flex"
            )}
            role="dialog"
            aria-modal="true"
            aria-label={t("dashboard")}
          >
            <button
              type="button"
              onClick={() => setMobileOpen(false)}
              className="absolute top-3 right-3 flex h-9 w-9 items-center justify-center rounded-md hover:bg-accent"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent
              pathname={pathname}
              t={t}
              onNavigate={() => setMobileOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  );
}

function SidebarContent({
  pathname,
  t,
  onNavigate,
}: {
  pathname: string;
  t: (key: string) => string;
  onNavigate?: () => void;
}) {
  return (
    <>
      {/* Logo */}
      <div className="h-[60px] flex items-center gap-3 px-5 border-b">
        <div className="h-9 w-9 rounded-lg vnk-gradient flex items-center justify-center">
          <span className="text-white font-bold text-sm">VNK</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-tight truncate">
            Automatisation Inc.
          </div>
          <div className="text-[10px] text-muted-foreground leading-tight">
            VALUE · NETWORK · KNOWLEDGE
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-5" aria-label="Navigation principale">
        {GROUPS.map((group) => (
          <div key={group.key}>
            <div className="px-3 text-[10px] font-bold tracking-wider text-muted-foreground uppercase mb-2">
              {t(group.key)}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href || pathname.startsWith(item.href + "/");
                return (
                  <li key={item.key}>
                    <Link
                      href={item.href as "/admin"}
                      onClick={onNavigate}
                      className={cn(
                        "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                        active
                          ? "bg-primary text-primary-foreground font-medium"
                          : "text-foreground hover:bg-accent"
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{t(item.key)}</span>
                      {item.badge ? (
                        <span className="ml-auto text-[10px] bg-destructive text-destructive-foreground rounded-full px-1.5 py-0.5">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>
    </>
  );
}

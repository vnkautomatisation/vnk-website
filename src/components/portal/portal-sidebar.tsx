"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  Inbox,
  FileText,
  Receipt,
  FileSignature,
  FolderOpen,
  CalendarPlus,
  Calendar,
  Menu,
  X,
} from "lucide-react";

type Tab = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

const TABS: Tab[] = [
  { key: "dashboard", icon: LayoutDashboard, href: "/portail" },
  { key: "mandates", icon: Briefcase, href: "/portail/mandats" },
  { key: "quotes", icon: FileText, href: "/portail/devis" },
  { key: "invoices", icon: Receipt, href: "/portail/factures" },
  { key: "contracts", icon: FileSignature, href: "/portail/contrats" },
  { key: "documents", icon: FolderOpen, href: "/portail/documents" },
  { key: "my_requests", icon: Inbox, href: "/portail/demandes" },
  { key: "booking", icon: CalendarPlus, href: "/portail/reserver" },
  { key: "appointments", icon: Calendar, href: "/portail/rendez-vous" },
];

export function PortalSidebar({
  clientName,
  clientCompany,
}: {
  clientName: string;
  clientCompany?: string;
}) {
  const t = useTranslations("portal.sidebar");
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Desktop sidebar */}
      <aside
        className="hidden lg:flex fixed top-[70px] left-0 bottom-0 z-20 w-[240px] flex-col border-r bg-card"
        aria-label="Navigation portail"
      >
        <SidebarContent pathname={pathname} t={t} />
      </aside>

      {/* Mobile trigger */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-[78px] left-3 z-20 flex h-10 w-10 items-center justify-center rounded-lg bg-card border shadow-sm"
        aria-label="Menu portail"
      >
        <Menu className="h-4 w-4" />
      </button>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <aside className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[280px] flex flex-col bg-card border-r">
            <div className="h-[64px] px-5 flex items-center justify-between border-b">
              <span className="font-semibold text-sm">Portail client</span>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-md hover:bg-accent flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <SidebarContent
              pathname={pathname}
              t={t}
              onNavigate={() => setOpen(false)}
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
    <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Navigation">
      {TABS.map((tab) => {
        const Icon = tab.icon;
        const active =
          tab.href === "/portail"
            ? pathname === "/portail"
            : pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <NextLink
            key={tab.key}
            href={tab.href}
            prefetch
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
            <span className="flex-1 truncate">{t(tab.key)}</span>
          </NextLink>
        );
      })}
    </nav>
  );
}

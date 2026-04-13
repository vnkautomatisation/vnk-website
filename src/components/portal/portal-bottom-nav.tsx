"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Briefcase,
  Plus,
  Calendar,
  Menu,
  X,
  FileText,
  Receipt,
  FileSignature,
  FolderOpen,
  Inbox,
  CalendarPlus,
} from "lucide-react";
import type { PortalBadges } from "./portal-sidebar";

const BOTTOM_ITEMS = [
  { key: "dashboard", icon: LayoutDashboard, href: "/portail" },
  { key: "mandates", icon: Briefcase, href: "/portail/mandats" },
  { key: "new", icon: Plus, href: "/portail/demandes", primary: true },
  { key: "appointments", icon: Calendar, href: "/portail/rendez-vous" },
  { key: "more", icon: Menu, href: "#" },
];

const MORE_ITEMS = [
  { key: "quotes", icon: FileText, href: "/portail/devis", badgeKey: "pendingQuotes" as const },
  { key: "invoices", icon: Receipt, href: "/portail/factures", badgeKey: "unpaidInvoices" as const },
  { key: "contracts", icon: FileSignature, href: "/portail/contrats", badgeKey: "pendingContracts" as const },
  { key: "documents", icon: FolderOpen, href: "/portail/documents", badgeKey: "unreadDocs" as const },
  { key: "my_requests", icon: Inbox, href: "/portail/demandes" },
  { key: "booking", icon: CalendarPlus, href: "/portail/reserver" },
];

export function PortalBottomNav({ badges }: { badges?: PortalBadges }) {
  const t = useTranslations("portal.sidebar");
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (href: string) =>
    href === "/portail" ? pathname === "/portail" : pathname === href || pathname.startsWith(href + "/");

  // Check if any MORE item is active or has badge
  const hasMoreNotif = MORE_ITEMS.some(
    (item) => item.badgeKey && badges && badges[item.badgeKey] > 0
  );

  return (
    <>
      {/* Bottom nav bar */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-card border-t h-[64px] pb-safe flex items-stretch justify-around"
        aria-label="Navigation mobile"
      >
        {BOTTOM_ITEMS.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);
          const isMore = item.key === "more";

          if (item.primary) {
            return (
              <Link
                key={item.key}
                href={item.href}
                prefetch
                className="flex flex-col items-center justify-center flex-1 relative"
              >
                <div className="h-11 w-11 rounded-full vnk-gradient text-white flex items-center justify-center shadow-lg -mt-6">
                  <Icon className="h-5 w-5" />
                </div>
              </Link>
            );
          }

          if (isMore) {
            return (
              <button
                key={item.key}
                type="button"
                onClick={() => setMoreOpen(true)}
                className="flex flex-col items-center justify-center flex-1 gap-0.5 text-xs text-muted-foreground relative"
                aria-label="Plus"
              >
                <div className="relative">
                  <Icon className="h-5 w-5" />
                  {hasMoreNotif && (
                    <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500" />
                  )}
                </div>
                <span>{t("more")}</span>
              </button>
            );
          }

          return (
            <Link
              key={item.key}
              href={item.href}
              prefetch
              className={cn(
                "flex flex-col items-center justify-center flex-1 gap-0.5 text-xs",
                active ? "text-[#0F2D52] font-medium" : "text-muted-foreground"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-5 w-5" />
              <span>{t(item.key as "dashboard")}</span>
            </Link>
          );
        })}
      </nav>

      {/* "Plus" bottom sheet */}
      {moreOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            onClick={() => setMoreOpen(false)}
          />
          <div className="absolute bottom-0 left-0 right-0 bg-card rounded-t-2xl shadow-2xl max-h-[70vh] overflow-y-auto animate-in slide-in-from-bottom duration-200">
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-2">
              <div className="h-1 w-10 rounded-full bg-muted-foreground/30" />
            </div>

            {/* Header */}
            <div className="px-5 pb-3 flex items-center justify-between">
              <span className="font-semibold text-sm">Navigation</span>
              <button
                onClick={() => setMoreOpen(false)}
                className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Menu items */}
            <nav className="px-3 pb-6 space-y-0.5">
              {MORE_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                const hasBadge = item.badgeKey && badges && badges[item.badgeKey] > 0;
                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    prefetch
                    onClick={() => setMoreOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-colors",
                      active
                        ? "bg-[#0F2D52] text-white font-medium shadow-sm"
                        : "text-foreground hover:bg-muted"
                    )}
                  >
                    <div className={cn(
                      "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
                      active ? "bg-white/15" : "bg-[#0F2D52]/10"
                    )}>
                      <Icon className={cn("h-4 w-4", active ? "text-white" : "text-[#0F2D52]")} />
                    </div>
                    <span className="flex-1">{t(item.key as "quotes")}</span>
                    {hasBadge && (
                      <span className={cn(
                        "h-2.5 w-2.5 rounded-full shrink-0",
                        active ? "bg-white/70" : "bg-red-500"
                      )} />
                    )}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}

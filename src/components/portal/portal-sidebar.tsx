"use client";
import { useState, useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import NextLink from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  UserCircle,
  Briefcase,
  Inbox,
  FileText,
  Receipt,
  FileSignature,
  FolderOpen,
  CalendarPlus,
  Calendar,
  Bell,
  MessageCircle,
  LogOut,
  Menu,
  X,
  Globe,
} from "lucide-react";
import { signOut } from "next-auth/react";

type Tab = {
  key: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
};

const TABS: Tab[] = [
  { key: "dashboard", icon: LayoutDashboard, href: "/portail" },
  { key: "profile", icon: UserCircle, href: "/portail/profil" },
  { key: "mandates", icon: Briefcase, href: "/portail/mandats" },
  { key: "my_requests", icon: Inbox, href: "/portail/demandes" },
  { key: "quotes", icon: FileText, href: "/portail/devis" },
  { key: "invoices", icon: Receipt, href: "/portail/factures" },
  { key: "contracts", icon: FileSignature, href: "/portail/contrats" },
  { key: "documents", icon: FolderOpen, href: "/portail/documents" },
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
  const currentLocale = useLocale();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const otherLocale = currentLocale === "fr" ? "en" : "fr";
  const otherLabel = otherLocale.toUpperCase();

  const toggleLocale = () => {
    startTransition(async () => {
      await fetch("/api/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: otherLocale }),
      });
      window.location.reload();
    });
  };

  return (
    <>
      {/* ── Desktop sidebar ─────────────────────────────── */}
      <aside
        className="hidden lg:flex fixed top-0 left-0 bottom-0 z-40 w-[240px] flex-col border-r bg-card"
        aria-label="Navigation portail"
      >
        <Content
          pathname={pathname}
          t={t}
          clientName={clientName}
          clientCompany={clientCompany}
          otherLabel={otherLabel}
          toggleLocale={toggleLocale}
          pending={pending}
        />
      </aside>

      {/* ── Mobile: trigger + drawer ────────────────────── */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-3 left-3 z-30 flex h-11 w-11 items-center justify-center rounded-lg bg-card border shadow-sm"
        aria-label={t("dashboard")}
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <aside
            className="lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[290px] flex flex-col border-r bg-card"
            role="dialog"
            aria-modal="true"
          >
            <button
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 h-9 w-9 rounded-md hover:bg-accent flex items-center justify-center"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
            <Content
              pathname={pathname}
              t={t}
              clientName={clientName}
              clientCompany={clientCompany}
              otherLabel={otherLabel}
              toggleLocale={toggleLocale}
              pending={pending}
              onNavigate={() => setOpen(false)}
            />
          </aside>
        </>
      )}
    </>
  );
}

function Content({
  pathname,
  t,
  clientName,
  clientCompany,
  otherLabel,
  toggleLocale,
  pending,
  onNavigate,
}: {
  pathname: string;
  t: (key: string) => string;
  clientName: string;
  clientCompany?: string;
  otherLabel: string;
  toggleLocale: () => void;
  pending: boolean;
  onNavigate?: () => void;
}) {
  return (
    <>
      <div className="h-[80px] px-5 py-4 border-b flex items-center gap-3">
        <div className="h-10 w-10 rounded-full vnk-gradient flex items-center justify-center text-white text-sm font-bold shrink-0">
          {clientName.split(" ").map((s) => s[0]).join("").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{clientName}</div>
          {clientCompany && (
            <div className="text-xs text-muted-foreground truncate">
              {clientCompany}
            </div>
          )}
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-3 space-y-0.5" aria-label="Navigation principale">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const active = pathname === tab.href || pathname.startsWith(tab.href + "/");
          return (
            <NextLink
              key={tab.key}
              href={tab.href}
              onClick={onNavigate}
              className={cn(
                "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                active
                  ? "bg-primary text-primary-foreground font-medium"
                  : "hover:bg-accent"
              )}
              aria-current={active ? "page" : undefined}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 truncate">{t(tab.key)}</span>
            </NextLink>
          );
        })}
      </nav>

      <div className="p-3 border-t space-y-1">
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent text-muted-foreground">
          <Bell className="h-4 w-4" />
          {t("notifications")}
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent text-muted-foreground">
          <MessageCircle className="h-4 w-4" />
          {t("contact_us")}
        </button>
        <button
          type="button"
          onClick={toggleLocale}
          disabled={pending}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-accent text-muted-foreground disabled:opacity-50"
          aria-label={`Changer vers ${otherLabel}`}
        >
          <Globe className="h-4 w-4" />
          <span className="flex-1 text-left">Langue</span>
          <span className="text-xs font-bold tracking-wider px-2 py-0.5 rounded border">
            {otherLabel}
          </span>
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/portail/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm hover:bg-destructive/10 text-destructive"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
    </>
  );
}

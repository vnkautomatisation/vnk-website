"use client";
// Topbar admin — meme style que portal-topbar
// Barre pleine largeur, logo VNK, notifs, refresh, locale, avatar
import { useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ExternalLink, RefreshCw, User, LogOut, Settings } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link as IntlLink } from "@/i18n/routing";
import NextLink from "next/link";
import { signOut } from "next-auth/react";

export function AdminTopbar({
  adminName,
  adminEmail,
  overdueCount = 0,
}: {
  adminName: string;
  adminEmail: string;
  overdueCount?: number;
}) {
  const t = useTranslations("admin.topbar");
  const currentLocale = useLocale();
  const [pending, startTransition] = useTransition();

  const otherLocale = currentLocale === "fr" ? "en" : "fr";
  const otherLabel = otherLocale.toUpperCase();

  const initials = adminName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
    <header className="sticky top-0 z-30 bg-[#0F2D52]/95 backdrop-blur-md shadow-lg">
      <div className="h-[64px] px-4 sm:px-6 flex items-center justify-between">
        {/* Logo — identique au portail */}
        <NextLink href="/admin" className="flex items-center gap-3 group shrink-0">
          <div className="h-10 w-10 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
            <span className="text-white font-bold text-sm">VNK</span>
          </div>
          <div className="hidden sm:block">
            <div className="text-sm font-bold leading-tight text-white">
              Automatisation Inc.
            </div>
            <div className="text-[9px] text-white/60 tracking-[0.15em] font-medium">
              VALUE · NETWORK · KNOWLEDGE
            </div>
          </div>
        </NextLink>

        {/* Actions droite */}
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <div className="hidden md:flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-red-500/20 text-red-200 font-medium">
              {t("overdue_invoices", { count: overdueCount })}
            </div>
          )}

          <NotificationBell />

          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.location.reload()}
            className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
            title={t("refresh")}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <Button
            variant="ghost"
            size="icon"
            asChild
            className="hidden sm:flex h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
          >
            <IntlLink href="/" target="_blank" title={t("site")}>
              <ExternalLink className="h-4 w-4" />
            </IntlLink>
          </Button>

          <button
            type="button"
            onClick={toggleLocale}
            disabled={pending}
            className="h-8 px-2.5 rounded-md border border-white/20 text-xs font-bold tracking-wider text-white hover:bg-white/10 transition-colors disabled:opacity-50"
          >
            {otherLabel}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-white/10 transition-colors" aria-label="Menu utilisateur">
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="text-sm font-medium">{adminName}</div>
                <div className="text-xs text-muted-foreground truncate">
                  {adminEmail}
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem asChild>
                <NextLink href="/admin/profile">
                  <User className="h-4 w-4 mr-2" />
                  Mon profil
                </NextLink>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <NextLink href="/admin/settings">
                  <Settings className="h-4 w-4 mr-2" />
                  Parametres
                </NextLink>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => signOut({ callbackUrl: "/admin/login" })}
                className="text-destructive"
              >
                <LogOut className="h-4 w-4 mr-2" />
                Deconnexion
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

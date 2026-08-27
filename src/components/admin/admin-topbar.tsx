"use client";
// Topbar admin — meme style que portal-topbar
// Barre pleine largeur, logo VNK, notifs, refresh, locale, avatar
import { useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import { ExternalLink, RefreshCw, User, LogOut, Settings } from "lucide-react";
import { NotificationBell } from "./notification-bell";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Link as IntlLink } from "@/i18n/routing";
import NextLink from "next/link";
import { signOut } from "next-auth/react";

export function AdminTopbar({
  adminName,
  adminEmail,
  adminAvatarUrl,
  overdueCount = 0,
}: {
  adminName: string;
  adminEmail: string;
  adminAvatarUrl?: string | null;
  overdueCount?: number;
}) {
  const tc = useTranslations("common");
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
      <div className="h-[64px] pl-14 pr-4 sm:pr-6 lg:pl-6 flex items-center justify-between">
        {/* Logo — pl-14 jusqu'a lg pour laisser place au hamburger fixed (qui occupe ~48px) ;
            pl-6 a partir de lg ou la sidebar prend le relais (plus de hamburger). */}
        <NextLink href="/admin" className="flex items-center gap-3 group shrink-0">
          <div className="h-8 w-8 sm:h-10 sm:w-10 rounded-lg bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center shrink-0 group-hover:bg-white/20 transition-colors">
            <span className="text-white font-bold text-[10px] sm:text-sm">VNK</span>
          </div>
          <div className="block min-w-0">
            <div className="text-xs sm:text-sm font-bold leading-tight text-white truncate">
              {t("automatisation_inc")}
            </div>
            <div className="text-[8px] sm:text-[9px] text-white/60 tracking-[0.12em] sm:tracking-[0.15em] font-medium truncate">
              {t("value_network_knowledge")}
            </div>
          </div>
        </NextLink>


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
            className="hidden sm:flex h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
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
            className="hidden sm:inline-flex h-8 px-2.5 rounded-md border border-white/20 text-xs font-bold tracking-wider text-white hover:bg-white/10 transition-colors disabled:opacity-50 items-center"
          >
            {otherLabel}
          </button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-white/10 transition-colors" aria-label={t("menu_utilisateur")}>
                <Avatar className="h-8 w-8 ring-2 ring-white/20">
                  {adminAvatarUrl && (
                    <AvatarImage src={adminAvatarUrl} alt={adminName} className="object-cover" />
                  )}
                  <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64 p-0 overflow-hidden">

              <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar className="h-11 w-11 ring-2 ring-white/30 shrink-0">
                    {adminAvatarUrl && (
                      <AvatarImage src={adminAvatarUrl} alt={adminName} className="object-cover" />
                    )}
                    <AvatarFallback className="bg-white/20 text-white text-sm font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">{adminName}</p>
                    <p className="text-[11px] text-white/70 truncate">{adminEmail}</p>
                  </div>
                </div>
              </div>


              <div className="py-1">
                <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#0F2D52]/5 focus:text-[#0F2D52]">
                  <NextLink href="/admin/profile">
                    <User className="h-4 w-4 mr-2 text-[#0F2D52]" />
                    {t("mon_profil")}
                  </NextLink>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#0F2D52]/5 focus:text-[#0F2D52]">
                  <NextLink href="/admin/settings">
                    <Settings className="h-4 w-4 mr-2 text-[#0F2D52]" />
                    {t("parametres")}
                  </NextLink>
                </DropdownMenuItem>
              </div>


              <div className="sm:hidden">
                <DropdownMenuSeparator className="my-0" />
                <div className="py-1">
                  <DropdownMenuItem onClick={() => window.location.reload()} className="cursor-pointer focus:bg-[#0F2D52]/5 focus:text-[#0F2D52]">
                    <RefreshCw className="h-4 w-4 mr-2 text-[#0F2D52]" />
                    {tc("refresh")}
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="cursor-pointer focus:bg-[#0F2D52]/5 focus:text-[#0F2D52]">
                    <a href="/" target="_blank" rel="noopener">
                      <ExternalLink className="h-4 w-4 mr-2 text-[#0F2D52]" />
                      {t("voir_site_public")}
                    </a>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={toggleLocale} disabled={pending} className="cursor-pointer focus:bg-[#0F2D52]/5 focus:text-[#0F2D52]">
                    <span className="h-4 w-4 mr-2 inline-flex items-center justify-center text-[10px] font-bold border border-[#0F2D52] text-[#0F2D52] rounded">
                      {otherLabel}
                    </span>
                    Passer en {currentLocale === "fr" ? t("anglais") : t("francais")}
                  </DropdownMenuItem>
                </div>
              </div>


              <DropdownMenuSeparator className="my-0" />
              <div className="py-1 bg-red-50/40">
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/admin/login" })}
                  className="cursor-pointer text-red-600 focus:text-red-700 focus:bg-red-100 font-medium"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  {t("deconnexion")}
                </DropdownMenuItem>
              </div>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}

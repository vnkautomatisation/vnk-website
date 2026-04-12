"use client";
import { useTransition } from "react";
import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import { Bell, ExternalLink, RefreshCw, User } from "lucide-react";
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
    <header className="h-[60px] sticky top-0 z-20 bg-[#0F2D52] text-white flex items-center justify-between px-4 lg:pl-[260px]">
      <div className="flex items-center gap-3 pl-12 lg:pl-0">
        <NextLink href="/" className="flex items-center gap-2">
          <Image src="/images/vnk-icon-transparent-white.svg" alt="VNK" width={24} height={24} />
          <span className="font-bold text-sm hidden sm:inline">VNK</span>
        </NextLink>
        <span className="text-xs bg-white/20 px-2 py-0.5 rounded font-semibold">Admin</span>
      </div>

      <div className="flex items-center gap-2">
        {overdueCount > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-red-500/20 text-red-200 font-medium">
            <Bell className="h-3.5 w-3.5" />
            {t("overdue_invoices", { count: overdueCount })}
          </div>
        )}

        <Button
          variant="ghost"
          size="sm"
          onClick={() => window.location.reload()}
          className="hidden sm:flex text-white/70 hover:text-white hover:bg-white/10"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{t("refresh")}</span>
        </Button>

        <Button
          variant="ghost"
          size="sm"
          asChild
          className="hidden sm:flex text-white/70 hover:text-white hover:bg-white/10"
        >
          <IntlLink href="/" target="_blank">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t("site")}</span>
          </IntlLink>
        </Button>

        {/* Locale switcher — cookie-based (admin sans prefix URL) */}
        <button
          type="button"
          onClick={toggleLocale}
          disabled={pending}
          aria-label={`Changer vers ${otherLabel}`}
          className="inline-flex items-center justify-center h-8 px-2.5 rounded-md border border-white/20 text-xs font-bold tracking-wider hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {otherLabel}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-white/10 transition-colors" aria-label="Menu utilisateur">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                  {adminName.slice(0, 2).toUpperCase()}
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
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/admin/login" })}
              className="text-destructive"
            >
              Déconnexion
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}

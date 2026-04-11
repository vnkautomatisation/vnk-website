"use client";
import { useTranslations, useLocale } from "next-intl";
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
import { Link, usePathname } from "@/i18n/routing";
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
  const pathname = usePathname();

  const otherLocale = currentLocale === "fr" ? "en" : "fr";
  const otherLabel = otherLocale.toUpperCase();
  const switcherHref =
    otherLocale === "en" ? `/en${pathname || ""}` : pathname || "/";

  return (
    <header className="h-[60px] sticky top-0 z-20 bg-card border-b flex items-center justify-between px-4 lg:pl-[260px]">
      <div className="flex items-center gap-2 pl-12 lg:pl-0">
        <h1 className="text-sm font-semibold">Admin</h1>
      </div>

      <div className="flex items-center gap-2">
        {overdueCount > 0 && (
          <div className="hidden sm:flex items-center gap-2 text-xs px-3 py-1.5 rounded-md bg-destructive/10 text-destructive font-medium">
            <Bell className="h-3.5 w-3.5" />
            {t("overdue_invoices", { count: overdueCount })}
          </div>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={() => window.location.reload()}
          className="hidden sm:flex"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden md:inline">{t("refresh")}</span>
        </Button>

        <Button
          variant="outline"
          size="sm"
          asChild
          className="hidden sm:flex"
        >
          <Link href="/" target="_blank">
            <ExternalLink className="h-3.5 w-3.5" />
            <span className="hidden md:inline">{t("site")}</span>
          </Link>
        </Button>

        {/* Locale switcher */}
        <NextLink
          href={switcherHref}
          aria-label={`Changer vers ${otherLabel}`}
          className="inline-flex items-center justify-center h-9 w-12 rounded-md border border-border text-xs font-bold tracking-wider hover:bg-accent transition-colors"
        >
          {otherLabel}
        </NextLink>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full p-1 hover:bg-accent" aria-label="Menu utilisateur">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="vnk-gradient text-white">
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
              <Link href={"/admin/profile" as "/admin"}>
                <User className="h-4 w-4 mr-2" />
                Mon profil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={() => signOut({ callbackUrl: "/fr/admin/login" })}
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

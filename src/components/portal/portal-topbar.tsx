"use client";

// Topbar du portail : reprend la barre de navigation du site public
// + avatar client + notifications + langue (cookie-based)

import { useState, useEffect, useTransition } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { signOut } from "next-auth/react";
import {
  Menu,
  X,
  Bell,
  LogOut,
  User,
  ArrowRight,
  Home,
  Wrench,
  Info,
  Phone,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { label: "Accueil", href: "/", icon: Home },
  { label: "Services", href: "/services", icon: Wrench },
  { label: "A propos", href: "/a-propos", icon: Info },
  { label: "Contact", href: "/contact", icon: Phone },
];

export function PortalTopbar({
  clientName,
  clientCompany,
}: {
  clientName: string;
  clientCompany?: string;
}) {
  const currentLocale = useLocale();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const otherLocale = currentLocale === "fr" ? "en" : "fr";
  const otherLabel = otherLocale.toUpperCase();

  const initials = clientName
    .split(" ")
    .map((s) => s[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

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
      <header
        className={cn(
          "sticky top-0 z-30 transition-all duration-300",
          scrolled
            ? "bg-[#0F2D52]/95 backdrop-blur-md shadow-lg"
            : "bg-[#0F2D52]"
        )}
      >
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-[64px] flex items-center justify-between">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group shrink-0">
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
          </Link>

          {/* Desktop nav */}
          <nav className="hidden lg:flex items-center gap-1" aria-label="Navigation">
            {NAV_ITEMS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                className="px-3 py-2 rounded-md text-sm font-medium text-white/80 hover:text-white hover:bg-white/10 transition-all"
              >
                {item.label}
              </Link>
            ))}

            <div className="h-5 w-px bg-white/20 mx-2" />

            {/* Portail link (active) */}
            <Link
              href="/portail"
              prefetch
              className="px-3 py-2 rounded-md text-sm font-medium text-white bg-white/15"
            >
              Mon portail
            </Link>
          </nav>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
            >
              <Bell className="h-4 w-4" />
            </Button>

            {/* Locale */}
            <button
              type="button"
              onClick={toggleLocale}
              disabled={pending}
              className="h-8 px-2.5 rounded-md border border-white/20 text-xs font-bold tracking-wider text-white hover:bg-white/10 transition-colors disabled:opacity-50"
            >
              {otherLabel}
            </button>

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center gap-2 rounded-full p-0.5 hover:bg-white/10 transition-colors">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-white/20 text-white text-xs font-bold">
                      {initials}
                    </AvatarFallback>
                  </Avatar>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-medium">{clientName}</div>
                  {clientCompany && (
                    <div className="text-xs text-muted-foreground">{clientCompany}</div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/portail" prefetch>
                    <Home className="h-4 w-4 mr-2" />
                    Tableau de bord
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/portail/profil" prefetch>
                    <User className="h-4 w-4 mr-2" />
                    Mon profil
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: "/portail/login" })}
                  className="text-destructive"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Deconnexion
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            {/* Mobile menu */}
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              className="lg:hidden h-9 w-9 rounded-md border border-white/20 flex items-center justify-center text-white hover:bg-white/10"
              aria-label="Menu"
            >
              <Menu className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile drawer */}
      {mobileOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <div className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[85%] max-w-sm bg-[#0F2D52] text-white flex flex-col">
            <div className="h-[64px] px-5 flex items-center justify-between border-b border-white/10">
              <span className="font-bold">Menu</span>
              <button
                onClick={() => setMobileOpen(false)}
                className="h-9 w-9 rounded-md hover:bg-white/10 flex items-center justify-center"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 p-5 space-y-1">
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    prefetch
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-4 py-3 rounded-md text-white/80 hover:text-white hover:bg-white/10 transition-colors"
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </Link>
                );
              })}
              <div className="border-t border-white/10 my-3" />
              <Link
                href="/portail"
                prefetch
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-3 px-4 py-3 rounded-md bg-white/10 text-white font-medium"
              >
                Mon portail
              </Link>
            </nav>
          </div>
        </>
      )}
    </>
  );
}

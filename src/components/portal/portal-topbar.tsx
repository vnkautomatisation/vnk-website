"use client";

import { useTransition } from "react";
import { useLocale } from "next-intl";
import Link from "next/link";
import Image from "next/image";
import { signOut } from "next-auth/react";
import { Bell, LogOut, User, Globe } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function PortalTopbar({
  clientName,
  clientCompany,
}: {
  clientName: string;
  clientCompany?: string;
}) {
  const currentLocale = useLocale();
  const [pending, startTransition] = useTransition();
  const otherLocale = currentLocale === "fr" ? "en" : "fr";
  const otherLabel = otherLocale.toUpperCase();

  const initials = clientName
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
    <header className="h-14 sticky top-0 z-30 bg-[#0F2D52] text-white flex items-center justify-between px-4 lg:pl-[256px]">
      {/* Left: Logo (visible mobile + desktop) */}
      <div className="flex items-center gap-3 pl-12 lg:pl-0">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src="/images/vnk-icon-transparent-white.svg"
            alt="VNK"
            width={28}
            height={28}
            className="shrink-0"
          />
          <span className="font-bold text-sm hidden sm:inline">
            VNK Automatisation
          </span>
        </Link>
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-2">
        {/* Notifications */}
        <Button
          variant="ghost"
          size="icon"
          className="h-9 w-9 text-white/70 hover:text-white hover:bg-white/10"
        >
          <Bell className="h-4 w-4" />
        </Button>

        {/* Locale toggle */}
        <button
          type="button"
          onClick={toggleLocale}
          disabled={pending}
          className="h-8 px-2.5 rounded-md border border-white/20 text-xs font-bold tracking-wider hover:bg-white/10 transition-colors disabled:opacity-50"
        >
          {otherLabel}
        </button>

        {/* User menu */}
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
              <Link href="/portail/profil">
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
      </div>
    </header>
  );
}

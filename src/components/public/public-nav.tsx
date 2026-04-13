"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import NextLink from "next/link";
import { cn } from "@/lib/utils";
import { Menu, X, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const currentLocale = useLocale();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const items: { key: string; href: string }[] = [
    { key: "home", href: "/" },
    { key: "services", href: "/services" },
    { key: "about", href: "/a-propos" },
    { key: "contact", href: "/contact" },
  ];

  const isActive = (href: string) => {
    if (href === "/") return pathname === "/";
    return pathname.startsWith(href);
  };

  const otherLocale = currentLocale === "fr" ? "en" : "fr";
  const otherLabel = otherLocale === "fr" ? "FR" : "EN";
  const switcherHref =
    otherLocale === "en" ? `/en${pathname || ""}` : pathname || "/";

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-30 transition-all duration-300 border-b border-white/10",
        scrolled
          ? "bg-[#0F2D52] shadow-lg"
          : "bg-[#0F2D52] backdrop-blur-md"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 group">
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
        <nav
          className="hidden lg:flex items-center gap-1"
          aria-label="Navigation principale"
        >
          {items.map((item) => {
            const active = isActive(item.href);
            return (
              <Link
                key={item.key}
                href={item.href as "/"}
                className={cn(
                  "relative px-4 py-2 rounded-md text-sm font-medium transition-all",
                  active
                    ? "text-white bg-white/10"
                    : "text-white/80 hover:text-white hover:bg-white/5"
                )}
                aria-current={active ? "page" : undefined}
              >
                {t(item.key as "home")}
                {active && (
                  <span className="absolute -bottom-[18px] left-1/2 -translate-x-1/2 h-0.5 w-8 bg-white rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Divider */}
          <div className="h-6 w-px bg-white/20 mx-3" />

          {/* Portail CTA */}
          <Button
            asChild
            size="sm"
            className="bg-white text-[#0F2D52] hover:bg-white/90 font-semibold px-4"
          >
            <Link href="/portail">
              {t("portal")}
            </Link>
          </Button>

          {/* Locale switcher — bouton FR/EN */}
          <NextLink
            href={switcherHref}
            aria-label={`Changer vers ${otherLabel}`}
            className="ml-2 inline-flex items-center justify-center h-9 w-12 rounded-md border border-white/20 text-xs font-bold tracking-wider text-white hover:bg-white/10 transition-colors"
          >
            {otherLabel}
          </NextLink>
        </nav>

        {/* Mobile — langue + menu */}
        <div className="lg:hidden flex items-center gap-2">
          <NextLink
            href={switcherHref}
            aria-label={`Changer vers ${otherLabel}`}
            className="inline-flex items-center justify-center h-10 w-12 rounded-md border border-white/20 text-xs font-bold text-white hover:bg-white/10"
          >
            {otherLabel}
          </NextLink>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-10 w-10 rounded-md border border-white/20 flex items-center justify-center text-white hover:bg-white/10"
            aria-label={t("menu")}
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {open && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/70 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[85%] max-w-sm bg-[#0a1f3a] text-white flex flex-col shadow-2xl"
          >
            <div className="h-[72px] px-5 flex items-center justify-between border-b border-white/15">
              <span className="font-bold text-base">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-md hover:bg-white/10 flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 p-4 space-y-1">
              {items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.key}
                    href={item.href as "/"}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center justify-between px-4 py-3.5 rounded-lg text-[15px] font-medium transition-colors",
                      active
                        ? "bg-white/15 text-white"
                        : "text-white/70 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    <span>{t(item.key as "home")}</span>
                    {active && (
                      <span className="h-2 w-2 rounded-full bg-white" />
                    )}
                  </Link>
                );
              })}
              <div className="border-t border-white/10 mt-4 pt-4">
                <Button
                  asChild
                  className="w-full bg-white text-[#0F2D52] hover:bg-white/90 font-semibold h-11"
                >
                  <Link href="/portail" onClick={() => setOpen(false)}>
                    {t("portal")}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </Link>
                </Button>
              </div>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}

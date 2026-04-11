"use client";
import { useState, useEffect } from "react";
import { useTranslations, useLocale } from "next-intl";
import { usePathname, Link } from "@/i18n/routing";
import NextLink from "next/link";
import { cn } from "@/lib/utils";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export function PublicNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const currentLocale = useLocale();
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Sticky effect : nav devient compacte après scroll
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

  // Locale switcher href
  const otherLocale = currentLocale === "fr" ? "en" : "fr";
  const otherLabel = otherLocale === "fr" ? "FR" : "EN";
  const switcherHref =
    otherLocale === "en" ? `/en${pathname || ""}` : pathname || "/";

  return (
    <header
      className={cn(
        "fixed top-0 inset-x-0 z-30 transition-all duration-300",
        scrolled
          ? "bg-background/95 backdrop-blur-sm border-b shadow-sm"
          : "bg-transparent border-b border-transparent"
      )}
    >
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 h-[70px] flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-lg vnk-gradient flex items-center justify-center shrink-0">
            <span className="text-white font-bold text-sm">VNK</span>
          </div>
          <div className="hidden sm:block">
            <div
              className={cn(
                "text-sm font-bold leading-tight transition-colors",
                scrolled ? "text-foreground" : "text-foreground"
              )}
            >
              Automatisation Inc.
            </div>
            <div className="text-[9px] text-muted-foreground tracking-wider">
              VALUE · NETWORK · KNOWLEDGE
            </div>
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden lg:flex items-center gap-6" aria-label="Navigation principale">
          {items.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.key}
                href={item.href as "/"}
                className={cn(
                  "text-sm font-medium transition-colors relative",
                  active
                    ? "text-primary"
                    : "text-foreground hover:text-primary"
                )}
                aria-current={active ? "page" : undefined}
              >
                {t(item.key as "home")}
                {active && (
                  <span className="absolute -bottom-1.5 left-0 right-0 h-0.5 bg-primary rounded-full" />
                )}
              </Link>
            );
          })}

          {/* Portail CTA */}
          <Button asChild variant="default">
            <Link href="/portail">{t("portal")}</Link>
          </Button>

          {/* Locale switcher — bouton FR/EN comme avant */}
          <NextLink
            href={switcherHref}
            aria-label={`Changer vers ${otherLabel}`}
            className="inline-flex items-center justify-center h-9 w-12 rounded-md border border-border text-xs font-bold tracking-wider text-foreground hover:bg-accent transition-colors"
          >
            {otherLabel}
          </NextLink>
        </nav>

        {/* Mobile trigger */}
        <div className="lg:hidden flex items-center gap-2">
          <NextLink
            href={switcherHref}
            aria-label={`Changer vers ${otherLabel}`}
            className="inline-flex items-center justify-center h-9 w-11 rounded-md border border-border text-xs font-bold text-foreground hover:bg-accent"
          >
            {otherLabel}
          </NextLink>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="h-11 w-11 rounded-lg border flex items-center justify-center"
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
            className="lg:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            onClick={() => setOpen(false)}
            aria-hidden="true"
          />
          <div
            role="dialog"
            aria-modal="true"
            className="lg:hidden fixed top-0 right-0 bottom-0 z-50 w-[85%] max-w-sm bg-card border-l flex flex-col"
          >
            <div className="h-[70px] px-5 flex items-center justify-between border-b">
              <span className="font-semibold">Menu</span>
              <button
                onClick={() => setOpen(false)}
                className="h-9 w-9 rounded-md hover:bg-accent flex items-center justify-center"
                aria-label="Fermer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <nav className="flex-1 p-5 space-y-1">
              {items.map((item) => (
                <Link
                  key={item.key}
                  href={item.href as "/"}
                  onClick={() => setOpen(false)}
                  className="flex items-center px-3 py-3 rounded-md hover:bg-accent font-medium"
                >
                  {t(item.key as "home")}
                </Link>
              ))}
              <Button asChild className="w-full mt-4">
                <Link href="/portail">{t("portal")}</Link>
              </Button>
            </nav>
          </div>
        </>
      )}
    </header>
  );
}

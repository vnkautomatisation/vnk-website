"use client";
// Bouton FR/EN qui recharge la page dans l'autre langue
// - Clic sur "EN" → va sur /en/page-actuelle
// - Clic sur "FR" → va sur /page-actuelle (sans préfixe)
import { usePathname } from "@/i18n/routing";
import { useLocale } from "next-intl";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function LocaleSwitcher({ className }: { className?: string }) {
  const currentLocale = useLocale();
  const pathname = usePathname();

  // Si FR (défaut) → afficher "EN" qui amène sur /en/...
  // Si EN → afficher "FR" qui amène sur /... (sans préfixe)
  const otherLocale = currentLocale === "fr" ? "en" : "fr";
  const otherLabel = otherLocale === "fr" ? "FR" : "EN";

  // Construire le href : si otherLocale === fr → juste pathname, sinon /en + pathname
  const href = otherLocale === "en" ? `/en${pathname}` : pathname || "/";

  return (
    <Link
      href={href}
      aria-label={`Changer la langue vers ${otherLabel}`}
      className={cn(
        "inline-flex items-center justify-center h-9 px-3 rounded-md",
        "text-xs font-semibold tracking-wider border border-white/20 text-white",
        "hover:bg-white/10 transition-colors",
        className
      )}
    >
      {otherLabel}
    </Link>
  );
}

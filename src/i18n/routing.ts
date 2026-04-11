import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  // Jamais de préfixe dans l'URL pour le français (par défaut).
  // L'anglais utilise /en/... seulement si l'utilisateur le choisit.
  localePrefix: "as-needed",
  localeDetection: false, // on laisse l'utilisateur choisir via le bouton FR/EN
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  locales: ["fr", "en"],
  defaultLocale: "fr",
  // French, the default, carries no URL prefix; English uses /en/...
  localePrefix: "as-needed",
  // First visit only: an English browser lands on the English page. Once the
  // visitor clicks FR or EN the NEXT_LOCALE cookie wins from then on.
  localeDetection: true,
});

export type Locale = (typeof routing.locales)[number];

export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);

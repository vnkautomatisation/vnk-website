import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { routing } from "./routing";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// One cookie per surface: browsing the marketing site must never flip the
// shop-floor kiosk, and the portal must not follow the public site either.
export const LOCALE_COOKIES = {
  public: "NEXT_LOCALE",
  portal: "VNK_PORTAL_LOCALE",
  kiosk: "VNK_KIOSK_LOCALE",
} as const;

export type LocaleScope = keyof typeof LOCALE_COOKIES;

const isLocale = (v: string | undefined | null): v is "fr" | "en" =>
  !!v && routing.locales.includes(v as "fr" | "en");

// "en-CA,en;q=0.9,fr;q=0.8" -> "en"
function fromAcceptLanguage(header: string | null): string | undefined {
  if (!header) return undefined;
  const ranked = header
    .split(",")
    .map((part) => {
      const [tag, q] = part.trim().split(";q=");
      return { tag: tag.split("-")[0].toLowerCase(), q: q ? Number(q) : 1 };
    })
    .sort((a, b) => b.q - a.q);
  return ranked.find((r) => isLocale(r.tag))?.tag;
}

export default getRequestConfig(async ({ requestLocale }) => {
  // The [locale] segment, for the public site only.
  let locale = await requestLocale;
  let timeZone = "America/Toronto";

  const h = await headers().catch(() => null);
  const pathname =
    h?.get("x-pathname") || h?.get("x-invoke-path") || h?.get("next-url") || "";

  const scope: LocaleScope | "admin" = pathname.startsWith("/admin")
    ? "admin"
    : pathname.startsWith("/kiosque")
      ? "kiosk"
      : pathname.startsWith("/portail")
        ? "portal"
        : "public";

  const cookieStore = await cookies().catch(() => null);
  const cookieFor = (s: LocaleScope) => cookieStore?.get(LOCALE_COOKIES[s])?.value;

  if (scope === "admin" || scope === "portal") {
    // Signed-in surfaces keep their preference in the database, so it follows
    // the person across devices instead of living in one browser.
    try {
      const session = await auth();
      if (scope === "admin" && session?.user?.role === "admin" && session.user.adminId) {
        const admin = await prisma.admin.findUnique({
          where: { id: session.user.adminId },
          select: { locale: true, timezone: true },
        });
        const lang = admin?.locale?.split("-")[0];
        if (isLocale(lang)) locale = lang;
        if (admin?.timezone) timeZone = admin.timezone;
      }
      if (scope === "portal" && session?.user?.role === "client" && session.user.clientId) {
        const client = await prisma.client.findUnique({
          where: { id: session.user.clientId },
          select: { locale: true },
        });
        const lang = client?.locale?.split("-")[0];
        if (isLocale(lang)) locale = lang;
      }
    } catch { /* fallback below */ }

    // Signed out (the portal login page) or no stored preference.
    if (scope === "portal" && !isLocale(locale)) {
      const c = cookieFor("portal");
      if (isLocale(c)) locale = c;
    }
  } else if (scope === "kiosk") {
    // Shared device: the choice lives on the device, seeded from its browser.
    const c = cookieFor("kiosk");
    locale = isLocale(c) ? c : fromAcceptLanguage(h?.get("accept-language") ?? null);
  } else if (!isLocale(locale)) {
    const c = cookieFor("public");
    if (isLocale(c)) locale = c;
  }

  if (!isLocale(locale)) locale = routing.defaultLocale;

  return {
    locale,
    // One file per namespace under messages/<locale>/: a single catalogue of
    // several thousand keys is unreviewable, and the index puts it back together.
    messages: (await import(`../../messages/${locale}`)).default,
    timeZone,
    now: new Date(),
  };
});

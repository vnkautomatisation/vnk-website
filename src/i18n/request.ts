import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { routing } from "./routing";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export default getRequestConfig(async ({ requestLocale }) => {
  // 1. Tentative URL-based locale (utilisé par le site public via [locale] segment)
  let locale = await requestLocale;
  let timeZone = "America/Toronto";

  // 2. Détection du contexte admin : si on est sur /admin/*, on utilise EXCLUSIVEMENT
  //    admin.locale stocké en base. Le cookie NEXT_LOCALE est ignoré pour éviter
  //    toute interférence avec le site public.
  let isAdminContext = false;
  try {
    const h = await headers();
    const pathname =
      h.get("x-pathname") ||
      h.get("x-invoke-path") ||
      h.get("next-url") ||
      "";
    if (pathname.startsWith("/admin") || pathname.includes("/admin/")) {
      isAdminContext = true;
    }
  } catch { /* fallback */ }

  // 3. Admin connecté → priorité absolue à sa préférence
  try {
    const session = await auth();
    if (session?.user?.role === "admin" && session.user.adminId) {
      const admin = await prisma.admin.findUnique({
        where: { id: session.user.adminId },
        select: { locale: true, timezone: true },
      });
      if (admin?.locale) {
        const adminLang = admin.locale.split("-")[0];
        if (routing.locales.includes(adminLang as "fr" | "en")) {
          locale = adminLang;
        }
      }
      if (admin?.timezone) {
        timeZone = admin.timezone;
      }
    }
  } catch { /* fallback */ }

  // 4. Cookie fallback UNIQUEMENT pour le site public (jamais en contexte admin)
  if (!isAdminContext && (!locale || !routing.locales.includes(locale as "fr" | "en"))) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
    if (cookieLocale && routing.locales.includes(cookieLocale as "fr" | "en")) {
      locale = cookieLocale;
    }
  }

  // 5. Défaut final
  if (!locale || !routing.locales.includes(locale as "fr" | "en")) {
    locale = routing.defaultLocale;
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone,
    now: new Date(),
  };
});

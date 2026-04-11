import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  // 1. Try URL-based locale first (public site uses [locale] segment)
  let locale = await requestLocale;

  // 2. If no URL locale (admin/portal routes), fall back to NEXT_LOCALE cookie
  if (!locale || !routing.locales.includes(locale as "fr" | "en")) {
    const cookieStore = await cookies();
    const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
    if (cookieLocale && routing.locales.includes(cookieLocale as "fr" | "en")) {
      locale = cookieLocale;
    } else {
      locale = routing.defaultLocale;
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
    timeZone: "America/Montreal",
    now: new Date(),
  };
});

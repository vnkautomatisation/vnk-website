import { useLocale } from "next-intl";

// Dates and numbers follow the reader's locale, never the language of the source.
export function dateLocale(locale: string): string {
  return locale.startsWith("en") ? "en-CA" : "fr-CA";
}

export function useDateLocale(): string {
  return dateLocale(useLocale());
}

// Month and weekday names come from Intl, so a new locale needs no new table.
// Sunday-first, matching the calendars across the portal.
function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function monthNames(locale: string, style: "long" | "short" = "long"): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { month: style });
  return Array.from({ length: 12 }, (_, m) => capitalize(fmt.format(new Date(2024, m, 1))));
}

export function weekdayNames(locale: string, style: "short" | "narrow" = "short"): string[] {
  const fmt = new Intl.DateTimeFormat(locale, { weekday: style });
  // 2024-01-07 is a Sunday.
  return Array.from({ length: 7 }, (_, d) => capitalize(fmt.format(new Date(2024, 0, 7 + d))));
}

export function useMonthNames(style: "long" | "short" = "long"): string[] {
  return monthNames(useDateLocale(), style);
}

export function useWeekdayNames(style: "short" | "narrow" = "short"): string[] {
  return weekdayNames(useDateLocale(), style);
}

// Les noms de pays viennent d'Intl : aucun tableau a maintenir.
export function countryName(code: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: "region" }).of(code.toUpperCase()) ?? code;
  } catch {
    return code;
  }
}

export function useCountryName(): (code: string) => string {
  const locale = useDateLocale();
  return (code: string) => countryName(code, locale);
}

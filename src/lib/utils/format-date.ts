// Helpers centralises pour formater les dates dans tout le portail.
// Evite la derive entre fmtDate/fmtShort/toLocaleDateString eparpilles.
//
// La locale est toujours passee par l'appelant (voir lib/i18n-format) : ces
// fonctions ne decident jamais de la langue du lecteur. Pour les chaines ISO
// "YYYY-MM-DD" on parse en local, sinon UTC recule la date d'un jour.

function toLocalDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

/**
 * Date d'un conge : "mar. 19 mai", "mardi 19 mai 2026" ou "19 mai".
 */
export function formatLeaveDate(
  d: string | Date,
  tag: string,
  options?: { short?: boolean; withWeekday?: boolean }
): string {
  const date = toLocalDate(d);
  if (isNaN(date.getTime())) return "—";
  if (options?.short) {
    return date.toLocaleDateString(tag, { day: "numeric", month: "long" });
  }
  if (options?.withWeekday) {
    return date.toLocaleDateString(tag, {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return date.toLocaleDateString(tag, {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

/**
 * Plage de dates. Intl produit "19–28 mai" ou "19 May – 28 May" selon la
 * langue, ce qui evite d'ecrire "Du ... au ..." a la main.
 */
export function formatLeaveRange(
  start: string | Date,
  end: string | Date,
  tag: string
): string {
  const s = toLocalDate(start);
  const e = toLocalDate(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "—";
  const sameYear = s.getFullYear() === e.getFullYear();
  const opts: Intl.DateTimeFormatOptions = sameYear
    ? { day: "numeric", month: "long" }
    : { day: "numeric", month: "long", year: "numeric" };
  const fmt = new Intl.DateTimeFormat(tag, opts);
  const sameDay =
    sameYear && s.getMonth() === e.getMonth() && s.getDate() === e.getDate();
  return sameDay ? fmt.format(s) : fmt.formatRange(s, e);
}

/**
 * Mois d'un titre : "Mai 2026".
 */
export function formatLeaveMonth(d: string | Date, tag: string): string {
  const date = toLocalDate(d);
  if (isNaN(date.getTime())) return "—";
  const s = date.toLocaleDateString(tag, { month: "long", year: "numeric" });
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format compact numerique : "19/05/2026". Independant de la langue.
 */
export function formatLeaveCompact(d: string | Date): string {
  const date = toLocalDate(d);
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

// Helpers centralisés pour formater les dates dans tout le portail.
// Évite la dérive entre fmtDate/fmtShort/toLocaleDateString éparpillés.
//
// Locale "fr-CA" partout, fuseau "America/Montreal" implicite via Date locale du navigateur.
// Pour les chaînes ISO "YYYY-MM-DD" (sans heure), on parse en local pour éviter
// le décalage UTC qui fait reculer la date d'un jour.

function toLocalDate(d: string | Date): Date {
  if (d instanceof Date) return d;
  // Cas "YYYY-MM-DD" pur : parse en local pour éviter UTC shift.
  if (/^\d{4}-\d{2}-\d{2}$/.test(d)) {
    const [y, m, day] = d.split("-").map(Number);
    return new Date(y, m - 1, day);
  }
  return new Date(d);
}

/**
 * Formate une date pour l'affichage usuel d'un congé.
 * - short: false (défaut) → "lun. 19 mai"
 * - short: false, withWeekday: true → "lundi 19 mai 2026"
 * - short: true → "19 mai"
 *
 * @example
 *   formatLeaveDate("2026-05-19")
 *   // → "mar. 19 mai"
 *   formatLeaveDate("2026-05-19", { withWeekday: true })
 *   // → "mardi 19 mai 2026"
 *   formatLeaveDate("2026-05-19", { short: true })
 *   // → "19 mai"
 */
export function formatLeaveDate(
  d: string | Date,
  options?: { short?: boolean; withWeekday?: boolean }
): string {
  const date = toLocalDate(d);
  if (isNaN(date.getTime())) return "—";
  if (options?.short) {
    return date.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  }
  if (options?.withWeekday) {
    return date.toLocaleDateString("fr-CA", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  return date.toLocaleDateString("fr-CA", {
    weekday: "short",
    day: "numeric",
    month: "long",
  });
}

/**
 * Formate une plage de dates : "Du 19 mai au 28 mai" ou "Le 19 mai" si même jour.
 *
 * @example
 *   formatLeaveRange("2026-05-19", "2026-05-28")
 *   // → "Du 19 mai au 28 mai"
 *   formatLeaveRange("2026-05-19", "2026-05-19")
 *   // → "Le 19 mai"
 */
export function formatLeaveRange(start: string | Date, end: string | Date): string {
  const s = toLocalDate(start);
  const e = toLocalDate(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime())) return "—";
  const sameDay =
    s.getFullYear() === e.getFullYear() &&
    s.getMonth() === e.getMonth() &&
    s.getDate() === e.getDate();
  if (sameDay) {
    return `Le ${s.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;
  }
  const sameYear = s.getFullYear() === e.getFullYear();
  const sStr = s.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
  const eStr = e.toLocaleDateString(
    "fr-CA",
    sameYear ? { day: "numeric", month: "long" } : { day: "numeric", month: "long", year: "numeric" }
  );
  return `Du ${sStr} au ${eStr}`;
}

/**
 * Formate un mois pour un titre : "Mai 2026".
 *
 * @example
 *   formatLeaveMonth("2026-05-19")
 *   // → "Mai 2026"
 */
export function formatLeaveMonth(d: string | Date): string {
  const date = toLocalDate(d);
  if (isNaN(date.getTime())) return "—";
  const s = date.toLocaleDateString("fr-CA", { month: "long", year: "numeric" });
  // Capitalise la première lettre ("mai 2026" → "Mai 2026")
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Format compact numérique : "19/05/2026".
 *
 * @example
 *   formatLeaveCompact("2026-05-19")
 *   // → "2026-05-19" (fr-CA par défaut), or use the helper for explicit dd/mm/yyyy
 */
export function formatLeaveCompact(d: string | Date): string {
  const date = toLocalDate(d);
  if (isNaN(date.getTime())) return "—";
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

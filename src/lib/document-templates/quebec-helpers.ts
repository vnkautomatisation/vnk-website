// Helpers de formatage Quebec (FR-CA) : dates, monnaie, pourcentages,
// telephone, masquage NAS. Pas de dependance Prisma ni serveur.

const FR_MONTHS = [
  "janvier",
  "février",
  "mars",
  "avril",
  "mai",
  "juin",
  "juillet",
  "août",
  "septembre",
  "octobre",
  "novembre",
  "décembre",
];

function toDate(d: Date | string | number | null | undefined): Date | null {
  if (d === null || d === undefined || d === "") return null;
  if (d instanceof Date) return Number.isFinite(d.getTime()) ? d : null;
  const parsed = new Date(d);
  return Number.isFinite(parsed.getTime()) ? parsed : null;
}

// "30 mai 2026" (FR-CA, format long simple — pas de "1er")
export function formatDateFr(d: Date | string | number | null | undefined): string {
  const date = toDate(d);
  if (!date) return "";
  const day = date.getDate();
  const month = FR_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${day} ${month} ${year}`;
}

// Variante longue avec "1er" pour le premier du mois
// ex: "1er juin 2026", "30 mai 2026"
export function formatDateFrLong(
  d: Date | string | number | null | undefined,
): string {
  const date = toDate(d);
  if (!date) return "";
  const day = date.getDate();
  const dayStr = day === 1 ? "1er" : String(day);
  const month = FR_MONTHS[date.getMonth()];
  const year = date.getFullYear();
  return `${dayStr} ${month} ${year}`;
}

// ISO court: "2026-05-30"
export function formatDateIso(
  d: Date | string | number | null | undefined,
): string {
  const date = toDate(d);
  if (!date) return "";
  const yyyy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

// "65 000,00 $ CAD"
export function formatCurrencyCad(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "";
  try {
    const formatter = new Intl.NumberFormat("fr-CA", {
      style: "currency",
      currency: "CAD",
      currencyDisplay: "code",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
    // Intl peut produire "65 000,00 CAD" ou "CAD 65 000,00" selon ICU.
    // On normalise vers "65 000,00 $ CAD".
    const parts = formatter.formatToParts(num);
    const number = parts
      .filter((p) => p.type !== "currency" && p.type !== "literal")
      .map((p) => p.value)
      .join("")
      .trim();
    return `${number} $ CAD`;
  } catch {
    const fixed = num.toFixed(2).replace(".", ",");
    // Separateur de milliers (espace insecable etroite serait U+202F, on garde espace simple)
    const [intPart, decPart] = fixed.split(",");
    const withSep = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
    return `${withSep},${decPart} $ CAD`;
  }
}

// "4,0 %" (separateur espace insecable U+00A0 entre nombre et %)
export function formatPercent(
  n: number | string | null | undefined,
  decimals: number = 1,
): string {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "";
  const fixed = num.toFixed(decimals).replace(".", ",");
  return `${fixed} %`;
}

// "(514) 555-1234" — supporte numeros canadiens 10 chiffres
// Si format inconnu, retourne tel quel (apres trim).
export function formatPhone(s: string | null | undefined): string {
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) {
    // +1 (514) 555-1234
    const d = digits.slice(1);
    return `+1 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  return s.trim();
}

// "XXX-XXX-789" — masque tout sauf les 3 derniers chiffres
// Accepte NAS avec ou sans separateurs.
export function maskNas(s: string | null | undefined): string {
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits.length < 4) return "XXX-XXX-XXX";
  const last3 = digits.slice(-3);
  // Reconstruit avec triplets XXX-XXX-NNN si NAS 9 chiffres
  if (digits.length === 9) {
    return `XXX-XXX-${last3}`;
  }
  // Fallback generique
  return `${"X".repeat(Math.max(0, digits.length - 3))
    .replace(/(.{3})/g, "$1-")
    .replace(/-$/, "")}-${last3}`;
}

// ─── Genre grammatical / accord épicène FR-CA ─────────────
//
// Reference OQLF : la rédaction épicène recommande d'utiliser doublets
// ("l'employé ou l'employée") ou termes neutres ("le personnel") plutôt
// que les parenthèses "(e)". Cependant pour les contrats individuels où
// le genre du signataire est connu, on accorde directement au féminin
// ou masculin. La forme "(e)" reste utilisée quand le genre est inconnu
// ou non divulgué.

export type Gender = "male" | "female" | "non_binary" | "prefer_not_to_say";

// Normalise une valeur de la BDD en Gender (avec fallback)
export function normalizeGender(raw: string | null | undefined): Gender {
  if (!raw) return "prefer_not_to_say";
  const v = raw.toLowerCase().trim();
  if (v === "male" || v === "homme" || v === "m" || v === "h") return "male";
  if (v === "female" || v === "femme" || v === "f") return "female";
  if (v === "non_binary" || v === "nonbinary" || v === "non-binaire" || v === "nb") {
    return "non_binary";
  }
  return "prefer_not_to_say";
}

// Civilité par défaut selon le genre (utilisée si Admin.civility est null)
export function defaultCivility(gender: Gender): string {
  switch (gender) {
    case "male": return "M.";
    case "female": return "Mme";
    case "non_binary": return "Mx";
    default: return "";
  }
}

// "Monsieur" / "Madame" / "Mx" (titre long)
export function gTitle(gender: Gender): string {
  switch (gender) {
    case "male": return "Monsieur";
    case "female": return "Madame";
    case "non_binary": return "Mx";
    default: return "Madame, Monsieur";
  }
}

// Pronom sujet : "il" / "elle" / "iel" / "il ou elle"
export function gPronoun(gender: Gender): string {
  switch (gender) {
    case "male": return "il";
    case "female": return "elle";
    case "non_binary": return "iel";
    default: return "il ou elle";
  }
}

// Pronom objet direct : "le" / "la" / "lui"
export function gPronounObj(gender: Gender): string {
  switch (gender) {
    case "male": return "le";
    case "female": return "la";
    case "non_binary": return "lui";
    default: return "le ou la";
  }
}

// Déterminant possessif : "son" / "sa" / "son" (épicène par défaut)
export function gPronounDet(gender: Gender): string {
  switch (gender) {
    case "male": return "son";
    case "female": return "sa";
    case "non_binary": return "son";
    default: return "son ou sa";
  }
}

// Accord du mot "Employé" (capitalisé) : "Employé" / "Employée" / "Employé(e)"
export function gEmployed(gender: Gender, capitalized: boolean = true): string {
  const base = capitalized ? "Employé" : "employé";
  switch (gender) {
    case "male": return base;
    case "female": return `${base}e`;
    case "non_binary": return `${base}·e`; // point médian (forme inclusive non-binaire)
    default: return `${base}(e)`;
  }
}

// Accord générique d'un mot finissant par "é" : suffix "" / "e" / "·e" / "(e)"
// Ex: gAccordE(gender) sur "engagé" -> "engagée"/"engagé(e)"
export function gAccordE(gender: Gender): string {
  switch (gender) {
    case "male": return "";
    case "female": return "e";
    case "non_binary": return "·e";
    default: return "(e)";
  }
}

// "Né" / "Née" / "Né(e)"
export function gBorn(gender: Gender, capitalized: boolean = false): string {
  const base = capitalized ? "Né" : "né";
  switch (gender) {
    case "male": return base;
    case "female": return `${base}e`;
    case "non_binary": return `${base}·e`;
    default: return `${base}(e)`;
  }
}

// ─── NAS — formatage non masqué (utilisation RH interne uniquement) ───
// Format Canada : "XXX XXX XXX" (groupes de 3 séparés par espace, standard
// du Commissariat à la protection de la vie privée). Tirets également utilisés.
export function formatNasFull(s: string | null | undefined): string {
  if (!s) return "";
  const digits = s.replace(/\D/g, "");
  if (digits.length !== 9) return s.trim();
  return `${digits.slice(0, 3)} ${digits.slice(3, 6)} ${digits.slice(6)}`;
}

// ─── Calcul d'ancienneté (mois et années depuis startDate) ─────────
export function tenureMonths(startDate: Date | string | null | undefined): number {
  const start = toDate(startDate);
  if (!start) return 0;
  const now = new Date();
  let months = (now.getFullYear() - start.getFullYear()) * 12;
  months += now.getMonth() - start.getMonth();
  if (now.getDate() < start.getDate()) months -= 1;
  return Math.max(0, months);
}

export function tenureYears(startDate: Date | string | null | undefined): number {
  return Math.floor(tenureMonths(startDate) / 12);
}

// Libellé FR : "2 ans et 4 mois" / "8 mois" / "1 an"
export function tenureLabelFr(
  startDate: Date | string | null | undefined,
): string {
  const m = tenureMonths(startDate);
  if (m === 0) return "moins d'un mois";
  const y = Math.floor(m / 12);
  const rem = m % 12;
  const parts: string[] = [];
  if (y > 0) parts.push(`${y} ${y > 1 ? "ans" : "an"}`);
  if (rem > 0) parts.push(`${rem} mois`);
  return parts.join(" et ");
}

// ─── Conversion taux horaire ↔ annuel ─────────────────────────────
// Standard CDN : 52 semaines / an (sans déduction des vacances payées)
const WEEKS_PER_YEAR = 52;

export function hourlyToAnnual(
  hourly: number | null | undefined,
  hoursPerWeek: number | null | undefined,
): number | null {
  if (hourly === null || hourly === undefined || hoursPerWeek === null || hoursPerWeek === undefined) {
    return null;
  }
  const h = Number(hourly);
  const w = Number(hoursPerWeek);
  if (!Number.isFinite(h) || !Number.isFinite(w) || h <= 0 || w <= 0) return null;
  return Math.round(h * w * WEEKS_PER_YEAR * 100) / 100;
}

export function annualToHourly(
  annual: number | null | undefined,
  hoursPerWeek: number | null | undefined,
): number | null {
  if (annual === null || annual === undefined || hoursPerWeek === null || hoursPerWeek === undefined) {
    return null;
  }
  const a = Number(annual);
  const w = Number(hoursPerWeek);
  if (!Number.isFinite(a) || !Number.isFinite(w) || a <= 0 || w <= 0) return null;
  return Math.round((a / (w * WEEKS_PER_YEAR)) * 100) / 100;
}

// ─── Calcul fin de probation (start + N jours, défaut 90j = 3 mois Loi NT) ──
export function computeProbationEnd(
  startDate: Date | string | null | undefined,
  days: number = 90,
): Date | null {
  const start = toDate(startDate);
  if (!start) return null;
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return end;
}

// Formate un nombre brut sans symbole monnaie ("65 000")
export function formatNumber(
  n: number | string | null | undefined,
  decimals: number = 0,
): string {
  if (n === null || n === undefined || n === "") return "";
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num)) return "";
  try {
    return new Intl.NumberFormat("fr-CA", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    }).format(num);
  } catch {
    return String(num);
  }
}

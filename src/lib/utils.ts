// Helpers génériques partagés
import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Base URL auto-detectee (fonctionne sur localhost, Railway, domaine custom)
export function getBaseUrl(headersList?: { get: (key: string) => string | null }): string {
  // 1. En runtime serveur avec headers
  if (headersList) {
    const host = headersList.get("host");
    const proto = headersList.get("x-forwarded-proto") ?? "http";
    if (host) return `${proto}://${host}`;
  }
  // 2. Env var explicite (optionnel)
  if (process.env.AUTH_URL) return process.env.AUTH_URL;
  // 3. Fallback dev
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

// Formatage devise
export function formatCurrency(
  amount: number | string,
  currency = "CAD",
  locale = "fr-CA"
): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(n)) return "0,00 $";
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

// Formatage de date
export function formatDate(
  date: Date | string | null | undefined,
  locale = "fr-CA"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
}

// Formatage de date + heure
export function formatDateTime(
  date: Date | string | null | undefined,
  locale = "fr-CA"
): string {
  if (!date) return "—";
  const d = typeof date === "string" ? new Date(date) : date;
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(locale, {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// Formatage heure sans secondes ("14:30:00" → "14:30")
export function formatTime(time: string | null | undefined): string {
  if (!time) return "—";
  return time.replace(/:00$/, "");
}

// Initiales depuis nom complet
export function initials(fullName: string | null | undefined): string {
  if (!fullName) return "?";
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Truncate + ellipsis
export function truncate(text: string, max = 50): string {
  if (text.length <= max) return text;
  return text.slice(0, max - 1) + "…";
}

// Numéro de document (remplace {YYYY}, {MM}, etc. dans un préfixe)
export function generateDocumentNumber(
  prefix: string,
  sequence: number,
  pad = 3
): string {
  const now = new Date();
  return prefix
    .replace("{YYYY}", String(now.getFullYear()))
    .replace("{YY}", String(now.getFullYear()).slice(-2))
    .replace("{MM}", String(now.getMonth() + 1).padStart(2, "0"))
    .replace("{DD}", String(now.getDate()).padStart(2, "0"))
    + String(sequence).padStart(pad, "0");
}

// Calcul des taxes Québec (TPS + TVQ) à partir d'un montant HT
export function calculateTaxes(
  amountHt: number,
  tpsRate = 5,
  tvqRate = 9.975
) {
  const tps = Math.round(amountHt * tpsRate) / 100;
  const tvq = Math.round(amountHt * tvqRate * 100) / 10000;
  const ttc = Math.round((amountHt + tps + tvq) * 100) / 100;
  return {
    ht: amountHt,
    tps: Math.round(tps * 100) / 100,
    tvq: Math.round(tvq * 100) / 100,
    ttc,
  };
}

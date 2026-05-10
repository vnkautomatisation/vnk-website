// FX (taux de change) — Banque du Canada Valet API + cache journalier en mémoire
// API officielle gratuite : https://www.bankofcanada.ca/valet/docs
import "server-only";

export type FxQuote = {
  rate: number;       // 1 unité de la devise source = X CAD
  source: "BOC" | "ECB" | "fallback";
  date: string;       // YYYY-MM-DD
};

// Cache en mémoire (par instance Node) — durée 24h
type CacheEntry = { quote: FxQuote; expiresAt: number };
const fxCache = new Map<string, CacheEntry>();
const TTL_MS = 24 * 60 * 60 * 1000;

// Mapping devise → série Valet de la Banque du Canada
// Ces séries donnent le taux X CAD = 1 unité devise
const BOC_SERIES: Record<string, string> = {
  USD: "FXUSDCAD",
  EUR: "FXEURCAD",
  GBP: "FXGBPCAD",
  JPY: "FXJPYCAD",
  CHF: "FXCHFCAD",
  AUD: "FXAUDCAD",
  CNY: "FXCNYCAD",
  MXN: "FXMXNCAD",
  INR: "FXINRCAD",
  HKD: "FXHKDCAD",
};

// Devises avec parité fixe vs EUR (Afrique francophone)
const EUR_PEGGED: Record<string, number> = {
  XOF: 1 / 655.957, // 1 XOF = 1/655.957 EUR
  XAF: 1 / 655.957,
};

/**
 * Convertit `amount` d'une devise vers CAD au taux du jour (ou date donnée).
 * Renvoie null si la devise n'est pas supportée.
 */
export async function convertToCAD(
  amount: number,
  fromCurrency: string,
  date?: Date,
): Promise<{ amountCad: number; quote: FxQuote } | null> {
  const cur = fromCurrency.toUpperCase();
  if (cur === "CAD") {
    return {
      amountCad: amount,
      quote: { rate: 1, source: "BOC", date: (date ?? new Date()).toISOString().slice(0, 10) },
    };
  }

  const quote = await getRate(cur, date);
  if (!quote) return null;
  return {
    amountCad: Math.round(amount * quote.rate * 100) / 100,
    quote,
  };
}

/**
 * Récupère le taux de change actuel d'une devise vers CAD.
 * Cache 24h, fallback sur ECB pour devises non couvertes par BoC.
 */
export async function getRate(currency: string, date?: Date): Promise<FxQuote | null> {
  const cur = currency.toUpperCase();
  if (cur === "CAD") return { rate: 1, source: "BOC", date: new Date().toISOString().slice(0, 10) };

  const dateKey = date ? date.toISOString().slice(0, 10) : "today";
  const cacheKey = `${cur}:${dateKey}`;
  const cached = fxCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.quote;
  }

  // 1. Essayer Banque du Canada (taux officiels)
  const bocSeries = BOC_SERIES[cur];
  if (bocSeries) {
    const quote = await fetchBocRate(bocSeries, date);
    if (quote) {
      fxCache.set(cacheKey, { quote, expiresAt: Date.now() + TTL_MS });
      return quote;
    }
  }

  // 2. Devises arrimées à l'EUR (XOF/XAF) — convertir via EUR/CAD
  if (EUR_PEGGED[cur]) {
    const eurToCad = await fetchBocRate("FXEURCAD", date);
    if (eurToCad) {
      const quote: FxQuote = {
        rate: eurToCad.rate * EUR_PEGGED[cur],
        source: "BOC",
        date: eurToCad.date,
      };
      fxCache.set(cacheKey, { quote, expiresAt: Date.now() + TTL_MS });
      return quote;
    }
  }

  // 3. Fallback ECB pour les autres devises EU
  const ecbQuote = await fetchEcbRate(cur, date);
  if (ecbQuote) {
    fxCache.set(cacheKey, { quote: ecbQuote, expiresAt: Date.now() + TTL_MS });
    return ecbQuote;
  }

  return null;
}

async function fetchBocRate(series: string, date?: Date): Promise<FxQuote | null> {
  try {
    let url = `https://www.bankofcanada.ca/valet/observations/${series}/json?recent=1`;
    if (date) {
      const iso = date.toISOString().slice(0, 10);
      url = `https://www.bankofcanada.ca/valet/observations/${series}/json?start_date=${iso}&end_date=${iso}`;
    }
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return null;
    const data = await res.json();
    const obs = data.observations?.[0];
    if (!obs) return null;
    const value = obs[series];
    const rate = parseFloat(value?.v ?? value);
    if (isNaN(rate)) return null;
    return { rate, source: "BOC", date: obs.d };
  } catch {
    return null;
  }
}

async function fetchEcbRate(currency: string, date?: Date): Promise<FxQuote | null> {
  // ECB donne EUR comme base, on doit ensuite convertir EUR → CAD
  try {
    const dateParam = date ? `?startPeriod=${date.toISOString().slice(0, 10)}&endPeriod=${date.toISOString().slice(0, 10)}` : "";
    const ecbUrl = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A${dateParam}?format=jsondata&lastNObservations=1`;
    const res = await fetch(ecbUrl, {
      headers: { Accept: "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const series = data?.dataSets?.[0]?.series;
    if (!series) return null;
    const seriesKey = Object.keys(series)[0];
    const obs = series[seriesKey]?.observations;
    if (!obs) return null;
    const obsKey = Object.keys(obs)[0];
    const eurPerCurrency = obs[obsKey]?.[0];
    if (eurPerCurrency == null) return null;
    // Maintenant EUR → CAD via BoC
    const eurToCad = await fetchBocRate("FXEURCAD");
    if (!eurToCad) return null;
    return {
      rate: (1 / eurPerCurrency) * eurToCad.rate,
      source: "ECB",
      date: eurToCad.date,
    };
  } catch {
    return null;
  }
}

// Liste des devises supportées
export const SUPPORTED_CURRENCIES = [
  "CAD", "USD", "EUR", "GBP", "CHF", "AUD",
  "JPY", "CNY", "MXN", "INR", "HKD",
  "XOF", "XAF", // Afrique francophone (parité fixe EUR)
] as const;

export type SupportedCurrency = typeof SUPPORTED_CURRENCIES[number];

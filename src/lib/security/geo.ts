// ─────────────────────────────────────────────────────────
// Géolocalisation IP — multi-stratégies
//
// 1. Headers CDN (Cloudflare, Vercel, Railway) — instantané, gratuit, fiable en prod
// 2. Parse x-forwarded-for / x-real-ip — fallback
// 3. Détection IP locale (::1, 127.0.0.1, RFC1918) → marquée explicitement
// 4. API publique gratuite ipapi.co → fallback dev/sans CDN (cache 24 h)
// ─────────────────────────────────────────────────────────
import { headers } from "next/headers";

export type GeoInfo = {
  ip: string | null;
  country: string | null;
  city: string | null;
  region: string | null;
  isLocal: boolean;
};

// Cache mémoire IP → géo (TTL 24 h)
const geoCache = new Map<string, { data: GeoInfo; expiresAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

// IP locale / réservée (RFC1918, loopback, link-local) ?
export function isLocalIp(ip: string | null | undefined): boolean {
  if (!ip) return false;
  // IPv6 loopback / link-local
  if (ip === "::1" || ip === "::" || ip.startsWith("fe80:") || ip.startsWith("fc00:") || ip.startsWith("fd00:")) return true;
  // IPv6 mapped IPv4 ::ffff:192.168.x.x
  const ipv4Mapped = ip.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (ipv4Mapped) return isLocalIp(ipv4Mapped[1]);
  // IPv4 loopback + RFC1918
  if (/^127\./.test(ip) || /^10\./.test(ip) || /^192\.168\./.test(ip) || /^169\.254\./.test(ip)) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m && parseInt(m[1], 10) >= 16 && parseInt(m[1], 10) <= 31) return true;
  return false;
}

// Lit l'IP réelle depuis les headers (proxy-aware)
function extractIpFromHeaders(h: Headers): string | null {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    // Premier IP de la liste = client réel
    const first = xff.split(",")[0].trim();
    if (first) return first;
  }
  return (
    h.get("x-real-ip") ||
    h.get("cf-connecting-ip") ||
    h.get("true-client-ip") ||
    null
  );
}

// Lookup géo via ipapi.co (gratuit, 1000 requêtes/jour, anonyme)
async function lookupGeoIpApi(ip: string): Promise<{ country: string | null; city: string | null; region: string | null }> {
  const cached = geoCache.get(ip);
  if (cached && cached.expiresAt > Date.now()) {
    return { country: cached.data.country, city: cached.data.city, region: cached.data.region };
  }

  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { "User-Agent": "vnk-portal/1.0" },
      next: { revalidate: 86400 },
    });
    if (!res.ok) return { country: null, city: null, region: null };
    const data = await res.json();
    if (data.error) return { country: null, city: null, region: null };
    const result = {
      country: data.country_code ?? data.country ?? null,
      city: data.city ?? null,
      region: data.region ?? data.region_code ?? null,
    };
    geoCache.set(ip, {
      data: { ip, ...result, isLocal: false },
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
    return result;
  } catch {
    return { country: null, city: null, region: null };
  }
}

export async function getRequestGeo(): Promise<GeoInfo> {
  const h = await headers();
  const ip = extractIpFromHeaders(h);

  // 1. Détection IP locale (dev)
  if (isLocalIp(ip)) {
    return { ip, country: null, city: null, region: null, isLocal: true };
  }

  // 2. Headers CDN (instantané, gratuit en prod)
  const cdnCountry =
    h.get("cf-ipcountry") ||
    h.get("x-vercel-ip-country") ||
    h.get("x-railway-ip-country") ||
    null;
  const cdnCity =
    h.get("cf-ipcity") ||
    h.get("x-vercel-ip-city") ||
    null;
  const cdnRegion =
    h.get("x-vercel-ip-country-region") ||
    null;

  if (cdnCountry && cdnCountry !== "XX") {
    return {
      ip,
      country: cdnCountry,
      city: cdnCity ? decodeURIComponent(cdnCity) : null,
      region: cdnRegion,
      isLocal: false,
    };
  }

  // 3. Fallback API publique
  if (ip) {
    const apiGeo = await lookupGeoIpApi(ip);
    return { ip, ...apiGeo, isLocal: false };
  }

  return { ip: null, country: null, city: null, region: null, isLocal: false };
}

// Formate "Montréal, QC, CA" ou "Réseau local (développement)" ou "Inconnu"
export function formatGeo(geo: { country: string | null; city: string | null; region?: string | null; isLocal?: boolean }): string {
  if (geo.isLocal) return "Réseau local (développement)";
  const parts = [geo.city, geo.region, geo.country].filter(Boolean);
  if (parts.length === 0) return "Localisation inconnue";
  return parts.join(", ");
}

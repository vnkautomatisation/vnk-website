// Time clock feature configuration, driven by the "hr_pointage" settings
// category (editable in the admin Settings UI, seeded by
// scripts/seed-timeclock-settings.ts):
//   - punch rounding (0/5/10/15 min, nearest)
//   - GPS capture at punch (best-effort)
//   - geofencing (reject web punches outside the configured radius)
//   - kiosk mode (PIN-based shared tablet punching)
import "server-only";
import { getSetting } from "@/lib/settings";

export type TimeclockConfig = {
  roundingMin: number; // 0 = disabled
  geolocEnabled: boolean;
  geofenceEnabled: boolean;
  geofenceLat: number | null;
  geofenceLng: number | null;
  geofenceRadiusM: number;
  kioskEnabled: boolean;
};

// getSetting() parses by the row's declared `type`, so a "boolean" setting
// comes back as a real boolean and a "number" one as a number — never as the
// raw string. These helpers accept both shapes (the string-only version made
// kiosk + geofencing permanently false whatever the stored value).
function toBool(v: unknown): boolean {
  return v === true || v === "true" || v === "1" || v === 1;
}
function toNum(v: unknown, fallback: number): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function getTimeclockConfig(): Promise<TimeclockConfig> {
  const [rounding, geoloc, fence, lat, lng, radius, kiosk] = await Promise.all([
    getSetting("hr_pointage", "rounding_min", "0"),
    getSetting("hr_pointage", "geoloc_enabled", "false"),
    getSetting("hr_pointage", "geofence_enabled", "false"),
    getSetting("hr_pointage", "geofence_lat", ""),
    getSetting("hr_pointage", "geofence_lng", ""),
    getSetting("hr_pointage", "geofence_radius_m", "250"),
    getSetting("hr_pointage", "kiosk_enabled", "false"),
  ]);
  const latN = Number(lat);
  const lngN = Number(lng);
  const hasLat = lat !== "" && lat !== null && lat !== undefined;
  const hasLng = lng !== "" && lng !== null && lng !== undefined;
  return {
    roundingMin: [0, 5, 10, 15].includes(toNum(rounding, 0)) ? toNum(rounding, 0) : 0,
    geolocEnabled: toBool(geoloc),
    geofenceEnabled: toBool(fence),
    geofenceLat: Number.isFinite(latN) && hasLat ? latN : null,
    geofenceLng: Number.isFinite(lngN) && hasLng ? lngN : null,
    geofenceRadiusM: Math.max(10, toNum(radius, 250)),
    kioskEnabled: toBool(kiosk),
  };
}

/** Rounds a date to the NEAREST `stepMin` minutes (0 = no rounding). */
export function roundToStep(d: Date, stepMin: number): Date {
  if (!stepMin || stepMin <= 0) return d;
  const ms = stepMin * 60000;
  return new Date(Math.round(d.getTime() / ms) * ms);
}

/** Haversine distance in meters between two lat/lng points. */
export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Validates optional punch coordinates. Returns null when absent/invalid. */
export function sanitizeCoords(
  lat: unknown,
  lng: unknown,
): { lat: number; lng: number } | null {
  const la = Number(lat);
  const ln = Number(lng);
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return null;
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return null;
  return { lat: la, lng: ln };
}

/**
 * Geofence check for a punch. Returns an error message when the punch must
 * be rejected, null when allowed. Kiosk punches bypass the fence (the
 * tablet itself is on site).
 */
export function geofenceError(
  cfg: TimeclockConfig,
  coords: { lat: number; lng: number } | null,
  source: "web" | "kiosk",
): string | null {
  if (!cfg.geofenceEnabled || source === "kiosk") return null;
  if (cfg.geofenceLat === null || cfg.geofenceLng === null) return null; // fence mal configurée -> ne bloque pas
  if (!coords) {
    return "Position GPS requise pour pointer (géofencing actif). Autorisez la localisation dans votre navigateur.";
  }
  const dist = distanceMeters(coords.lat, coords.lng, cfg.geofenceLat, cfg.geofenceLng);
  if (dist > cfg.geofenceRadiusM) {
    return `Punch refusé : vous êtes à ${Math.round(dist)} m de la zone autorisée (max ${cfg.geofenceRadiusM} m).`;
  }
  return null;
}

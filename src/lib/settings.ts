// Helper pour lire/écrire les settings (cache mémoire + invalidation)
// Usage : const companyName = await getSetting('general', 'company_name')
import "server-only";
import { prisma } from "./prisma";
import type { SettingType } from "@prisma/client";

// ── Cache mémoire (invalidé à chaque update via revalidatePath) ──
type CacheEntry = { value: string | null; type: SettingType; fetchedAt: number };
const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60_000; // 1 minute

function cacheKey(category: string, key: string) {
  return `${category}:${key}`;
}

// ═══════════════════════════════════════════════════════════
// READ
// ═══════════════════════════════════════════════════════════

export async function getSetting<T = string>(
  category: string,
  key: string,
  defaultValue?: T
): Promise<T | null> {
  const k = cacheKey(category, key);
  const now = Date.now();
  const cached = cache.get(k);

  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return parseSettingValue<T>(cached.value, cached.type) ?? defaultValue ?? null;
  }

  const row = await prisma.setting.findUnique({
    where: { category_key: { category, key } },
    select: { value: true, type: true },
  });

  if (!row) {
    cache.set(k, { value: null, type: "string", fetchedAt: now });
    return defaultValue ?? null;
  }

  cache.set(k, { value: row.value, type: row.type, fetchedAt: now });
  return parseSettingValue<T>(row.value, row.type) ?? defaultValue ?? null;
}

export async function getSettingsByCategory(category: string) {
  const rows = await prisma.setting.findMany({
    where: { category },
    orderBy: { sortOrder: "asc" },
  });
  return rows;
}

export async function getAllSettings() {
  const rows = await prisma.setting.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  const byCategory: Record<string, typeof rows> = {};
  for (const r of rows) {
    byCategory[r.category] ??= [];
    byCategory[r.category].push(r);
  }
  return byCategory;
}

// Raccourci pour l'UI publique : retourne uniquement les settings isPublic=true
export async function getPublicSettings() {
  const rows = await prisma.setting.findMany({
    where: { isPublic: true },
    select: { category: true, key: true, value: true, type: true },
  });
  const map: Record<string, unknown> = {};
  for (const r of rows) {
    map[`${r.category}.${r.key}`] = parseSettingValue(r.value, r.type);
  }
  return map;
}

// ═══════════════════════════════════════════════════════════
// WRITE
// ═══════════════════════════════════════════════════════════

export async function updateSetting(
  category: string,
  key: string,
  value: string,
  updatedBy?: number
) {
  const row = await prisma.setting.update({
    where: { category_key: { category, key } },
    data: { value, updatedBy },
  });
  // Invalider le cache
  cache.delete(cacheKey(category, key));
  return row;
}

export async function updateMultipleSettings(
  updates: Array<{ category: string; key: string; value: string }>,
  updatedBy?: number
) {
  const results = await prisma.$transaction(
    updates.map((u) =>
      prisma.setting.update({
        where: { category_key: { category: u.category, key: u.key } },
        data: { value: u.value, updatedBy },
      })
    )
  );
  // Invalider complètement le cache (plus sûr pour un batch)
  cache.clear();
  return results;
}

export function invalidateSettingsCache() {
  cache.clear();
}

// ═══════════════════════════════════════════════════════════
// PARSE
// ═══════════════════════════════════════════════════════════

function parseSettingValue<T>(value: string | null, type: SettingType): T | null {
  if (value === null || value === undefined) return null;
  try {
    switch (type) {
      case "number":
        return Number(value) as T;
      case "boolean":
        return (value === "true") as T;
      case "json":
        return JSON.parse(value) as T;
      case "secret":
      case "string":
      default:
        return value as T;
    }
  } catch {
    return value as T;
  }
}

// Masquer les valeurs des secrets dans l'UI (••••••)
export function maskSecret(value: string | null): string {
  if (!value) return "";
  if (value.length < 8) return "••••";
  return value.slice(0, 4) + "••••••" + value.slice(-2);
}

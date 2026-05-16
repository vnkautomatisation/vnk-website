// ─────────────────────────────────────────────────────────
// Lecture unifiée des identifiants d'intégration
// Source de vérité : table `Integration` (Postgres)
// Fallback 1 : table `Setting` (catégorie "integrations") — pour rétro-compat
// Fallback 2 : process.env (pour environnements dev/CI)
//
// Avantage : permet à l'utilisateur de modifier ses clés depuis
// l'UI sans toucher au fichier .env.local ni redémarrer le serveur.
// ─────────────────────────────────────────────────────────
import "server-only";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { decryptSecret, isEncrypted } from "@/lib/security/crypto";

// Cache mémoire (TTL 30 s) pour éviter de hammer la DB à chaque requête
const cache = new Map<string, { value: string | null; fetchedAt: number }>();
const CACHE_TTL_MS = 30_000;

export type CredentialSource = "database" | "settings" | "env" | "missing";

export async function getIntegrationCredential(
  provider: string,
  key: string,
  envVarName?: string
): Promise<{ value: string | null; source: CredentialSource }> {
  const cacheKey = `${provider}:${key}`;
  const cached = cache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return { value: cached.value, source: cached.value ? "database" : "missing" };
  }

  // 1. Lire depuis Integration.credentials (déchiffrement AES-256-GCM)
  try {
    const integ = await prisma.integration.findUnique({
      where: { provider },
      select: { credentials: true, isEnabled: true },
    });
    if (integ?.isEnabled && integ.credentials) {
      const creds = integ.credentials as Record<string, string>;
      const raw = creds[key];
      if (raw) {
        // Si chiffré : déchiffrer. Sinon (legacy) : utiliser tel quel.
        const value = isEncrypted(raw) ? decryptSecret(raw) : raw;
        if (value) {
          cache.set(cacheKey, { value, fetchedAt: Date.now() });
          return { value, source: "database" };
        }
      }
    }
  } catch {
    // ignore, fallthrough
  }

  // 2. Fallback Settings (rétro-compat)
  const settingsVal = await getSetting<string>("integrations", `${provider}_${key}`);
  if (settingsVal) {
    cache.set(cacheKey, { value: settingsVal, fetchedAt: Date.now() });
    return { value: settingsVal, source: "settings" };
  }

  // 3. Fallback env var
  if (envVarName && process.env[envVarName]) {
    cache.set(cacheKey, { value: process.env[envVarName]!, fetchedAt: Date.now() });
    return { value: process.env[envVarName]!, source: "env" };
  }

  cache.set(cacheKey, { value: null, fetchedAt: Date.now() });
  return { value: null, source: "missing" };
}

// Invalider le cache lors d'un upsert
export function invalidateIntegrationCache(provider?: string) {
  if (provider) {
    for (const k of Array.from(cache.keys())) {
      if (k.startsWith(`${provider}:`)) cache.delete(k);
    }
  } else {
    cache.clear();
  }
}

// Récupérer tous les credentials d'une intégration en bloc (déchiffrés)
export async function getIntegrationCredentials(provider: string): Promise<Record<string, string> | null> {
  try {
    const integ = await prisma.integration.findUnique({
      where: { provider },
      select: { credentials: true, isEnabled: true },
    });
    if (!integ?.isEnabled) return null;
    const raw = (integ.credentials as Record<string, string>) ?? {};
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries(raw)) {
      if (!v) { out[k] = ""; continue; }
      out[k] = isEncrypted(v) ? (decryptSecret(v) ?? "") : v;
    }
    return out;
  } catch {
    return null;
  }
}

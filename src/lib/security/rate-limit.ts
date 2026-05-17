// ─────────────────────────────────────────────────────────
// Rate-limit in-memory (fenêtre glissante simple).
// Suffisant pour mono-instance Railway ; à remplacer par Redis
// si on passe sur plusieurs noeuds.
// Pas de "server-only" : pure utilité (Map en mémoire) — testable.
// ─────────────────────────────────────────────────────────

type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

// Nettoyage périodique pour éviter une fuite mémoire si beaucoup d'IPs.
let lastCleanup = Date.now();
function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < 5 * 60 * 1000) return;
  lastCleanup = now;
  for (const [key, b] of buckets.entries()) {
    if (b.resetAt < now) buckets.delete(key);
  }
}

export function checkRateLimit(opts: {
  key: string;
  limit: number;
  windowMs: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  cleanup();
  const now = Date.now();
  const entry = buckets.get(opts.key);
  if (!entry || entry.resetAt < now) {
    buckets.set(opts.key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true };
  }
  if (entry.count >= opts.limit) {
    return { ok: false, retryAfterMs: entry.resetAt - now };
  }
  entry.count++;
  return { ok: true };
}

export function getClientIpFromHeaders(h: Headers | null | undefined): string {
  if (!h) return "unknown";
  return (
    h.get("x-forwarded-for")?.split(",")[0].trim() ||
    h.get("x-real-ip") ||
    "unknown"
  );
}

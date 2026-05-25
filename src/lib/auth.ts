// ─────────────────────────────────────────────────────────────────────────────
// AUTHENTIFICATION DESACTIVEE EN DEV
// ─────────────────────────────────────────────────────────────────────────────
// Le systeme d'auth (NextAuth + 2FA + passkey + SSO + sessions DB) sera
// reconstruit a partir de zero plus tard. En attendant, on bypass complet :
//   - `auth()` retourne TOUJOURS une session admin (premier Admin actif en DB,
//      sinon fallback hardcode).
//   - `signIn` / `signOut` sont des no-ops.
//   - `handlers` (route /api/auth/[...nextauth]) retourne 200 vide.
//   - Le middleware ne redirige plus /admin vers /admin/login.
//
// Pour reactiver l'auth : `git revert` ce fichier et middleware.ts.
// ─────────────────────────────────────────────────────────────────────────────
import type { DefaultSession } from "next-auth";
import { prisma } from "./prisma";

// ─── Type augmentation (conserve pour compat avec le reste du code) ─────────
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "client";
      adminRole?: string | null;
      clientId?: number;
      adminId?: number;
      sessionId?: string;
    } & DefaultSession["user"];
  }
}

type DevAdmin = { id: number; email: string; fullName: string | null; role: string | null };

// Cache process-level pour eviter de hit la DB sur chaque auth() call
let cachedDevAdmin: DevAdmin | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 60_000;

async function getDevAdmin(): Promise<DevAdmin> {
  const now = Date.now();
  if (cachedDevAdmin && now - cachedAt < CACHE_TTL_MS) return cachedDevAdmin;

  try {
    const admin = await prisma.admin.findFirst({
      where: { isActive: true },
      orderBy: { id: "asc" },
      select: { id: true, email: true, fullName: true, role: true },
    });
    if (admin) {
      cachedDevAdmin = admin;
      cachedAt = now;
      return admin;
    }
  } catch (e) {
    console.warn("[auth-bypass] DB lookup failed, using hardcoded fallback:", (e as Error).message);
  }

  // Fallback si DB injoignable ou aucun admin
  const fallback: DevAdmin = {
    id: 1,
    email: "vnkautomatisation@gmail.com",
    fullName: "Yan Verone Kengne",
    role: "super_admin",
  };
  cachedDevAdmin = fallback;
  cachedAt = now;
  return fallback;
}

// ─── auth() — TOUJOURS connecte comme super_admin ───────────────────────────
export async function auth() {
  const admin = await getDevAdmin();
  return {
    user: {
      id: `admin-${admin.id}`,
      email: admin.email,
      name: admin.fullName ?? admin.email,
      role: "admin" as const,
      adminRole: admin.role ?? "super_admin",
      adminId: admin.id,
    },
    expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  };
}

// ─── signIn / signOut — no-ops ──────────────────────────────────────────────
export async function signIn(_provider?: string, _options?: Record<string, unknown>) {
  return { ok: true, error: null, status: 200, url: "/admin" };
}

export async function signOut(_options?: Record<string, unknown>) {
  return { url: "/admin" };
}

// ─── handlers — stub pour /api/auth/[...nextauth] ───────────────────────────
async function noopHandler() {
  return new Response(JSON.stringify({ ok: true, auth: "disabled" }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

export const handlers = {
  GET: noopHandler,
  POST: noopHandler,
};

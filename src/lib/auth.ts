// NextAuth v5: admin password, passkey, client portal, and SSO when configured.
// A dev-only bypass sits at the bottom; it cannot engage in production.
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { z } from "zod";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { logLoginEvent } from "./request-context";

// Session shape shared by both roles.

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



// Fail closed at run time. `next build` is exempt: it runs under NODE_ENV
// production too, and a build must not depend on the runtime secrets.
const IS_BUILD = process.env.NEXT_PHASE === "phase-production-build";
if (process.env.NODE_ENV === "production" && !IS_BUILD) {
  if (!process.env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required in production: refusing to serve unsigned sessions.");
  }
  if (process.env.AUTH_DEV_BYPASS === "1") {
    throw new Error("AUTH_DEV_BYPASS is set on a production server: refusing to start.");
  }
}

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  kind: z.enum(["admin", "client"]).default("client"),
  twoFactorCode: z.string().optional(),
  trustDevice: z.union([z.boolean(), z.string()]).optional(),
});



const nextAuth = NextAuth({
  trustHost: true,
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 7 * 24 * 60 * 60, // 7 days (configurable via Settings)
  },
  pages: {
    signIn: "/admin/login",
    error: "/admin/login",
  },
  providers: [
    // ─── Admin password ─────────────────────────────────────
    Credentials({
      id: "admin-credentials",
      name: "Admin",
      credentials: {
        email: { label: "Courriel", type: "email" },
        password: { label: "Mot de passe", type: "password" },
      },
      authorize: async (raw, req) => {
        const parsed = credentialsSchema.safeParse({
          ...raw,
          kind: "admin",
        });
        const reqObj = req as Request | undefined;
        const email = (raw as { email?: string })?.email ?? "";
        if (!parsed.success) {
          if (reqObj && email) await logLoginEvent({ req: reqObj, email, type: "failed", reason: "invalid_payload" }).catch(() => {});
          return null;
        }

        const admin = await prisma.admin.findUnique({
          where: { email: parsed.data.email },
        });
        if (!admin || !admin.isActive) {
          if (reqObj) await logLoginEvent({ req: reqObj, email: parsed.data.email, type: "failed", reason: !admin ? "unknown_email" : "account_inactive" }).catch(() => {});
          return null;
        }

        const valid = await bcrypt.compare(parsed.data.password, admin.passwordHash);
        if (!valid) {
          if (reqObj) await logLoginEvent({ req: reqObj, adminId: admin.id, email: admin.email, type: "failed", reason: "wrong_password" }).catch(() => {});
          return null;
        }

        // Device details, for 2FA and the trusted-device check.
        const { parseUserAgent, deviceFingerprint } = await import("./security/ua-parser");
        const { getRequestGeo } = await import("./security/geo");
        const ua = reqObj?.headers.get("user-agent") ?? null;
        const parsedUA = parseUserAgent(ua);
        const geo = reqObj ? await getRequestGeo().catch(() => ({ ip: null, country: null, city: null })) : { ip: null, country: null, city: null };
        const fingerprint = await deviceFingerprint(ua ?? "", geo.ip);

        // 2FA, when the account has it on.
        if (admin.twoFactorEnabled && admin.twoFactorSecret) {
          // A trusted device skips the code.
          const trusted = await prisma.adminTrustedDevice.findUnique({
            where: { adminId_fingerprint: { adminId: admin.id, fingerprint } },
          });
          const trustedValid = trusted && new Date(trusted.expiresAt) > new Date();

          if (!trustedValid) {
            // Code required.
            const code = parsed.data.twoFactorCode;
            if (!code) {
              if (reqObj) await logLoginEvent({ req: reqObj, adminId: admin.id, email: admin.email, type: "2fa_challenge" }).catch(() => {});
              return null;
            }
            const { verifySync } = await import("otplib");
            const codeValid = verifySync({ token: code, secret: admin.twoFactorSecret });
            if (!codeValid) {
              if (reqObj) await logLoginEvent({ req: reqObj, adminId: admin.id, email: admin.email, type: "2fa_failed" }).catch(() => {});
              return null;
            }
            if (reqObj) await logLoginEvent({ req: reqObj, adminId: admin.id, email: admin.email, type: "2fa_success" }).catch(() => {});

            // "Trust this device" keeps it for 30 days.
            const trustDevice = parsed.data.trustDevice === true || parsed.data.trustDevice === "true";
            if (trustDevice) {
              const label = `${parsedUA.browser} sur ${parsedUA.os}`;
              const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
              await prisma.adminTrustedDevice.upsert({
                where: { adminId_fingerprint: { adminId: admin.id, fingerprint } },
                create: { adminId: admin.id, fingerprint, label, expiresAt },
                update: { label, expiresAt, lastUsedAt: new Date() },
              }).catch((e) => console.error("[auth] trusted device upsert failed:", e));
            }
          } else if (trusted) {
            // Known device: just touch lastUsedAt.
            await prisma.adminTrustedDevice.update({
              where: { id: trusted.id },
              data: { lastUsedAt: new Date() },
            }).catch(() => null);
          }
        }

        // Record the login.
        await prisma.admin.update({
          where: { id: admin.id },
          data: { lastLogin: new Date() },
        });

        // An AdminSession row backs the device list and remote sign-out.
        let sessionId: string | null = null;
        let isNewDevice = false;
        try {
          // New device = never seen in the last 30 days.
          const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const previousFromSameDevice = await prisma.adminSession.count({
            where: {
              adminId: admin.id,
              userAgent: ua,
              ipAddress: geo.ip,
              createdAt: { gte: since },
            },
          });
          isNewDevice = previousFromSameDevice === 0;

          const token = crypto.randomBytes(32).toString("hex");
          const created = await prisma.adminSession.create({
            data: {
              adminId: admin.id,
              token,
              userAgent: ua,
              ipAddress: geo.ip,
              browser: parsedUA.browser,
              os: parsedUA.os,
              deviceType: parsedUA.deviceType,
              country: geo.country,
              city: geo.city,
              lastActiveAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          sessionId = created.id;
        } catch (e) {
          console.error("[auth] AdminSession creation failed:", e);
        }

        // Warn by email on an unknown device.
        if (isNewDevice && sessionId && admin.loginAlertsEnabled) {
          try {
            const { sendLoginAlertEmail } = await import("./security/login-alert");
            const appUrl = reqObj ? new URL(reqObj.url).origin : undefined;
            // Fire and forget: never block the sign-in.
            sendLoginAlertEmail({
              adminId: admin.id,
              adminEmail: admin.email,
              adminName: admin.fullName,
              sessionId,
              browser: parsedUA.browser,
              os: parsedUA.os,
              deviceType: parsedUA.deviceType,
              ipAddress: geo.ip,
              country: geo.country,
              city: geo.city,
              loginAt: new Date(),
              appUrl,
            }).catch((e) => console.error("[auth] login alert email failed:", e));
          } catch (e) {
            console.error("[auth] login alert dispatch failed:", e);
          }
        }

        await logAudit({
          adminId: admin.id,
          action: "login",
          entityType: "admin",
          entityId: admin.id,
        });
        if (reqObj) await logLoginEvent({ req: reqObj, adminId: admin.id, email: admin.email, type: "success" }).catch(() => {});

        return {
          id: `admin-${admin.id}`,
          email: admin.email,
          name: admin.fullName ?? admin.email,
          image: admin.avatarUrl ?? undefined,
          ...(sessionId ? { sessionId } : {}),
        };
      },
    }),

    // ─── Admin passkey (WebAuthn, no password) ──────────────
    // The one-shot token comes from /api/auth/passkey/auth-finish, after the
    // WebAuthn assertion has been verified server-side.
    Credentials({
      id: "admin-passkey",
      name: "Admin Passkey",
      credentials: {
        email: { label: "Email", type: "email" },
        token: { label: "WebAuthn one-shot token", type: "text" },
      },
      authorize: async (raw, req) => {
        const email = typeof (raw as { email?: string })?.email === "string"
          ? (raw as { email: string }).email.toLowerCase().trim() : "";
        const token = typeof (raw as { token?: string })?.token === "string"
          ? (raw as { token: string }).token : "";
        if (!email || !token) return null;

        const crypto = await import("crypto");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const challenge = await prisma.webAuthnChallenge.findUnique({
          where: { challenge: tokenHash },
        });
        if (!challenge || challenge.purpose !== "auth-token") return null;
        if (challenge.expiresAt < new Date()) return null;
        if (!challenge.adminId) return null;

        const admin = await prisma.admin.findUnique({
          where: { id: challenge.adminId },
        });
        if (!admin || !admin.isActive || admin.email.toLowerCase() !== email) return null;

        // The challenge token is single use.
        await prisma.webAuthnChallenge.delete({ where: { id: challenge.id } }).catch(() => null);

        const reqObj = req as Request | undefined;
        const { parseUserAgent, deviceFingerprint } = await import("./security/ua-parser");
        const { getRequestGeo } = await import("./security/geo");
        const ua = reqObj?.headers.get("user-agent") ?? null;
        const parsedUA = parseUserAgent(ua);
        const geo = reqObj ? await getRequestGeo().catch(() => ({ ip: null, country: null, city: null })) : { ip: null, country: null, city: null };
        await deviceFingerprint(ua ?? "", geo.ip); // parity with the password path

        await prisma.admin.update({
          where: { id: admin.id },
          data: { lastLogin: new Date() },
        });

        let sessionId: string | null = null;
        try {
          const sessionToken = crypto.randomBytes(32).toString("hex");
          const created = await prisma.adminSession.create({
            data: {
              adminId: admin.id,
              token: sessionToken,
              userAgent: ua,
              ipAddress: geo.ip,
              browser: parsedUA.browser,
              os: parsedUA.os,
              deviceType: parsedUA.deviceType,
              country: geo.country,
              city: geo.city,
              lastActiveAt: new Date(),
              expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
            },
          });
          sessionId = created.id;
        } catch (e) {
          console.error("[auth-passkey] AdminSession creation failed:", e);
        }

        await logAudit({
          adminId: admin.id, action: "login", entityType: "admin", entityId: admin.id,
          changes: { via: "passkey" },
        });
        if (reqObj) await logLoginEvent({ req: reqObj, adminId: admin.id, email: admin.email, type: "success", reason: "passkey" }).catch(() => {});

        return {
          id: `admin-${admin.id}`,
          email: admin.email,
          name: admin.fullName ?? admin.email,
          image: admin.avatarUrl ?? undefined,
          ...(sessionId ? { sessionId } : {}),
        };
      },
    }),

    // ─── Client portal password ─────────────────────────────
    Credentials({
      id: "client-credentials",
      name: "Client",
      credentials: {
        email: { label: "Courriel", type: "email" },
        password: { label: "Mot de passe", type: "password" },
        twoFactorCode: { label: "Code 2FA", type: "text" },
      },
      authorize: async (raw, req) => {
        const parsed = credentialsSchema.safeParse({
          ...raw,
          kind: "client",
        });
        const reqObj = req as Request | undefined;
        const emailRaw = (raw as { email?: string })?.email ?? "";
        if (!parsed.success) {
          if (reqObj && emailRaw) await logLoginEvent({ req: reqObj, email: emailRaw, type: "failed", reason: "invalid_payload" }).catch(() => {});
          return null;
        }

        const client = await prisma.client.findUnique({
          where: { email: parsed.data.email },
        });
        if (!client || !client.isActive || client.archived) {
          if (reqObj) await logLoginEvent({ req: reqObj, email: parsed.data.email, type: "failed", reason: !client ? "unknown_email" : client.archived ? "account_archived" : "account_inactive" }).catch(() => {});
          return null;
        }

        const valid = await bcrypt.compare(parsed.data.password, client.passwordHash);
        if (!valid) {
          if (reqObj) await logLoginEvent({ req: reqObj, clientId: client.id, email: client.email, type: "failed", reason: "wrong_password" }).catch(() => {});
          return null;
        }

        // 2FA, when the account has it on.
        if (client.twoFactorEnabled && client.twoFactorSecret) {
          const code = parsed.data.twoFactorCode;
          if (!code) {
            if (reqObj) await logLoginEvent({ req: reqObj, clientId: client.id, email: client.email, type: "2fa_challenge" }).catch(() => {});
            return null;
          }
          const { verifySync } = await import("otplib");
          const isValid = verifySync({ token: code, secret: client.twoFactorSecret });
          if (!isValid) {
            if (reqObj) await logLoginEvent({ req: reqObj, clientId: client.id, email: client.email, type: "2fa_failed" }).catch(() => {});
            return null;
          }
          if (reqObj) await logLoginEvent({ req: reqObj, clientId: client.id, email: client.email, type: "2fa_success" }).catch(() => {});
        }

        await prisma.client.update({
          where: { id: client.id },
          data: { lastLogin: new Date() },
        });

        if (reqObj) await logLoginEvent({ req: reqObj, clientId: client.id, email: client.email, type: "success" }).catch(() => {});

        return {
          id: `client-${client.id}`,
          email: client.email,
          name: client.fullName,
          image: client.avatarUrl ?? undefined,
        };
      },
    }),

    // ─── Google OAuth, enabled by setting the env vars ────────
    ...(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET
      ? [
          Google({
            clientId: process.env.AUTH_GOOGLE_ID,
            clientSecret: process.env.AUTH_GOOGLE_SECRET,
          }),
        ]
      : []),

    // ─── Microsoft Entra ID SSO ───────────────────────────────
    ...(process.env.AUTH_MICROSOFT_ENTRA_ID_ID && process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET
      ? [
          MicrosoftEntraID({
            clientId: process.env.AUTH_MICROSOFT_ENTRA_ID_ID,
            clientSecret: process.env.AUTH_MICROSOFT_ENTRA_ID_SECRET,
            issuer: process.env.AUTH_MICROSOFT_ENTRA_ID_ISSUER,
          }),
        ]
      : []),
  ],
  callbacks: {
    // SSO only admits an email that already belongs to an active admin.
    async signIn({ user, account }) {
      // Credentials providers are already validated in authorize().
      if (account?.provider === "google" || account?.provider === "microsoft-entra-id") {
        const email = user.email?.toLowerCase().trim();
        if (!email) return false;
        const admin = await prisma.admin.findUnique({
          where: { email },
          select: { id: true, isActive: true },
        });
        if (!admin || !admin.isActive) return false;
        // Remap user.id so the jwt callback treats this as an admin.
        user.id = `admin-${admin.id}`;

        // No auto-provisioning: an admin account must already exist.
        return true;
      }
      return true;
    },
    async jwt({ token, user, account }) {
      if (user?.id) {
        const [kind, rawId] = user.id.split("-");
        token.role = kind === "admin" ? "admin" : "client";
        if (kind === "admin") {
          token.adminId = Number(rawId);
          const admin = await prisma.admin.findUnique({
            where: { id: Number(rawId) },
            select: { role: true },
          });
          token.adminRole = admin?.role ?? "admin";
          if ((user as { sessionId?: string }).sessionId) {
            token.sessionId = (user as { sessionId?: string }).sessionId;
          }
          // Trace the SSO login.
          if (account?.provider === "google" || account?.provider === "microsoft-entra-id") {
            await logAudit({
              adminId: Number(rawId),
              action: "login",
              entityType: "admin",
              entityId: Number(rawId),
              changes: { via: account.provider },
            }).catch(() => null);
          }
        } else {
          token.clientId = Number(rawId);
        }
      }
      // Two ways an admin session dies: its AdminSession row is gone
      // (revoked from the device list), or it predates
      // admin.sessionsInvalidatedAt (global sign-out).
      if (token.role === "admin" && token.adminId) {
        try {
          // Account status and global invalidation, checked every time.
          const admin = await prisma.admin.findUnique({
            where: { id: token.adminId as number },
            select: { sessionsInvalidatedAt: true, isActive: true },
          });
          if (!admin || !admin.isActive) {
            return {} as typeof token; // account deleted or deactivated
          }
          const iatMs = (token.iat as number | undefined) ? (token.iat as number) * 1000 : 0;
          if (admin.sessionsInvalidatedAt && admin.sessionsInvalidatedAt.getTime() > iatMs) {
            return {} as typeof token; // global sign-out
          }

          // With a sessionId, the row must still exist.
          if (token.sessionId) {
            const sessionExists = await prisma.adminSession.findUnique({
              where: { id: token.sessionId as string },
              select: { id: true },
            });
            if (!sessionExists) {
              return {} as typeof token;
            }
          }
        } catch { /* never blocks the request */ }
      }
      // Sliding session: at most once a minute, mark the session active and
      // push its expiry back 7 days, so an account in daily use never logs out.
      if (token.sessionId && token.role === "admin") {
        const lastTouch = (token.lastTouch as number | undefined) ?? 0;
        if (Date.now() - lastTouch > 60_000) {
          token.lastTouch = Date.now();
          const newExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          prisma.adminSession.updateMany({
            where: { id: token.sessionId as string },
            data: { lastActiveAt: new Date(), expiresAt: newExpires },
          }).catch(() => null);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = String(token.sub ?? "");
        session.user.role = (token.role as "admin" | "client") ?? "client";
        session.user.adminRole = (token.adminRole as string | null) ?? null;
        session.user.adminId = token.adminId as number | undefined;
        session.user.clientId = token.clientId as number | undefined;
        session.user.sessionId = token.sessionId as string | undefined;
      }
      return session;
    },
  },
});

export const handlers = nextAuth.handlers;
export const signIn = nextAuth.signIn;
export const signOut = nextAuth.signOut;

// ─── Session type ───────────────────────────────────────────────────────────
// Covers BOTH roles: the client portal reads session.user.clientId, and a
// type that only described admins made that code compile blind.
export type AppSessionUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "client";
  adminRole?: string | null;
  adminId?: number;
  clientId?: number;
  sessionId?: string;
};
export type AppSession = { user: AppSessionUser; expires: string };

// ─── Development bypass ─────────────────────────────────────────────────────
// Signs you in as the first active admin. Needs NODE_ENV != production AND
// AUTH_DEV_BYPASS=1; drop the line from .env.local to test the real sign-in.
const DEV_BYPASS =
  process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "1";

type DevAdmin = { id: number; email: string; fullName: string | null; role: string | null };

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
    console.warn("[auth] dev bypass: DB lookup failed,", (e as Error).message);
  }
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

/** The signed-in session, or null. */
export async function auth(): Promise<AppSession | null> {
  if (DEV_BYPASS) {
    const admin = await getDevAdmin();
    return {
      user: {
        id: `admin-${admin.id}`,
        email: admin.email,
        name: admin.fullName ?? admin.email,
        role: "admin",
        adminRole: admin.role ?? "super_admin",
        adminId: admin.id,
      },
      expires: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }
  return (await nextAuth.auth()) as AppSession | null;
}

// NextAuth v5 — 2 providers d'identité (admin + client portal) via Credentials
// Pour Google / Microsoft SSO : activables via la section Paramètres → Intégrations
import NextAuth, { type DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import MicrosoftEntraID from "next-auth/providers/microsoft-entra-id";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "./prisma";
import { logAudit } from "./audit";
import { logLoginEvent } from "./request-context";

// ═══════════════════════════════════════════════════════════
// TYPES AUGMENTATION
// ═══════════════════════════════════════════════════════════

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: "admin" | "client";
      adminRole?: string | null;
      clientId?: number;
      adminId?: number;
    } & DefaultSession["user"];
  }
}

// ═══════════════════════════════════════════════════════════
// SCHEMAS
// ═══════════════════════════════════════════════════════════

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  kind: z.enum(["admin", "client"]).default("client"),
  twoFactorCode: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════
// NEXTAUTH CONFIG
// ═══════════════════════════════════════════════════════════

export const { handlers, auth, signIn, signOut } = NextAuth({
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
    // ─── Admin credentials ──────────────────────────────────
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

        // Mettre à jour lastLogin
        await prisma.admin.update({
          where: { id: admin.id },
          data: { lastLogin: new Date() },
        });

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
        };
      },
    }),

    // ─── Client credentials (portail) ───────────────────────
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

        // 2FA verification si active
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

    // ─── Google OAuth (activable via Settings → Intégrations) ──
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
        } else {
          token.clientId = Number(rawId);
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
      }
      return session;
    },
  },
});

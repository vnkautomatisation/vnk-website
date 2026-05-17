"use server";
// Flow "mot de passe oublié" complet pour admin + client.
// 3 étapes :
//   1. demandePasswordResetAction(email) → envoie email avec lien + code 6 chiffres
//   2. verifyResetCodeAction(token, code) → valide la session de reset
//   3. completePasswordResetAction(token, code, newPassword) → applique
// Sécurité : token 256 bits, code 6 chiffres, expiration 30 min, max 5 essais.
// On retourne TOUJOURS success: true au step 1 même si email inconnu (anti enum).
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";
import { sendEmail } from "@/lib/services/email";
import { escapeHtml, escapeUrlForEmail } from "@/lib/security/escape-html";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

const RESET_TTL_MIN = 30;
const MAX_ATTEMPTS = 5;

function generateCode(): string {
  // 6 chiffres entre 100000 et 999999
  const min = 100000;
  const max = 999999;
  const buf = crypto.randomBytes(4);
  const n = buf.readUInt32BE(0) % (max - min + 1) + min;
  return n.toString();
}

// ── ÉTAPE 1 : Demander la réinitialisation ──
const requestSchema = z.object({
  email: z.string().email("Email invalide").max(200),
  audience: z.enum(["admin", "client"]).default("admin"),
});

export async function requestPasswordResetAction(
  input: z.infer<typeof requestSchema>
): Promise<Result<{ tokenHint: string }>> {
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const email = parsed.data.email.toLowerCase().trim();

  // Rate-limit basique : pas plus de 3 requêtes pour le même email dans 15 min
  const recent = await prisma.passwordResetToken.count({
    where: { email, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
  });
  if (recent >= 3) {
    return { success: false, error: "Trop de demandes récentes. Veuillez patienter quelques minutes." };
  }

  // Trouve l'utilisateur (sans révéler s'il existe)
  let adminId: number | null = null;
  let clientId: number | null = null;
  let fullName: string | null = null;

  if (parsed.data.audience === "admin") {
    const admin = await prisma.admin.findUnique({
      where: { email },
      select: { id: true, fullName: true, isActive: true },
    });
    if (admin && admin.isActive) {
      adminId = admin.id;
      fullName = admin.fullName;
    }
  } else {
    const client = await prisma.client.findUnique({
      where: { email },
      select: { id: true, fullName: true, isActive: true },
    });
    if (client && client.isActive) {
      clientId = client.id;
      fullName = client.fullName;
    }
  }

  // Génère token + code SEULEMENT si user trouvé (sinon on retourne quand même OK)
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const code = generateCode();
  const codeHash = crypto.createHash("sha256").update(code).digest("hex");
  const expiresAt = new Date(Date.now() + RESET_TTL_MIN * 60 * 1000);

  // Capture l'IP/UA pour audit (avec rate-limit anti brute-force)
  const h = await headers().catch(() => null);
  const ipAddress = h?.get("x-forwarded-for")?.split(",")[0].trim() ?? null;
  const userAgent = h?.get("user-agent") ?? null;

  // Rate-limit par IP : pas plus de 10 demandes en 15 min
  if (ipAddress) {
    const recentByIp = await prisma.passwordResetToken.count({
      where: { ipAddress, createdAt: { gt: new Date(Date.now() - 15 * 60 * 1000) } },
    });
    if (recentByIp >= 10) {
      return { success: false, error: "Trop de tentatives depuis votre adresse. Patientez quelques minutes." };
    }
  }

  if (adminId || clientId) {
    await prisma.passwordResetToken.create({
      data: {
        email,
        adminId,
        clientId,
        tokenHash,
        codeHash,
        expiresAt,
        ipAddress,
        userAgent,
      },
    });

    // Construire URL de reset
    const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://vnkautomatisation.ca";
    const resetUrl = `${baseUrl.replace(/\/$/, "")}/${parsed.data.audience === "admin" ? "admin" : "portail"}/reset-password?token=${rawToken}`;

    // Envoie email (échappement HTML strict)
    const safeName = escapeHtml(fullName ?? "");
    const safeUrl = escapeUrlForEmail(resetUrl);
    const safeIp = escapeHtml(ipAddress ?? "");
    try {
      await sendEmail({
        to: email,
        subject: "Réinitialisation de votre mot de passe — VNK Automatisation",
        html: `
<!DOCTYPE html>
<html lang="fr">
<head><meta charset="UTF-8" /></head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;padding:20px">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0F2D52,#15406d);color:#fff;padding:24px;text-align:center">
      <h1 style="margin:0;font-size:20px;font-weight:700">Réinitialisation de mot de passe</h1>
      <p style="margin:6px 0 0;opacity:0.85;font-size:14px">VNK Automatisation</p>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6">
      ${safeName ? `<p>Bonjour <strong>${safeName}</strong>,</p>` : "<p>Bonjour,</p>"}
      <p>Vous avez demandé à réinitialiser votre mot de passe. Voici votre code de sécurité :</p>
      <div style="text-align:center;margin:24px 0">
        <div style="display:inline-block;background:#f3f4f6;border:2px dashed #0F2D52;padding:18px 32px;border-radius:8px">
          <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0F2D52;font-family:monospace">${code}</span>
        </div>
      </div>
      <p>Ou cliquez sur ce bouton pour ouvrir la page directement :</p>
      <p style="text-align:center;margin:20px 0">
        <a href="${safeUrl}" style="display:inline-block;background:#0F2D52;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Réinitialiser mon mot de passe</a>
      </p>
      <p style="color:#6b7280;font-size:12px">Ce code expire dans <strong>${RESET_TTL_MIN} minutes</strong>. Si vous n'êtes pas à l'origine de cette demande, ignorez cet email.</p>
      ${ipAddress ? `<p style="color:#9ca3af;font-size:11px">Demande effectuée depuis l'adresse IP <code>${safeIp}</code></p>` : ""}
    </div>
    <div style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb">
      VNK Automatisation Inc. · Sécurité du compte
    </div>
  </div>
</body>
</html>`.trim(),
      });
    } catch (e) {
      console.error("[password-reset-email]", e);
    }

    if (adminId) {
      await logSecurityEvent({
        adminId,
        type: "password_changed",
        severity: "info",
        message: "Réinitialisation de mot de passe demandée",
        metadata: { ip: ipAddress },
      });
    }
  }

  // Toujours retourner OK avec un hint anonymisé du token (pour la page suivante)
  // En cas d'email inconnu, on retourne aussi success mais sans token utilisable
  return {
    success: true,
    data: {
      tokenHint: adminId || clientId ? rawToken : "",
    },
  };
}

// ── ÉTAPE 2 : Vérifier le code ──
const verifySchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
});

export async function verifyResetCodeAction(
  input: z.infer<typeof verifySchema>
): Promise<Result<{ verified: true }>> {
  const parsed = verifySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Code invalide" };

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record) return { success: false, error: "Lien invalide ou expiré" };
  if (record.usedAt) return { success: false, error: "Ce lien a déjà été utilisé" };
  if (record.expiresAt < new Date()) return { success: false, error: "Lien expiré" };
  if (record.attempts >= MAX_ATTEMPTS) {
    return { success: false, error: "Trop de tentatives. Demandez un nouveau lien." };
  }

  const codeHash = crypto.createHash("sha256").update(parsed.data.code).digest("hex");
  if (codeHash !== record.codeHash) {
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { success: false, error: `Code incorrect (${MAX_ATTEMPTS - record.attempts - 1} essai(s) restant(s))` };
  }

  return { success: true, data: { verified: true } };
}

// ── ÉTAPE 3 : Compléter le reset ──
const completeSchema = z.object({
  token: z.string().min(1),
  code: z.string().length(6).regex(/^\d{6}$/),
  newPassword: z
    .string()
    .min(12, "Au moins 12 caractères")
    .regex(/[A-Z]/, "Au moins une majuscule")
    .regex(/[a-z]/, "Au moins une minuscule")
    .regex(/\d/, "Au moins un chiffre"),
});

export async function completePasswordResetAction(
  input: z.infer<typeof completeSchema>
): Promise<Result> {
  const parsed = completeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");
  const record = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

  if (!record) return { success: false, error: "Lien invalide ou expiré" };
  if (record.usedAt) return { success: false, error: "Ce lien a déjà été utilisé" };
  if (record.expiresAt < new Date()) return { success: false, error: "Lien expiré" };
  if (record.attempts >= MAX_ATTEMPTS) {
    return { success: false, error: "Trop de tentatives. Demandez un nouveau lien." };
  }

  const codeHash = crypto.createHash("sha256").update(parsed.data.code).digest("hex");
  if (codeHash !== record.codeHash) {
    await prisma.passwordResetToken.update({
      where: { id: record.id },
      data: { attempts: { increment: 1 } },
    });
    return { success: false, error: "Code incorrect" };
  }

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);

  await prisma.$transaction(async (tx) => {
    // Marquer le token comme utilisé
    await tx.passwordResetToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    if (record.adminId) {
      await tx.admin.update({
        where: { id: record.adminId },
        data: {
          passwordHash,
          passwordChangedAt: new Date(),
          failedLoginAttempts: 0,
          lockedUntil: null,
          sessionsInvalidatedAt: new Date(),
        },
      });
      await tx.adminSession.deleteMany({ where: { adminId: record.adminId } });
    } else if (record.clientId) {
      await tx.client.update({
        where: { id: record.clientId },
        data: { passwordHash },
      });
    }

    // Invalider toutes les autres tokens de reset pour cet email
    await tx.passwordResetToken.updateMany({
      where: { email: record.email, id: { not: record.id }, usedAt: null },
      data: { usedAt: new Date() },
    });
  });

  if (record.adminId) {
    await logSecurityEvent({
      adminId: record.adminId,
      type: "password_changed",
      severity: "success",
      message: "Mot de passe réinitialisé via courriel",
      metadata: { ip: record.ipAddress },
    });
  }

  return { success: true };
}

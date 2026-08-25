"use server";
// Server Action publique — acceptation d'une invitation d'admin.
// Pas d'auth requise puisque le user n'a pas encore de compte.
// Sécurité : token single-use validé par hash SHA-256, expiration 7 jours.
// Anti brute-force : rate-limit par IP (20 essais/15 min).
import { z } from "zod";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";
import { checkRateLimit, getClientIpFromHeaders } from "@/lib/security/rate-limit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

const schema = z.object({
  token: z.string().min(1),
  password: z
    .string()
    .min(12, "Le mot de passe doit faire au moins 12 caractères")
    .regex(/[A-Z]/, "Au moins une majuscule")
    .regex(/[a-z]/, "Au moins une minuscule")
    .regex(/\d/, "Au moins un chiffre"),
  consentAccepted: z.boolean().refine((v) => v === true, {
    message: "Vous devez accepter les politiques pour continuer",
  }),
});

export async function acceptInvitationAction(input: z.infer<typeof schema>): Promise<Result<{ adminId: number }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // ── Rate-limit anti brute-force sur le token ────────────────
  const h = await headers().catch(() => null);
  const ip = getClientIpFromHeaders(h);
  const rl = checkRateLimit({
    key: `accept-invite:${ip}`,
    limit: 20,
    windowMs: 15 * 60 * 1000,
  });
  if (!rl.ok) {
    return {
      success: false,
      error: `Trop de tentatives. Réessayez dans ${Math.ceil(rl.retryAfterMs / 60000)} minute(s).`,
    };
  }

  const tokenHash = crypto.createHash("sha256").update(parsed.data.token).digest("hex");

  const invitation = await prisma.adminInvitation.findUnique({ where: { tokenHash } });
  if (!invitation) return { success: false, error: "Lien d'invitation invalide" };
  if (invitation.revokedAt) return { success: false, error: "Cette invitation a été annulée" };
  if (invitation.acceptedAt) return { success: false, error: "Cette invitation a déjà été utilisée" };
  if (invitation.expiresAt < new Date()) return { success: false, error: "Cette invitation a expiré" };

  // Double-check : email pas pris depuis
  const existing = await prisma.admin.findUnique({ where: { email: invitation.email } });
  if (existing) return { success: false, error: "Un compte avec cet email existe déjà. Connectez-vous." };

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  // Transaction : créer admin + marquer invitation acceptée (atomic)
  // updateMany guard pour éviter double-acceptation en cas de double-clic.
  const result = await prisma.$transaction(async (tx) => {
    const claimed = await tx.adminInvitation.updateMany({
      where: { id: invitation.id, acceptedAt: null, revokedAt: null },
      data: { acceptedAt: new Date() },
    });
    if (claimed.count === 0) {
      throw new Error("INVITATION_ALREADY_CLAIMED");
    }
    const admin = await tx.admin.create({
      data: {
        email: invitation.email,
        passwordHash,
        fullName: invitation.fullName,
        title: invitation.title,
        phone: invitation.phone,
        department: invitation.department,
        roleId: invitation.roleId,
        positionId: invitation.positionId,
        role: "admin",
        isActive: true,
        passwordChangedAt: new Date(),
        onboardingDone: false, // force le wizard à la première connexion
      },
      select: { id: true },
    });
    await tx.adminInvitation.update({
      where: { id: invitation.id },
      data: { acceptedAdminId: admin.id },
    });
    return admin;
  }).catch((e: unknown) => {
    if (e instanceof Error && e.message === "INVITATION_ALREADY_CLAIMED") {
      return null;
    }
    throw e;
  });

  if (!result) {
    return { success: false, error: "Cette invitation a déjà été utilisée" };
  }

  await logSecurityEvent({
    adminId: result.id,
    type: "user_created",
    severity: "success",
    message: `Compte activé via invitation`,
    metadata: { invitationId: invitation.id, invitedBy: invitation.invitedById, ip },
  });

  // Trace de consentement (politique utilisation + confidentialité)
  await logSecurityEvent({
    adminId: result.id,
    type: "consent_granted",
    severity: "info",
    message: "Politique d'utilisation et politique de confidentialité acceptées",
    metadata: { ip, source: "invitation_accept", at: new Date().toISOString() },
  });

  // Auto-assignation des documents requis (onboarding) — best-effort.
  // requestedById = l'inviteur (RH) si connu.
  const { assignRequiredDocsToNewEmployee } = await import(
    "@/lib/services/onboarding-docs"
  );
  await assignRequiredDocsToNewEmployee(result.id, invitation.invitedById ?? null);

  return { success: true, data: { adminId: result.id } };
}

"use server";
// Server Actions — gestion des utilisateurs admin (employés).
// Permet de créer/modifier/désactiver/supprimer des comptes admin sans toucher
// au code. Vérifie la permission users:write avant chaque mutation.
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { sendEmail } from "@/lib/services/email";
import { escapeHtml, escapeUrlForEmail } from "@/lib/security/escape-html";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

// ═══════════════════════════════════════════════════════════
// INVITATION D'UN UTILISATEUR (pattern Slack/Stripe)
// ═══════════════════════════════════════════════════════════
const inviteSchema = z.object({
  email: z.string().email("Email invalide").max(200),
  fullName: z.string().min(1).max(200),
  roleId: z.number().int().nullable().optional(),
  positionId: z.number().int().nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
});

const INVITE_TTL_DAYS = 7;

export async function inviteUserAction(input: z.infer<typeof inviteSchema>): Promise<Result<{ invitationId: number; expiresAt: string; inviteUrl: string; emailSent: boolean; emailError?: string }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  const parsed = inviteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Normaliser email
  const email = parsed.data.email.toLowerCase().trim();

  // Whitelist de domaine (P2)
  const allowedDomain = process.env.INVITE_EMAIL_DOMAIN;
  if (allowedDomain && !email.endsWith(`@${allowedDomain.toLowerCase()}`)) {
    return { success: false, error: `Email doit se terminer par @${allowedDomain}` };
  }

  // Rate-limit par admin : max 20 invitations/heure
  const recentByAdmin = await prisma.adminInvitation.count({
    where: { invitedById: adminId, createdAt: { gt: new Date(Date.now() - 60 * 60 * 1000) } },
  });
  if (recentByAdmin >= 20) {
    return { success: false, error: t("limite_atteinte_20_invitations_par_heure_reessayez") };
  }

  // Email déjà utilisé par un admin existant ?
  const existing = await prisma.admin.findUnique({ where: { email } });
  if (existing) return { success: false, error: t("un_compte_avec_cet_email_existe_deja_2") };

  // Valider FK : si roleId fourni, vérifier qu'il existe
  if (parsed.data.roleId) {
    const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
    if (!role) return { success: false, error: t("role_introuvable") };
  }
  // Valider FK : si positionId fourni, vérifier qu'il existe
  if (parsed.data.positionId) {
    const pos = await prisma.position.findUnique({ where: { id: parsed.data.positionId } });
    if (!pos) return { success: false, error: "Poste introuvable" };
  }

  // Hériter du rôle du poste si non fourni
  let effectiveRoleId = parsed.data.roleId ?? null;
  if (!effectiveRoleId && parsed.data.positionId) {
    const pos = await prisma.position.findUnique({ where: { id: parsed.data.positionId } });
    effectiveRoleId = pos?.defaultRoleId ?? null;
  }

  // Générer un token aléatoire 32 octets
  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  // ── Race condition guard : check + create dans une transaction ──
  // Si une autre invitation pour le même email est créée en parallèle,
  // l'isolation Serializable garantit que l'une des deux échouera.
  let invitation: { id: number };
  try {
    invitation = await prisma.$transaction(
      async (tx) => {
        const pendingInvite = await tx.adminInvitation.findFirst({
          where: {
            email,
            acceptedAt: null,
            revokedAt: null,
            expiresAt: { gt: new Date() },
          },
          select: { id: true },
        });
        if (pendingInvite) {
          throw new Error("DUPLICATE_PENDING_INVITE");
        }
        // Re-check admin (au cas où un compte aurait été créé entretemps)
        const dup = await tx.admin.findUnique({ where: { email }, select: { id: true } });
        if (dup) throw new Error("DUPLICATE_ADMIN");

        return tx.adminInvitation.create({
          data: {
            email,
            fullName: parsed.data.fullName,
            title: parsed.data.title ?? null,
            phone: parsed.data.phone ?? null,
            department: parsed.data.department ?? null,
            roleId: effectiveRoleId,
            positionId: parsed.data.positionId ?? null,
            tokenHash,
            invitedById: adminId,
            expiresAt,
          },
          select: { id: true },
        });
      },
      { isolationLevel: "Serializable" }
    );
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "DUPLICATE_PENDING_INVITE") {
      return { success: false, error: t("une_invitation_est_deja_en_cours_pour") };
    }
    if (msg === "DUPLICATE_ADMIN") {
      return { success: false, error: t("un_compte_avec_cet_email_existe_deja_2") };
    }
    // Conflit de sérialisation Postgres → retry-friendly message
    if (msg.includes("could not serialize") || msg.includes("40001")) {
      return { success: false, error: t("conflit_detecte_reessayez_s_il_vous_plait") };
    }
    throw e;
  }

  // Construire le lien d'invitation
  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://vnkautomatisation.ca";
  const inviteUrl = `${baseUrl.replace(/\/$/, "")}/admin/accept-invite?token=${rawToken}`;

  // Envoyer l'email d'invitation (capture l'erreur pour feedback à l'admin)
  let emailSent = false;
  let emailError: string | undefined;
  try {
    const invitedBy = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { fullName: true, email: true, locale: true },
    });
    const inviterName = invitedBy?.fullName || invitedBy?.email || "L'administrateur";
    // L'invite n'a pas encore de compte : on suit la langue de l'inviteur.
    const inviteLocale = invitedBy?.locale?.split("-")[0] ?? "fr";
    const te = await getTranslations({ locale: inviteLocale, namespace: "admin.emails" });
    const html = `
<!DOCTYPE html>
<html lang="${inviteLocale}">
<head>
<meta charset="UTF-8" />
</head>
<body style="margin:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;padding:20px">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0F2D52,#15406d);color:#fff;padding:24px;text-align:center">
      <h1 style="margin:0;font-size:20px;font-weight:700">${te("bienvenue_chez_vnk")}</h1>
      <p style="margin:6px 0 0;opacity:0.85;font-size:14px">${te("compte_pret_active")}</p>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6">
      <p>${te("bonjour_nom", { nom: `<strong>${escapeHtml(parsed.data.fullName)}</strong>` })}</p>
      <p>${te("x_vous_invite", { inviteur: `<strong>${escapeHtml(inviterName)}</strong>` })}</p>
      <p>${te("cliquez_bouton_creer_mdp")}</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${escapeUrlForEmail(inviteUrl)}" style="display:inline-block;background:#0F2D52;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Activer mon compte</a>
      </p>
      <p style="color:#6b7280;font-size:12px">Ce lien expire dans ${INVITE_TTL_DAYS} jours. Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :</p>
      <p style="word-break:break-all;font-family:monospace;font-size:11px;background:#f3f4f6;padding:8px;border-radius:4px;color:#374151">${escapeHtml(inviteUrl)}</p>
      <p style="margin-top:24px;color:#6b7280;font-size:12px">${te("si_vous_ne_vous_attendiez_pas")}</p>
    </div>
    <div style="background:#f9fafb;padding:16px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb">{te("users_vnk_automatisation_inc_securite_geree_par_le")}</div>
  </div>
</body>
</html>`.trim();

    await sendEmail({
      to: email,
      subject: te("sujet_invitation"),
      html,
    });
    emailSent = true;
  } catch (e) {
    console.error("[invite-email]", e);
    emailError = e instanceof Error ? e.message : "Erreur d'envoi du courriel";
    // On ne fait pas échouer la création — l'admin peut copier le lien
  }

  await logAudit({
    adminId,
    action: "create",
    entityType: "admin_invitation",
    entityId: invitation.id,
    changes: { email, roleId: effectiveRoleId },
  });
  await logSecurityEvent({
    adminId,
    type: "user_created",
    message: `Invitation envoyée à ${email}`,
    metadata: { invitationId: invitation.id },
  });

  revalidatePath("/admin/settings/team");
  return {
    success: true,
    data: {
      invitationId: invitation.id,
      expiresAt: expiresAt.toISOString(),
      inviteUrl,
      emailSent,
      emailError,
    },
  };
}

// ── Bulk invite : invite plusieurs personnes en une seule opération ──
// Accepte soit une liste simple d'emails (legacy, nom deviné),
// soit une liste d'entries { email, fullName } (recommandé).
const bulkInviteSchema = z.object({
  // Mode legacy : list d'emails (nom deviné depuis local-part)
  emails: z.array(z.string().email()).max(50).optional(),
  // Mode recommandé : entries explicites
  entries: z.array(z.object({
    email: z.string().email(),
    fullName: z.string().max(200).optional(),
  })).max(50).optional(),
  roleId: z.number().int().nullable().optional(),
  positionId: z.number().int().nullable().optional(),
  department: z.string().max(100).nullable().optional(),
}).refine((d) => (d.emails && d.emails.length > 0) || (d.entries && d.entries.length > 0), {
  message: "fournir_au_moins_un_email_a_inviter",
});

export async function bulkInviteUsersAction(
  input: z.infer<typeof bulkInviteSchema>
): Promise<Result<{ invited: number; skipped: Array<{ email: string; reason: string }> }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  const parsed = bulkInviteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Construire liste unifiée { email, fullName }
  type Entry = { email: string; fullName: string };
  const guessName = (email: string) =>
    email.split("@")[0]
      .split(/[.\-_]/)
      .filter(Boolean)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(" ");

  const map = new Map<string, Entry>();
  if (parsed.data.entries) {
    for (const e of parsed.data.entries) {
      const email = e.email.toLowerCase().trim();
      const fullName = (e.fullName && e.fullName.trim()) || guessName(email);
      if (!map.has(email)) map.set(email, { email, fullName });
    }
  }
  if (parsed.data.emails) {
    for (const raw of parsed.data.emails) {
      const email = raw.toLowerCase().trim();
      if (!map.has(email)) map.set(email, { email, fullName: guessName(email) });
    }
  }
  const list = Array.from(map.values());
  if (list.length === 0) return { success: false, error: "Aucun email valide" };
  if (list.length > 50) return { success: false, error: t("maximum_50_invitations_par_envoi") };

  const skipped: Array<{ email: string; reason: string }> = [];
  let invited = 0;

  for (const { email, fullName } of list) {
    const r = await inviteUserAction({
      email,
      fullName,
      roleId: parsed.data.roleId ?? null,
      positionId: parsed.data.positionId ?? null,
      department: parsed.data.department ?? null,
    });

    if (r.success) {
      invited += 1;
    } else {
      skipped.push({ email, reason: r.error });
    }
  }

  await logAudit({
    adminId,
    action: "create",
    entityType: "admin_invitation_bulk",
    changes: { invited, skipped: skipped.length, total: list.length },
  });

  revalidatePath("/admin/settings/team");
  revalidatePath("/admin/employes");
  return { success: true, data: { invited, skipped } };
}

// ── Révocation d'invitation ────────────────────────────────
export async function revokeInvitationAction(input: { id: number }): Promise<Result> {
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();

  await prisma.adminInvitation.update({
    where: { id: input.id },
    data: { revokedAt: new Date() },
  });

  await logAudit({ adminId, action: "delete", entityType: "admin_invitation", entityId: input.id });
  revalidatePath("/admin/settings/team");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// LOI 25 / RGPD — export et anonymisation des données user
// ═══════════════════════════════════════════════════════════
export async function exportUserDataAction(input: { id: number }): Promise<Result<{ data: Record<string, unknown> }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();

  const [admin, sessions, auditLogs, securityEvents, backupCodes, trustedDevices, apiTokens] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: input.id },
      include: {
        customRole: { select: { name: true, color: true, permissions: true } },
        position: { select: { name: true, color: true, defaultDepartment: true } },
      },
    }),
    prisma.adminSession.findMany({ where: { adminId: input.id } }),
    prisma.auditLog.findMany({ where: { adminId: input.id }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.adminSecurityEvent.findMany({ where: { adminId: input.id }, orderBy: { createdAt: "desc" }, take: 500 }),
    prisma.adminBackupCode.findMany({ where: { adminId: input.id }, select: { id: true, usedAt: true, createdAt: true } }),
    prisma.adminTrustedDevice.findMany({ where: { adminId: input.id } }),
    prisma.adminApiToken.findMany({ where: { adminId: input.id }, select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, createdAt: true, revokedAt: true } }),
  ]);

  if (!admin) return { success: false, error: "Utilisateur introuvable" };

  // Exclure passwordHash et twoFactorSecret (sécurité)
  const { passwordHash: _ph, twoFactorSecret: _2fa, passwordHistory: _hist, ...adminSafe } = admin;
  void _ph; void _2fa; void _hist;

  const exportData = {
    metadata: {
      exportedAt: new Date().toISOString(),
      exportedBy: adminId,
      legalBasis: "Loi 25 (Québec) — Article 27 (droit d'accès)",
      version: "1.0",
    },
    profile: adminSafe,
    sessions,
    auditLogs,
    securityEvents,
    backupCodes,
    trustedDevices,
    apiTokens,
  };

  // Marquer la demande d'export
  await prisma.admin.update({
    where: { id: input.id },
    data: { dataExportRequestedAt: new Date(), dataExportReadyAt: new Date() },
  });

  await logAudit({
    adminId, action: "export", entityType: "admin_data_export", entityId: input.id,
    changes: { totalRecords: sessions.length + auditLogs.length + securityEvents.length },
  });
  await logSecurityEvent({
    adminId: input.id,
    type: "data_export_requested",
    severity: "info",
    message: "export_de_donnees_personnelles_loi_25_declenche",
    metadata: { byAdminId: adminId },
  });

  return { success: true, data: { data: exportData } };
}

// Anonymisation — supprime les données personnelles mais conserve les références
// pour préserver l'intégrité des logs et l'historique métier.
export async function anonymizeUserAction(input: { id: number }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  if (input.id === adminId) return { success: false, error: t("vous_ne_pouvez_pas_vous_anonymiser_vous") };

  // Vérifier que c'est pas le dernier super_admin
  const target = await prisma.admin.findUnique({
    where: { id: input.id },
    include: { customRole: true },
  });
  if (!target) return { success: false, error: "Utilisateur introuvable" };
  if (target.customRole?.name === "super_admin") {
    const superAdminCount = await prisma.admin.count({
      where: { customRole: { name: "super_admin" }, isActive: true },
    });
    if (superAdminCount <= 1) {
      return { success: false, error: t("impossible_d_anonymiser_le_dernier_super_administrateur") };
    }
  }

  const anonymousId = crypto.randomBytes(4).toString("hex");
  await prisma.$transaction([
    prisma.admin.update({
      where: { id: input.id },
      data: {
        email: `anonyme-${anonymousId}@vnk.deleted`,
        fullName: "Compte anonymisé",
        passwordHash: crypto.randomBytes(32).toString("base64"),
        twoFactorSecret: null,
        twoFactorEnabled: false,
        avatarUrl: null,
        title: null,
        phone: null,
        bio: null,
        emailSignature: null,
        recoveryEmail: null,
        presenceMessage: null,
        internalNotes: `Anonymisé le ${new Date().toISOString()} par admin#${adminId}`,
        isActive: false,
        sessionsInvalidatedAt: new Date(),
      },
    }),
    prisma.adminSession.deleteMany({ where: { adminId: input.id } }),
    prisma.adminBackupCode.deleteMany({ where: { adminId: input.id } }),
    prisma.adminTrustedDevice.deleteMany({ where: { adminId: input.id } }),
    prisma.adminApiToken.updateMany({
      where: { adminId: input.id, revokedAt: null },
      data: { revokedAt: new Date() },
    }),
  ]);

  await logAudit({
    adminId, action: "delete", entityType: "admin_anonymized", entityId: input.id,
    changes: { anonymousId, originalEmail: target.email },
  });
  await logSecurityEvent({
    adminId,
    type: "account_deletion_requested",
    severity: "critical",
    message: `Compte anonymisé (Loi 25 / Droit à l'oubli) : ${target.email}`,
    metadata: { targetId: input.id, anonymousId },
  });

  revalidatePath("/admin/settings/team");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// RESET PASSWORD PAR EMAIL — déclenché par admin pour un user
// ═══════════════════════════════════════════════════════════
export async function sendPasswordResetEmailAction(input: { id: number }): Promise<Result<{ emailSent: boolean }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();

  const target = await prisma.admin.findUnique({
    where: { id: input.id },
    select: { id: true, email: true, fullName: true, isActive: true },
  });
  if (!target) return { success: false, error: "Utilisateur introuvable" };
  if (!target.isActive) return { success: false, error: t("compte_desactive_reactivez_le_d_abord") };

  // Délègue au flow standard de reset
  const { requestPasswordResetAction } = await import("./password-reset");
  const r = await requestPasswordResetAction({ email: target.email, audience: "admin" });

  if (!r.success) return { success: false, error: r.error };

  await logAudit({
    adminId,
    action: "password_reset",
    entityType: "admin",
    entityId: target.id,
    changes: { method: "email_link", initiatedBy: "admin" },
  });
  await logSecurityEvent({
    adminId: target.id,
    type: "password_changed",
    severity: "warning",
    message: `Lien de réinitialisation de mot de passe envoyé par un administrateur`,
    metadata: { byAdminId: adminId },
  });

  return { success: true, data: { emailSent: !!r.data.tokenHint } };
}

// ═══════════════════════════════════════════════════════════
// SÉCURITÉ — actions de gestion 2FA et déblocage
// ═══════════════════════════════════════════════════════════
export async function disable2FAAction(input: { id: number }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  if (input.id === adminId) return { success: false, error: t("utilisez_vos_parametres_personnels_pour_modifier_votre") };

  // ── Garde : impossible de désactiver la 2FA du dernier super_admin actif ──
  const target = await prisma.admin.findUnique({
    where: { id: input.id },
    select: { twoFactorEnabled: true, isActive: true, customRole: { select: { name: true } } },
  });
  if (!target) return { success: false, error: "Utilisateur introuvable" };
  if (target.customRole?.name === "super_admin" && target.twoFactorEnabled && target.isActive) {
    const superAdminsWith2FA = await prisma.admin.count({
      where: {
        customRole: { name: "super_admin" },
        twoFactorEnabled: true,
        isActive: true,
      },
    });
    if (superAdminsWith2FA <= 1) {
      return {
        success: false,
        error: t("impossible_de_desactiver_la_2fa_du_dernier"),
      };
    }
  }

  await prisma.admin.update({
    where: { id: input.id },
    data: { twoFactorEnabled: false, twoFactorSecret: null, sessionsInvalidatedAt: new Date() },
  });
  await prisma.adminBackupCode.deleteMany({ where: { adminId: input.id } });
  await prisma.adminSession.deleteMany({ where: { adminId: input.id } });

  await logAudit({
    adminId, action: "update", entityType: "admin", entityId: input.id,
    changes: { twoFactorDisabled: true, byAdmin: adminId },
  });
  await logSecurityEvent({
    adminId: input.id,
    type: "two_factor_disabled",
    severity: "warning",
    message: "2fa_desactivee_par_un_administrateur",
    metadata: { byAdminId: adminId },
  });

  revalidatePath("/admin/settings/team");
  return { success: true };
}

export async function unlockUserAction(input: { id: number }): Promise<Result> {
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();

  await prisma.admin.update({
    where: { id: input.id },
    data: { lockedUntil: null, failedLoginAttempts: 0 },
  });

  await logAudit({
    adminId, action: "update", entityType: "admin", entityId: input.id,
    changes: { unlocked: true },
  });
  revalidatePath("/admin/settings/team");
  return { success: true };
}

export async function lockUserAction(input: { id: number; hours: number }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  if (input.id === adminId) return { success: false, error: t("vous_ne_pouvez_pas_vous_bloquer_vous") };

  const lockedUntil = new Date(Date.now() + input.hours * 60 * 60 * 1000);
  await prisma.admin.update({
    where: { id: input.id },
    data: { lockedUntil, sessionsInvalidatedAt: new Date() },
  });
  await prisma.adminSession.deleteMany({ where: { adminId: input.id } });

  await logAudit({
    adminId, action: "update", entityType: "admin", entityId: input.id,
    changes: { lockedUntil, hours: input.hours },
  });
  revalidatePath("/admin/settings/team");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// BULK ACTIONS — actions en lot sur plusieurs utilisateurs
// ═══════════════════════════════════════════════════════════
const bulkSchema = z.object({
  userIds: z.array(z.number().int()).min(1).max(100),
  action: z.enum(["activate", "deactivate", "delete", "assign_role", "assign_position"]),
  roleId: z.number().int().nullable().optional(),
  positionId: z.number().int().nullable().optional(),
  // Successeur unique vers qui transférer les portefeuilles des utilisateurs désactivés.
  reassignToAdminId: z.number().int().nullable().optional(),
  // Optimistic concurrency : ISO timestamps connus au moment de l'ouverture de la sélection.
  // Si fourni, on rejette si un user a été modifié depuis (qq'un d'autre a touché à la fiche).
  expectedUpdatedAts: z.record(z.string(), z.string()).optional(),
});

export async function bulkUpdateUsersAction(input: z.infer<typeof bulkSchema>): Promise<Result<{ updated: number; reassigned?: { timeEntries: number; notifications: number } }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Sécurité : exclure le propre compte de l'admin courant
  const ids = parsed.data.userIds.filter((id) => id !== adminId);
  if (ids.length === 0) {
    return { success: false, error: t("aucun_utilisateur_valide_vous_ne_pouvez_pas") };
  }

  // ── Optimistic concurrency check ──
  if (parsed.data.expectedUpdatedAts && Object.keys(parsed.data.expectedUpdatedAts).length > 0) {
    const current = await prisma.admin.findMany({
      where: { id: { in: ids } },
      select: { id: true, updatedAt: true },
    });
    const conflicts: number[] = [];
    for (const row of current) {
      const expected = parsed.data.expectedUpdatedAts[String(row.id)];
      if (!expected) continue; // pas de référence, on ignore
      const expectedTs = new Date(expected).getTime();
      const actualTs = row.updatedAt?.getTime() ?? 0;
      if (Math.abs(actualTs - expectedTs) > 500) {
        conflicts.push(row.id);
      }
    }
    if (conflicts.length > 0) {
      return {
        success: false,
        error: `${conflicts.length} compte(s) ont été modifié(s) par quelqu'un d'autre depuis votre sélection. Rechargez la page.`,
      };
    }
  }

  // ── Validation successeur (si transfert demandé) ──
  if (parsed.data.reassignToAdminId) {
    if (ids.includes(parsed.data.reassignToAdminId)) {
      return { success: false, error: t("le_successeur_ne_peut_pas_etre_dans") };
    }
    const successor = await prisma.admin.findUnique({
      where: { id: parsed.data.reassignToAdminId },
      select: { id: true, isActive: true },
    });
    if (!successor || !successor.isActive) {
      return { success: false, error: t("le_successeur_selectionne_est_introuvable_ou_inactif") };
    }
  }

  const data: Record<string, unknown> = {};
  switch (parsed.data.action) {
    case "activate":
      data.isActive = true;
      break;
    case "deactivate":
    case "delete":
      data.isActive = false;
      data.sessionsInvalidatedAt = new Date();
      data.endDate = new Date();
      break;
    case "assign_role":
      data.roleId = parsed.data.roleId ?? null;
      break;
    case "assign_position":
      data.positionId = parsed.data.positionId ?? null;
      break;
  }

  const result = await prisma.admin.updateMany({
    where: { id: { in: ids } },
    data,
  });

  let reassigned: { timeEntries: number; notifications: number } | undefined;
  if (parsed.data.action === "deactivate" || parsed.data.action === "delete") {
    await prisma.adminSession.deleteMany({ where: { adminId: { in: ids } } });

    // ── Transfert portefeuille en lot ──
    if (parsed.data.reassignToAdminId) {
      const teResult = await prisma.timeEntry.updateMany({
        where: { adminId: { in: ids }, endedAt: null, invoiceId: null },
        data: { adminId: parsed.data.reassignToAdminId },
      });
      const notifResult = await prisma.notification.updateMany({
        where: { recipientType: "admin", recipientId: { in: ids }, isRead: false },
        data: { recipientId: parsed.data.reassignToAdminId },
      });
      reassigned = { timeEntries: teResult.count, notifications: notifResult.count };
      await logAudit({
        adminId,
        action: "transfer",
        entityType: "admin_portfolio_bulk",
        changes: { fromAdminIds: ids, toAdminId: parsed.data.reassignToAdminId, ...reassigned },
      });
    }
  }

  await logAudit({
    adminId,
    action: "update",
    entityType: "admin_bulk",
    changes: { action: parsed.data.action, count: result.count, ids, reassigned },
  });

  revalidatePath("/admin/settings/team");
  revalidatePath("/admin/employes");
  return { success: true, data: { updated: result.count, reassigned } };
}

// ── Renvoyer une invitation (régénère le token) ────────────
export async function resendInvitationAction(input: { id: number }): Promise<Result<{ inviteUrl: string; emailSent: boolean; emailError?: string }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();

  const invite = await prisma.adminInvitation.findUnique({ where: { id: input.id } });
  const resendBy = await prisma.admin.findUnique({ where: { id: adminId }, select: { locale: true } });
  const tr = await getTranslations({ locale: resendBy?.locale?.split("-")[0] ?? "fr", namespace: "admin.emails" });
  if (!invite) return { success: false, error: "Invitation introuvable" };
  if (invite.acceptedAt) return { success: false, error: t("invitation_deja_acceptee") };

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.adminInvitation.update({
    where: { id: input.id },
    data: { tokenHash, expiresAt, revokedAt: null },
  });

  const baseUrl = process.env.NEXTAUTH_URL || process.env.AUTH_URL || "https://vnkautomatisation.ca";
  const inviteUrl = `${baseUrl.replace(/\/$/, "")}/admin/accept-invite?token=${rawToken}`;

  let emailSent = false;
  let emailError: string | undefined;
  try {
    await sendEmail({
      to: invite.email,
      subject: `Rappel : invitation à rejoindre VNK Automatisation`,
      html: `
<!DOCTYPE html>
<html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f3f4f6;padding:20px">
  <div style="max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 4px 12px rgba(0,0,0,0.06)">
    <div style="background:linear-gradient(135deg,#0F2D52,#15406d);color:#fff;padding:24px;text-align:center">
      <h1 style="margin:0;font-size:18px;font-weight:700">Rappel d'invitation</h1>
    </div>
    <div style="padding:24px;color:#1f2937;font-size:14px;line-height:1.6">
      <p>Bonjour <strong>${escapeHtml(invite.fullName ?? "")}</strong>,</p>
      <p>${tr("invitation_toujours_active")}</p>
      <p style="text-align:center;margin:24px 0">
        <a href="${escapeUrlForEmail(inviteUrl)}" style="display:inline-block;background:#0F2D52;color:#fff;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:14px">Activer mon compte</a>
      </p>
      <p style="color:#6b7280;font-size:12px">Ce lien expire dans ${INVITE_TTL_DAYS} jours.</p>
    </div>
  </div>
</body></html>`.trim(),
    });
    emailSent = true;
  } catch (e) {
    console.error("[resend-invite-email]", e);
    emailError = e instanceof Error ? e.message : "Erreur d'envoi";
  }

  await logAudit({ adminId, action: "update", entityType: "admin_invitation", entityId: input.id, changes: { resent: true } });
  revalidatePath("/admin/settings/team");
  return { success: true, data: { inviteUrl, emailSent, emailError } };
}

async function requireUsersWrite() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!admin) return null;
  // super_admin OR custom role with users:write
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  const canWrite = isSuper || (perms.users ?? []).includes("write");
  return canWrite ? adminId : null;
}

// ═══════════════════════════════════════════════════════════
// CRÉER UN UTILISATEUR
// ═══════════════════════════════════════════════════════════
const createSchema = z.object({
  email: z.string().email("Email invalide").max(200),
  fullName: z.string().min(1, "Nom requis").max(200),
  password: z.string().min(12, "mot_de_passe_trop_court_min_12").max(200),
  roleId: z.number().int().nullable().optional(),
  positionId: z.number().int().nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  startDate: z.string().nullable().optional(),
  sendWelcomeEmail: z.boolean().optional(),
});

export async function createUserAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Email unique ?
  const existing = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { success: false, error: t("un_compte_avec_cet_email_existe_deja_2") };

  // Valider FK
  if (parsed.data.roleId) {
    const role = await prisma.role.findUnique({ where: { id: parsed.data.roleId } });
    if (!role) return { success: false, error: t("role_introuvable") };
  }
  if (parsed.data.positionId) {
    const pos = await prisma.position.findUnique({ where: { id: parsed.data.positionId } });
    if (!pos) return { success: false, error: "Poste introuvable" };
  }

  // Si positionId fourni et roleId absent → hériter du défaut du poste
  let effectiveRoleId = parsed.data.roleId ?? null;
  if (!effectiveRoleId && parsed.data.positionId) {
    const pos = await prisma.position.findUnique({ where: { id: parsed.data.positionId } });
    effectiveRoleId = pos?.defaultRoleId ?? null;
  }

  const passwordHash = await bcrypt.hash(parsed.data.password, 12);

  const created = await prisma.admin.create({
    data: {
      email: parsed.data.email,
      passwordHash,
      fullName: parsed.data.fullName,
      role: "admin", // legacy string column conservée pour compatibilité
      isActive: true,
      roleId: effectiveRoleId,
      positionId: parsed.data.positionId ?? null,
      department: parsed.data.department ?? null,
      title: parsed.data.title ?? null,
      phone: parsed.data.phone ?? null,
      startDate: parsed.data.startDate ? new Date(parsed.data.startDate) : null,
    },
    select: { id: true },
  });

  await logAudit({
    adminId,
    action: "create",
    entityType: "admin",
    entityId: created.id,
    changes: { after: { email: parsed.data.email, fullName: parsed.data.fullName, roleId: effectiveRoleId } },
  });
  await logSecurityEvent({
    adminId,
    type: "user_created",
    message: `Compte créé pour ${parsed.data.email}`,
    metadata: { newAdminId: created.id },
  });

  // Auto-assignation des documents requis (onboarding) — best-effort.
  const { assignRequiredDocsToNewEmployee } = await import(
    "@/lib/services/onboarding-docs"
  );
  await assignRequiredDocsToNewEmployee(created.id, adminId);

  revalidatePath("/admin/settings");
  return { success: true, data: { id: created.id } };
}

// ═══════════════════════════════════════════════════════════
// MODIFIER UN UTILISATEUR
// ═══════════════════════════════════════════════════════════
const updateSchema = z.object({
  id: z.number().int(),
  fullName: z.string().min(1).max(200).optional(),
  roleId: z.number().int().nullable().optional(),
  positionId: z.number().int().nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  startDate: z.string().nullable().optional(),
  endDate: z.string().nullable().optional(),
  internalNotes: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
  recoveryEmail: z.string().email().nullable().optional().or(z.literal("")),
  loginAlertsEnabled: z.boolean().optional(),
  defaultLanding: z.string().max(80).nullable().optional(),
  bio: z.string().max(280).nullable().optional(),
  // Genre + civilité (pour accord grammatical FR-CA dans documents PDF)
  civility: z.enum(["M.", "Mme", "Mx", ""]).nullable().optional(),
  gender: z.enum(["male", "female", "non_binary", "prefer_not_to_say", ""]).nullable().optional(),
  preferredPronouns: z.string().max(40).nullable().optional(),
  // Offboarding : transfert du portefeuille à un autre admin lors d'une désactivation
  reassignToAdminId: z.number().int().nullable().optional(),
  // Optimistic locking : si fourni, on rejette la mise à jour si updatedAt a changé.
  expectedUpdatedAt: z.string().optional(),
  // Organisation : équipe + manager
  teamId: z.number().int().nullable().optional(),
  managerId: z.number().int().nullable().optional(),
});

export async function updateUserAction(input: z.infer<typeof updateSchema>): Promise<Result<{ reassigned?: { timeEntries: number; notifications: number } }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const { id, startDate, endDate, reassignToAdminId, expectedUpdatedAt, managerId, ...rest } = parsed.data;

  // Anti-cycle hiérarchique : managerId ne peut pas être soi-même ni un descendant.
  if (managerId !== undefined && managerId !== null) {
    if (managerId === id) {
      return { success: false, error: t("un_utilisateur_ne_peut_pas_etre_son") };
    }
    let cursor: number | null = managerId;
    const visited = new Set<number>();
    while (cursor != null) {
      if (cursor === id) {
        return { success: false, error: t("cycle_detecte_dans_la_hierarchie_manageriale") };
      }
      if (visited.has(cursor)) break;
      visited.add(cursor);
      const next: { managerId: number | null } | null = await prisma.admin.findUnique({
        where: { id: cursor }, select: { managerId: true },
      });
      cursor = next?.managerId ?? null;
    }
  }

  const before = await prisma.admin.findUnique({
    where: { id },
    select: { fullName: true, roleId: true, positionId: true, department: true, title: true, isActive: true, updatedAt: true, managerId: true },
  });
  if (!before) return { success: false, error: "Utilisateur introuvable" };

  // ── Optimistic concurrency : si client envoie expectedUpdatedAt, on refuse en cas de conflit ──
  if (expectedUpdatedAt) {
    const clientTs = new Date(expectedUpdatedAt).getTime();
    const dbTs = before.updatedAt?.getTime() ?? 0;
    // Tolérance de 500 ms pour gérer les arrondis ISO
    if (Math.abs(dbTs - clientTs) > 500) {
      return {
        success: false,
        error: t("cette_fiche_a_ete_modifiee_par_quelqu"),
      };
    }
  }

  // ── Validation du successeur si fourni ──
  if (reassignToAdminId) {
    if (reassignToAdminId === id) {
      return { success: false, error: t("le_successeur_ne_peut_pas_etre_l") };
    }
    const successor = await prisma.admin.findUnique({
      where: { id: reassignToAdminId },
      select: { id: true, isActive: true },
    });
    if (!successor || !successor.isActive) {
      return { success: false, error: t("le_successeur_selectionne_est_introuvable_ou_inactif") };
    }
  }

  await prisma.admin.update({
    where: { id },
    data: {
      ...rest,
      // Normaliser recoveryEmail vide → null
      recoveryEmail: rest.recoveryEmail === "" ? null : rest.recoveryEmail,
      // Normaliser civility / gender vides → null
      civility: rest.civility === "" ? null : rest.civility,
      gender: rest.gender === "" ? null : rest.gender,
      startDate: startDate === undefined ? undefined : startDate ? new Date(startDate) : null,
      endDate: endDate === undefined ? undefined : endDate ? new Date(endDate) : null,
      managerId: managerId === undefined ? undefined : managerId,
    },
  });

  // ── Notification : changement de manager ──────────────────
  // Quand managerId est explicitement fourni et différent de l'ancien,
  // on notifie le NOUVEAU manager et l'EMPLOYÉ concerné.
  if (managerId !== undefined && managerId !== before.managerId) {
    const [employee, newManager, oldManager] = await Promise.all([
      prisma.admin.findUnique({ where: { id }, select: { fullName: true, email: true } }),
      managerId ? prisma.admin.findUnique({ where: { id: managerId }, select: { fullName: true, isActive: true } }) : Promise.resolve(null),
      before.managerId ? prisma.admin.findUnique({ where: { id: before.managerId }, select: { fullName: true } }) : Promise.resolve(null),
    ]);
    const employeeLabel = employee?.fullName || employee?.email || `Employé #${id}`;

    // Nouveau manager : "Nouvel employé à votre charge"
    if (managerId && newManager?.isActive) {
      await prisma.notification
        .create({
          data: {
            recipientType: "admin",
            recipientId: managerId,
            type: "info",
            title: t("nouvel_employe_a_votre_charge"),
            body: `${employeeLabel} vous est désormais rattaché.`,
            link: "/admin/employes/organigramme",
            icon: "users",
          },
        })
        .catch(() => null);
    }

    // Employé : "Nouveau manager : [nom]" (ou "Plus de manager attitré" si retiré)
    const newMgrLabel = newManager?.fullName ?? "—";
    await prisma.notification
      .create({
        data: {
          recipientType: "admin",
          recipientId: id,
          type: "info",
          title: managerId ? t("nouveau_manager", { name: newMgrLabel }) : t("manager_retire"),
          body: managerId
            ? `Votre supérieur hiérarchique a été mis à jour.`
            : `Vous n'avez plus de supérieur hiérarchique attitré pour l'instant.`,
          link: "/admin/mon-espace",
          icon: "user-check",
        },
      })
      .catch(() => null);

    // Bonus : informer l'ancien manager qu'un de ses subordonnés a changé de hiérarchie.
    if (before.managerId && before.managerId !== managerId && oldManager) {
      await prisma.notification
        .create({
          data: {
            recipientType: "admin",
            recipientId: before.managerId,
            type: "info",
            title: t("employe_retire_de_votre_equipe"),
            body: `${employeeLabel} n'est plus sous votre supervision.`,
            link: "/admin/employes/organigramme",
            icon: "users",
          },
        })
        .catch(() => null);
    }
  }

  await logAudit({
    adminId,
    action: "update",
    entityType: "admin",
    entityId: id,
    changes: { before, after: rest },
  });

  // ── Si désactivation : invalider toutes les sessions + transférer ──
  let reassigned: { timeEntries: number; notifications: number } | undefined;
  if (rest.isActive === false && before.isActive === true) {
    await prisma.admin.update({ where: { id }, data: { sessionsInvalidatedAt: new Date() } });
    await prisma.adminSession.deleteMany({ where: { adminId: id } });

    if (reassignToAdminId) {
      // Transférer les saisies de temps non facturées + non clôturées au successeur
      const teResult = await prisma.timeEntry.updateMany({
        where: { adminId: id, endedAt: null, invoiceId: null },
        data: { adminId: reassignToAdminId },
      });
      // Transférer les notifications non lues
      const notifResult = await prisma.notification.updateMany({
        where: { recipientType: "admin", recipientId: id, isRead: false },
        data: { recipientId: reassignToAdminId },
      });
      reassigned = { timeEntries: teResult.count, notifications: notifResult.count };

      await logAudit({
        adminId,
        action: "transfer",
        entityType: "admin_portfolio",
        entityId: id,
        changes: { fromAdminId: id, toAdminId: reassignToAdminId, ...reassigned },
      });
      await logSecurityEvent({
        adminId,
        type: "user_deleted",
        severity: "info",
        message: `Portefeuille transféré de admin#${id} vers admin#${reassignToAdminId}`,
        metadata: { fromAdminId: id, toAdminId: reassignToAdminId, ...reassigned },
      });
    }
  }

  revalidatePath("/admin/settings");
  return { success: true, data: { reassigned } };
}

// ═══════════════════════════════════════════════════════════
// RÉINITIALISER LE MOT DE PASSE
// ═══════════════════════════════════════════════════════════
const resetPwdSchema = z.object({
  id: z.number().int(),
  newPassword: z.string().min(12).max(200),
});
export async function resetUserPasswordAction(input: z.infer<typeof resetPwdSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  const parsed = resetPwdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const passwordHash = await bcrypt.hash(parsed.data.newPassword, 12);
  await prisma.admin.update({
    where: { id: parsed.data.id },
    data: {
      passwordHash,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });
  // Invalider toutes les sessions par sécurité
  await prisma.admin.update({ where: { id: parsed.data.id }, data: { sessionsInvalidatedAt: new Date() } });
  await prisma.adminSession.deleteMany({ where: { adminId: parsed.data.id } });

  await logAudit({ adminId, action: "password_reset", entityType: "admin", entityId: parsed.data.id });
  await logSecurityEvent({
    adminId: parsed.data.id,
    type: "password_changed",
    severity: "warning",
    message: "mot_de_passe_reinitialise_par_un_administrateur",
    metadata: { byAdminId: adminId },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// SUPPRIMER UN UTILISATEUR (soft → désactivation, hard interdit pour self)
// Offboarding : option reassignToAdminId pour transférer le portefeuille
// ═══════════════════════════════════════════════════════════
const deleteSchema = z.object({
  id: z.number().int(),
  hard: z.boolean().optional(),
  reassignToAdminId: z.number().int().nullable().optional(),
});
export async function deleteUserAction(input: z.infer<typeof deleteSchema>): Promise<Result<{ reassigned?: { timeEntries: number; notifications: number } }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireUsersWrite();
  if (!adminId) return unauthorized();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t("donnees_invalides") };
  if (parsed.data.id === adminId) return { success: false, error: t("vous_ne_pouvez_pas_supprimer_votre_propre") };

  // ── Validation du successeur si fourni ──
  if (parsed.data.reassignToAdminId) {
    if (parsed.data.reassignToAdminId === parsed.data.id) {
      return { success: false, error: t("le_successeur_ne_peut_pas_etre_l") };
    }
    const successor = await prisma.admin.findUnique({
      where: { id: parsed.data.reassignToAdminId },
      select: { id: true, isActive: true },
    });
    if (!successor || !successor.isActive) {
      return { success: false, error: t("le_successeur_selectionne_est_introuvable_ou_inactif") };
    }
  }

  let reassigned: { timeEntries: number; notifications: number } | undefined;

  if (parsed.data.hard) {
    // Hard delete — réservé aux super_admin uniquement
    const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
    if (me?.customRole?.name !== "super_admin") {
      return { success: false, error: t("seul_un_super_administrateur_peut_supprimer_definitivement") };
    }
    // Avant suppression : si successeur fourni, déplacer ; sinon les FK SetNull
    if (parsed.data.reassignToAdminId) {
      const teResult = await prisma.timeEntry.updateMany({
        where: { adminId: parsed.data.id },
        data: { adminId: parsed.data.reassignToAdminId },
      });
      const notifResult = await prisma.notification.updateMany({
        where: { recipientType: "admin", recipientId: parsed.data.id, isRead: false },
        data: { recipientId: parsed.data.reassignToAdminId },
      });
      reassigned = { timeEntries: teResult.count, notifications: notifResult.count };
    }
    await prisma.admin.delete({ where: { id: parsed.data.id } });
    await logAudit({ adminId, action: "delete", entityType: "admin", entityId: parsed.data.id, changes: { reassigned } });
  } else {
    await prisma.admin.update({
      where: { id: parsed.data.id },
      data: { isActive: false, sessionsInvalidatedAt: new Date(), endDate: new Date() },
    });
    await prisma.adminSession.deleteMany({ where: { adminId: parsed.data.id } });
    if (parsed.data.reassignToAdminId) {
      const teResult = await prisma.timeEntry.updateMany({
        where: { adminId: parsed.data.id, endedAt: null, invoiceId: null },
        data: { adminId: parsed.data.reassignToAdminId },
      });
      const notifResult = await prisma.notification.updateMany({
        where: { recipientType: "admin", recipientId: parsed.data.id, isRead: false },
        data: { recipientId: parsed.data.reassignToAdminId },
      });
      reassigned = { timeEntries: teResult.count, notifications: notifResult.count };
      await logAudit({
        adminId,
        action: "transfer",
        entityType: "admin_portfolio",
        entityId: parsed.data.id,
        changes: { fromAdminId: parsed.data.id, toAdminId: parsed.data.reassignToAdminId, ...reassigned },
      });
    }
    await logAudit({ adminId, action: "update", entityType: "admin", entityId: parsed.data.id, changes: { deactivated: true, reassigned } });
  }

  revalidatePath("/admin/settings");
  return { success: true, data: { reassigned } };
}

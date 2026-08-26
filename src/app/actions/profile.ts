"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { getRequestGeo } from "@/lib/security/geo";
import { unauthorized, forbidden } from "@/lib/refusals";

type ActionResult<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return null;
  }
  return session.user.adminId!;
}

// ═════════════════════════════════════════════════════════════
// 1. COMPTE — Nom, avatar, titre, telephone, bio, signature, presence
// ═════════════════════════════════════════════════════════════
const profileSchema = z.object({
  fullName: z.string().min(1, "Nom requis").max(200),
  avatarUrl: z.string().url().optional().or(z.literal("")),
  title: z.string().max(120).optional().nullable(),
  phone: z.string().max(40).optional().nullable(),
  bio: z.string().max(280).optional().nullable(),
  emailSignature: z.string().max(2000).optional().nullable(),
  recoveryEmail: z.string().email().optional().nullable().or(z.literal("")),
});

export async function updateProfileAction(input: z.infer<typeof profileSchema>): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = profileSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const before = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { fullName: true, avatarUrl: true, title: true, phone: true, bio: true, emailSignature: true, recoveryEmail: true },
    });

    await prisma.admin.update({
      where: { id: adminId },
      data: {
        fullName: parsed.data.fullName,
        avatarUrl: parsed.data.avatarUrl || null,
        title: parsed.data.title || null,
        phone: parsed.data.phone || null,
        bio: parsed.data.bio || null,
        emailSignature: parsed.data.emailSignature || null,
        recoveryEmail: parsed.data.recoveryEmail || null,
      },
    });

    await logAudit({ adminId, action: "update", entityType: "admin", entityId: adminId, changes: { before, after: parsed.data } });
    await logSecurityEvent({ adminId, type: "profile_updated", message: "Profil mis à jour" });

    revalidatePath("/admin/profile");
    revalidatePath("/admin");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur lors de la mise à jour" };
  }
}

// ── Statut de presence (En reunion, Vacances, Focus...) ─────
const presenceSchema = z.object({
  status: z.enum(["active", "meeting", "vacation", "focus", "offline"]).nullable(),
  message: z.string().max(120).optional().nullable(),
  until: z.string().datetime().optional().nullable(),
});
export async function updatePresenceAction(input: z.infer<typeof presenceSchema>): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = presenceSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        presenceStatus: parsed.data.status,
        presenceMessage: parsed.data.message || null,
        presenceUntil: parsed.data.until ? new Date(parsed.data.until) : null,
      },
    });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ═════════════════════════════════════════════════════════════
// 2. PREFERENCES — Timezone, langue, theme, accent, vue defaut
// ═════════════════════════════════════════════════════════════
const preferencesSchema = z.object({
  timezone: z.string().max(60).optional().nullable(),
  locale: z.enum(["fr-CA", "en-CA"]).optional().nullable(),
  theme: z.enum(["light", "dark", "auto"]).optional().nullable(),
  accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional().nullable().or(z.literal("")),
  defaultLanding: z.enum(["dashboard", "requests", "calendar", "messages", "invoices"]).optional().nullable(),
  shortcuts: z.record(z.string()).optional().nullable(),
});

export async function updatePreferencesAction(input: z.infer<typeof preferencesSchema>): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = preferencesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        timezone: parsed.data.timezone || undefined,
        locale: parsed.data.locale || undefined,
        theme: parsed.data.theme || undefined,
        accentColor: parsed.data.accentColor || null,
        defaultLanding: parsed.data.defaultLanding || null,
        shortcuts: parsed.data.shortcuts ?? undefined,
      },
    });
    await logSecurityEvent({ adminId, type: "preferences_updated", message: "Préférences mises à jour" });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ═════════════════════════════════════════════════════════════
// 3. NOTIFICATIONS — granularite par canal x categorie
// ═════════════════════════════════════════════════════════════
const notifPrefsSchema = z.object({
  email: z.record(z.boolean()).optional(),
  push: z.record(z.boolean()).optional(),
  slack: z.record(z.boolean()).optional(),
  digest: z.enum(["instant", "hourly", "daily", "weekly", "off"]).optional(),
  quietHoursStart: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().or(z.literal("")),
  quietHoursEnd: z.string().regex(/^\d{2}:\d{2}$/).optional().nullable().or(z.literal("")),
  loginAlertsEnabled: z.boolean().optional(),
});

export async function updateNotificationPrefsAction(input: z.infer<typeof notifPrefsSchema>): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = notifPrefsSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const current = await prisma.admin.findUnique({ where: { id: adminId }, select: { notificationPrefs: true } });
    const merged = { ...(current?.notificationPrefs as object || {}), ...parsed.data };
    await prisma.admin.update({
      where: { id: adminId },
      data: {
        notificationPrefs: merged as never,
        loginAlertsEnabled: parsed.data.loginAlertsEnabled ?? undefined,
      },
    });
    await logSecurityEvent({ adminId, type: "notification_prefs_updated", message: "Préférences de notification mises à jour" });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ═════════════════════════════════════════════════════════════
// 4. SESSIONS — revoke individuel + revoke all OTHERS
// ═════════════════════════════════════════════════════════════
export async function revokeSessionAction(sessionId: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();

  try {
    const target = await prisma.adminSession.findUnique({ where: { id: sessionId } });
    if (!target || target.adminId !== adminId) return { success: false, error: "Session introuvable" };

    await prisma.adminSession.delete({ where: { id: sessionId } });
    await logAudit({ adminId, action: "delete", entityType: "admin_session", entityId: null, changes: { sessionId, ip: target.ipAddress } });
    await logSecurityEvent({ adminId, type: "session_revoked", message: `Session révoquée (${target.userAgent?.slice(0, 40) ?? "appareil inconnu"})` });

    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur lors de la révocation" };
  }
}

// Revoke toutes les autres sessions :
// 1. Delete les rows AdminSession en DB
// 2. Bump admin.sessionsInvalidatedAt → invalide TOUS les JWT existants
//    (le JWT callback rejettera tout token dont iat < sessionsInvalidatedAt)
// 3. La session courante émet un nouveau JWT au prochain rafraîchissement
//    qui sera valide car iat est plus récent.
export async function revokeAllOtherSessionsAction(currentSessionId?: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();

  try {
    const result = await prisma.adminSession.deleteMany({
      where: { adminId, ...(currentSessionId ? { NOT: { id: currentSessionId } } : {}) },
    });

    // Bump le timestamp — invalide TOUS les JWT émis avant cette seconde
    await prisma.admin.update({
      where: { id: adminId },
      data: { sessionsInvalidatedAt: new Date() },
    });

    await logAudit({ adminId, action: "delete", entityType: "admin_session", entityId: null, changes: { revokedCount: result.count, jwtInvalidated: true } });
    await logSecurityEvent({
      adminId,
      type: "all_sessions_revoked",
      severity: "warning",
      message: `${result.count} session${result.count > 1 ? "s" : ""} révoquée${result.count > 1 ? "s" : ""} + tous les JWT externes invalidés`,
    });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur lors de la révocation" };
  }
}

// Renommer une session ("Macbook bureau", "iPhone perso")
export async function renameSessionAction(sessionId: string, label: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  if (label.length > 60) return { success: false, error: "Label trop long" };

  try {
    const target = await prisma.adminSession.findUnique({ where: { id: sessionId } });
    if (!target || target.adminId !== adminId) return { success: false, error: "Session introuvable" };
    await prisma.adminSession.update({ where: { id: sessionId }, data: { label: label.trim() || null } });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ── Marquer un appareil comme de confiance (30 jours) ──
// Skip 2FA pendant 30 jours sur cet appareil. Après expiration,
// le 2FA sera redemandé à la prochaine connexion. L'utilisateur
// pourra alors recocher la case « Se souvenir de cet appareil ».
const TRUSTED_DEVICE_DAYS = 30;

export async function trustSessionDeviceAction(sessionId: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();

  try {
    const target = await prisma.adminSession.findUnique({ where: { id: sessionId } });
    if (!target || target.adminId !== adminId) return { success: false, error: "Session introuvable" };

    const { deviceFingerprint } = await import("@/lib/security/ua-parser");
    const fingerprint = await deviceFingerprint(target.userAgent ?? "", target.ipAddress);
    const label = target.label ?? `${target.browser ?? "Appareil"} sur ${target.os ?? "Inconnu"}`;
    const expiresAt = new Date(Date.now() + TRUSTED_DEVICE_DAYS * 24 * 60 * 60 * 1000);

    await prisma.adminTrustedDevice.upsert({
      where: { adminId_fingerprint: { adminId, fingerprint } },
      create: { adminId, fingerprint, label, expiresAt },
      update: { label, expiresAt, lastUsedAt: new Date() },
    });

    await logSecurityEvent({
      adminId,
      type: "trusted_device_added",
      severity: "warning",
      message: `Appareil de confiance ajouté : ${label}`,
      metadata: { sessionId, fingerprint: fingerprint.slice(0, 16) },
    });

    revalidatePath("/admin/profile");
    revalidatePath("/admin/settings");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ── Signaler une session comme suspecte (déclenche alerte critique) ──
export async function reportSuspiciousSessionAction(sessionId: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();

  try {
    const target = await prisma.adminSession.findUnique({ where: { id: sessionId } });
    if (!target || target.adminId !== adminId) return { success: false, error: "Session introuvable" };

    // Révoque la session immédiatement
    await prisma.adminSession.delete({ where: { id: sessionId } });

    await logSecurityEvent({
      adminId,
      type: "suspicious_login",
      severity: "critical",
      message: `Session signalée comme suspecte et révoquée (${target.browser ?? "appareil inconnu"} · ${target.ipAddress ?? "IP masquée"})`,
      metadata: {
        sessionId,
        userAgent: target.userAgent,
        ipAddress: target.ipAddress,
        country: target.country,
        city: target.city,
      },
    });

    await logAudit({
      adminId,
      action: "delete",
      entityType: "admin_session",
      entityId: null,
      changes: { sessionId, reason: "reported_suspicious", ip: target.ipAddress },
    });

    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ═════════════════════════════════════════════════════════════
// 5. TRUSTED DEVICES — list / remove
// ═════════════════════════════════════════════════════════════
export async function removeTrustedDeviceAction(deviceId: number): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  try {
    const target = await prisma.adminTrustedDevice.findUnique({ where: { id: deviceId } });
    if (!target || target.adminId !== adminId) return { success: false, error: "Appareil introuvable" };
    await prisma.adminTrustedDevice.delete({ where: { id: deviceId } });
    await logSecurityEvent({ adminId, type: "trusted_device_removed", message: `Appareil de confiance retiré : ${target.label}` });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ═════════════════════════════════════════════════════════════
// 6. API TOKENS — create / revoke
// ═════════════════════════════════════════════════════════════
const apiTokenSchema = z.object({
  name: z.string().min(2).max(80),
  scopes: z.array(z.string()).min(1, "Sélectionnez au moins une permission"),
  expiresInDays: z.number().int().min(1).max(365).optional().nullable(),
});

export async function createApiTokenAction(input: z.infer<typeof apiTokenSchema>): Promise<ActionResult<{ token: string; prefix: string }>> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = apiTokenSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    // Generer token: vnk_pa_<32 chars>
    const bytes = new Uint8Array(24);
    crypto.getRandomValues(bytes);
    const random = Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    const token = `vnk_pa_${random}`;
    const prefix = token.slice(0, 16);

    const enc = new TextEncoder().encode(token);
    const buf = await crypto.subtle.digest("SHA-256", enc);
    const tokenHash = Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");

    const expiresAt = parsed.data.expiresInDays
      ? new Date(Date.now() + parsed.data.expiresInDays * 24 * 60 * 60 * 1000)
      : null;

    await prisma.adminApiToken.create({
      data: {
        adminId,
        name: parsed.data.name,
        tokenHash,
        prefix,
        scopes: parsed.data.scopes as never,
        expiresAt,
      },
    });

    await logSecurityEvent({
      adminId,
      type: "api_token_created",
      severity: "warning",
      message: `Token API créé : ${parsed.data.name}`,
      metadata: { scopes: parsed.data.scopes },
    });

    revalidatePath("/admin/profile");
    return { success: true, data: { token, prefix } };
  } catch {
    return { success: false, error: "Erreur lors de la création" };
  }
}

export async function revokeApiTokenAction(tokenId: number): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  try {
    const target = await prisma.adminApiToken.findUnique({ where: { id: tokenId } });
    if (!target || target.adminId !== adminId) return { success: false, error: "Token introuvable" };
    await prisma.adminApiToken.update({ where: { id: tokenId }, data: { revokedAt: new Date() } });
    await logSecurityEvent({ adminId, type: "api_token_revoked", message: `Token API révoqué : ${target.name}` });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ═════════════════════════════════════════════════════════════
// 7. BACKUP CODES — regen one-time
// ═════════════════════════════════════════════════════════════
export async function regenerateBackupCodesAction(): Promise<ActionResult<{ codes: string[] }>> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  try {
    const { regenerateBackupCodes } = await import("@/lib/security/backup-codes");
    const codes = await regenerateBackupCodes(adminId);
    await logSecurityEvent({ adminId, type: "backup_codes_regenerated", message: "10 codes de récupération générés" });
    revalidatePath("/admin/profile");
    return { success: true, data: { codes } };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ═════════════════════════════════════════════════════════════
// 8. LOI 25 — Export + Demande suppression
// ═════════════════════════════════════════════════════════════
export async function requestDataExportAction(): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  try {
    await prisma.admin.update({
      where: { id: adminId },
      data: { dataExportRequestedAt: new Date() },
    });
    await logSecurityEvent({
      adminId,
      type: "data_export_requested",
      severity: "warning",
      message: "Export de données personnelles demandé (Loi 25)",
    });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

export async function requestAccountDeletionAction(confirmEmail: string): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  try {
    const admin = await prisma.admin.findUnique({ where: { id: adminId }, select: { email: true } });
    if (!admin || admin.email.toLowerCase() !== confirmEmail.toLowerCase()) {
      return { success: false, error: "Le courriel ne correspond pas" };
    }
    await logSecurityEvent({
      adminId,
      type: "account_deletion_requested",
      severity: "critical",
      message: "Demande de suppression de compte (Loi 25)",
    });
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// ═════════════════════════════════════════════════════════════
// 9. ONBOARDING — marquer etape complete
// ═════════════════════════════════════════════════════════════
export async function updateOnboardingStepAction(stepKey: string, done: boolean): Promise<ActionResult> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  try {
    const current = await prisma.admin.findUnique({ where: { id: adminId }, select: { onboardingSteps: true } });
    const steps = { ...((current?.onboardingSteps as Record<string, boolean>) || {}), [stepKey]: done };
    await prisma.admin.update({
      where: { id: adminId },
      data: { onboardingSteps: steps as never, onboardingDone: Object.values(steps).every(Boolean) },
    });
    revalidatePath("/admin/profile");
    return { success: true };
  } catch {
    return { success: false, error: "Erreur" };
  }
}

// Touch lastActiveAt sur session courante (called from layout heartbeat)
export async function touchSessionAction(sessionId: string): Promise<void> {
  const adminId = await requireAdmin();
  if (!adminId) return;
  try {
    const geo = await getRequestGeo();
    await prisma.adminSession.updateMany({
      where: { id: sessionId, adminId },
      data: { lastActiveAt: new Date(), ...(geo.country ? { country: geo.country } : {}), ...(geo.city ? { city: geo.city } : {}) },
    });
  } catch {
    // silent
  }
}

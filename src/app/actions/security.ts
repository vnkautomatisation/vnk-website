"use server";
// Server Actions — politique de sécurité globale.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireSuperAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (admin?.customRole?.name !== "super_admin") return null;
  return adminId;
}

// ── POLITIQUE GLOBALE ─────────────────────────────────────
const policySchema = z.object({
  // Mots de passe
  minPasswordLength: z.number().int().min(8).max(128),
  requireUppercase: z.boolean(),
  requireDigits: z.boolean(),
  requireSymbols: z.boolean(),
  passwordHistorySize: z.number().int().min(0).max(20),
  passwordExpiryDays: z.number().int().min(0).max(730),
  // 2FA
  require2FAForAdmins: z.boolean(),
  require2FAForSuperAdmins: z.boolean(),
  trustedDeviceDays: z.number().int().min(1).max(365),
  // Sessions
  sessionMaxAgeHours: z.number().int().min(1).max(720),
  maxConcurrentSessions: z.number().int().min(1).max(50),
  // Tentatives
  maxFailedAttempts: z.number().int().min(3).max(20),
  lockoutMinutes: z.number().int().min(1).max(1440),
  // Alertes
  alertOnNewDevice: z.boolean(),
  alertOnFailedLogin: z.boolean(),
  alertOnPasswordChange: z.boolean(),
  alertOnRoleChange: z.boolean(),
  // IP whitelist
  ipWhitelistEnabled: z.boolean(),
  ipWhitelist: z.string().max(2000), // une IP/CIDR par ligne
});

export async function updateSecurityPolicyAction(input: z.infer<typeof policySchema>): Promise<Result> {
  const adminId = await requireSuperAdmin();
  if (!adminId) return { success: false, error: "Action réservée au super-administrateur" };
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const entries = Object.entries(parsed.data).map(([key, value]) => ({
    key,
    value: typeof value === "boolean" ? (value ? "true" : "false") : String(value),
    type: typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "string",
  }));

  for (const e of entries) {
    await prisma.setting.upsert({
      where: { category_key: { category: "security", key: e.key } },
      update: { value: e.value, type: e.type, updatedBy: adminId },
      create: {
        category: "security",
        key: e.key,
        value: e.value,
        type: e.type,
        label: e.key,
        isSecret: e.key === "ipWhitelist",
        updatedBy: adminId,
      },
    });
  }

  await logAudit({ adminId, action: "settings_update", entityType: "security_policy", changes: { after: parsed.data } });
  revalidatePath("/admin/settings/security");
  return { success: true };
}

// ── DÉCONNEXION GLOBALE FORCÉE ────────────────────────────
export async function forceLogoutAllAction(): Promise<Result<{ count: number }>> {
  const adminId = await requireSuperAdmin();
  if (!adminId) return { success: false, error: "Action réservée au super-administrateur" };

  // Bumper sessionsInvalidatedAt de tous les admins SAUF moi
  const now = new Date();
  const result = await prisma.admin.updateMany({
    where: { id: { not: adminId } },
    data: { sessionsInvalidatedAt: now },
  });
  await prisma.adminSession.deleteMany({ where: { adminId: { not: adminId } } });

  await logAudit({ adminId, action: "settings_update", entityType: "force_logout_all", changes: { count: result.count } });
  return { success: true, data: { count: result.count } };
}

// ── BLOQUER UN COMPTE ─────────────────────────────────────
export async function lockAdminAction(input: { id: number; minutes: number }): Promise<Result> {
  const adminId = await requireSuperAdmin();
  if (!adminId) return { success: false, error: "Action réservée au super-administrateur" };
  if (input.id === adminId) return { success: false, error: "Vous ne pouvez pas vous bloquer vous-même" };

  const lockedUntil = new Date(Date.now() + input.minutes * 60_000);
  await prisma.admin.update({
    where: { id: input.id },
    data: { lockedUntil, sessionsInvalidatedAt: new Date() },
  });
  await prisma.adminSession.deleteMany({ where: { adminId: input.id } });

  await logAudit({ adminId, action: "settings_update", entityType: "admin_locked", entityId: input.id, changes: { lockedUntil, minutes: input.minutes } });
  revalidatePath("/admin/settings/security");
  return { success: true };
}

export async function unlockAdminAction(input: { id: number }): Promise<Result> {
  const adminId = await requireSuperAdmin();
  if (!adminId) return { success: false, error: "Action réservée au super-administrateur" };

  await prisma.admin.update({
    where: { id: input.id },
    data: { lockedUntil: null, failedLoginAttempts: 0 },
  });

  await logAudit({ adminId, action: "settings_update", entityType: "admin_unlocked", entityId: input.id });
  revalidatePath("/admin/settings/security");
  return { success: true };
}

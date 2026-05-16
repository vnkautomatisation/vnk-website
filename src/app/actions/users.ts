"use server";
// Server Actions — gestion des utilisateurs admin (employés).
// Permet de créer/modifier/désactiver/supprimer des comptes admin sans toucher
// au code. Vérifie la permission users:write avant chaque mutation.
import { z } from "zod";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

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
  password: z.string().min(12, "Mot de passe trop court (min 12 caractères)").max(200),
  roleId: z.number().int().nullable().optional(),
  positionId: z.number().int().nullable().optional(),
  department: z.string().max(100).nullable().optional(),
  title: z.string().max(120).nullable().optional(),
  phone: z.string().max(40).nullable().optional(),
  startDate: z.string().nullable().optional(),
  sendWelcomeEmail: z.boolean().optional(),
});

export async function createUserAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireUsersWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Email unique ?
  const existing = await prisma.admin.findUnique({ where: { email: parsed.data.email } });
  if (existing) return { success: false, error: "Un compte avec cet email existe déjà" };

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
});

export async function updateUserAction(input: z.infer<typeof updateSchema>): Promise<Result> {
  const adminId = await requireUsersWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const { id, startDate, endDate, ...rest } = parsed.data;

  const before = await prisma.admin.findUnique({
    where: { id },
    select: { fullName: true, roleId: true, positionId: true, department: true, title: true, isActive: true },
  });
  if (!before) return { success: false, error: "Utilisateur introuvable" };

  await prisma.admin.update({
    where: { id },
    data: {
      ...rest,
      startDate: startDate === undefined ? undefined : startDate ? new Date(startDate) : null,
      endDate: endDate === undefined ? undefined : endDate ? new Date(endDate) : null,
    },
  });

  await logAudit({
    adminId,
    action: "update",
    entityType: "admin",
    entityId: id,
    changes: { before, after: rest },
  });

  // Si désactivation : invalider toutes les sessions
  if (rest.isActive === false && before.isActive === true) {
    await prisma.admin.update({ where: { id }, data: { sessionsInvalidatedAt: new Date() } });
    await prisma.adminSession.deleteMany({ where: { adminId: id } });
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// RÉINITIALISER LE MOT DE PASSE
// ═══════════════════════════════════════════════════════════
const resetPwdSchema = z.object({
  id: z.number().int(),
  newPassword: z.string().min(12).max(200),
});
export async function resetUserPasswordAction(input: z.infer<typeof resetPwdSchema>): Promise<Result> {
  const adminId = await requireUsersWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = resetPwdSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

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
    message: "Mot de passe réinitialisé par un administrateur",
    metadata: { byAdminId: adminId },
  });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// SUPPRIMER UN UTILISATEUR (soft → désactivation, hard interdit pour self)
// ═══════════════════════════════════════════════════════════
const deleteSchema = z.object({ id: z.number().int(), hard: z.boolean().optional() });
export async function deleteUserAction(input: z.infer<typeof deleteSchema>): Promise<Result> {
  const adminId = await requireUsersWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides" };
  if (parsed.data.id === adminId) return { success: false, error: "Vous ne pouvez pas supprimer votre propre compte" };

  if (parsed.data.hard) {
    // Hard delete — réservé aux super_admin uniquement
    const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
    if (me?.customRole?.name !== "super_admin") {
      return { success: false, error: "Seul un super-administrateur peut supprimer définitivement un compte" };
    }
    await prisma.admin.delete({ where: { id: parsed.data.id } });
    await logAudit({ adminId, action: "delete", entityType: "admin", entityId: parsed.data.id });
  } else {
    await prisma.admin.update({
      where: { id: parsed.data.id },
      data: { isActive: false, sessionsInvalidatedAt: new Date(), endDate: new Date() },
    });
    await prisma.adminSession.deleteMany({ where: { adminId: parsed.data.id } });
    await logAudit({ adminId, action: "update", entityType: "admin", entityId: parsed.data.id, changes: { deactivated: true } });
  }

  revalidatePath("/admin/settings");
  return { success: true };
}

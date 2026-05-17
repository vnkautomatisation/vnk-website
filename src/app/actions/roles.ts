"use server";
// Server Actions — gestion des rôles (RBAC custom).
// Permet de créer/modifier des rôles sur mesure avec une matrice de permissions
// cochable (ressource × action). Protège les 7 rôles système (isSystem=true).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireRolesWrite() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  const canWrite = isSuper || (perms.roles ?? []).includes("write");
  return canWrite ? adminId : null;
}

const ACTIONS = ["read", "write", "delete", "export"] as const;
const permissionsSchema = z.record(z.array(z.enum(ACTIONS)));

// ═══════════════════════════════════════════════════════════
// CRÉER UN RÔLE
// ═══════════════════════════════════════════════════════════
const createSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(50).regex(/^[a-z][a-z0-9_]*$/, "Code en minuscules, sans espaces (ex: gestionnaire_ventes)"),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hex invalide").optional(),
  permissions: permissionsSchema,
});

export async function createRoleAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireRolesWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const existing = await prisma.role.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { success: false, error: "Un rôle avec ce nom existe déjà" };

  const created = await prisma.role.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? "#0F2D52",
      permissions: parsed.data.permissions as never,
      isSystem: false,
      sortOrder: 1000,
    },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "role", entityId: created.id, changes: { after: parsed.data } });
  await logSecurityEvent({ adminId, type: "role_created", message: `Rôle créé : ${parsed.data.name}`, metadata: { roleId: created.id } });

  revalidatePath("/admin/settings");
  return { success: true, data: { id: created.id } };
}

// ═══════════════════════════════════════════════════════════
// MODIFIER UN RÔLE
// ═══════════════════════════════════════════════════════════
const updateSchema = z.object({
  id: z.number().int(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  permissions: permissionsSchema.optional(),
});

export async function updateRoleAction(input: z.infer<typeof updateSchema>): Promise<Result> {
  const adminId = await requireRolesWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const before = await prisma.role.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { success: false, error: "Rôle introuvable" };

  // Rôles système : seul super_admin peut éditer (et même là, on bloque le renommage)
  if (before.isSystem) {
    const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
    if (me?.customRole?.name !== "super_admin") {
      return { success: false, error: "Ce rôle est protégé et ne peut être modifié que par un super-administrateur" };
    }
  }

  const { id, ...rest } = parsed.data;
  await prisma.role.update({
    where: { id },
    data: {
      ...rest,
      permissions: rest.permissions ? (rest.permissions as never) : undefined,
    },
  });

  await logAudit({ adminId, action: "update", entityType: "role", entityId: id, changes: { before, after: rest } });
  await logSecurityEvent({ adminId, type: "role_updated", message: `Rôle mis à jour : ${before.name}` });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// SUPPRIMER UN RÔLE (jamais un rôle système, ni un rôle utilisé)
// ═══════════════════════════════════════════════════════════
const deleteSchema = z.object({ id: z.number().int() });
export async function deleteRoleAction(input: z.infer<typeof deleteSchema>): Promise<Result> {
  const adminId = await requireRolesWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  const role = await prisma.role.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { admins: true, positions: true } } },
  });
  if (!role) return { success: false, error: "Rôle introuvable" };
  if (role.isSystem) return { success: false, error: "Les rôles système ne peuvent être supprimés" };
  if (role._count.admins > 0) return { success: false, error: `Ce rôle est attribué à ${role._count.admins} utilisateur(s). Réassignez-les avant de supprimer.` };
  if (role._count.positions > 0) return { success: false, error: `Ce rôle est utilisé par défaut pour ${role._count.positions} poste(s).` };

  await prisma.role.delete({ where: { id: parsed.data.id } });
  await logAudit({ adminId, action: "delete", entityType: "role", entityId: parsed.data.id });
  await logSecurityEvent({ adminId, type: "role_deleted", message: `Rôle supprimé : ${role.name}` });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// DUPLIQUER UN RÔLE
// ═══════════════════════════════════════════════════════════
const duplicateSchema = z.object({
  sourceId: z.number().int(),
  newName: z.string().min(2).max(50).regex(/^[a-z][a-z0-9_]*$/, "Code en minuscules sans espaces"),
});

export async function duplicateRoleAction(input: z.infer<typeof duplicateSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireRolesWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = duplicateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const source = await prisma.role.findUnique({ where: { id: parsed.data.sourceId } });
  if (!source) return { success: false, error: "Rôle source introuvable" };

  const existing = await prisma.role.findUnique({ where: { name: parsed.data.newName } });
  if (existing) return { success: false, error: "Un rôle avec ce nom existe déjà" };

  const created = await prisma.role.create({
    data: {
      name: parsed.data.newName,
      description: source.description ? `${source.description} (copie de ${source.name})` : `Copie de ${source.name}`,
      permissions: source.permissions as never,
      color: source.color,
      sortOrder: 1000,
      isSystem: false,
    },
    select: { id: true },
  });

  await logAudit({
    adminId, action: "create", entityType: "role", entityId: created.id,
    changes: { duplicatedFrom: source.id, sourceName: source.name },
  });
  await logSecurityEvent({ adminId, type: "role_created", message: `Rôle dupliqué : ${source.name} → ${parsed.data.newName}` });

  revalidatePath("/admin/settings/team");
  return { success: true, data: { id: created.id } };
}

// ═══════════════════════════════════════════════════════════
// RÉORDONNER LES RÔLES (drag & drop)
// ═══════════════════════════════════════════════════════════
const reorderSchema = z.object({
  orderedIds: z.array(z.number().int()).min(1),
});

export async function reorderRolesAction(input: z.infer<typeof reorderSchema>): Promise<Result> {
  const adminId = await requireRolesWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Données invalides" };

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, idx) =>
      prisma.role.update({
        where: { id },
        data: { sortOrder: (idx + 1) * 10 },
      })
    )
  );

  await logAudit({ adminId, action: "update", entityType: "role_reorder", changes: { count: parsed.data.orderedIds.length } });
  revalidatePath("/admin/settings/team");
  return { success: true };
}

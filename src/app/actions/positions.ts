"use server";
// Server Actions — gestion des postes (templates de profil employé).
// Un poste pré-remplit le rôle, le département et la couleur par défaut lors
// de la création d'un nouvel utilisateur.
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requirePositionsWrite() {
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
  const canWrite = isSuper || (perms.positions ?? []).includes("write");
  return canWrite ? adminId : null;
}

// ═══════════════════════════════════════════════════════════
// CRÉER UN POSTE
// ═══════════════════════════════════════════════════════════
const createSchema = z.object({
  name: z.string().min(2, "Nom trop court").max(100),
  description: z.string().max(500).nullable().optional(),
  defaultRoleId: z.number().int().nullable().optional(),
  defaultDepartment: z.string().max(100).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Couleur hex invalide").optional(),
});

export async function createPositionAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requirePositionsWrite();
  if (!adminId) return unauthorized();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const existing = await prisma.position.findUnique({ where: { name: parsed.data.name } });
  if (existing) return { success: false, error: t("un_poste_avec_ce_nom_existe_deja") };

  const created = await prisma.position.create({
    data: {
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      defaultRoleId: parsed.data.defaultRoleId ?? null,
      defaultDepartment: parsed.data.defaultDepartment ?? null,
      color: parsed.data.color ?? "#0F2D52",
      isSystem: false,
      sortOrder: 1000,
    },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "position", entityId: created.id, changes: { after: parsed.data } });
  await logSecurityEvent({ adminId, type: "position_created", message: t("positions_poste_cree_p0", { p0: parsed.data.name }) });

  revalidatePath("/admin/settings");
  return { success: true, data: { id: created.id } };
}

// ═══════════════════════════════════════════════════════════
// MODIFIER UN POSTE
// ═══════════════════════════════════════════════════════════
const updateSchema = z.object({
  id: z.number().int(),
  name: z.string().min(2).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  defaultRoleId: z.number().int().nullable().optional(),
  defaultDepartment: z.string().max(100).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

export async function updatePositionAction(input: z.infer<typeof updateSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requirePositionsWrite();
  if (!adminId) return unauthorized();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const before = await prisma.position.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { success: false, error: "Poste introuvable" };

  // Postes système : on peut éditer description/rôle/département mais pas renommer
  const { id, name, ...rest } = parsed.data;
  if (before.isSystem && name && name !== before.name) {
    return { success: false, error: t("le_nom_d_un_poste_systeme_ne") };
  }

  await prisma.position.update({
    where: { id },
    data: { ...rest, ...(name && !before.isSystem ? { name } : {}) },
  });

  await logAudit({ adminId, action: "update", entityType: "position", entityId: id, changes: { before, after: rest } });
  await logSecurityEvent({ adminId, type: "position_updated", message: t("positions_poste_mis_a_jour_p0", { p0: before.name }) });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// SUPPRIMER UN POSTE
// ═══════════════════════════════════════════════════════════
const deleteSchema = z.object({ id: z.number().int() });
export async function deletePositionAction(input: z.infer<typeof deleteSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requirePositionsWrite();
  if (!adminId) return unauthorized();
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t("donnees_invalides") };

  const position = await prisma.position.findUnique({
    where: { id: parsed.data.id },
    include: { _count: { select: { admins: true } } },
  });
  if (!position) return { success: false, error: "Poste introuvable" };
  if (position.isSystem) return { success: false, error: t("les_postes_systeme_ne_peuvent_etre_supprimes") };
  if (position._count.admins > 0) return { success: false, error: t("positions_ce_poste_est_attribue_a_p0_utilisateur_s", { p0: position._count.admins }) };

  await prisma.position.delete({ where: { id: parsed.data.id } });
  await logAudit({ adminId, action: "delete", entityType: "position", entityId: parsed.data.id });
  await logSecurityEvent({ adminId, type: "position_deleted", message: t("positions_poste_supprime_p0", { p0: position.name }) });

  revalidatePath("/admin/settings");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// RÉORDONNER LES POSTES (drag & drop)
// ═══════════════════════════════════════════════════════════
const reorderSchema = z.object({
  orderedIds: z.array(z.number().int()).min(1),
});

export async function reorderPositionsAction(input: z.infer<typeof reorderSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requirePositionsWrite();
  if (!adminId) return unauthorized();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t("donnees_invalides") };

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, idx) =>
      prisma.position.update({
        where: { id },
        data: { sortOrder: (idx + 1) * 10 },
      })
    )
  );

  await logAudit({ adminId, action: "update", entityType: "position_reorder", changes: { count: parsed.data.orderedIds.length } });
  revalidatePath("/admin/settings/team");
  return { success: true };
}

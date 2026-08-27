"use server";
// Server Actions — gestion des catalogues métier (CatalogItem).
// Couvre : client_tag, client_source, industry, expense_category,
// workflow_status, currency, payment_method, contact_method.
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

export const CATALOG_TYPES = [
  "client_tag",
  "client_source",
  "industry",
  "expense_category",
  "workflow_status",
  "currency",
  "payment_method",
  "contact_method",
] as const;
export type CatalogType = (typeof CATALOG_TYPES)[number];

async function requireWrite(resource: string) {
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
  const canWrite = isSuper || (perms[resource] ?? []).includes("write") || (perms.settings ?? []).includes("write");
  return canWrite ? adminId : null;
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 50);
}

// ── CRÉER ─────────────────────────────────────────────────
const createSchema = z.object({
  type: z.enum(CATALOG_TYPES),
  name: z.string().min(1).max(100),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(60).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export async function createCatalogItemAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireWrite(`${input.type}s`);
  if (!adminId) return unauthorized();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const key = slugify(parsed.data.name);
  const existing = await prisma.catalogItem.findUnique({ where: { type_key: { type: parsed.data.type, key } } });
  if (existing) return { success: false, error: t("un_element_avec_ce_nom_existe_deja") };

  // Max sortOrder existant pour placer à la fin
  const max = await prisma.catalogItem.aggregate({
    where: { type: parsed.data.type },
    _max: { sortOrder: true },
  });
  const nextOrder = (max._max.sortOrder ?? 0) + 10;

  const created = await prisma.catalogItem.create({
    data: {
      type: parsed.data.type,
      key,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      color: parsed.data.color ?? "#0F2D52",
      icon: parsed.data.icon ?? null,
      metadata: (parsed.data.metadata ?? {}) as never,
      sortOrder: nextOrder,
      isSystem: false,
      isActive: true,
    },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "catalog_item", entityId: created.id, changes: { after: parsed.data } });
  revalidatePath("/admin/settings/catalogs");
  return { success: true, data: { id: created.id } };
}

// ── MODIFIER ──────────────────────────────────────────────
const updateSchema = z.object({
  id: z.number().int(),
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  icon: z.string().max(60).nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function updateCatalogItemAction(input: z.infer<typeof updateSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const adminId = session.user.adminId!;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const before = await prisma.catalogItem.findUnique({ where: { id: parsed.data.id } });
  if (!before) return { success: false, error: t("element_introuvable") };

  const authed = await requireWrite(`${before.type}s`);
  if (!authed) return unauthorized();

  const { id, ...rest } = parsed.data;
  await prisma.catalogItem.update({
    where: { id },
    data: {
      ...rest,
      metadata: rest.metadata ? (rest.metadata as never) : undefined,
    },
  });

  await logAudit({ adminId, action: "update", entityType: "catalog_item", entityId: id, changes: { before, after: rest } });
  revalidatePath("/admin/settings/catalogs");
  return { success: true };
}

// ── SUPPRIMER (pas système, non utilisé) ──────────────────
const deleteSchema = z.object({ id: z.number().int() });
export async function deleteCatalogItemAction(input: z.infer<typeof deleteSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const adminId = session.user.adminId!;
  const parsed = deleteSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t("donnees_invalides") };

  const item = await prisma.catalogItem.findUnique({ where: { id: parsed.data.id } });
  if (!item) return { success: false, error: t("element_introuvable") };
  if (item.isSystem) return { success: false, error: t("les_elements_systeme_ne_peuvent_etre_supprimes") };

  const authed = await requireWrite(`${item.type}s`);
  if (!authed) return unauthorized();

  await prisma.catalogItem.delete({ where: { id: parsed.data.id } });
  await logAudit({ adminId, action: "delete", entityType: "catalog_item", entityId: parsed.data.id });
  revalidatePath("/admin/settings/catalogs");
  return { success: true };
}

// ── RÉORDONNER (drag & drop) ──────────────────────────────
const reorderSchema = z.object({
  type: z.enum(CATALOG_TYPES),
  orderedIds: z.array(z.number().int()).min(1),
});
export async function reorderCatalogItemsAction(input: z.infer<typeof reorderSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const authed = await requireWrite(`${input.type}s`);
  if (!authed) return unauthorized();
  const parsed = reorderSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t("donnees_invalides") };

  await prisma.$transaction(
    parsed.data.orderedIds.map((id, idx) =>
      prisma.catalogItem.update({ where: { id }, data: { sortOrder: (idx + 1) * 10 } })
    )
  );

  revalidatePath("/admin/settings/catalogs");
  return { success: true };
}

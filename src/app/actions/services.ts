"use server";
// Server Actions — gestion du catalogue de services offerts (ServiceCatalog).
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireAdmin() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  // Enforcement matrice : ecriture requise sur la/les ressource(s) du module.
  const { getCurrentAdminPermissions, canAct } = await import("@/lib/permissions");
  const perms = await getCurrentAdminPermissions();
  if (!(canAct(perms, "settings", "write") || canAct(perms, "website", "write"))) return null;
  return session.user.adminId!;
}

function slugify(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 50);
}

// ── CRÉER UN SERVICE ──
const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).nullable().optional(),
  basePrice: z.number().min(0).max(999999),
  priceUnit: z.enum(["hour", "fixed", "day", "month", "year"]).default("hour"),
  currency: z.string().min(3).max(3).default("CAD"),
  category: z.string().max(80).nullable().optional(),
});

export async function createServiceAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const key = slugify(parsed.data.name);
  const existing = await prisma.serviceCatalog.findUnique({ where: { key } });
  if (existing) return { success: false, error: t("un_service_avec_ce_nom_existe_deja") };

  const max = await prisma.serviceCatalog.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.serviceCatalog.create({
    data: {
      key,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
      basePrice: parsed.data.basePrice,
      priceUnit: parsed.data.priceUnit,
      currency: parsed.data.currency.toUpperCase(),
      category: parsed.data.category ?? null,
      isActive: true,
      sortOrder: (max._max.sortOrder ?? 0) + 10,
    },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "service_catalog", entityId: created.id, changes: { after: parsed.data } });
  revalidatePath("/admin/settings/catalogs");
  return { success: true, data: { id: created.id } };
}

// ── MODIFIER ──
const updateSchema = createSchema.partial().extend({
  id: z.number().int(),
  isActive: z.boolean().optional(),
});

export async function updateServiceAction(input: z.infer<typeof updateSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const { id, currency, ...rest } = parsed.data;
  const before = await prisma.serviceCatalog.findUnique({ where: { id } });
  if (!before) return { success: false, error: "Service introuvable" };

  await prisma.serviceCatalog.update({
    where: { id },
    data: { ...rest, currency: currency?.toUpperCase() },
  });

  await logAudit({ adminId, action: "update", entityType: "service_catalog", entityId: id, changes: { before, after: rest } });
  revalidatePath("/admin/settings/catalogs");
  return { success: true };
}

// ── SUPPRIMER ──
export async function deleteServiceAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  await prisma.serviceCatalog.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "service_catalog", entityId: input.id });
  revalidatePath("/admin/settings/catalogs");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// CODES PROMO (DiscountCode)
// ═══════════════════════════════════════════════════════════
const promoSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[A-Z0-9_-]+$/i, "Lettres, chiffres, tirets uniquement"),
  description: z.string().max(500).nullable().optional(),
  discountType: z.enum(["percent", "fixed"]),
  value: z.number().min(0).max(100000),
  maxUses: z.number().int().min(1).nullable().optional(),
  validFrom: z.string().nullable().optional(),
  validUntil: z.string().nullable().optional(),
});

export async function createPromoAction(input: z.infer<typeof promoSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = promoSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const code = parsed.data.code.toUpperCase();
  const existing = await prisma.discountCode.findUnique({ where: { code } });
  if (existing) return { success: false, error: t("ce_code_promo_existe_deja") };

  const created = await prisma.discountCode.create({
    data: {
      code,
      description: parsed.data.description ?? null,
      discountType: parsed.data.discountType,
      value: parsed.data.value,
      maxUses: parsed.data.maxUses ?? null,
      validFrom: parsed.data.validFrom ? new Date(parsed.data.validFrom) : null,
      validUntil: parsed.data.validUntil ? new Date(parsed.data.validUntil) : null,
      isActive: true,
    },
    select: { id: true },
  });

  await logAudit({ adminId, action: "create", entityType: "discount_code", entityId: created.id, changes: { after: parsed.data } });
  revalidatePath("/admin/settings/catalogs");
  return { success: true, data: { id: created.id } };
}

export async function updatePromoAction(input: z.infer<typeof promoSchema> & { id: number; isActive?: boolean }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();

  const { id, code, validFrom, validUntil, isActive, ...rest } = input;
  await prisma.discountCode.update({
    where: { id },
    data: {
      ...rest,
      code: code?.toUpperCase(),
      validFrom: validFrom ? new Date(validFrom) : null,
      validUntil: validUntil ? new Date(validUntil) : null,
      isActive: isActive ?? undefined,
    },
  });

  await logAudit({ adminId, action: "update", entityType: "discount_code", entityId: id });
  revalidatePath("/admin/settings/catalogs");
  return { success: true };
}

export async function deletePromoAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  await prisma.discountCode.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "discount_code", entityId: input.id });
  revalidatePath("/admin/settings/catalogs");
  return { success: true };
}

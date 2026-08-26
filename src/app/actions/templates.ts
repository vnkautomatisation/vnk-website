"use server";
// Server Actions — gestion des templates Email (transactionnels) et PDF.
import { z } from "zod";
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
  if (!(canAct(perms, "settings", "write") || canAct(perms, "email_templates", "write") || canAct(perms, "pdf_templates", "write"))) return null;
  return session.user.adminId!;
}

// ═══════════════════════════════════════════════════════════
// EMAIL TEMPLATES
// ═══════════════════════════════════════════════════════════
const emailSchema = z.object({
  key: z.string().min(1).max(80),
  locale: z.enum(["fr", "en"]).default("fr"),
  subject: z.string().min(1).max(300),
  bodyHtml: z.string().min(1).max(200000),
  bodyText: z.string().max(50000).nullable().optional(),
  variables: z.record(z.string()).optional(),
  isEnabled: z.boolean().default(true),
});

export async function upsertEmailTemplateAction(input: z.infer<typeof emailSchema> & { id?: number }): Promise<Result<{ id: number }>> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = emailSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = {
    subject: parsed.data.subject,
    bodyHtml: parsed.data.bodyHtml,
    bodyText: parsed.data.bodyText ?? null,
    variables: (parsed.data.variables ?? {}) as never,
    isEnabled: parsed.data.isEnabled,
    updatedBy: adminId,
  };

  let id: number;
  if (input.id) {
    const updated = await prisma.emailTemplate.update({ where: { id: input.id }, data, select: { id: true } });
    id = updated.id;
  } else {
    const created = await prisma.emailTemplate.upsert({
      where: { key_locale: { key: parsed.data.key, locale: parsed.data.locale } },
      update: data,
      create: { key: parsed.data.key, locale: parsed.data.locale, ...data },
      select: { id: true },
    });
    id = created.id;
  }

  await logAudit({ adminId, action: "update", entityType: "email_template", entityId: id });
  revalidatePath("/admin/settings/templates");
  return { success: true, data: { id } };
}

export async function deleteEmailTemplateAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  await prisma.emailTemplate.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "email_template", entityId: input.id });
  revalidatePath("/admin/settings/templates");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// PDF TEMPLATES
// ═══════════════════════════════════════════════════════════
// Structure JSON simple : { header: { html }, body: { html }, footer: { html },
//   pageSize: "A4", margins: { top, right, bottom, left }, paperColor, accentColor }
const pdfSchema = z.object({
  key: z.string().min(1).max(80),
  locale: z.enum(["fr", "en"]).default("fr"),
  content: z.object({
    headerHtml: z.string().max(50000).optional(),
    bodyHtml: z.string().max(200000),
    footerHtml: z.string().max(50000).optional(),
    pageSize: z.enum(["A4", "Letter", "Legal"]).default("A4"),
    margins: z.object({
      top: z.number().min(0).max(100).default(40),
      right: z.number().min(0).max(100).default(40),
      bottom: z.number().min(0).max(100).default(40),
      left: z.number().min(0).max(100).default(40),
    }).default({ top: 40, right: 40, bottom: 40, left: 40 }),
    accentColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).default("#0F2D52"),
  }),
  variables: z.record(z.string()).optional(),
  isEnabled: z.boolean().default(true),
});

export async function upsertPdfTemplateAction(input: z.infer<typeof pdfSchema> & { id?: number }): Promise<Result<{ id: number }>> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  const parsed = pdfSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = {
    content: parsed.data.content as never,
    variables: (parsed.data.variables ?? {}) as never,
    isEnabled: parsed.data.isEnabled,
  };

  let id: number;
  if (input.id) {
    const updated = await prisma.pdfTemplate.update({ where: { id: input.id }, data, select: { id: true } });
    id = updated.id;
  } else {
    const created = await prisma.pdfTemplate.upsert({
      where: { key_locale: { key: parsed.data.key, locale: parsed.data.locale } },
      update: data,
      create: { key: parsed.data.key, locale: parsed.data.locale, ...data },
      select: { id: true },
    });
    id = created.id;
  }

  await logAudit({ adminId, action: "update", entityType: "pdf_template", entityId: id });
  revalidatePath("/admin/settings/templates");
  return { success: true, data: { id } };
}

export async function deletePdfTemplateAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdmin();
  if (!adminId) return unauthorized();
  await prisma.pdfTemplate.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "pdf_template", entityId: input.id });
  revalidatePath("/admin/settings/templates");
  return { success: true };
}

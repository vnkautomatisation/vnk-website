"use server";
// Annonces internes + politiques RH.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireHrWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const id = session.user.adminId!;
  const me = await prisma.admin.findUnique({ where: { id }, include: { customRole: true } });
  if (!me) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  return (me.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write") || (perms.users ?? []).includes("write")) ? id : null;
}

// ═══════════════════════════════════════════════════════════
// ANNONCES INTERNES
// ═══════════════════════════════════════════════════════════
const announcementSchema = z.object({
  id: z.number().int().optional(),
  title: z.string().min(1).max(200),
  body: z.string().min(1).max(20000),
  category: z.enum(["general", "safety", "hr", "tech", "celebration"]).default("general"),
  pinned: z.boolean().default(false),
  publishedAt: z.string().nullable().optional(),
  expiresAt: z.string().nullable().optional(),
  audienceType: z.enum(["all", "team", "role"]).default("all"),
  audienceTeamId: z.number().int().nullable().optional(),
  audienceRoleId: z.number().int().nullable().optional(),
});

export async function upsertAnnouncementAction(input: z.infer<typeof announcementSchema>): Promise<Result<{ id: number }>> {
  const authorId = await requireHrWrite();
  if (!authorId) return { success: false, error: "Non autorisé" };
  const parsed = announcementSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = {
    authorId,
    title: parsed.data.title,
    body: parsed.data.body,
    category: parsed.data.category,
    pinned: parsed.data.pinned,
    publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
    expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    audienceType: parsed.data.audienceType,
    audienceTeamId: parsed.data.audienceTeamId ?? null,
    audienceRoleId: parsed.data.audienceRoleId ?? null,
  };

  const row = parsed.data.id
    ? await prisma.announcement.update({ where: { id: parsed.data.id }, data, select: { id: true } })
    : await prisma.announcement.create({ data, select: { id: true } });

  // Si publiée et nouvelle → notifier l'audience
  if (!parsed.data.id && data.publishedAt) {
    await notifyAnnouncementAudience(row.id, data);
  }

  await logAudit({ adminId: authorId, action: parsed.data.id ? "update" : "create", entityType: "announcement", entityId: row.id });
  revalidatePath("/admin/employes/annonces");
  revalidatePath("/admin/mon-espace");
  return { success: true, data: { id: row.id } };
}

async function notifyAnnouncementAudience(announcementId: number, ann: { title: string; audienceType: string; audienceTeamId: number | null; audienceRoleId: number | null }) {
  const where: Record<string, unknown> = { isActive: true };
  if (ann.audienceType === "team" && ann.audienceTeamId) where.teamId = ann.audienceTeamId;
  if (ann.audienceType === "role" && ann.audienceRoleId) where.roleId = ann.audienceRoleId;
  const recipients = await prisma.admin.findMany({ where: where as never, select: { id: true } });
  for (const r of recipients) {
    await prisma.notification.create({
      data: {
        recipientType: "admin", recipientId: r.id,
        type: "info", title: ann.title,
        link: `/admin/mon-espace`,
        icon: "megaphone",
      },
    }).catch(() => null);
  }
}

export async function publishAnnouncementAction(input: { id: number }): Promise<Result> {
  const authorId = await requireHrWrite();
  if (!authorId) return { success: false, error: "Non autorisé" };
  const ann = await prisma.announcement.update({
    where: { id: input.id },
    data: { publishedAt: new Date() },
  });
  await notifyAnnouncementAudience(ann.id, ann);
  await logAudit({ adminId: authorId, action: "update", entityType: "announcement", entityId: input.id, changes: { published: true } });
  revalidatePath("/admin/employes/annonces");
  revalidatePath("/admin/mon-espace");
  return { success: true };
}

export async function deleteAnnouncementAction(input: { id: number }): Promise<Result> {
  const authorId = await requireHrWrite();
  if (!authorId) return { success: false, error: "Non autorisé" };
  await prisma.announcement.delete({ where: { id: input.id } });
  await logAudit({ adminId: authorId, action: "delete", entityType: "announcement", entityId: input.id });
  revalidatePath("/admin/employes/annonces");
  return { success: true };
}

export async function markAnnouncementReadAction(input: { id: number }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;
  await prisma.announcementRead.upsert({
    where: { announcementId_adminId: { announcementId: input.id, adminId } },
    create: { announcementId: input.id, adminId },
    update: {},
  });
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// POLITIQUES RH (référence interne, distincte des LegalDocs signables)
// ═══════════════════════════════════════════════════════════
const policySchema = z.object({
  id: z.number().int().optional(),
  key: z.string().min(1).max(80).regex(/^[a-z0-9_]+$/),
  title: z.string().min(1).max(200),
  version: z.string().min(1).max(20),
  bodyMarkdown: z.string().min(20),
  effectiveFrom: z.string(),
  isActive: z.boolean().default(true),
});

export async function upsertHrPolicyAction(input: z.infer<typeof policySchema>): Promise<Result<{ id: number }>> {
  const publishedBy = await requireHrWrite();
  if (!publishedBy) return { success: false, error: "Non autorisé" };
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const data = {
    key: parsed.data.key,
    title: parsed.data.title,
    version: parsed.data.version,
    bodyMarkdown: parsed.data.bodyMarkdown,
    effectiveFrom: new Date(parsed.data.effectiveFrom),
    isActive: parsed.data.isActive,
    publishedBy,
  };

  const row = parsed.data.id
    ? await prisma.hrPolicy.update({ where: { id: parsed.data.id }, data: { ...data, key: undefined }, select: { id: true } })
    : await prisma.hrPolicy.create({ data, select: { id: true } });

  await logAudit({ adminId: publishedBy, action: parsed.data.id ? "update" : "create", entityType: "hr_policy", entityId: row.id });
  revalidatePath("/admin/employes/politiques");
  revalidatePath("/admin/mon-espace/politiques");
  return { success: true, data: { id: row.id } };
}

// Duplique une politique RH : copie avec suffix " (copie)" + isStarter = false
export async function duplicateHrPolicyAction(input: { id: number }): Promise<Result<{ id: number; title: string }>> {
  const publishedBy = await requireHrWrite();
  if (!publishedBy) return { success: false, error: "Non autorisé" };

  const src = await prisma.hrPolicy.findUnique({ where: { id: input.id } });
  if (!src) return { success: false, error: "Politique introuvable" };

  // Cle unique : key_copy, key_copy_2, …
  const baseKey = `${src.key}_copy`;
  let newKey = baseKey;
  let n = 2;
  while (await prisma.hrPolicy.findUnique({ where: { key: newKey }, select: { id: true } })) {
    newKey = `${baseKey}_${n++}`;
    if (n > 50) return { success: false, error: "Trop de copies existantes" };
  }

  const newTitle = `${src.title} (copie)`;
  const copy = await prisma.hrPolicy.create({
    data: {
      key: newKey,
      title: newTitle,
      version: src.version,
      bodyMarkdown: src.bodyMarkdown,
      effectiveFrom: src.effectiveFrom,
      isActive: true,
      publishedBy,
      variables: src.variables ?? undefined,
      isStarter: false,
    },
    select: { id: true, title: true },
  });

  await logAudit({ adminId: publishedBy, action: "create", entityType: "hr_policy", entityId: copy.id, changes: { duplicatedFrom: src.id } });
  revalidatePath("/admin/employes/politiques");
  revalidatePath("/admin/employes/documents/bibliotheque");
  return { success: true, data: { id: copy.id, title: copy.title } };
}

// Archive / desarchive une politique RH (toggle isActive)
export async function toggleHrPolicyActiveAction(input: { id: number; isActive: boolean }): Promise<Result> {
  const publishedBy = await requireHrWrite();
  if (!publishedBy) return { success: false, error: "Non autorisé" };
  await prisma.hrPolicy.update({
    where: { id: input.id },
    data: { isActive: input.isActive },
  });
  await logAudit({ adminId: publishedBy, action: "update", entityType: "hr_policy", entityId: input.id, changes: { isActive: input.isActive } });
  revalidatePath("/admin/employes/politiques");
  revalidatePath("/admin/employes/documents/bibliotheque");
  return { success: true };
}

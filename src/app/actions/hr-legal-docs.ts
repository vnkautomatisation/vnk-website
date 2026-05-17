"use server";
// Actions documents légaux (NDA, code conduite, etc.) + signatures employés.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { getClientIpFromHeaders } from "@/lib/security/rate-limit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireHrWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return (isSuper || (perms.users ?? []).includes("write")) ? adminId : null;
}

const docSchema = z.object({
  key: z.string().min(1).max(60).regex(/^[a-z0-9_]+$/, "Clé : a-z, 0-9, _"),
  title: z.string().min(1).max(160),
  category: z.enum(["policy", "nda", "acknowledgment"]).default("policy"),
  version: z.string().min(1).max(20),
  bodyMarkdown: z.string().min(20),
  isRequired: z.boolean().default(true),
});

export async function upsertLegalDocAction(input: z.infer<typeof docSchema> & { id?: number }): Promise<Result<{ id: number }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = docSchema.extend({ id: z.number().int().optional() }).safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  let doc;
  if (parsed.data.id) {
    doc = await prisma.legalDocumentTemplate.update({
      where: { id: parsed.data.id },
      data: {
        title: parsed.data.title,
        category: parsed.data.category,
        version: parsed.data.version,
        bodyMarkdown: parsed.data.bodyMarkdown,
        isRequired: parsed.data.isRequired,
      },
      select: { id: true },
    });
  } else {
    doc = await prisma.legalDocumentTemplate.create({
      data: {
        key: parsed.data.key,
        title: parsed.data.title,
        category: parsed.data.category,
        version: parsed.data.version,
        bodyMarkdown: parsed.data.bodyMarkdown,
        isRequired: parsed.data.isRequired,
      },
      select: { id: true },
    });

    // Notifier tous les admins actifs qu'un nouveau document obligatoire est à signer
    if (parsed.data.isRequired) {
      const activeAdmins = await prisma.admin.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      await Promise.all(
        activeAdmins.map((a) =>
          prisma.notification.create({
            data: {
              recipientType: "admin",
              recipientId: a.id,
              type: "warning",
              title: "Nouveau document à signer",
              body: parsed.data.title,
              link: "/admin/mon-espace/documents",
              icon: "file-signature",
            },
          }).catch(() => null),
        ),
      );
    }
  }
  await logAudit({ adminId, action: parsed.data.id ? "update" : "create", entityType: "legal_doc", entityId: doc.id });
  revalidatePath("/admin/employes/documents");
  return { success: true, data: { id: doc.id } };
}

export async function deleteLegalDocAction(input: { id: number }): Promise<Result> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const used = await prisma.legalDocumentSignature.count({ where: { templateId: input.id } });
  if (used > 0) {
    await prisma.legalDocumentTemplate.update({ where: { id: input.id }, data: { isActive: false } });
  } else {
    await prisma.legalDocumentTemplate.delete({ where: { id: input.id } });
  }
  await logAudit({ adminId, action: "delete", entityType: "legal_doc", entityId: input.id });
  revalidatePath("/admin/employes/documents");
  return { success: true };
}

// Signature par l'employé connecté
export async function signLegalDocAction(input: { templateId: number; signatureData: string }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  const tpl = await prisma.legalDocumentTemplate.findUnique({ where: { id: input.templateId } });
  if (!tpl || !tpl.isActive) return { success: false, error: "Document introuvable" };
  if (!input.signatureData?.startsWith("data:image/")) return { success: false, error: "Signature invalide" };

  const already = await prisma.legalDocumentSignature.findUnique({
    where: { templateId_adminId_version: { templateId: tpl.id, adminId, version: tpl.version } },
  });
  if (already) return { success: false, error: "Déjà signé pour cette version" };

  const h = await headers().catch(() => null);
  const ip = getClientIpFromHeaders(h);
  const ua = h?.get("user-agent") ?? null;

  await prisma.legalDocumentSignature.create({
    data: {
      templateId: tpl.id,
      adminId,
      version: tpl.version,
      signatureData: input.signatureData,
      ipAddress: ip,
      userAgent: ua,
    },
  });
  await logAudit({ adminId, action: "create", entityType: "legal_signature", entityId: tpl.id, changes: { key: tpl.key, version: tpl.version } });
  revalidatePath("/admin/employes/documents");
  return { success: true };
}

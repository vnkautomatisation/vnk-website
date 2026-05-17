"use server";
// Documents fiscaux (T4, Relevé 1) + lettres d'emploi.
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
  return (me.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write") || (perms.payroll ?? []).includes("write")) ? id : null;
}

// ═══════════════════════════════════════════════════════════
// ÉMETTRE DOC FISCAL (T4, Relevé 1, etc.)
// ═══════════════════════════════════════════════════════════
const issueDocSchema = z.object({
  adminId: z.number().int(),
  type: z.enum(["t4", "releve1", "employment_letter", "nr4", "t2200", "other"]),
  taxYear: z.number().int().min(2000).max(2100).nullable().optional(),
  title: z.string().min(1).max(200),
  fileUrl: z.string().min(1),
  notes: z.string().max(500).nullable().optional(),
});

export async function issueTaxDocumentAction(input: z.infer<typeof issueDocSchema>): Promise<Result<{ id: number }>> {
  const issuedBy = await requireHrWrite();
  if (!issuedBy) return { success: false, error: "Non autorisé" };
  const parsed = issueDocSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const row = await prisma.taxDocument.create({
    data: {
      adminId: parsed.data.adminId,
      type: parsed.data.type,
      taxYear: parsed.data.taxYear ?? null,
      title: parsed.data.title,
      fileUrl: parsed.data.fileUrl,
      notes: parsed.data.notes ?? null,
      issuedBy,
    },
    select: { id: true },
  });

  // Notifier l'employé
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: parsed.data.adminId,
      type: "info",
      title: "Nouveau document fiscal",
      body: `${parsed.data.title} disponible dans Mon espace > Documents`,
      link: "/admin/mon-espace/documents",
      icon: "file-text",
    },
  }).catch(() => null);

  await logAudit({ adminId: issuedBy, action: "create", entityType: "tax_document", entityId: row.id });
  revalidatePath("/admin/mon-espace/documents");
  revalidatePath("/admin/employes/docs-fiscaux");
  return { success: true, data: { id: row.id } };
}

// ═══════════════════════════════════════════════════════════
// LETTRES D'EMPLOI : demande employé + émission RH
// ═══════════════════════════════════════════════════════════
const requestLetterSchema = z.object({
  purpose: z.enum(["bank", "rental", "embassy", "hypothec", "other"]),
  recipient: z.string().max(200).nullable().optional(),
  includeSalary: z.boolean().default(true),
  notes: z.string().max(500).nullable().optional(),
});

export async function requestEmploymentLetterAction(input: z.infer<typeof requestLetterSchema>): Promise<Result<{ id: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;
  const parsed = requestLetterSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const row = await prisma.employmentLetterRequest.create({
    data: {
      adminId,
      purpose: parsed.data.purpose,
      recipient: parsed.data.recipient ?? null,
      includeSalary: parsed.data.includeSalary,
      notes: parsed.data.notes ?? null,
      status: "pending",
    },
    select: { id: true },
  });

  // Notifier les RH
  const hrAdmins = await prisma.admin.findMany({
    where: { customRole: { name: "super_admin" }, isActive: true },
    select: { id: true },
  });
  for (const hr of hrAdmins) {
    await prisma.notification.create({
      data: {
        recipientType: "admin", recipientId: hr.id,
        type: "info", title: "Demande de lettre d'emploi",
        body: `Nouvelle demande à traiter (${parsed.data.purpose})`,
        link: "/admin/employes/lettres",
        icon: "mail",
      },
    }).catch(() => null);
  }

  await logAudit({ adminId, action: "create", entityType: "employment_letter_request", entityId: row.id });
  revalidatePath("/admin/mon-espace/documents");
  revalidatePath("/admin/employes/lettres");
  return { success: true, data: { id: row.id } };
}

export async function issueEmploymentLetterAction(input: { id: number; letterUrl: string }): Promise<Result> {
  const issuedBy = await requireHrWrite();
  if (!issuedBy) return { success: false, error: "Non autorisé" };

  const r = await prisma.employmentLetterRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };

  await prisma.employmentLetterRequest.update({
    where: { id: input.id },
    data: { status: "issued", letterUrl: input.letterUrl, issuedAt: new Date(), issuedBy },
  });

  // Notifier le demandeur
  await prisma.notification.create({
    data: {
      recipientType: "admin", recipientId: r.adminId,
      type: "success", title: "Lettre d'emploi disponible",
      body: "Votre lettre est prête, téléchargez-la depuis Mon espace > Documents",
      link: "/admin/mon-espace/documents",
      icon: "check",
    },
  }).catch(() => null);

  await logAudit({ adminId: issuedBy, action: "update", entityType: "employment_letter_request", entityId: input.id, changes: { issued: true } });
  revalidatePath("/admin/mon-espace/documents");
  revalidatePath("/admin/employes/lettres");
  return { success: true };
}

export async function rejectEmploymentLetterAction(input: { id: number; reason: string }): Promise<Result> {
  const issuedBy = await requireHrWrite();
  if (!issuedBy) return { success: false, error: "Non autorisé" };
  const r = await prisma.employmentLetterRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Introuvable" };

  await prisma.employmentLetterRequest.update({
    where: { id: input.id },
    data: { status: "rejected", notes: input.reason, issuedBy, issuedAt: new Date() },
  });
  await prisma.notification.create({
    data: {
      recipientType: "admin", recipientId: r.adminId,
      type: "warning", title: "Demande de lettre refusée",
      body: input.reason,
      link: "/admin/mon-espace/documents",
    },
  }).catch(() => null);
  await logAudit({ adminId: issuedBy, action: "update", entityType: "employment_letter_request", entityId: input.id, changes: { rejected: true } });
  revalidatePath("/admin/employes/lettres");
  return { success: true };
}

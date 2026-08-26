"use server";
// Documents fiscaux (T4, Relevé 1) + lettres d'emploi.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { generateT4SummaryPdf, generateReleve1Pdf } from "@/lib/services/pdf-hr";
import { uploadBuffer } from "@/lib/storage/object-storage";
import { unauthorized, forbidden } from "@/lib/refusals";

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
  if (!issuedBy) return unauthorized();
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
// GÉNÉRATION AUTO T4 / RELEVÉ 1 à partir des PayStub publiés
// ═══════════════════════════════════════════════════════════
const annualSchema = z.object({
  adminId: z.number().int(),
  year: z.number().int().min(2000).max(2100),
  type: z.enum(["t4", "releve1"]),
});

export async function generateAnnualTaxDocAction(
  input: z.infer<typeof annualSchema>,
): Promise<Result<{ id: number; fileUrl: string }>> {
  const issuedBy = await requireHrWrite();
  if (!issuedBy) return unauthorized();
  const parsed = annualSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  try {
    const { adminId, year, type } = parsed.data;
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59);

    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { fullName: true, email: true },
    });
    if (!admin) return { success: false, error: "Employé introuvable" };

    const stubs = await prisma.payStub.findMany({
      where: {
        adminId,
        releasedAt: { not: null },
        period: { payDate: { gte: yearStart, lte: yearEnd } },
      },
      include: { period: true },
    });

    if (stubs.length === 0) {
      return { success: false, error: `Aucun bulletin publié en ${year} pour cet employé` };
    }

    const totals = stubs.reduce(
      (acc, s) => ({
        grossPay: acc.grossPay + Number(s.grossPay),
        netPay: acc.netPay + Number(s.netPay),
        deductionFederal: acc.deductionFederal + Number(s.deductionFederal),
        deductionProvincial: acc.deductionProvincial + Number(s.deductionProvincial),
        deductionRrq: acc.deductionRrq + Number(s.deductionRrq),
        deductionAe: acc.deductionAe + Number(s.deductionAe),
        deductionRqap: acc.deductionRqap + Number(s.deductionRqap),
        deductionOther: acc.deductionOther + Number(s.deductionOther),
      }),
      { grossPay: 0, netPay: 0, deductionFederal: 0, deductionProvincial: 0,
        deductionRrq: 0, deductionAe: 0, deductionRqap: 0, deductionOther: 0 },
    );

    const buf = type === "t4"
      ? await generateT4SummaryPdf({ admin, year, totals, stubCount: stubs.length })
      : await generateReleve1Pdf({ admin, year, totals, stubCount: stubs.length });

    const upload = await uploadBuffer({
      buffer: buf,
      mime: "application/pdf",
      keyBase: `tax-docs/${type}-${adminId}-${year}`,
      ext: "pdf",
    });
    const fileUrl = upload.kind === "remote" ? upload.url : upload.dataUrl;

    const title = type === "t4"
      ? `T4 ${year} — Sommaire`
      : `Relevé 1 ${year} — Sommaire`;

    const row = await prisma.taxDocument.create({
      data: {
        adminId,
        type,
        taxYear: year,
        title,
        fileUrl,
        issuedBy,
        notes: `Résumé non officiel généré automatiquement à partir de ${stubs.length} bulletin(s) publié(s).`,
      },
      select: { id: true },
    });

    // Notifier l'employé
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: adminId,
        type: "info",
        title: "Nouveau document fiscal",
        body: `${title} disponible dans Mon espace > Documents`,
        link: "/admin/mon-espace/documents",
        icon: "file-text",
      },
    }).catch(() => null);

    await logAudit({
      adminId: issuedBy,
      action: "create",
      entityType: "tax_document",
      entityId: row.id,
      changes: { type, year, stubCount: stubs.length, auto: true },
    });
    revalidatePath("/admin/employes/docs-fiscaux");
    revalidatePath("/admin/mon-espace/documents");
    return { success: true, data: { id: row.id, fileUrl } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Erreur" };
  }
}

// Génération en lot : tous les employés actifs ayant ≥ 1 bulletin publié dans l'année.
const bulkSchema = z.object({
  year: z.number().int().min(2000).max(2100),
  type: z.enum(["t4", "releve1"]),
});

export async function generateAnnualTaxDocsBulkAction(
  input: z.infer<typeof bulkSchema>,
): Promise<Result<{ generated: number; skipped: number; errors: string[] }>> {
  const issuedBy = await requireHrWrite();
  if (!issuedBy) return unauthorized();
  const parsed = bulkSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };
  const { year, type } = parsed.data;

  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59);

  const employees = await prisma.admin.findMany({
    where: {
      isActive: true,
      payStubs: {
        some: { releasedAt: { not: null }, period: { payDate: { gte: yearStart, lte: yearEnd } } },
      },
    },
    select: { id: true },
  });

  let generated = 0;
  let skipped = 0;
  const errors: string[] = [];
  for (const emp of employees) {
    const r = await generateAnnualTaxDocAction({ adminId: emp.id, year, type });
    if (r.success) generated++;
    else { skipped++; errors.push(`Admin ${emp.id}: ${r.error}`); }
  }
  return { success: true, data: { generated, skipped, errors } };
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
  if (!session?.user || session.user.role !== "admin") return unauthorized();
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
  if (!issuedBy) return unauthorized();

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
  if (!issuedBy) return unauthorized();
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

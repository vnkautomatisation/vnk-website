"use server";
// Actions pour Contrats employés (templates + contrats individuels).
// Workflow : draft → sent → signed_employee → signed_employer → active.
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
  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  const canHr = isSuper || (perms.users ?? []).includes("write") || (perms.hr ?? []).includes("write");
  return canHr ? adminId : null;
}

// ── Templates ──────────────────────────────────────────────
const templateSchema = z.object({
  name: z.string().min(1).max(160),
  positionId: z.number().int().nullable().optional(),
  contractType: z.enum(["cdi", "cdd", "contractuel", "stagiaire", "autre"]),
  bodyMarkdown: z.string().min(20),
  defaultSalary: z.number().nullable().optional(),
  defaultRate: z.number().nullable().optional(),
  defaultHoursPerWeek: z.number().int().nullable().optional(),
  defaultVacationPct: z.number().nullable().optional(),
  probationDays: z.number().int().nullable().optional(),
});

export async function createContractTemplateAction(input: z.infer<typeof templateSchema>): Promise<Result<{ id: number }>> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = templateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const t = await prisma.contractTemplate.create({
    data: {
      name: parsed.data.name,
      positionId: parsed.data.positionId ?? null,
      contractType: parsed.data.contractType,
      bodyMarkdown: parsed.data.bodyMarkdown,
      defaultSalary: parsed.data.defaultSalary ?? null,
      defaultRate: parsed.data.defaultRate ?? null,
      defaultHoursPerWeek: parsed.data.defaultHoursPerWeek ?? null,
      defaultVacationPct: parsed.data.defaultVacationPct ?? 4.0,
      probationDays: parsed.data.probationDays ?? 90,
    },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "contract_template", entityId: t.id });
  revalidatePath("/admin/employes/contrats");
  return { success: true, data: { id: t.id } };
}

export async function updateContractTemplateAction(input: z.infer<typeof templateSchema> & { id: number }): Promise<Result> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  const parsed = templateSchema.extend({ id: z.number().int() }).safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  await prisma.contractTemplate.update({
    where: { id: parsed.data.id },
    data: {
      name: parsed.data.name,
      positionId: parsed.data.positionId ?? null,
      contractType: parsed.data.contractType,
      bodyMarkdown: parsed.data.bodyMarkdown,
      defaultSalary: parsed.data.defaultSalary ?? null,
      defaultRate: parsed.data.defaultRate ?? null,
      defaultHoursPerWeek: parsed.data.defaultHoursPerWeek ?? null,
      defaultVacationPct: parsed.data.defaultVacationPct ?? null,
      probationDays: parsed.data.probationDays ?? null,
    },
  });
  await logAudit({ adminId, action: "update", entityType: "contract_template", entityId: parsed.data.id });
  revalidatePath("/admin/employes/contrats");
  return { success: true };
}

export async function deleteContractTemplateAction(input: { id: number }): Promise<Result> {
  const adminId = await requireHrWrite();
  if (!adminId) return { success: false, error: "Non autorisé" };
  // Soft : on désactive si déjà utilisé, sinon delete
  const used = await prisma.employeeContract.count({ where: { templateId: input.id } });
  if (used > 0) {
    await prisma.contractTemplate.update({ where: { id: input.id }, data: { isActive: false } });
  } else {
    await prisma.contractTemplate.delete({ where: { id: input.id } });
  }
  await logAudit({ adminId, action: "delete", entityType: "contract_template", entityId: input.id, changes: { soft: used > 0 } });
  revalidatePath("/admin/employes/contrats");
  return { success: true };
}

// ── Contrats individuels ───────────────────────────────────
const contractSchema = z.object({
  adminId: z.number().int(),
  templateId: z.number().int().nullable().optional(),
  title: z.string().min(1).max(200),
  contractType: z.enum(["cdi", "cdd", "contractuel", "stagiaire", "autre"]),
  bodyMarkdown: z.string().min(20),
  startDate: z.string(),
  endDate: z.string().nullable().optional(),
  probationEndDate: z.string().nullable().optional(),
  salaryAnnual: z.number().nullable().optional(),
  hourlyRate: z.number().nullable().optional(),
  hoursPerWeek: z.number().int().nullable().optional(),
  vacationPct: z.number().nullable().optional(),
});

export async function createContractAction(input: z.infer<typeof contractSchema>): Promise<Result<{ id: number }>> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  const parsed = contractSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const employee = await prisma.admin.findUnique({ where: { id: parsed.data.adminId }, select: { id: true } });
  if (!employee) return { success: false, error: "Employé introuvable" };

  const c = await prisma.employeeContract.create({
    data: {
      adminId: parsed.data.adminId,
      templateId: parsed.data.templateId ?? null,
      title: parsed.data.title,
      contractType: parsed.data.contractType,
      bodyMarkdown: parsed.data.bodyMarkdown,
      startDate: new Date(parsed.data.startDate),
      endDate: parsed.data.endDate ? new Date(parsed.data.endDate) : null,
      probationEndDate: parsed.data.probationEndDate ? new Date(parsed.data.probationEndDate) : null,
      salaryAnnual: parsed.data.salaryAnnual ?? null,
      hourlyRate: parsed.data.hourlyRate ?? null,
      hoursPerWeek: parsed.data.hoursPerWeek ?? null,
      vacationPct: parsed.data.vacationPct ?? null,
      status: "draft",
    },
    select: { id: true },
  });
  await logAudit({ adminId: actorId, action: "create", entityType: "employee_contract", entityId: c.id });
  revalidatePath("/admin/employes/contrats");
  return { success: true, data: { id: c.id } };
}

export async function sendContractAction(input: { id: number }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  await prisma.employeeContract.update({
    where: { id: input.id },
    data: { status: "sent" },
  });
  // Notifier l'employé qu'un contrat est à signer
  const contract = await prisma.employeeContract.findUnique({
    where: { id: input.id },
    select: { adminId: true, title: true },
  });
  if (contract) {
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: contract.adminId,
        type: "warning",
        title: "Contrat à signer",
        body: `Veuillez consulter et signer votre contrat : ${contract.title}`,
        link: "/admin/mon-espace/contrats",
        icon: "file-signature",
      },
    }).catch(() => null);
  }
  await logAudit({ adminId: actorId, action: "update", entityType: "employee_contract", entityId: input.id, changes: { sent: true } });
  revalidatePath("/admin/employes/contrats");
  return { success: true };
}

// Signature employé (le user lui-même signe son contrat)
export async function signContractAsEmployeeAction(input: { id: number; signatureData: string }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  const contract = await prisma.employeeContract.findUnique({ where: { id: input.id } });
  if (!contract) return { success: false, error: "Contrat introuvable" };
  if (contract.adminId !== adminId) return { success: false, error: "Vous ne pouvez signer que votre propre contrat" };
  if (contract.employeeSignedAt) return { success: false, error: "Déjà signé par l'employé" };
  if (!input.signatureData?.startsWith("data:image/")) return { success: false, error: "Signature invalide" };

  const h = await headers().catch(() => null);
  const ip = getClientIpFromHeaders(h);

  await prisma.employeeContract.update({
    where: { id: input.id },
    data: {
      employeeSignatureData: input.signatureData,
      employeeSignedAt: new Date(),
      employeeSignedIp: ip,
      status: contract.employerSignedAt ? "active" : "signed_employee",
    },
  });

  // Notifier le(s) RH/super-admin que l'employé a signé et qu'il faut contre-signer
  const signed = await prisma.employeeContract.findUnique({
    where: { id: input.id },
    select: {
      title: true,
      admin: { select: { fullName: true, email: true } },
    },
  });
  if (signed) {
    const hrAdmins = await prisma.admin.findMany({
      where: { isActive: true, customRole: { name: "super_admin" } },
      select: { id: true },
    });
    await Promise.all(
      hrAdmins.map((a) =>
        prisma.notification.create({
          data: {
            recipientType: "admin",
            recipientId: a.id,
            type: "info",
            title: "Contrat signé par l'employé",
            body: `${signed.admin.fullName || signed.admin.email} a signé : ${signed.title}. À signer en tant qu'employeur.`,
            link: "/admin/employes/contrats",
            icon: "file-signature",
          },
        }).catch(() => null),
      ),
    );
  }

  await logAudit({ adminId, action: "update", entityType: "employee_contract", entityId: input.id, changes: { employeeSigned: true } });
  revalidatePath("/admin/employes/contrats");
  return { success: true };
}

// Signature employeur (un super-admin / RH valide le contrat signé par l'employé)
export async function signContractAsEmployerAction(input: { id: number; signatureData: string }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  if (!input.signatureData?.startsWith("data:image/")) return { success: false, error: "Signature invalide" };

  const contract = await prisma.employeeContract.findUnique({ where: { id: input.id } });
  if (!contract) return { success: false, error: "Contrat introuvable" };
  if (contract.employerSignedAt) return { success: false, error: "Déjà signé par l'employeur" };

  const h = await headers().catch(() => null);
  const ip = getClientIpFromHeaders(h);

  await prisma.employeeContract.update({
    where: { id: input.id },
    data: {
      employerSignatureData: input.signatureData,
      employerSignedAt: new Date(),
      employerSignedIp: ip,
      employerAdminId: actorId,
      status: contract.employeeSignedAt ? "active" : "signed_employer",
    },
  });

  // Notifier l'employé que son contrat est maintenant actif (les deux signatures sont apposées)
  const finalized = await prisma.employeeContract.findUnique({
    where: { id: input.id },
    select: { adminId: true, title: true },
  });
  if (finalized) {
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: finalized.adminId,
        type: "success",
        title: "Contrat actif",
        body: `Votre contrat est maintenant signé par les deux parties : ${finalized.title}`,
        link: "/admin/mon-espace/contrats",
        icon: "check-circle",
      },
    }).catch(() => null);
  }

  await logAudit({ adminId: actorId, action: "update", entityType: "employee_contract", entityId: input.id, changes: { employerSigned: true } });
  revalidatePath("/admin/employes/contrats");
  return { success: true };
}

export async function terminateContractAction(input: { id: number; reason: string }): Promise<Result> {
  const actorId = await requireHrWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  if (!input.reason?.trim()) return { success: false, error: "Motif obligatoire" };

  await prisma.employeeContract.update({
    where: { id: input.id },
    data: {
      status: "terminated",
      terminatedAt: new Date(),
      terminationReason: input.reason.slice(0, 500),
    },
  });
  await logAudit({ adminId: actorId, action: "update", entityType: "employee_contract", entityId: input.id, changes: { terminated: true, reason: input.reason } });
  revalidatePath("/admin/employes/contrats");
  return { success: true };
}

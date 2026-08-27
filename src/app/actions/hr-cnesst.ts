"use server";
// CNESST — déclaration d'accident du travail (Québec, obligatoire <24h).
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

const incidentSchema = z.object({
  id: z.number().int().optional(),
  adminId: z.number().int(),
  incidentDate: z.string(),
  location: z.string().min(1).max(200),
  description: z.string().min(10).max(4000),
  injuryType: z.string().max(200).nullable().optional(),
  bodyPart: z.string().max(120).nullable().optional(),
  witnessName: z.string().max(200).nullable().optional(),
  cnesstFileNumber: z.string().max(60).nullable().optional(),
  reportedToCnesstAt: z.string().nullable().optional(),
  daysAbsent: z.number().int().min(0).nullable().optional(),
  returnedToWorkAt: z.string().nullable().optional(),
  status: z.enum(["declared", "accepted", "refused", "closed"]).default("declared"),
  notes: z.string().max(2000).nullable().optional(),
});

export async function upsertCnesstIncidentAction(input: z.infer<typeof incidentSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  if (!(await hasSafetyWrite(session.user.adminId!))) return { success: false, error: t("non_autorise_sst_rh_requis") };
  const actorId = session.user.adminId!;

  const parsed = incidentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const data = {
    adminId: parsed.data.adminId,
    reportedBy: actorId,
    incidentDate: new Date(parsed.data.incidentDate),
    location: parsed.data.location,
    description: parsed.data.description,
    injuryType: parsed.data.injuryType ?? null,
    bodyPart: parsed.data.bodyPart ?? null,
    witnessName: parsed.data.witnessName ?? null,
    cnesstFileNumber: parsed.data.cnesstFileNumber ?? null,
    reportedToCnesstAt: parsed.data.reportedToCnesstAt ? new Date(parsed.data.reportedToCnesstAt) : null,
    daysAbsent: parsed.data.daysAbsent ?? null,
    returnedToWorkAt: parsed.data.returnedToWorkAt ? new Date(parsed.data.returnedToWorkAt) : null,
    status: parsed.data.status,
    notes: parsed.data.notes ?? null,
  };

  const row = parsed.data.id
    ? await prisma.cnesstIncident.update({ where: { id: parsed.data.id }, data, select: { id: true } })
    : await prisma.cnesstIncident.create({ data, select: { id: true } });

  // Alerte critique aux super-admins si nouvelle déclaration
  if (!parsed.data.id) {
    const superAdmins = await prisma.admin.findMany({
      where: { customRole: { name: "super_admin" }, isActive: true },
      select: { id: true },
    });
    for (const sa of superAdmins) {
      await prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: sa.id,
          type: "error",
          title: t("nouvelle_declaration_cnesst"),
          body: `Accident déclaré le ${data.incidentDate.toLocaleDateString("fr-CA")} · ${data.location}`,
          link: "/admin/employes/cnesst",
          icon: "alert-triangle",
        },
      }).catch(() => null);
    }
    await logSecurityEvent({
      adminId: actorId,
      type: "suspicious_login", // pas de type cnesst — on réutilise pour visibilité critique
      severity: "critical",
      message: `Déclaration CNESST créée pour admin#${parsed.data.adminId} · ${parsed.data.location}`,
      metadata: { incidentId: row.id, adminId: parsed.data.adminId },
    }).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: parsed.data.id ? "update" : "create",
    entityType: "cnesst_incident",
    entityId: row.id,
    changes: { adminId: parsed.data.adminId, location: parsed.data.location },
  });
  revalidatePath("/admin/employes/cnesst");
  return { success: true, data: { id: row.id } };
}

export async function deleteCnesstIncidentAction(input: { id: number }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  if (!(await hasSafetyWrite(session.user.adminId!))) return { success: false, error: t("non_autorise_sst_rh_requis") };
  const me = await prisma.admin.findUnique({ where: { id: session.user.adminId! }, include: { customRole: true } });
  if (me?.customRole?.name !== "super_admin") {
    return { success: false, error: t("seul_un_super_admin_peut_supprimer_une") };
  }
  await prisma.cnesstIncident.delete({ where: { id: input.id } });
  await logAudit({ adminId: me.id, action: "delete", entityType: "cnesst_incident", entityId: input.id });
  revalidatePath("/admin/employes/cnesst");
  return { success: true };
}

export async function markCnesstReportedAction(input: { id: number; date?: string }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  if (!(await hasSafetyWrite(session.user.adminId!))) return { success: false, error: t("non_autorise_sst_rh_requis") };
  const actorId = session.user.adminId!;
  try {
    const reportedAt = input.date ? new Date(input.date) : new Date();
    if (isNaN(reportedAt.getTime())) return { success: false, error: "Date invalide" };
    await prisma.cnesstIncident.update({
      where: { id: input.id },
      data: { reportedToCnesstAt: reportedAt },
    });
    await logAudit({
      adminId: actorId,
      action: "update",
      entityType: "cnesst_incident",
      entityId: input.id,
      changes: { reportedToCnesstAt: reportedAt.toISOString() },
    });
    revalidatePath("/admin/employes/cnesst");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

export async function markCnesstReturnedAction(input: { id: number; date: string }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  if (!(await hasSafetyWrite(session.user.adminId!))) return { success: false, error: t("non_autorise_sst_rh_requis") };
  const actorId = session.user.adminId!;
  try {
    const returnedAt = new Date(input.date);
    if (isNaN(returnedAt.getTime())) return { success: false, error: "Date invalide" };
    await prisma.cnesstIncident.update({
      where: { id: input.id },
      data: { returnedToWorkAt: returnedAt },
    });
    await logAudit({
      adminId: actorId,
      action: "update",
      entityType: "cnesst_incident",
      entityId: input.id,
      changes: { returnedToWorkAt: returnedAt.toISOString() },
    });
    revalidatePath("/admin/employes/cnesst");
    return { success: true };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Erreur" };
  }
}

// Garde SST : super_admin / users.write / hr.write / safety.write.
async function hasSafetyWrite(adminId: number): Promise<boolean> {
  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!me) return false;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  return me.customRole?.name === "super_admin"
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write")
    || (perms.safety ?? []).includes("write");
}

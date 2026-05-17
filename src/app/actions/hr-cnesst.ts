"use server";
// CNESST — déclaration d'accident du travail (Québec, obligatoire <24h).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";

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
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const actorId = session.user.adminId!;

  const parsed = incidentSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

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
          title: "⚠️ Nouvelle déclaration CNESST",
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
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const me = await prisma.admin.findUnique({ where: { id: session.user.adminId! }, include: { customRole: true } });
  if (me?.customRole?.name !== "super_admin") {
    return { success: false, error: "Seul un super-admin peut supprimer une déclaration CNESST" };
  }
  await prisma.cnesstIncident.delete({ where: { id: input.id } });
  await logAudit({ adminId: me.id, action: "delete", entityType: "cnesst_incident", entityId: input.id });
  revalidatePath("/admin/employes/cnesst");
  return { success: true };
}

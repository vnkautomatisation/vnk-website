"use server";
// Workflow demandes de congé (vacances, maladie, parental).
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { calculateWorkingDays } from "@/lib/services/leave-days";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireLeavesReview(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return (isSuper || (perms.leaves ?? []).includes("write") || (perms.users ?? []).includes("write")) ? adminId : null;
}

const requestSchema = z.object({
  type: z.enum(["vacation", "sick", "parental", "unpaid", "bereavement", "other"]),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(500).nullable().optional(),
});

export async function createLeaveRequestAction(input: z.infer<typeof requestSchema>): Promise<Result<{ id: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { success: false, error: "Dates invalides" };
  if (end < start) return { success: false, error: "Fin avant début" };
  // Calcul serveur : exclut weekends + jours fériés QC (table Holiday)
  const days = await calculateWorkingDays(start, end);
  if (days <= 0) return { success: false, error: "Aucun jour ouvrable dans la plage sélectionnée" };

  const r = await prisma.leaveRequest.create({
    data: {
      adminId,
      type: parsed.data.type,
      startDate: start,
      endDate: end,
      daysCount: days,
      reason: parsed.data.reason ?? null,
      status: "pending",
    },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "leave_request", entityId: r.id });

  // Notifier les managers + super_admins
  const supervisors = await prisma.admin.findMany({
    where: {
      OR: [
        { customRole: { name: "super_admin" } },
        { directReports: { some: { id: adminId } } },
      ],
      isActive: true,
    },
    select: { id: true },
  });
  for (const s of supervisors) {
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: s.id,
        type: "info",
        title: "Nouvelle demande de congé",
        body: `${parsed.data.type} · ${days} jour${days > 1 ? "s" : ""} · du ${start.toLocaleDateString("fr-CA")} au ${end.toLocaleDateString("fr-CA")}`,
        link: "/admin/employes/conges",
        icon: "calendar",
      },
    }).catch(() => null);
  }

  revalidatePath("/admin/employes/conges");
  return { success: true, data: { id: r.id } };
}

export async function reviewLeaveRequestAction(input: { id: number; decision: "approved" | "rejected"; notes?: string }): Promise<Result> {
  const reviewerId = await requireLeavesReview();
  if (!reviewerId) return { success: false, error: "Non autorisé" };

  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };
  if (r.status !== "pending") return { success: false, error: "Déjà traitée" };

  await prisma.leaveRequest.update({
    where: { id: input.id },
    data: {
      status: input.decision,
      reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.notes?.slice(0, 500) ?? null,
    },
  });

  // Notifier le demandeur
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: r.adminId,
      type: input.decision === "approved" ? "success" : "warning",
      title: input.decision === "approved" ? "Demande de congé approuvée" : "Demande de congé refusée",
      body: input.notes || `Statut : ${input.decision === "approved" ? "approuvée" : "refusée"}`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  await logSecurityEvent({
    adminId: r.adminId,
    type: "profile_updated",
    severity: "info",
    message: `Demande de congé ${input.decision === "approved" ? "approuvée" : "refusée"}`,
    metadata: { leaveRequestId: input.id, decision: input.decision, by: reviewerId },
  });

  await logAudit({ adminId: reviewerId, action: "update", entityType: "leave_request", entityId: input.id, changes: { decision: input.decision } });
  revalidatePath("/admin/employes/conges");
  return { success: true };
}

export async function cancelLeaveRequestAction(input: { id: number }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Introuvable" };
  if (r.adminId !== adminId) return { success: false, error: "Vous ne pouvez annuler que vos propres demandes" };
  if (r.status === "rejected") return { success: false, error: "Demande déjà refusée" };

  await prisma.leaveRequest.update({
    where: { id: input.id },
    data: { status: "cancelled" },
  });
  await logAudit({ adminId, action: "update", entityType: "leave_request", entityId: input.id, changes: { cancelled: true } });
  revalidatePath("/admin/employes/conges");
  return { success: true };
}

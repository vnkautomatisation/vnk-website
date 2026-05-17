"use server";
// Actions pointage horaire employé.
// L'employé pointe lui-même son entrée/sortie ; un superviseur peut approuver.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requirePayrollWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return (isSuper || (perms.payroll ?? []).includes("write") || (perms.users ?? []).includes("write")) ? adminId : null;
}

// ── Clock-in ────────────────────────────────────────────────
export async function clockInAction(input: { category?: string; notes?: string }): Promise<Result<{ id: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  // Vérifier qu'il n'y a pas déjà un pointage ouvert
  const open = await prisma.timeClock.findFirst({
    where: { adminId, clockOut: null },
  });
  if (open) return { success: false, error: "Vous avez déjà un pointage ouvert — fermez-le d'abord" };

  const cat = ["work", "break", "meeting", "training"].includes(input.category ?? "") ? input.category! : "work";
  const tc = await prisma.timeClock.create({
    data: {
      adminId,
      clockIn: new Date(),
      category: cat,
      notes: input.notes?.slice(0, 500) ?? null,
    },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "time_clock", entityId: tc.id });
  revalidatePath("/admin/employes/pointage");
  return { success: true, data: { id: tc.id } };
}

// ── Clock-out ───────────────────────────────────────────────
export async function clockOutAction(): Promise<Result<{ durationMin: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  const open = await prisma.timeClock.findFirst({
    where: { adminId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (!open) return { success: false, error: "Aucun pointage ouvert" };

  const now = new Date();
  const durationMin = Math.floor((now.getTime() - open.clockIn.getTime()) / 60000);
  await prisma.timeClock.update({
    where: { id: open.id },
    data: { clockOut: now, durationMin },
  });
  await logAudit({ adminId, action: "update", entityType: "time_clock", entityId: open.id, changes: { closed: true, durationMin } });
  revalidatePath("/admin/employes/pointage");
  return { success: true, data: { durationMin } };
}

// ── Saisie manuelle d'une période ──────────────────────────
const manualSchema = z.object({
  clockIn: z.string(),
  clockOut: z.string(),
  category: z.enum(["work", "break", "meeting", "training", "sick", "vacation"]).default("work"),
  notes: z.string().max(500).nullable().optional(),
});

export async function manualTimeEntryAction(input: z.infer<typeof manualSchema>): Promise<Result<{ id: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const ci = new Date(parsed.data.clockIn);
  const co = new Date(parsed.data.clockOut);
  if (isNaN(ci.getTime()) || isNaN(co.getTime())) return { success: false, error: "Dates invalides" };
  if (co <= ci) return { success: false, error: "Sortie doit être après entrée" };
  if (co.getTime() - ci.getTime() > 24 * 60 * 60 * 1000) return { success: false, error: "Période > 24h refusée" };

  const durationMin = Math.floor((co.getTime() - ci.getTime()) / 60000);
  const tc = await prisma.timeClock.create({
    data: {
      adminId,
      clockIn: ci,
      clockOut: co,
      durationMin,
      category: parsed.data.category,
      notes: parsed.data.notes ?? null,
    },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "time_clock", entityId: tc.id, changes: { manual: true } });
  revalidatePath("/admin/employes/pointage");
  return { success: true, data: { id: tc.id } };
}

// ── Suppression par l'employé (uniquement si non approuvé/non payé) ──
export async function deleteTimeClockAction(input: { id: number }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  const tc = await prisma.timeClock.findUnique({ where: { id: input.id } });
  if (!tc) return { success: false, error: "Introuvable" };
  if (tc.adminId !== adminId) return { success: false, error: "Vous ne pouvez supprimer que vos propres entrées" };
  if (tc.approvedAt) return { success: false, error: "Approuvée — non modifiable" };
  if (tc.payStubId) return { success: false, error: "Déjà sur un bulletin de paie" };

  await prisma.timeClock.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "time_clock", entityId: input.id });
  revalidatePath("/admin/employes/pointage");
  return { success: true };
}

// ── Approbation par superviseur ────────────────────────────
export async function approveTimeClockAction(input: { ids: number[] }): Promise<Result<{ approved: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé (rôle paie/RH requis)" };
  if (!Array.isArray(input.ids) || input.ids.length === 0) return { success: false, error: "Aucune entrée fournie" };

  const r = await prisma.timeClock.updateMany({
    where: { id: { in: input.ids }, approvedAt: null, payStubId: null },
    data: { approvedBy: actorId, approvedAt: new Date() },
  });
  await logAudit({ adminId: actorId, action: "update", entityType: "time_clock_bulk", changes: { approved: r.count, ids: input.ids } });
  revalidatePath("/admin/employes/pointage");
  return { success: true, data: { approved: r.count } };
}

// ── Rejet (renvoie à l'employé) ────────────────────────────
export async function rejectTimeClockAction(input: { id: number; reason: string }): Promise<Result> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  const tc = await prisma.timeClock.findUnique({ where: { id: input.id } });
  if (!tc) return { success: false, error: "Introuvable" };
  if (tc.payStubId) return { success: false, error: "Déjà sur un bulletin — débloquer le bulletin d'abord" };
  await prisma.timeClock.update({
    where: { id: input.id },
    data: { approvedAt: null, approvedBy: null, notes: `[REJET ${new Date().toISOString().slice(0,10)}] ${input.reason}\n${tc.notes ?? ""}`.slice(0, 500) },
  });
  await logAudit({ adminId: actorId, action: "update", entityType: "time_clock", entityId: input.id, changes: { rejected: true, reason: input.reason } });
  revalidatePath("/admin/employes/pointage");
  return { success: true };
}

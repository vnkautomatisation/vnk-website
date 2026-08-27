"use server";
// Actions CRUD pour les codes de tache (JobCode) lies aux postes.
// Chaque poste a sa propre liste de codes (comptable / programmeur / etc.).
// Le pointage exige obligatoirement un code au clock-in.
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireUsersWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return (isSuper || (perms.users ?? []).includes("write") || (perms.payroll ?? []).includes("write") || (perms.timeclock ?? []).includes("write") || (perms.hr ?? []).includes("write")) ? adminId : null;
}

function revalidateAll() {
  revalidatePath("/admin/employes/codes-taches");
  revalidatePath("/admin/employes/postes");
  revalidatePath("/admin/mon-espace");
  revalidatePath("/admin/mon-espace/pointage");
}

// ─── Create ────────────────────────────────────────────────
const createSchema = z.object({
  code: z.string().min(1).max(40).regex(/^[A-Z0-9-_]+$/, "code_lettres_maj_chiffres_et_seulement"),
  label: z.string().min(1).max(120),
  positionId: z.number().int().positive(),
  sortOrder: z.number().int().optional(),
});

export async function createJobCodeAction(input: z.infer<typeof createSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const actorId = await requireUsersWrite();
  if (!actorId) return unauthorized();
  const parsed = createSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Verifier unicite du code (global)
  const existing = await prisma.jobCode.findUnique({ where: { code: parsed.data.code } });
  if (existing) return { success: false, error: `Le code "${parsed.data.code}" existe déjà` };

  // Verifier que la position existe
  const pos = await prisma.position.findUnique({ where: { id: parsed.data.positionId } });
  if (!pos) return { success: false, error: "Poste introuvable" };

  const created = await prisma.jobCode.create({
    data: {
      code: parsed.data.code,
      label: parsed.data.label,
      positionId: parsed.data.positionId,
      sortOrder: parsed.data.sortOrder ?? 0,
    },
    select: { id: true },
  });
  await logAudit({ adminId: actorId, action: "create", entityType: "job_code", entityId: created.id, changes: { ...parsed.data } });
  revalidateAll();
  return { success: true, data: { id: created.id } };
}

// ─── Update ────────────────────────────────────────────────
const updateSchema = z.object({
  id: z.number().int().positive(),
  code: z.string().min(1).max(40).regex(/^[A-Z0-9-_]+$/).optional(),
  label: z.string().min(1).max(120).optional(),
  positionId: z.number().int().positive().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export async function updateJobCodeAction(input: z.infer<typeof updateSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const actorId = await requireUsersWrite();
  if (!actorId) return unauthorized();
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const existing = await prisma.jobCode.findUnique({ where: { id: parsed.data.id } });
  if (!existing) return { success: false, error: "Code introuvable" };

  // Si on change le code, verifier unicite
  if (parsed.data.code && parsed.data.code !== existing.code) {
    const dup = await prisma.jobCode.findUnique({ where: { code: parsed.data.code } });
    if (dup) return { success: false, error: `Le code "${parsed.data.code}" existe déjà` };
  }

  await prisma.jobCode.update({
    where: { id: parsed.data.id },
    data: {
      ...(parsed.data.code !== undefined ? { code: parsed.data.code } : {}),
      ...(parsed.data.label !== undefined ? { label: parsed.data.label } : {}),
      ...(parsed.data.positionId !== undefined ? { positionId: parsed.data.positionId } : {}),
      ...(parsed.data.isActive !== undefined ? { isActive: parsed.data.isActive } : {}),
      ...(parsed.data.sortOrder !== undefined ? { sortOrder: parsed.data.sortOrder } : {}),
    },
  });
  await logAudit({ adminId: actorId, action: "update", entityType: "job_code", entityId: parsed.data.id, changes: parsed.data });
  revalidateAll();
  return { success: true };
}

// ─── Delete ────────────────────────────────────────────────
export async function deleteJobCodeAction(input: { id: number }): Promise<Result> {
  const actorId = await requireUsersWrite();
  if (!actorId) return unauthorized();

  const existing = await prisma.jobCode.findUnique({
    where: { id: input.id },
    include: { _count: { select: { timeClocks: true } } },
  });
  if (!existing) return { success: false, error: "Introuvable" };
  if (existing._count.timeClocks > 0) {
    return { success: false, error: `Impossible de supprimer : ${existing._count.timeClocks} pointage(s) lié(s). Désactivez-le plutôt.` };
  }

  await prisma.jobCode.delete({ where: { id: input.id } });
  await logAudit({ adminId: actorId, action: "delete", entityType: "job_code", entityId: input.id });
  revalidateAll();
  return { success: true };
}

// ─── Toggle isActive (raccourci) ─────────────────────────────
export async function toggleJobCodeActiveAction(input: { id: number }): Promise<Result<{ isActive: boolean }>> {
  const actorId = await requireUsersWrite();
  if (!actorId) return unauthorized();
  const existing = await prisma.jobCode.findUnique({ where: { id: input.id } });
  if (!existing) return { success: false, error: "Introuvable" };
  const next = !existing.isActive;
  await prisma.jobCode.update({ where: { id: input.id }, data: { isActive: next } });
  await logAudit({ adminId: actorId, action: "update", entityType: "job_code", entityId: input.id, changes: { isActive: next } });
  revalidateAll();
  return { success: true, data: { isActive: next } };
}

"use server";
// CRUD politiques de conges (LeavePolicy) — admin only.
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function requireAdminWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!me) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = me.customRole?.name === "super_admin";
  return (isSuper || (perms.users ?? []).includes("write") || (perms.leaves ?? []).includes("write")) ? adminId : null;
}

const policySchema = z.object({
  name: z.string().min(2).max(100),
  referenceMonthStart: z.number().int().min(1).max(12).default(5),
  accrualRateBelow3y: z.number().min(0).max(20).default(4),
  accrualRateAbove3y: z.number().min(0).max(20).default(6),
  vacationNoticeDays: z.number().int().min(0).max(90).default(7),
  minConsecutiveDays: z.number().int().min(0).max(30).default(1),
  maxConsecutiveDays: z.number().int().min(1).max(365).default(30),
  carryOverDays: z.number().int().min(0).max(365).default(0),
  carryOverMonths: z.number().int().min(1).max(36).default(12),
  sickDaysPerYear: z.number().int().min(0).max(365).nullable().optional(),
  personalDaysPerYear: z.number().int().min(0).max(365).nullable().optional(),
  isDefault: z.boolean().default(false),
});

export async function createLeavePolicyAction(input: z.infer<typeof policySchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return unauthorized();
  const parsed = policySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // S'il y a un default, le decoche d'abord
  if (parsed.data.isDefault) {
    await prisma.leavePolicy.updateMany({ where: { isDefault: true }, data: { isDefault: false } });
  }
  const row = await prisma.leavePolicy.create({
    data: parsed.data,
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "leave_policy", entityId: row.id });
  revalidatePath("/admin/employes/conges/politiques");
  return { success: true, data: { id: row.id } };
}

export async function updateLeavePolicyAction(input: { id: number } & Partial<z.infer<typeof policySchema>>): Promise<Result> {
  const adminId = await requireAdminWrite();
  if (!adminId) return unauthorized();
  const { id, ...rest } = input;
  if (rest.isDefault) {
    await prisma.leavePolicy.updateMany({ where: { isDefault: true, id: { not: id } }, data: { isDefault: false } });
  }
  await prisma.leavePolicy.update({ where: { id }, data: rest });
  await logAudit({ adminId, action: "update", entityType: "leave_policy", entityId: id });
  revalidatePath("/admin/employes/conges/politiques");
  return { success: true };
}

export async function deleteLeavePolicyAction(input: { id: number }): Promise<Result> {
  const adminId = await requireAdminWrite();
  if (!adminId) return unauthorized();
  // Detache d'abord les admins lies
  await prisma.admin.updateMany({ where: { leavePolicyId: input.id }, data: { leavePolicyId: null } });
  await prisma.leavePolicy.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "leave_policy", entityId: input.id });
  revalidatePath("/admin/employes/conges/politiques");
  return { success: true };
}

export async function assignPolicyToAdminAction(input: { adminId: number; policyId: number | null }): Promise<Result> {
  const actorId = await requireAdminWrite();
  if (!actorId) return unauthorized();
  await prisma.admin.update({
    where: { id: input.adminId },
    data: { leavePolicyId: input.policyId },
  });
  await logAudit({ adminId: actorId, action: "update", entityType: "admin", entityId: input.adminId, changes: { leavePolicyId: input.policyId } });
  revalidatePath("/admin/employes/conges/politiques");
  return { success: true };
}

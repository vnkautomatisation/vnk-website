"use server";
// Actions évaluations performance + 1-on-1.
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

async function getMe(): Promise<{ id: number; isHr: boolean } | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const id = session.user.adminId!;
  const me = await prisma.admin.findUnique({ where: { id }, include: { customRole: true } });
  if (!me) return null;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr = me.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write") || (perms.users ?? []).includes("write") || (perms.performance ?? []).includes("write");
  return { id, isHr };
}

// ═══════════════════════════════════════════════════════════
// PERFORMANCE REVIEWS
// ═══════════════════════════════════════════════════════════
const reviewCreateSchema = z.object({
  adminId: z.number().int(),
  reviewerId: z.number().int(),
  periodStart: z.string(),
  periodEnd: z.string(),
});

export async function createPerformanceReviewAction(input: z.infer<typeof reviewCreateSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const me = await getMe();
  if (!me || !me.isHr) return unauthorized();
  const parsed = reviewCreateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Org-chart rule: the reviewer can never be the reviewed employee.
  if (parsed.data.adminId === parsed.data.reviewerId) {
    return { success: false, error: t("l_evaluateur_ne_peut_pas_etre_l") };
  }

  const r = await prisma.performanceReview.create({
    data: {
      adminId: parsed.data.adminId,
      reviewerId: parsed.data.reviewerId,
      periodStart: new Date(parsed.data.periodStart),
      periodEnd: new Date(parsed.data.periodEnd),
      status: "draft",
    },
    select: { id: true },
  });
  await logAudit({ adminId: me.id, action: "create", entityType: "performance_review", entityId: r.id });
  revalidatePath("/admin/employes/evaluations");
  return { success: true, data: { id: r.id } };
}

const reviewUpdateSchema = z.object({
  id: z.number().int(),
  rating: z.number().int().min(1).max(10).nullable().optional(),
  strengths: z.string().max(4000).nullable().optional(),
  improvements: z.string().max(4000).nullable().optional(),
  objectivesNext: z.string().max(4000).nullable().optional(),
  managerComments: z.string().max(4000).nullable().optional(),
  employeeComments: z.string().max(4000).nullable().optional(),
  status: z.enum(["draft", "submitted", "reviewed", "acknowledged", "closed"]).optional(),
});

export async function updatePerformanceReviewAction(input: z.infer<typeof reviewUpdateSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const me = await getMe();
  if (!me) return unauthorized();
  const parsed = reviewUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const review = await prisma.performanceReview.findUnique({ where: { id: parsed.data.id } });
  if (!review) return { success: false, error: "Introuvable" };

  const isReviewer = review.reviewerId === me.id;
  const isEmployee = review.adminId === me.id;
  if (!me.isHr && !isReviewer && !isEmployee) return unauthorized();

  // Org-chart rule: even an HR admin cannot grade/submit their OWN review —
  // only their superior can. Founder is the sole exception (no superior).
  const { isFounder } = await import("@/lib/services/org-guard");
  const founderException = isEmployee ? await isFounder(me.id) : false;
  const canManage = (me.isHr || isReviewer) && (!isEmployee || founderException);

  const data: Record<string, unknown> = {};
  // Manager fields (HR ou reviewer, jamais sur sa propre évaluation)
  if (canManage) {
    if (parsed.data.rating !== undefined) data.rating = parsed.data.rating;
    if (parsed.data.strengths !== undefined) data.strengths = parsed.data.strengths;
    if (parsed.data.improvements !== undefined) data.improvements = parsed.data.improvements;
    if (parsed.data.objectivesNext !== undefined) data.objectivesNext = parsed.data.objectivesNext;
    if (parsed.data.managerComments !== undefined) data.managerComments = parsed.data.managerComments;
  }
  // Employee fields
  if (isEmployee && (review.status === "submitted" || review.status === "reviewed")) {
    if (parsed.data.employeeComments !== undefined) data.employeeComments = parsed.data.employeeComments;
  }
  // Status transitions
  if (parsed.data.status) {
    if (parsed.data.status === "submitted" && canManage) {
      data.status = "submitted";
      data.submittedAt = new Date();
    } else if (parsed.data.status === "acknowledged" && isEmployee) {
      data.status = "acknowledged";
      data.acknowledgedAt = new Date();
      // Notifier le reviewer
      await prisma.notification.create({
        data: {
          recipientType: "admin", recipientId: review.reviewerId,
          type: "success", title: t("evaluation_reconnue"),
          body: `L'employé a pris connaissance de l'évaluation`,
          link: `/admin/employes/evaluations`,
        },
      }).catch(() => null);
    } else if (parsed.data.status === "closed" && me.isHr && (!isEmployee || founderException)) {
      data.status = "closed";
    }
  }

  await prisma.performanceReview.update({ where: { id: parsed.data.id }, data: data as never });
  await logAudit({ adminId: me.id, action: "update", entityType: "performance_review", entityId: parsed.data.id });
  revalidatePath("/admin/employes/evaluations");
  revalidatePath("/admin/mon-espace/evaluations");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════
// 1-ON-1 MEETINGS
// ═══════════════════════════════════════════════════════════
const oneOnOneSchema = z.object({
  id: z.number().int().optional(),
  adminId: z.number().int(),
  managerId: z.number().int(),
  scheduledAt: z.string(),
  durationMin: z.number().int().min(15).max(240).default(30),
  agenda: z.string().max(4000).nullable().optional(),
  notes: z.string().max(8000).nullable().optional(),
  privateNotes: z.string().max(4000).nullable().optional(),
  actionItems: z.array(z.object({
    text: z.string(),
    owner: z.enum(["employee", "manager"]).optional(),
    dueDate: z.string().optional(),
    done: z.boolean().default(false),
  })).optional(),
  status: z.enum(["scheduled", "held", "cancelled", "rescheduled"]).optional(),
});

export async function upsertOneOnOneAction(input: z.infer<typeof oneOnOneSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const me = await getMe();
  if (!me) return unauthorized();
  const parsed = oneOnOneSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Auth : manager OU employé du meeting
  const isParticipant = me.id === parsed.data.managerId || me.id === parsed.data.adminId;
  if (!me.isHr && !isParticipant) return unauthorized();

  const data = {
    adminId: parsed.data.adminId,
    managerId: parsed.data.managerId,
    scheduledAt: new Date(parsed.data.scheduledAt),
    durationMin: parsed.data.durationMin,
    agenda: parsed.data.agenda ?? null,
    notes: parsed.data.notes ?? null,
    actionItems: (parsed.data.actionItems ?? []) as never,
    status: parsed.data.status ?? "scheduled",
    heldAt: parsed.data.status === "held" ? new Date() : undefined,
    // privateNotes : visible manager seulement
    privateNotes: me.id === parsed.data.managerId ? parsed.data.privateNotes ?? null : undefined,
  };

  const row = parsed.data.id
    ? await prisma.oneOnOneMeeting.update({ where: { id: parsed.data.id }, data: data as never, select: { id: true } })
    : await prisma.oneOnOneMeeting.create({ data: data as never, select: { id: true } });

  await logAudit({ adminId: me.id, action: parsed.data.id ? "update" : "create", entityType: "one_on_one", entityId: row.id });
  revalidatePath("/admin/employes/one-on-ones");
  revalidatePath("/admin/mon-espace/one-on-ones");
  return { success: true, data: { id: row.id } };
}

// ═══════════════════════════════════════════════════════════
// SALAIRES & BONUS
// ═══════════════════════════════════════════════════════════
const salarySchema = z.object({
  adminId: z.number().int(),
  effectiveDate: z.string(),
  type: z.enum(["initial", "raise", "promotion", "adjustment", "bonus_base", "demotion"]),
  salaryAnnual: z.number().nullable().optional(),
  hourlyRate: z.number().nullable().optional(),
  reason: z.string().max(500).nullable().optional(),
});

export async function addSalaryHistoryAction(input: z.infer<typeof salarySchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const me = await getMe();
  if (!me || !me.isHr) return { success: false, error: t("non_autorise_reserve_rh_super_admin") };
  const parsed = salarySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const row = await prisma.salaryHistory.create({
    data: {
      adminId: parsed.data.adminId,
      effectiveDate: new Date(parsed.data.effectiveDate),
      type: parsed.data.type,
      salaryAnnual: parsed.data.salaryAnnual ?? null,
      hourlyRate: parsed.data.hourlyRate ?? null,
      reason: parsed.data.reason ?? null,
      approvedBy: me.id,
    },
    select: { id: true },
  });
  await logAudit({ adminId: me.id, action: "create", entityType: "salary_history", entityId: row.id });
  revalidatePath("/admin/employes/compensation");
  return { success: true, data: { id: row.id } };
}

const bonusSchema = z.object({
  adminId: z.number().int(),
  type: z.enum(["annual_bonus", "spot_bonus", "commission", "sign_on", "referral", "retention"]),
  amount: z.number().positive(),
  reason: z.string().max(500).nullable().optional(),
  awardedAt: z.string(),
});

export async function addBonusAction(input: z.infer<typeof bonusSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const me = await getMe();
  if (!me || !me.isHr) return unauthorized();
  const parsed = bonusSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const row = await prisma.bonusRecord.create({
    data: {
      adminId: parsed.data.adminId,
      type: parsed.data.type,
      amount: parsed.data.amount,
      reason: parsed.data.reason ?? null,
      awardedAt: new Date(parsed.data.awardedAt),
      approvedBy: me.id,
    },
    select: { id: true },
  });

  // Notifier l'employé
  await prisma.notification.create({
    data: {
      recipientType: "admin", recipientId: parsed.data.adminId,
      type: "success", title: t("bonus_accorde"),
      body: `Un bonus de ${parsed.data.amount.toFixed(2)} $ vous a été accordé`,
      link: "/admin/mon-espace/paie",
      icon: "gift",
    },
  }).catch(() => null);

  await logAudit({ adminId: me.id, action: "create", entityType: "bonus_record", entityId: row.id });
  revalidatePath("/admin/employes/compensation");
  revalidatePath("/admin/mon-espace/paie");
  return { success: true, data: { id: row.id } };
}

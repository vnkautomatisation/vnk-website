"use server";
// Workflow demandes de congé (vacances, maladie, parental).
// Couvre : creation/modif/annulation employee, revue (approve/reject) reviewer,
// bulk actions, delegation, auto-TimeClock pour les conges payes.
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { calculateWorkingDays } from "@/lib/services/leave-days";
import { getHolidaysInRange } from "@/lib/services/holidays";
import { assertCanReviewLeave } from "@/lib/services/timesheet-scope";
import { getLeaveBalance, syncBalanceForRequest } from "@/lib/services/leave-balance";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

const ERR_NO_AUTHORITY = "vous_n_avez_pas_l_autorite_pour";

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

const TYPES = ["vacation", "sick", "parental", "unpaid", "bereavement", "other"] as const;
const HALF = ["AM", "PM"] as const;

const requestSchema = z.object({
  type: z.enum(TYPES),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(500).nullable().optional(),
  halfDay: z.enum(HALF).nullable().optional(),
});

const updateSchema = z.object({
  id: z.number().int(),
  type: z.enum(TYPES).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().max(500).nullable().optional(),
  halfDay: z.enum(HALF).nullable().optional(),
});

const PAID_LEAVE_TYPES = new Set(["vacation", "sick", "parental", "bereavement"]);

// ─── Validations ────────────────────────────────────────────────
async function validatePeriod(
  adminId: number,
  start: Date,
  end: Date,
  type: string,
  daysCount: number,
  isHalfDay: boolean,
  excludeRequestId?: number,
): Promise<string | null> {
  // 1) dates passees > 14 jours interdites (sauf super_admin)
  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const isSuper = me?.customRole?.name === "super_admin";
  const now = new Date();
  const cutoff = new Date(now.getTime() - 14 * 86400000);
  if (start < cutoff && !isSuper) {
    return "les_dates_ne_peuvent_pas_etre_14j";
  }

  // 2) chevauchement avec autre demande
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      adminId,
      status: { in: ["pending", "approved"] },
      startDate: { lte: end },
      endDate: { gte: start },
      ...(excludeRequestId ? { id: { not: excludeRequestId } } : {}),
    },
    select: { id: true, startDate: true, endDate: true },
  });
  if (overlap) {
    return `Conflit avec une demande existante du ${overlap.startDate.toLocaleDateString("fr-CA")} au ${overlap.endDate.toLocaleDateString("fr-CA")}.`;
  }

  // 3) chevauchement avec PayPeriod payee
  const paidPeriod = await prisma.payPeriod.findFirst({
    where: {
      status: "paid",
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { startDate: true, endDate: true },
  });
  if (paidPeriod) {
    return `La periode du ${paidPeriod.startDate.toLocaleDateString("fr-CA")} au ${paidPeriod.endDate.toLocaleDateString("fr-CA")} est deja payee.`;
  }

  // 4) preavis vacances
  if (type === "vacation") {
    const minNotice = 7 * 86400000;
    if (start.getTime() - now.getTime() < minNotice && !isSuper) {
      return "les_vacances_exigent_preavis_7j";
    }
  }

  // 5) solde insuffisant (vacances + halfDay = 0.5)
  if (type === "vacation") {
    const balance = await getLeaveBalance(adminId, "vacation");
    const effective = isHalfDay ? 0.5 : daysCount;
    if (balance.vacationDaysRemaining < effective) {
      return `Solde insuffisant : ${balance.vacationDaysRemaining} jours disponibles, demande de ${effective}.`;
    }
  }

  return null;
}

// ─── Detection conflits equipe (combien d'autres absents sur la periode) ─
async function detectTeamConflict(
  adminId: number,
  start: Date,
  end: Date,
): Promise<{ othersAbsent: number; teamSize: number; ratio: number; managerIds: number[] }> {
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { teamId: true, managerId: true },
  });
  if (!me) return { othersAbsent: 0, teamSize: 0, ratio: 0, managerIds: [] };

  const peers = await prisma.admin.findMany({
    where: {
      isActive: true,
      id: { not: adminId },
      OR: [
        ...(me.teamId ? [{ teamId: me.teamId }] : []),
        ...(me.managerId ? [{ managerId: me.managerId }] : []),
      ],
    },
    select: { id: true },
  });
  if (peers.length === 0) {
    return { othersAbsent: 0, teamSize: 0, ratio: 0, managerIds: me.managerId ? [me.managerId] : [] };
  }
  const overlapping = await prisma.leaveRequest.count({
    where: {
      adminId: { in: peers.map((p) => p.id) },
      status: "approved",
      startDate: { lte: end },
      endDate: { gte: start },
    },
  });
  return {
    othersAbsent: overlapping,
    teamSize: peers.length,
    ratio: overlapping / peers.length,
    managerIds: me.managerId ? [me.managerId] : [],
  };
}

export async function createLeaveRequestAction(input: z.infer<typeof requestSchema>): Promise<Result<{ id: number; warning?: string }>> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const adminId = session.user.adminId!;
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Compte inactif refuse
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { isActive: true, leaveBlockedUntil: true, leaveBlockedReason: true },
  });
  if (!me || !me.isActive) return { success: false, error: t("compte_desactive_contactez_rh") };
  // Soumissions bloquées par un admin ?
  if (me.leaveBlockedUntil && me.leaveBlockedUntil.getTime() > Date.now()) {
    const untilStr = me.leaveBlockedUntil.toLocaleDateString("fr-CA");
    const reason = me.leaveBlockedReason ? ` — ${me.leaveBlockedReason}` : "";
    return { success: false, error: `Vos soumissions de congé sont bloquées jusqu'au ${untilStr}${reason}` };
  }

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { success: false, error: "Dates invalides" };
  if (end < start) return { success: false, error: t("fin_avant_debut") };

  const isHalf = !!parsed.data.halfDay;
  if (isHalf && parsed.data.startDate !== parsed.data.endDate) {
    return { success: false, error: t("une_demi_journee_doit_avoir_la_meme") };
  }

  // Calcul serveur : exclut weekends + jours fériés QC (table Holiday)
  const fullDays = await calculateWorkingDays(start, end);
  if (fullDays <= 0) return { success: false, error: t("aucun_jour_ouvrable_dans_la_plage_selectionnee") };
  const days = isHalf ? 0.5 : fullDays;

  const err = await validatePeriod(adminId, start, end, parsed.data.type, days, isHalf);
  if (err) return { success: false, error: err };

  const r = await prisma.leaveRequest.create({
    data: {
      adminId,
      type: parsed.data.type,
      startDate: start,
      endDate: end,
      daysCount: days,
      reason: parsed.data.reason ?? null,
      status: "pending",
      halfDay: parsed.data.halfDay ?? null,
    },
    select: { id: true, type: true, daysCount: true, startDate: true, endDate: true },
  });
  await logAudit({ adminId, action: "create", entityType: "leave_request", entityId: r.id });

  // Met a jour le balance (plannedDays += days) pour les vacances
  if (parsed.data.type === "vacation") {
    await syncBalanceForRequest(adminId, "vacation", { id: r.id, daysCount: days, status: "pending" }, "create").catch(() => null);
  }

  // Detection conflit equipe
  const conflict = await detectTeamConflict(adminId, start, end);
  const conflictWarning = conflict.ratio > 0.3 && conflict.othersAbsent >= 1
    ? t("n_autres_membres_absents", { count: conflict.othersAbsent })
    : undefined;

  // Notifier les managers + super_admins (createMany batche)
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
  if (supervisors.length > 0) {
    const conflictNote = conflictWarning ? ` Attention : Conflit potentiel : ${conflictWarning}` : "";
    await prisma.notification.createMany({
      data: supervisors.map((s) => ({
        recipientType: "admin",
        recipientId: s.id,
        type: conflictWarning ? "warning" : "info",
        title: t("nouvelle_demande_de_conge"),
        body: `${parsed.data.type} · ${days} jour${days > 1 ? "s" : ""} · du ${start.toLocaleDateString("fr-CA")} au ${end.toLocaleDateString("fr-CA")}${conflictNote}`,
        link: "/admin/employes/conges",
        icon: "calendar",
      })),
      skipDuplicates: true,
    }).catch(() => null);
  }

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true, data: { id: r.id, warning: conflictWarning } };
}

// Helper : si auteur modifie sa demande pending
export async function updateLeaveRequestAction(input: z.infer<typeof updateSchema>): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const adminId = session.user.adminId!;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const r = await prisma.leaveRequest.findUnique({ where: { id: parsed.data.id } });
  if (!r) return { success: false, error: "Demande introuvable" };
  if (r.adminId !== adminId) return { success: false, error: t("vous_ne_pouvez_modifier_que_vos_propres_2") };
  if (r.status !== "pending") return { success: false, error: t("seules_les_demandes_en_attente_sont_modifiables") };

  const start = parsed.data.startDate ? new Date(parsed.data.startDate) : r.startDate;
  const end = parsed.data.endDate ? new Date(parsed.data.endDate) : r.endDate;
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { success: false, error: "Dates invalides" };
  if (end < start) return { success: false, error: "Fin avant debut" };

  const type = parsed.data.type ?? r.type;
  const halfDayNext = parsed.data.halfDay !== undefined ? parsed.data.halfDay : r.halfDay;
  const isHalf = !!halfDayNext;
  if (isHalf && start.toDateString() !== end.toDateString()) {
    return { success: false, error: t("une_demi_journee_doit_avoir_la_meme") };
  }

  const fullDays = await calculateWorkingDays(start, end);
  if (fullDays <= 0) return { success: false, error: t("aucun_jour_ouvrable_dans_la_plage_selectionnee") };
  const days = isHalf ? 0.5 : fullDays;

  const err = await validatePeriod(adminId, start, end, type, days, isHalf, r.id);
  if (err) return { success: false, error: err };

  await prisma.leaveRequest.update({
    where: { id: r.id },
    data: {
      type,
      startDate: start,
      endDate: end,
      daysCount: days,
      reason: parsed.data.reason ?? r.reason,
      halfDay: halfDayNext,
    },
  });
  await logAudit({ adminId, action: "update", entityType: "leave_request", entityId: r.id });

  // Resync balance
  if (type === "vacation" || r.type === "vacation") {
    await syncBalanceForRequest(adminId, "vacation", { id: r.id, daysCount: days, status: "pending" }, "update", Number(r.daysCount)).catch(() => null);
  }

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// Cree des TimeClock auto pour les conges payes (vacation/sick/parental/bereavement).
// Note prefixee pour permettre la suppression ulterieure.
function autoLeaveNote(leaveId: number): string {
  return `[CONGÉ AUTO - LeaveRequest #${leaveId}]`;
}

function isoDay(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

async function createAutoTimeClocksForLeave(
  leaveId: number,
  adminId: number,
  type: string,
  startDate: Date,
  endDate: Date,
  reviewerId: number,
  halfDay: string | null,
): Promise<number> {
  if (!PAID_LEAVE_TYPES.has(type)) return 0;
  const contract = await prisma.employeeContract.findFirst({
    where: { adminId, status: "active" },
    orderBy: { startDate: "desc" },
    select: { hoursPerWeek: true },
  });
  const hoursPerWeek = contract?.hoursPerWeek ?? 40;
  const fullHoursPerDay = hoursPerWeek / 5;
  const hoursPerDay = halfDay ? fullHoursPerDay / 2 : fullHoursPerDay;
  const durationMin = Math.floor(hoursPerDay * 60);
  const note = autoLeaveNote(leaveId);
  const tag = type as "vacation" | "sick" | "parental" | "bereavement";

  const start = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate());
  const end = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());

  // Skip jours feries
  const holidaysMap = await getHolidaysInRange(start, end);

  const rows: Array<{
    adminId: number;
    clockIn: Date;
    clockOut: Date;
    durationMin: number;
    category: "vacation" | "sick" | "parental" | "bereavement";
    approvedBy: number;
    approvedAt: Date;
    submittedAt: Date;
    notes: string;
  }> = [];

  const cursor = new Date(start);
  while (cursor <= end) {
    const dow = cursor.getDay();
    const isWeekend = dow === 0 || dow === 6;
    const isHoliday = holidaysMap.has(isoDay(cursor));
    if (!isWeekend && !isHoliday) {
      const clockIn = new Date(cursor);
      const startHour = halfDay === "PM" ? 13 : 9;
      clockIn.setHours(startHour, 0, 0, 0);
      const clockOut = new Date(clockIn.getTime() + hoursPerDay * 60 * 60 * 1000);
      rows.push({
        adminId,
        clockIn,
        clockOut,
        durationMin,
        category: tag,
        approvedBy: reviewerId,
        approvedAt: new Date(),
        submittedAt: new Date(),
        notes: note,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  if (rows.length === 0) return 0;
  const res = await prisma.timeClock.createMany({ data: rows, skipDuplicates: true });
  return res.count;
}

async function deleteAutoTimeClocksForLeave(leaveId: number, adminId: number): Promise<number> {
  const note = autoLeaveNote(leaveId);
  const r = await prisma.timeClock.deleteMany({
    where: {
      adminId,
      payStubId: null,
      notes: { startsWith: note },
    },
  });
  return r.count;
}

export async function reviewLeaveRequestAction(input: { id: number; decision: "approved" | "rejected"; notes?: string }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const reviewerId = await requireLeavesReview();
  if (!reviewerId) return unauthorized();

  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };
  if (r.status !== "pending") return { success: false, error: t("deja_traitee") };

  // Anti-self-approval + scope
  const ok = await assertCanReviewLeave(reviewerId, r.adminId);
  if (!ok) {
    if (reviewerId === r.adminId) return { success: false, error: t("vous_ne_pouvez_pas_approuver_vos_propres") };
    return { success: false, error: t(ERR_NO_AUTHORITY) };
  }

  // Race condition : updateMany retourne count = 0 si quelqu'un d'autre l'a deja revue
  const upd = await prisma.leaveRequest.updateMany({
    where: { id: input.id, status: "pending" },
    data: {
      status: input.decision,
      reviewerId,
      reviewedAt: new Date(),
      reviewNotes: input.notes?.slice(0, 500) ?? null,
    },
  });
  if (upd.count === 0) return { success: false, error: t("demande_deja_traitee_par_un_autre_reviewer") };

  // Auto-creer les TimeClock pour les conges payes approuves
  if (input.decision === "approved" && PAID_LEAVE_TYPES.has(r.type)) {
    await createAutoTimeClocksForLeave(r.id, r.adminId, r.type, r.startDate, r.endDate, reviewerId, r.halfDay);
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }

  // Sync balance : planned -> taken si approved, planned -> 0 si rejected
  if (r.type === "vacation") {
    await syncBalanceForRequest(
      r.adminId,
      "vacation",
      { id: r.id, daysCount: Number(r.daysCount), status: input.decision },
      "review",
    ).catch(() => null);
  }

  // Notifier le demandeur
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: r.adminId,
      type: input.decision === "approved" ? "success" : "warning",
      title: input.decision === "approved" ? t("demande_conge_approuvee") : t("demande_conge_refusee"),
      body: input.notes || t("statut_decision", { statut: input.decision === "approved" ? t("approuvee") : t("refusee") }),
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  await logSecurityEvent({
    adminId: r.adminId,
    type: "profile_updated",
    severity: "info",
    message: input.decision === "approved" ? t("demande_conge_approuvee") : t("demande_conge_refusee"),
    metadata: { leaveRequestId: input.id, decision: input.decision, by: reviewerId },
  });

  await logAudit({ adminId: reviewerId, action: "update", entityType: "leave_request", entityId: input.id, changes: { decision: input.decision } });
  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// Bulk review : approuver/refuser plusieurs demandes en une fois.
// Implementation transactionnelle :
//   1. Pre-transaction : validation autorite + chargement + filtrage des IDs eligibles.
//   2. Transaction : 1 updateMany status + 1 createMany Notification + 1 createMany TimeClock
//      (pour les types payes approuves).
//   3. Post-transaction : audit logs + sync balances (best effort, hors transaction).
export async function bulkReviewLeavesAction(
  input: { ids: number[]; decision: "approved" | "rejected"; notes?: string },
): Promise<Result<{ processed: number; skipped: number; errors: Array<{ id: number; reason: string }> }>> {
  const t = await getTranslations("admin.action_errors");
  const reviewerId = await requireLeavesReview();
  if (!reviewerId) return unauthorized();
  if (!Array.isArray(input.ids) || input.ids.length === 0) {
    return { success: false, error: "Aucune demande selectionnee" };
  }
  const uniqueIds = Array.from(new Set(input.ids.filter((n) => Number.isInteger(n) && n > 0)));
  if (uniqueIds.length === 0) return { success: false, error: "IDs invalides" };

  const notesClean = input.notes?.slice(0, 500) ?? null;

  // ─── Etape 1 : charger + valider chaque demande ─────────────────
  const requests = await prisma.leaveRequest.findMany({
    where: { id: { in: uniqueIds } },
    select: {
      id: true, adminId: true, type: true, status: true,
      startDate: true, endDate: true, daysCount: true, halfDay: true,
    },
  });

  const found = new Map(requests.map((r) => [r.id, r]));
  const errors: Array<{ id: number; reason: string }> = [];
  const eligible: typeof requests = [];

  for (const id of uniqueIds) {
    const r = found.get(id);
    if (!r) { errors.push({ id, reason: "Demande introuvable" }); continue; }
    if (r.status !== "pending") { errors.push({ id, reason: "Deja traitee" }); continue; }
    // Anti-self + scope
    const ok = await assertCanReviewLeave(reviewerId, r.adminId);
    if (!ok) {
      errors.push({
        id,
        reason: reviewerId === r.adminId
          ? "Auto-approbation interdite"
          : t(ERR_NO_AUTHORITY),
      });
      continue;
    }
    eligible.push(r);
  }

  if (eligible.length === 0) {
    return { success: true, data: { processed: 0, skipped: uniqueIds.length, errors } };
  }

  const eligibleIds = eligible.map((r) => r.id);
  const now = new Date();

  // Prepare les contrats / heures par jour pour les TimeClock (1 query batch)
  const paidApproved = input.decision === "approved"
    ? eligible.filter((r) => PAID_LEAVE_TYPES.has(r.type))
    : [];
  const adminIdsPaid = Array.from(new Set(paidApproved.map((r) => r.adminId)));
  const hoursByAdmin = new Map<number, number>();
  if (adminIdsPaid.length > 0) {
    const contracts = await prisma.employeeContract.findMany({
      where: { adminId: { in: adminIdsPaid }, status: "active" },
      orderBy: { startDate: "desc" },
      select: { adminId: true, hoursPerWeek: true },
    });
    // Garde la plus recente par admin (hoursPerWeek peut etre null en schema)
    for (const c of contracts) {
      if (!hoursByAdmin.has(c.adminId)) hoursByAdmin.set(c.adminId, c.hoursPerWeek ?? 40);
    }
  }

  // Pre-calcule les rows TimeClock + Notification a inserer
  type TimeClockRow = {
    adminId: number;
    clockIn: Date;
    clockOut: Date;
    durationMin: number;
    category: "vacation" | "sick" | "parental" | "bereavement";
    approvedBy: number;
    approvedAt: Date;
    submittedAt: Date;
    notes: string;
  };
  const tcRows: TimeClockRow[] = [];

  for (const r of paidApproved) {
    const hoursPerWeek = hoursByAdmin.get(r.adminId) ?? 40;
    const fullHoursPerDay = hoursPerWeek / 5;
    const hoursPerDay = r.halfDay ? fullHoursPerDay / 2 : fullHoursPerDay;
    const durationMin = Math.floor(hoursPerDay * 60);
    const note = autoLeaveNote(r.id);
    const tag = r.type as "vacation" | "sick" | "parental" | "bereavement";

    const start = new Date(r.startDate.getFullYear(), r.startDate.getMonth(), r.startDate.getDate());
    const end = new Date(r.endDate.getFullYear(), r.endDate.getMonth(), r.endDate.getDate());
    const holidaysMap = await getHolidaysInRange(start, end);

    const cursor = new Date(start);
    while (cursor <= end) {
      const dow = cursor.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidaysMap.has(isoDay(cursor));
      if (!isWeekend && !isHoliday) {
        const clockIn = new Date(cursor);
        const startHour = r.halfDay === "PM" ? 13 : 9;
        clockIn.setHours(startHour, 0, 0, 0);
        const clockOut = new Date(clockIn.getTime() + hoursPerDay * 60 * 60 * 1000);
        tcRows.push({
          adminId: r.adminId,
          clockIn,
          clockOut,
          durationMin,
          category: tag,
          approvedBy: reviewerId,
          approvedAt: now,
          submittedAt: now,
          notes: note,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
  }

  const notifRows = eligible.map((r) => ({
    recipientType: "admin",
    recipientId: r.adminId,
    type: input.decision === "approved" ? "success" : "warning",
    title: input.decision === "approved" ? t("demande_conge_approuvee") : t("demande_conge_refusee"),
    body: notesClean || t("statut_decision", { statut: input.decision === "approved" ? t("approuvee") : t("refusee") }),
    link: "/admin/mon-espace/conges",
    icon: "calendar",
  }));

  // ─── Etape 2 : transaction (status + notifs + timeclocks) ────────
  let processed = 0;
  try {
    await prisma.$transaction(async (tx) => {
      // Race condition : status doit toujours etre pending au moment de l'update
      const upd = await tx.leaveRequest.updateMany({
        where: { id: { in: eligibleIds }, status: "pending" },
        data: {
          status: input.decision,
          reviewerId,
          reviewedAt: now,
          reviewNotes: notesClean,
        },
      });
      processed = upd.count;

      if (notifRows.length > 0) {
        await tx.notification.createMany({ data: notifRows, skipDuplicates: true });
      }
      if (tcRows.length > 0) {
        await tx.timeClock.createMany({ data: tcRows, skipDuplicates: true });
      }
    });
  } catch (err) {
    console.error("[bulkReviewLeavesAction] transaction failed", err);
    return { success: false, error: t("echec_de_la_transaction_aucune_demande_modifiee") };
  }

  // ─── Etape 3 : audit logs + sync balances (best effort, hors txn) ─
  await Promise.all(
    eligible.map((r) =>
      logAudit({
        adminId: reviewerId,
        action: "update",
        entityType: "leave_request",
        entityId: r.id,
        changes: { decision: input.decision, bulk: true },
      }).catch(() => null),
    ),
  );

  await Promise.all(
    eligible
      .filter((r) => r.type === "vacation")
      .map((r) =>
        syncBalanceForRequest(
          r.adminId,
          "vacation",
          { id: r.id, daysCount: Number(r.daysCount), status: input.decision },
          "review",
        ).catch(() => null),
      ),
  );

  // Security events (info, best effort)
  await Promise.all(
    eligible.map((r) =>
      logSecurityEvent({
        adminId: r.adminId,
        type: "profile_updated",
        severity: "info",
        message: input.decision === "approved" ? t("demande_conge_approuvee_bulk") : t("demande_conge_refusee_bulk"),
        metadata: { leaveRequestId: r.id, decision: input.decision, by: reviewerId, bulk: true },
      }).catch(() => null),
    ),
  );

  if (paidApproved.length > 0) {
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }
  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");

  const skipped = uniqueIds.length - processed;
  return { success: true, data: { processed, skipped, errors } };
}

const cancelLeaveSchema = z.object({
  id: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export async function cancelLeaveRequestAction(
  input: { id: number; reason?: string },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  const parsed = cancelLeaveSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const r = await prisma.leaveRequest.findUnique({ where: { id: parsed.data.id } });
  if (!r) return { success: false, error: "Introuvable" };

  // L'auteur peut annuler sa demande, sinon il faut etre autorise comme reviewer
  const isOwner = r.adminId === actorId;
  if (!isOwner) {
    const ok = await assertCanReviewLeave(actorId, r.adminId);
    if (!ok) return { success: false, error: t(ERR_NO_AUTHORITY) };
  }
  if (r.status === "rejected") return { success: false, error: t("demande_deja_refusee") };
  if (r.status === "cancelled") return { success: false, error: t("demande_deja_annulee") };

  const wasApproved = r.status === "approved";
  const wasPending = r.status === "pending";
  const reasonClean = parsed.data.reason?.trim().slice(0, 500) || null;

  await prisma.leaveRequest.update({
    where: { id: parsed.data.id },
    data: {
      status: "cancelled",
      ...(reasonClean ? { reviewNotes: reasonClean } : {}),
    },
  });

  // Si le conge etait approuve : nettoyer les TimeClock auto-crees
  if (wasApproved && PAID_LEAVE_TYPES.has(r.type)) {
    await deleteAutoTimeClocksForLeave(r.id, r.adminId);
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }

  if (r.type === "vacation") {
    await syncBalanceForRequest(
      r.adminId,
      "vacation",
      { id: r.id, daysCount: Number(r.daysCount), status: "cancelled" },
      "cancel",
    ).catch(() => null);
  }

  // ─── Notifications ciblees ──────────────────────────────────
  // - Si admin annule pour quelqu'un d'autre : notifier l'employe
  // - Toujours notifier le reviewer direct (si la demande etait pending OU approved)
  // - Notifier aussi le manager direct du proprietaire (admin.managerId)
  const owner = await prisma.admin.findUnique({
    where: { id: r.adminId },
    select: { id: true, fullName: true, email: true, managerId: true },
  });
  const actor = await prisma.admin.findUnique({
    where: { id: actorId },
    select: { id: true, fullName: true, email: true },
  });
  const actorLabel = actor?.fullName || actor?.email || "Un utilisateur";
  const ownerLabel = owner?.fullName || owner?.email || "Un employe";
  const periodStr = `${r.startDate.toLocaleDateString("fr-CA")} au ${r.endDate.toLocaleDateString("fr-CA")}`;
  const reasonSuffix = reasonClean ? ` Motif : ${reasonClean}` : "";

  const notifs: Array<{
    recipientType: string;
    recipientId: number;
    type: string;
    title: string;
    body: string;
    link: string;
    icon: string;
  }> = [];

  // Notif employe si annule par admin
  if (!isOwner) {
    notifs.push({
      recipientType: "admin",
      recipientId: r.adminId,
      type: "warning",
      title: t("votre_demande_de_conge_a_ete_annulee"),
      body: `${actorLabel} a annulé votre demande du ${periodStr}.${reasonSuffix}`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    });
  }

  // Reviewer direct : si la demande etait pending OU approved et qu'un reviewerId existait
  // ou s'il s'agissait d'une demande pending sans reviewer attribue, on prend les supervisors
  const reviewerIds = new Set<number>();
  if (r.reviewerId && r.reviewerId !== actorId) reviewerIds.add(r.reviewerId);
  // Manager direct du proprietaire
  if (owner?.managerId && owner.managerId !== actorId) reviewerIds.add(owner.managerId);

  // Si la demande etait pending sans reviewer attribue, notifier les supervisors candidats
  if (wasPending && !r.reviewerId) {
    const supervisors = await prisma.admin.findMany({
      where: {
        OR: [
          { customRole: { name: "super_admin" } },
          { directReports: { some: { id: r.adminId } } },
        ],
        isActive: true,
        id: { not: actorId },
      },
      select: { id: true },
    });
    for (const s of supervisors) reviewerIds.add(s.id);
  }

  // Cas : demande approved annulee par l'employe -> reviewer doit etre informe
  if (wasApproved && isOwner && r.reviewerId && r.reviewerId !== actorId) {
    reviewerIds.add(r.reviewerId);
  }

  for (const rid of reviewerIds) {
    notifs.push({
      recipientType: "admin",
      recipientId: rid,
      type: "info",
      title: isOwner ? t("demande_conge_annulee_par_employe") : t("demande_conge_annulee"),
      body: isOwner
        ? t("owner_a_annule_sa_demande", { owner: ownerLabel, periode: periodStr, etat: wasApproved ? t("etait_approuvee") : "", raison: reasonSuffix })
        : t("acteur_a_annule_demande_de", { acteur: actorLabel, owner: ownerLabel, periode: periodStr, raison: reasonSuffix }),
      link: "/admin/employes/conges",
      icon: "calendar",
    });
  }

  if (notifs.length > 0) {
    await prisma.notification.createMany({
      data: notifs,
      skipDuplicates: true,
    }).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "leave_request",
    entityId: parsed.data.id,
    changes: {
      cancelled: true,
      cancelledBy: isOwner ? "employee" : "admin",
      reason: reasonClean ?? null,
      previousStatus: r.status,
    },
  });

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// ─── Admin : créer un congé au nom d'un employé ───────────────
const createForEmployeeSchema = z.object({
  employeeId: z.number().int().positive(),
  type: z.enum(TYPES),
  startDate: z.string(),
  endDate: z.string(),
  reason: z.string().max(500).nullable().optional(),
  halfDay: z.enum(HALF).nullable().optional(),
  autoApprove: z.boolean().optional(),
});

export async function createLeaveForEmployeeAction(
  input: z.infer<typeof createForEmployeeSchema>,
): Promise<Result<{ id: number; status: "pending" | "approved"; warning?: string }>> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  const parsed = createForEmployeeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Anti-self-creation : on autorise quand même (le founder peut se créer un congé pour lui)
  // mais l'autorité doit être validée via assertCanReviewLeave
  const canAct = await assertCanReviewLeave(actorId, parsed.data.employeeId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  // Vérifie que l'employé existe et est actif
  const target = await prisma.admin.findUnique({
    where: { id: parsed.data.employeeId },
    select: { id: true, isActive: true, fullName: true, email: true },
  });
  if (!target) return { success: false, error: t("employe_introuvable") };
  if (!target.isActive) return { success: false, error: t("compte_de_l_employe_desactive") };

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { success: false, error: "Dates invalides" };
  if (end < start) return { success: false, error: t("fin_avant_debut") };

  const isHalf = !!parsed.data.halfDay;
  if (isHalf && parsed.data.startDate !== parsed.data.endDate) {
    return { success: false, error: t("une_demi_journee_doit_avoir_la_meme") };
  }

  const fullDays = await calculateWorkingDays(start, end);
  if (fullDays <= 0) return { success: false, error: t("aucun_jour_ouvrable_dans_la_plage_selectionnee") };
  const days = isHalf ? 0.5 : fullDays;

  // Validations (sauf 14-jours-passé : l'admin a l'autorité de rattraper)
  // On ne contrôle que les conflits + période payée + solde
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      adminId: parsed.data.employeeId,
      status: { in: ["pending", "approved"] },
      startDate: { lte: end },
      endDate: { gte: start },
    },
    select: { id: true, startDate: true, endDate: true },
  });
  if (overlap) {
    return {
      success: false,
      error: `Conflit avec une demande existante du ${overlap.startDate.toLocaleDateString("fr-CA")} au ${overlap.endDate.toLocaleDateString("fr-CA")}.`,
    };
  }
  const paidPeriod = await prisma.payPeriod.findFirst({
    where: { status: "paid", startDate: { lte: end }, endDate: { gte: start } },
    select: { startDate: true, endDate: true },
  });
  if (paidPeriod) {
    return {
      success: false,
      error: `La période du ${paidPeriod.startDate.toLocaleDateString("fr-CA")} au ${paidPeriod.endDate.toLocaleDateString("fr-CA")} est déjà payée.`,
    };
  }
  if (parsed.data.type === "vacation") {
    const balance = await getLeaveBalance(parsed.data.employeeId, "vacation");
    const effective = isHalf ? 0.5 : days;
    if (balance.vacationDaysRemaining < effective) {
      return { success: false, error: `Solde insuffisant : ${balance.vacationDaysRemaining} jours disponibles, demande de ${effective}.` };
    }
  }

  const autoApprove = !!parsed.data.autoApprove;
  const r = await prisma.leaveRequest.create({
    data: {
      adminId: parsed.data.employeeId,
      type: parsed.data.type,
      startDate: start,
      endDate: end,
      daysCount: days,
      reason: parsed.data.reason ?? null,
      status: autoApprove ? "approved" : "pending",
      halfDay: parsed.data.halfDay ?? null,
      ...(autoApprove ? { reviewerId: actorId, reviewedAt: new Date() } : {}),
    },
    select: { id: true, status: true },
  });

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "leave_request",
    entityId: r.id,
    changes: { createdForEmployee: parsed.data.employeeId, autoApprove },
  });

  // Sync balance
  if (parsed.data.type === "vacation") {
    await syncBalanceForRequest(
      parsed.data.employeeId,
      "vacation",
      { id: r.id, daysCount: days, status: r.status },
      autoApprove ? "review" : "create",
    ).catch(() => null);
  }

  // Si approuvé directement : créer TimeClock auto
  if (autoApprove && PAID_LEAVE_TYPES.has(parsed.data.type)) {
    await createAutoTimeClocksForLeave(r.id, parsed.data.employeeId, parsed.data.type, start, end, actorId, parsed.data.halfDay ?? null);
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }

  // Notif employé
  const actor = await prisma.admin.findUnique({ where: { id: actorId }, select: { fullName: true, email: true } });
  const actorLabel = actor?.fullName || actor?.email || "Un administrateur";
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: parsed.data.employeeId,
      type: autoApprove ? "success" : "info",
      title: autoApprove ? t("conge_cree_approuve_pour_vous") : t("demande_conge_creee_pour_vous"),
      body: `${actorLabel} a ${autoApprove ? t("cree_et_approuve") : t("cree")} une demande de ${parsed.data.type} : ${days} jour${days > 1 ? "s" : ""} du ${start.toLocaleDateString("fr-CA")} au ${end.toLocaleDateString("fr-CA")}.`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  await logSecurityEvent({
    adminId: parsed.data.employeeId,
    type: "profile_updated",
    severity: "info",
    message: autoApprove ? t("demande_creee_admin_auto") : t("demande_creee_admin_attente"),
    metadata: { leaveRequestId: r.id, by: actorId, autoApprove },
  });

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true, data: { id: r.id, status: r.status as "pending" | "approved" } };
}

// ─── Admin : Fermeture obligatoire (vacances entreprise) ───────
// Cree une LeaveRequest approuvee pour TOUS les employes actifs sur la plage donnee.
// Type "other" par defaut (pas de vacation auto-deduite). Permet d'exempter certains
// employes (ex: roles essentiels) via excludedAdminIds.
const mandatoryClosureSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  type: z.enum(["vacation", "unpaid", "other"]).default("other"),
  reason: z.string().min(2).max(500),
  excludedAdminIds: z.array(z.number().int()).optional(),
});

export async function createMandatoryClosureAction(
  input: z.infer<typeof mandatoryClosureSchema>,
): Promise<Result<{ created: number; skipped: number; conflicts: Array<{ adminId: number; reason: string }> }>> {
  const t = await getTranslations("admin.action_errors");
  const actorId = await requireLeavesReview();
  if (!actorId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const parsed = mandatoryClosureSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const start = new Date(parsed.data.startDate);
  const end = new Date(parsed.data.endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { success: false, error: "Dates invalides" };
  if (end < start) return { success: false, error: "Fin avant debut" };

  const fullDays = await calculateWorkingDays(start, end);
  if (fullDays <= 0) return { success: false, error: t("aucun_jour_ouvrable_dans_la_plage_selectionnee_2") };

  // Bloquer si une PayPeriod payee chevauche
  const paidPeriod = await prisma.payPeriod.findFirst({
    where: { status: "paid", startDate: { lte: end }, endDate: { gte: start } },
    select: { startDate: true, endDate: true },
  });
  if (paidPeriod) {
    return {
      success: false,
      error: `La periode du ${paidPeriod.startDate.toLocaleDateString("fr-CA")} au ${paidPeriod.endDate.toLocaleDateString("fr-CA")} est deja payee.`,
    };
  }

  const excluded = new Set(parsed.data.excludedAdminIds ?? []);
  const allActives = await prisma.admin.findMany({
    where: { isActive: true },
    select: { id: true, fullName: true, email: true },
  });
  const targets = allActives.filter((a) => !excluded.has(a.id));
  if (targets.length === 0) return { success: false, error: t("aucun_employe_cible_tous_exclus") };

  let created = 0;
  let skipped = 0;
  const conflicts: Array<{ adminId: number; reason: string }> = [];
  const reasonText = `Fermeture entreprise : ${parsed.data.reason}`;

  for (const target of targets) {
    // Skip si conflit deja present
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        adminId: target.id,
        status: { in: ["pending", "approved"] },
        startDate: { lte: end },
        endDate: { gte: start },
      },
      select: { id: true, startDate: true, endDate: true },
    });
    if (overlap) {
      skipped++;
      conflicts.push({
        adminId: target.id,
        reason: `${target.fullName || target.email} : conflit avec demande du ${overlap.startDate.toLocaleDateString("fr-CA")} au ${overlap.endDate.toLocaleDateString("fr-CA")}.`,
      });
      continue;
    }

    const r = await prisma.leaveRequest.create({
      data: {
        adminId: target.id,
        type: parsed.data.type,
        startDate: start,
        endDate: end,
        daysCount: fullDays,
        reason: reasonText,
        status: "approved",
        reviewerId: actorId,
        reviewedAt: new Date(),
        reviewNotes: "Fermeture obligatoire creee par RH",
        halfDay: null,
      },
      select: { id: true },
    });
    created++;

    if (PAID_LEAVE_TYPES.has(parsed.data.type)) {
      await createAutoTimeClocksForLeave(r.id, target.id, parsed.data.type, start, end, actorId, null).catch(() => null);
    }
    if (parsed.data.type === "vacation") {
      await syncBalanceForRequest(
        target.id, "vacation",
        { id: r.id, daysCount: fullDays, status: "approved" },
        "review",
      ).catch(() => null);
    }
  }

  // Notifier en bulk tous les beneficiaires
  if (created > 0) {
    const beneficiaries = targets.filter((t) => !conflicts.some((c) => c.adminId === t.id));
    await prisma.notification.createMany({
      data: beneficiaries.map((b) => ({
        recipientType: "admin",
        recipientId: b.id,
        type: "info",
        title: `Fermeture entreprise : ${parsed.data.reason}`,
        body: `Du ${start.toLocaleDateString("fr-CA")} au ${end.toLocaleDateString("fr-CA")} (${fullDays} j ouvres).`,
        link: "/admin/mon-espace/conges",
        icon: "calendar",
      })),
      skipDuplicates: true,
    }).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "leave_request",
    entityId: 0,
    changes: { mandatoryClosure: true, type: parsed.data.type, period: `${parsed.data.startDate}→${parsed.data.endDate}`, created, skipped },
  });

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/employes/pointage");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true, data: { created, skipped, conflicts } };
}

// ─── Admin : modifier une demande dans n'importe quel état ────
const adminUpdateSchema = z.object({
  id: z.number().int(),
  type: z.enum(TYPES).optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  reason: z.string().max(500).nullable().optional(),
  halfDay: z.enum(HALF).nullable().optional(),
  status: z.enum(["pending", "approved", "rejected", "cancelled"]).optional(),
});

export async function adminUpdateLeaveRequestAction(
  input: z.infer<typeof adminUpdateSchema>,
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  const parsed = adminUpdateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const r = await prisma.leaveRequest.findUnique({ where: { id: parsed.data.id } });
  if (!r) return { success: false, error: "Demande introuvable" };

  const canAct = await assertCanReviewLeave(actorId, r.adminId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  // Bloque si l'un des TimeClock liés est sur un payStubId (période payée)
  const start0 = parsed.data.startDate ? new Date(parsed.data.startDate) : r.startDate;
  const end0 = parsed.data.endDate ? new Date(parsed.data.endDate) : r.endDate;
  if (isNaN(start0.getTime()) || isNaN(end0.getTime())) return { success: false, error: "Dates invalides" };
  if (end0 < start0) return { success: false, error: t("fin_avant_debut") };

  if (r.status === "approved" && PAID_LEAVE_TYPES.has(r.type)) {
    const paid = await prisma.timeClock.findFirst({
      where: {
        adminId: r.adminId,
        payStubId: { not: null },
        notes: { startsWith: autoLeaveNote(r.id) },
      },
      select: { id: true },
    });
    if (paid) return { success: false, error: t("demande_deja_incluse_dans_une_paie_versee") };
  }

  const type = parsed.data.type ?? r.type;
  const halfDayNext = parsed.data.halfDay !== undefined ? parsed.data.halfDay : r.halfDay;
  const isHalf = !!halfDayNext;
  if (isHalf && start0.toDateString() !== end0.toDateString()) {
    return { success: false, error: t("une_demi_journee_doit_avoir_la_meme") };
  }

  const fullDays = await calculateWorkingDays(start0, end0);
  if (fullDays <= 0) return { success: false, error: t("aucun_jour_ouvrable_dans_la_plage_selectionnee") };
  const days = isHalf ? 0.5 : fullDays;

  // Vérifie chevauchement (en excluant cette demande)
  const overlap = await prisma.leaveRequest.findFirst({
    where: {
      adminId: r.adminId,
      status: { in: ["pending", "approved"] },
      startDate: { lte: end0 },
      endDate: { gte: start0 },
      id: { not: r.id },
    },
    select: { id: true, startDate: true, endDate: true },
  });
  if (overlap) {
    return {
      success: false,
      error: `Conflit avec une demande existante du ${overlap.startDate.toLocaleDateString("fr-CA")} au ${overlap.endDate.toLocaleDateString("fr-CA")}.`,
    };
  }

  const statusNext = parsed.data.status ?? r.status;
  const wasApproved = r.status === "approved";
  const willBeApproved = statusNext === "approved";

  // Construit diff pour la notif
  const diff: string[] = [];
  if (r.startDate.toDateString() !== start0.toDateString()) {
    diff.push(`du ${r.startDate.toLocaleDateString("fr-CA")} → ${start0.toLocaleDateString("fr-CA")}`);
  }
  if (r.endDate.toDateString() !== end0.toDateString()) {
    diff.push(`au ${r.endDate.toLocaleDateString("fr-CA")} → ${end0.toLocaleDateString("fr-CA")}`);
  }
  if (r.type !== type) diff.push(`type ${r.type} → ${type}`);
  if (r.status !== statusNext) diff.push(`statut ${r.status} → ${statusNext}`);

  await prisma.leaveRequest.update({
    where: { id: r.id },
    data: {
      type,
      startDate: start0,
      endDate: end0,
      daysCount: days,
      reason: parsed.data.reason !== undefined ? parsed.data.reason : r.reason,
      halfDay: halfDayNext,
      status: statusNext,
      ...(parsed.data.status && parsed.data.status !== r.status
        ? { reviewerId: actorId, reviewedAt: new Date() }
        : {}),
    },
  });

  // Gestion TimeClock auto
  if (wasApproved && PAID_LEAVE_TYPES.has(r.type)) {
    await deleteAutoTimeClocksForLeave(r.id, r.adminId);
  }
  if (willBeApproved && PAID_LEAVE_TYPES.has(type)) {
    await createAutoTimeClocksForLeave(r.id, r.adminId, type, start0, end0, actorId, halfDayNext);
  }
  if ((wasApproved !== willBeApproved) || (wasApproved && PAID_LEAVE_TYPES.has(r.type))) {
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }

  if (type === "vacation" || r.type === "vacation") {
    await syncBalanceForRequest(
      r.adminId,
      "vacation",
      { id: r.id, daysCount: days, status: statusNext },
      "update",
      Number(r.daysCount),
    ).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "leave_request",
    entityId: r.id,
    changes: { adminEdit: true, diff: diff.join(" ; ") || "(aucun changement notable)" },
  });

  // Notif employé
  if (r.adminId !== actorId) {
    const actor = await prisma.admin.findUnique({ where: { id: actorId }, select: { fullName: true, email: true } });
    const actorLabel = actor?.fullName || actor?.email || "Un administrateur";
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: r.adminId,
        type: "info",
        title: t("votre_demande_de_conge_a_ete_modifiee"),
        body: t("acteur_a_modifie_votre_demande", { acteur: actorLabel, diff: diff.join(" ; ") || t("details_ajustes") }),
        link: "/admin/mon-espace/conges",
        icon: "calendar",
      },
    }).catch(() => null);
  }

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// ─── Admin : annuler une demande approuvée ────────────────────
export async function adminCancelApprovedLeaveAction(
  input: { id: number; reason: string },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  if (!input.reason || input.reason.trim().length < 3) {
    return { success: false, error: t("une_raison_est_requise_pour_annuler_un") };
  }

  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };
  if (r.status !== "approved") return { success: false, error: t("seules_les_demandes_approuvees_peuvent_etre_annulees") };

  const canAct = await assertCanReviewLeave(actorId, r.adminId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  // Vérifie qu'aucun TimeClock lié n'a été payé
  if (PAID_LEAVE_TYPES.has(r.type)) {
    const paid = await prisma.timeClock.findFirst({
      where: {
        adminId: r.adminId,
        payStubId: { not: null },
        notes: { startsWith: autoLeaveNote(r.id) },
      },
      select: { id: true },
    });
    if (paid) return { success: false, error: t("periode_deja_payee_annulation_impossible") };
  }

  await prisma.leaveRequest.update({
    where: { id: r.id },
    data: {
      status: "cancelled",
      reviewerId: actorId,
      reviewedAt: new Date(),
      reviewNotes: input.reason.slice(0, 500),
    },
  });

  if (PAID_LEAVE_TYPES.has(r.type)) {
    await deleteAutoTimeClocksForLeave(r.id, r.adminId);
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }

  if (r.type === "vacation") {
    await syncBalanceForRequest(
      r.adminId,
      "vacation",
      { id: r.id, daysCount: Number(r.daysCount), status: "cancelled" },
      "cancel",
    ).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "leave_request",
    entityId: r.id,
    changes: { adminCancelled: true, reason: input.reason },
  });

  const actor = await prisma.admin.findUnique({ where: { id: actorId }, select: { fullName: true, email: true } });
  const actorLabel = actor?.fullName || actor?.email || "Un administrateur";
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: r.adminId,
      type: "warning",
      title: t("votre_conge_a_ete_annule"),
      body: `${actorLabel} a annulé votre congé du ${r.startDate.toLocaleDateString("fr-CA")} au ${r.endDate.toLocaleDateString("fr-CA")} : ${input.reason}`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  await logSecurityEvent({
    adminId: r.adminId,
    type: "profile_updated",
    severity: "warning",
    message: t("conge_approuve_annule_par_admin"),
    metadata: { leaveRequestId: r.id, by: actorId, reason: input.reason },
  });

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// ─── Admin : supprimer définitivement une demande ─────────────
export async function adminDeleteLeaveAction(
  input: { id: number },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;

  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };

  const canAct = await assertCanReviewLeave(actorId, r.adminId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  // Bloque si payé
  if (PAID_LEAVE_TYPES.has(r.type)) {
    const paid = await prisma.timeClock.findFirst({
      where: {
        adminId: r.adminId,
        payStubId: { not: null },
        notes: { startsWith: autoLeaveNote(r.id) },
      },
      select: { id: true },
    });
    if (paid) return { success: false, error: t("periode_deja_payee_suppression_impossible") };
    await deleteAutoTimeClocksForLeave(r.id, r.adminId);
  }

  const snapshot = {
    type: r.type,
    startDate: r.startDate.toISOString().slice(0, 10),
    endDate: r.endDate.toISOString().slice(0, 10),
    daysCount: Number(r.daysCount),
    status: r.status,
  };

  await prisma.leaveRequest.delete({ where: { id: r.id } });

  if (r.type === "vacation") {
    await syncBalanceForRequest(
      r.adminId,
      "vacation",
      { id: r.id, daysCount: 0, status: "cancelled" },
      "cancel",
    ).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "delete",
    entityType: "leave_request",
    entityId: r.id,
    changes: { adminDelete: true, snapshot },
  });

  const actor = await prisma.admin.findUnique({ where: { id: actorId }, select: { fullName: true, email: true } });
  const actorLabel = actor?.fullName || actor?.email || "Un administrateur";
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: r.adminId,
      type: "warning",
      title: t("une_de_vos_demandes_de_conge_a"),
      body: `${actorLabel} a supprimé votre demande du ${r.startDate.toLocaleDateString("fr-CA")} au ${r.endDate.toLocaleDateString("fr-CA")} (${r.type}).`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  await logSecurityEvent({
    adminId: r.adminId,
    type: "profile_updated",
    severity: "warning",
    message: t("demande_de_conge_supprimee_par_admin"),
    metadata: { leaveRequestId: r.id, by: actorId, snapshot },
  });

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// ─── Delegation d'approbation ─────────────────────────────────
export async function delegateLeaveApprovalAction(input: { delegateId: number | null }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const adminId = session.user.adminId!;

  if (input.delegateId !== null) {
    if (input.delegateId === adminId) return { success: false, error: t("vous_ne_pouvez_pas_vous_deleguer_a") };
    const target = await prisma.admin.findUnique({ where: { id: input.delegateId }, select: { id: true, isActive: true } });
    if (!target || !target.isActive) return { success: false, error: t("delegue_introuvable_ou_inactif") };
  }

  // Update typé via Prisma (champ disponible dans le client après generate)
  try {
    await prisma.admin.update({
      where: { id: adminId },
      data: { delegateApprovalTo: input.delegateId },
    });
  } catch {
    return { success: false, error: t("echec_de_la_mise_a_jour_de") };
  }

  await logAudit({ adminId, action: "update", entityType: "admin", entityId: adminId, changes: { delegateApprovalTo: input.delegateId } });

  // Notif au nouveau delegue
  if (input.delegateId !== null) {
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: input.delegateId,
        type: "info",
        title: t("delegation_d_approbation_recue"),
        body: t("vous_avez_ete_designe_pour_approuver_les"),
        link: "/admin/employes/conges",
        icon: "shield",
      },
    }).catch(() => null);
  }

  revalidatePath("/admin/profile");
  return { success: true };
}

// ═══════════════════════════════════════════════════════════════════
// 8 actions admin avancées sur les congés (drill-down panel)
// ═══════════════════════════════════════════════════════════════════

// 1) Annuler une approbation : approved -> pending
export async function unapproveLeaveAction(
  input: { id: number; reason: string },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  if (!input.reason || input.reason.trim().length < 3) {
    return { success: false, error: t("une_raison_est_requise") };
  }
  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };
  if (r.status !== "approved") return { success: false, error: t("la_demande_n_est_pas_approuvee") };

  const canAct = await assertCanReviewLeave(actorId, r.adminId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  // Période payée → impossible
  if (PAID_LEAVE_TYPES.has(r.type)) {
    const paid = await prisma.timeClock.findFirst({
      where: {
        adminId: r.adminId,
        payStubId: { not: null },
        notes: { startsWith: autoLeaveNote(r.id) },
      },
      select: { id: true },
    });
    if (paid) return { success: false, error: t("periode_deja_payee_impossible_de_retirer_l") };
    await deleteAutoTimeClocksForLeave(r.id, r.adminId);
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }

  await prisma.leaveRequest.update({
    where: { id: r.id },
    data: {
      status: "pending",
      reviewerId: null,
      reviewedAt: null,
      reviewNotes: input.reason.slice(0, 500),
    },
  });

  if (r.type === "vacation") {
    await syncBalanceForRequest(
      r.adminId,
      "vacation",
      { id: r.id, daysCount: Number(r.daysCount), status: "pending" },
      "update",
      Number(r.daysCount),
    ).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "leave_request",
    entityId: r.id,
    changes: { unapproved: true, reason: input.reason },
  });

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: r.adminId,
      type: "warning",
      title: t("approbation_retiree_votre_demande_repasse_en_attente"),
      body: `Raison : ${input.reason}`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// 2) Convertir le type d'une demande (ex: maladie → vacances)
export async function convertLeaveTypeAction(
  input: { id: number; newType: string; reason: string },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  if (!TYPES.includes(input.newType as (typeof TYPES)[number])) {
    return { success: false, error: "Type invalide" };
  }
  if (!input.reason || input.reason.trim().length < 3) {
    return { success: false, error: t("une_raison_est_requise") };
  }
  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };
  if (r.type === input.newType) return { success: false, error: t("aucun_changement_de_type") };

  const canAct = await assertCanReviewLeave(actorId, r.adminId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  // Période payée → bloque
  if (r.status === "approved" && PAID_LEAVE_TYPES.has(r.type)) {
    const paid = await prisma.timeClock.findFirst({
      where: {
        adminId: r.adminId,
        payStubId: { not: null },
        notes: { startsWith: autoLeaveNote(r.id) },
      },
      select: { id: true },
    });
    if (paid) return { success: false, error: t("periode_deja_payee_conversion_impossible") };
  }

  const prevType = r.type;
  await prisma.leaveRequest.update({
    where: { id: r.id },
    data: {
      type: input.newType,
      reviewNotes: input.reason.slice(0, 500),
    },
  });

  // Gestion TimeClock auto si approuvé
  if (r.status === "approved") {
    if (PAID_LEAVE_TYPES.has(prevType)) {
      await deleteAutoTimeClocksForLeave(r.id, r.adminId);
    }
    if (PAID_LEAVE_TYPES.has(input.newType)) {
      await createAutoTimeClocksForLeave(r.id, r.adminId, input.newType, r.startDate, r.endDate, actorId, r.halfDay);
    }
    revalidatePath("/admin/employes/pointage");
    revalidatePath("/admin/mon-espace/pointage");
  }

  // Sync balance vacation des deux côtés si impliquée
  if (prevType === "vacation" || input.newType === "vacation") {
    await syncBalanceForRequest(
      r.adminId,
      "vacation",
      { id: r.id, daysCount: Number(r.daysCount), status: r.status },
      "update",
      Number(r.daysCount),
    ).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "leave_request",
    entityId: r.id,
    changes: { typeConversion: true, from: prevType, to: input.newType, reason: input.reason },
  });

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: r.adminId,
      type: "info",
      title: t("type_de_conge_modifie"),
      body: `${prevType} → ${input.newType}. Raison : ${input.reason}`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// 3) Dupliquer une demande sur de nouvelles dates
export async function duplicateLeaveAction(
  input: { id: number; newStartDate: string; newEndDate: string },
): Promise<Result<{ newId: number }>> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;

  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };

  const canAct = await assertCanReviewLeave(actorId, r.adminId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  const start = new Date(input.newStartDate);
  const end = new Date(input.newEndDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { success: false, error: "Dates invalides" };
  if (end < start) return { success: false, error: t("fin_avant_debut") };

  const isHalf = !!r.halfDay;
  if (isHalf && input.newStartDate !== input.newEndDate) {
    return { success: false, error: t("une_demi_journee_doit_avoir_la_meme") };
  }
  const fullDays = await calculateWorkingDays(start, end);
  if (fullDays <= 0) return { success: false, error: t("aucun_jour_ouvrable_dans_la_plage_selectionnee") };
  const days = isHalf ? 0.5 : fullDays;

  const err = await validatePeriod(r.adminId, start, end, r.type, days, isHalf);
  if (err) return { success: false, error: err };

  const created = await prisma.leaveRequest.create({
    data: {
      adminId: r.adminId,
      type: r.type,
      startDate: start,
      endDate: end,
      daysCount: days,
      reason: r.reason,
      status: "pending",
      halfDay: r.halfDay,
    },
    select: { id: true },
  });

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "leave_request",
    entityId: created.id,
    changes: { duplicatedFrom: r.id },
  });

  if (r.type === "vacation") {
    await syncBalanceForRequest(r.adminId, "vacation", { id: created.id, daysCount: days, status: "pending" }, "create").catch(() => null);
  }

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: r.adminId,
      type: "info",
      title: t("demande_de_conge_dupliquee_pour_vous"),
      body: `Nouvelle demande du ${start.toLocaleDateString("fr-CA")} au ${end.toLocaleDateString("fr-CA")} (${days} j) — en attente.`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true, data: { newId: created.id } };
}

// 4) Upload justificatif (URL + nom) — l'upload binaire passe par l'API REST
export async function uploadLeaveAttachmentAction(
  input: { id: number; attachmentUrl: string; attachmentName: string },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  if (!input.attachmentUrl || !input.attachmentName) {
    return { success: false, error: t("url_et_nom_de_fichier_requis") };
  }

  const r = await prisma.leaveRequest.findUnique({ where: { id: input.id } });
  if (!r) return { success: false, error: "Demande introuvable" };

  // L'auteur OU un reviewer peut joindre un justificatif
  if (r.adminId !== actorId) {
    const canAct = await assertCanReviewLeave(actorId, r.adminId);
    if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };
  }

  await prisma.leaveRequest.update({
    where: { id: r.id },
    data: {
      attachmentUrl: input.attachmentUrl,
      attachmentName: input.attachmentName.slice(0, 200),
    },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "leave_request",
    entityId: r.id,
    changes: { attachmentUploaded: true, name: input.attachmentName },
  });

  // Notif RH si l'auteur a uploadé
  if (r.adminId === actorId) {
    const supervisors = await prisma.admin.findMany({
      where: {
        OR: [
          { customRole: { name: "super_admin" } },
          { directReports: { some: { id: r.adminId } } },
        ],
        isActive: true,
        id: { not: actorId },
      },
      select: { id: true },
    });
    if (supervisors.length > 0) {
      await prisma.notification.createMany({
        data: supervisors.map((s) => ({
          recipientType: "admin",
          recipientId: s.id,
          type: "info",
          title: t("justificatif_ajoute_a_une_demande_de_conge"),
          body: `Demande #${r.id} : ${input.attachmentName}`,
          link: "/admin/employes/conges",
          icon: "calendar",
        })),
        skipDuplicates: true,
      }).catch(() => null);
    }
  }

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// 5) Ajuster manuellement le solde de vacances d'un employé
export async function adjustLeaveBalanceAction(
  input: { employeeId: number; deltaDays: number; reason: string },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  if (!input.reason || input.reason.trim().length < 3) {
    return { success: false, error: t("une_raison_est_requise") };
  }
  if (!Number.isFinite(input.deltaDays) || input.deltaDays === 0) {
    return { success: false, error: t("delta_invalide_doit_etre_un_nombre_non") };
  }
  const delta = Math.round(input.deltaDays * 10) / 10;

  const canAct = await assertCanReviewLeave(actorId, input.employeeId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  // Cherche/crée la période courante via leave-balance helper
  const { getCurrentReferencePeriod } = await import("@/lib/services/leave-balance");
  const period = getCurrentReferencePeriod(new Date(), 5);

  let bal = await prisma.leaveBalance.findFirst({
    where: { adminId: input.employeeId, type: "vacation", periodStart: period.start },
  });
  if (!bal) {
    bal = await prisma.leaveBalance.create({
      data: {
        adminId: input.employeeId,
        type: "vacation",
        periodStart: period.start,
        periodEnd: period.end,
        accruedDays: 0,
        takenDays: 0,
        plannedDays: 0,
        carriedOverDays: 0,
      },
    });
  }

  // Ajoute un LeaveAccrual "manual_adjustment" + bump accruedDays sur LeaveBalance
  await prisma.$transaction([
    prisma.leaveAccrual.create({
      data: {
        adminId: input.employeeId,
        balanceId: bal.id,
        weekStart: new Date(),
        hoursWorked: 0,
        accruedDays: delta,
      },
    }),
    prisma.leaveBalance.update({
      where: { id: bal.id },
      data: { accruedDays: { increment: delta } },
    }),
  ]);

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "leave_balance",
    entityId: bal.id,
    changes: { manualAdjustment: true, delta, reason: input.reason, employeeId: input.employeeId },
  });

  await logSecurityEvent({
    adminId: input.employeeId,
    type: "profile_updated",
    severity: "warning",
    message: `Solde vacances ajusté manuellement de ${delta >= 0 ? "+" : ""}${delta} j`,
    metadata: { by: actorId, delta, reason: input.reason, balanceId: bal.id },
  });

  const sign = delta >= 0 ? "+" : "";
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: input.employeeId,
      type: "info",
      title: t("solde_de_conges_ajuste"),
      body: `Votre solde a été ajusté manuellement de ${sign}${delta} j. Raison : ${input.reason}`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// 6) Assigner / retirer une politique de congés à un employé
export async function assignLeavePolicyAction(
  input: { employeeId: number; policyId: number | null },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;

  const canAct = await assertCanReviewLeave(actorId, input.employeeId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  let policyName = t("aucune_defaut");
  if (input.policyId !== null) {
    const p = await prisma.leavePolicy.findUnique({ where: { id: input.policyId }, select: { name: true } });
    if (!p) return { success: false, error: "Politique introuvable" };
    policyName = p.name;
  }

  await prisma.admin.update({
    where: { id: input.employeeId },
    data: { leavePolicyId: input.policyId },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "admin",
    entityId: input.employeeId,
    changes: { leavePolicyId: input.policyId, policyName },
  });

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: input.employeeId,
      type: "info",
      title: t("nouvelle_politique_de_conges_assignee"),
      body: `Politique : ${policyName}`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// 7a) Bloquer les soumissions de congé d'un employé
export async function blockEmployeeLeaveAction(
  input: { employeeId: number; until: string; reason: string },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;
  if (!input.reason || input.reason.trim().length < 3) {
    return { success: false, error: t("une_raison_est_requise") };
  }
  const until = new Date(input.until);
  if (isNaN(until.getTime())) return { success: false, error: "Date invalide" };

  const canAct = await assertCanReviewLeave(actorId, input.employeeId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  await prisma.admin.update({
    where: { id: input.employeeId },
    data: {
      leaveBlockedUntil: until,
      leaveBlockedReason: input.reason.slice(0, 500),
    },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "admin",
    entityId: input.employeeId,
    changes: { leaveBlocked: true, until: until.toISOString(), reason: input.reason },
  });
  await logSecurityEvent({
    adminId: input.employeeId,
    type: "profile_updated",
    severity: "warning",
    message: t("soumissions_de_conge_bloquees_par_un_admin"),
    metadata: { by: actorId, until: until.toISOString(), reason: input.reason },
  });
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: input.employeeId,
      type: "warning",
      title: t("vos_soumissions_de_conge_sont_bloquees"),
      body: `Bloquées jusqu'au ${until.toLocaleDateString("fr-CA")}. Raison : ${input.reason}`,
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// 7b) Débloquer les soumissions
export async function unblockEmployeeLeaveAction(
  input: { employeeId: number },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;

  const canAct = await assertCanReviewLeave(actorId, input.employeeId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  await prisma.admin.update({
    where: { id: input.employeeId },
    data: { leaveBlockedUntil: null, leaveBlockedReason: null },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "admin",
    entityId: input.employeeId,
    changes: { leaveUnblocked: true },
  });
  await logSecurityEvent({
    adminId: input.employeeId,
    type: "profile_updated",
    severity: "info",
    message: t("soumissions_de_conge_debloquees_par_un_admin"),
    metadata: { by: actorId },
  });
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: input.employeeId,
      type: "success",
      title: t("vos_soumissions_de_conge_sont_a_nouveau"),
      body: t("vous_pouvez_de_nouveau_creer_des_demandes"),
      link: "/admin/mon-espace/conges",
      icon: "calendar",
    },
  }).catch(() => null);

  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// 8) Notifier directement un employé (ad-hoc)
const notifyEmployeeSchema = z.object({
  employeeId: z.number().int().positive(),
  subject: z.string().min(1).max(200),
  body: z.string().min(1).max(1000),
  link: z
    .string()
    .max(500)
    .regex(/^\/admin\//, "le_lien_doit_commencer_par_admin")
    .optional(),
});

// Defense in depth : meme si la regex /^\/admin\// devrait deja bloquer, on
// rejette explicitement les schemes dangereux pour eviter toute construction
// pathologique (ex: "/admin/..\\..\\javascript:...").
const FORBIDDEN_LINK_SCHEMES = /(^|[^a-z0-9])(javascript|data|vbscript|file):/i;
const FORBIDDEN_LINK_PREFIXES = /^(https?:|\/\/|javascript:|data:|vbscript:|file:)/i;

export async function notifyEmployeeDirectAction(
  input: { employeeId: number; subject: string; body: string; link?: string },
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const actorId = session.user.adminId!;

  const parsed = notifyEmployeeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  // Defense in depth sur le lien
  if (parsed.data.link) {
    if (FORBIDDEN_LINK_PREFIXES.test(parsed.data.link) || FORBIDDEN_LINK_SCHEMES.test(parsed.data.link)) {
      return { success: false, error: "Lien invalide (scheme refuse)." };
    }
  }

  const canAct = await assertCanReviewLeave(actorId, parsed.data.employeeId);
  if (!canAct) return { success: false, error: t(ERR_NO_AUTHORITY) };

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: parsed.data.employeeId,
      type: "info",
      title: parsed.data.subject,
      body: parsed.data.body,
      link: parsed.data.link ?? "/admin/mon-espace/conges",
      icon: "mail",
    },
  });

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "notification",
    entityId: 0,
    changes: { recipientId: parsed.data.employeeId, subject: parsed.data.subject },
  });

  return { success: true };
}

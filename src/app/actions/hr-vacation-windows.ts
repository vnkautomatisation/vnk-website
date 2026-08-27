"use server";
// Actions serveur pour les fenetres de selection de vacances (vacation bidding).
//
// Workflow :
//   1. RH cree une VacationSelectionWindow (draft) puis l'ouvre (status=open)
//   2. Pendant la periode openingDate -> closingDate, chaque employe soumet
//      jusqu'a 3 preferences (rank 1/2/3) via submitPreferenceAction
//   3. RH ferme la fenetre (status=closed) puis lance l'attribution :
//      allocateVacationsAction trie par anciennete (ou FCFS / manuel), tente
//      d'attribuer le choix #1, sinon #2, sinon #3 ; cree une LeaveRequest
//      approuvee pour chaque preference granted ; passe le status a "allocated"
import { z } from "zod";
import { getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { calculateWorkingDays } from "@/lib/services/leave-days";
import { unauthorized, forbidden } from "@/lib/refusals";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

const ERR_NO_AUTHORITY = "vous_n_avez_pas_l_autorite_pour_4";

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

// ─── CRUD fenetre ─────────────────────────────────────────────────
const createWindowSchema = z.object({
  name: z.string().min(2).max(100),
  openingDate: z.string(),
  closingDate: z.string(),
  coversFrom: z.string(),
  coversTo: z.string(),
  maxDaysPerEmployee: z.number().int().min(1).max(60).default(10),
  allocationMethod: z.enum(["seniority", "seniority_multi_round", "fcfs", "manual"]).default("seniority"),
  notes: z.string().max(500).optional().nullable(),
});

export async function createVacationWindowAction(input: z.infer<typeof createWindowSchema>): Promise<Result<{ id: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const parsed = createWindowSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const opening = new Date(parsed.data.openingDate);
  const closing = new Date(parsed.data.closingDate);
  const coversFrom = new Date(parsed.data.coversFrom);
  const coversTo = new Date(parsed.data.coversTo);
  if (isNaN(opening.getTime()) || isNaN(closing.getTime()) || isNaN(coversFrom.getTime()) || isNaN(coversTo.getTime())) {
    return { success: false, error: "Dates invalides" };
  }
  if (closing < opening) return { success: false, error: "closingDate < openingDate" };
  if (coversTo < coversFrom) return { success: false, error: "coversTo < coversFrom" };

  const row = await prisma.vacationSelectionWindow.create({
    data: {
      name: parsed.data.name,
      openingDate: opening,
      closingDate: closing,
      coversFrom,
      coversTo,
      maxDaysPerEmployee: parsed.data.maxDaysPerEmployee,
      allocationMethod: parsed.data.allocationMethod,
      notes: parsed.data.notes ?? null,
      status: "draft",
    },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "vacation_window", entityId: row.id });
  revalidatePath("/admin/employes/conges/fenetres");
  return { success: true, data: { id: row.id } };
}

export type VacationWindowStatus = "draft" | "open" | "closed" | "in_review" | "allocated" | "archived";

export async function updateVacationWindowStatusAction(input: { id: number; status: VacationWindowStatus }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const w = await prisma.vacationSelectionWindow.findUnique({ where: { id: input.id } });
  if (!w) return { success: false, error: "Fenetre introuvable" };

  // Transitions autorisees :
  //   draft -> open
  //   open -> closed
  //   closed -> in_review | allocated | open (rouvrir)
  //   in_review -> closed | allocated
  //   allocated -> archived
  //   archived (terminal)
  const allowed: Record<string, VacationWindowStatus[]> = {
    draft:     ["open"],
    open:      ["closed"],
    closed:    ["in_review", "allocated", "open"],
    in_review: ["closed", "allocated"],
    allocated: ["archived"],
    archived:  [],
  };
  if (!allowed[w.status]?.includes(input.status)) {
    return { success: false, error: `Transition ${w.status} -> ${input.status} non autorisee.` };
  }

  await prisma.vacationSelectionWindow.update({ where: { id: input.id }, data: { status: input.status } });
  await logAudit({ adminId, action: "update", entityType: "vacation_window", entityId: input.id, changes: { status: input.status } });

  // Quand on ouvre, notifier tous les employes actifs
  if (input.status === "open") {
    const actives = await prisma.admin.findMany({ where: { isActive: true }, select: { id: true } });
    if (actives.length > 0) {
      await prisma.notification.createMany({
        data: actives.map((a) => ({
          recipientType: "admin",
          recipientId: a.id,
          type: "info",
          title: `Fenetre de vacances ouverte : ${w.name}`,
          body: `Soumettez vos preferences avant le ${w.closingDate.toLocaleDateString("fr-CA")}.`,
          link: "/admin/mon-espace/conges",
          icon: "calendar",
        })),
        skipDuplicates: true,
      }).catch(() => null);
    }
  }

  // Quand on ferme manuellement (open -> closed), notifier RH (super_admins) et employes
  if (input.status === "closed" && w.status === "open") {
    const supers = await prisma.admin.findMany({
      where: { isActive: true, customRole: { name: "super_admin" } },
      select: { id: true },
    });
    if (supers.length > 0) {
      await prisma.notification.createMany({
        data: supers.map((s) => ({
          recipientType: "admin",
          recipientId: s.id,
          type: "info",
          title: `Fenetre fermee : ${w.name}`,
          body: t("prete_pour_la_revue_et_l_attribution"),
          link: "/admin/employes/conges/fenetres",
          icon: "calendar",
        })),
        skipDuplicates: true,
      }).catch(() => null);
    }
  }

  revalidatePath("/admin/employes/conges/fenetres");
  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

export async function deleteVacationWindowAction(input: { id: number }): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const w = await prisma.vacationSelectionWindow.findUnique({ where: { id: input.id } });
  if (!w) return { success: false, error: "Introuvable" };
  if (w.status === "allocated") return { success: false, error: t("impossible_de_supprimer_une_fenetre_dont_l") };
  await prisma.vacationSelectionWindow.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "vacation_window", entityId: input.id });
  revalidatePath("/admin/employes/conges/fenetres");
  return { success: true };
}

// ─── Soumission preferences (cote employe) ────────────────────────
const choiceSchema = z.object({
  rank: z.number().int().min(1).max(3),
  startDate: z.string(),
  endDate: z.string(),
});
const submitPreferencesSchema = z.object({
  windowId: z.number().int(),
  choices: z.array(choiceSchema).min(1).max(3),
});

export async function submitPreferencesAction(input: z.infer<typeof submitPreferencesSchema>): Promise<Result<{ count: number }>> {
  const t = await getTranslations("admin.action_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return unauthorized();
  const adminId = session.user.adminId!;
  const parsed = submitPreferencesSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const w = await prisma.vacationSelectionWindow.findUnique({ where: { id: parsed.data.windowId } });
  if (!w) return { success: false, error: "Fenetre introuvable" };
  if (w.status !== "open") return { success: false, error: t("cette_fenetre_n_est_pas_ouverte_aux") };
  const now = new Date();
  if (now < w.openingDate || now > w.closingDate) {
    return { success: false, error: t("hors_de_la_periode_de_soumission") };
  }

  // Valide chaque choix
  const parsedChoices: Array<{ rank: number; start: Date; end: Date; days: number }> = [];
  for (const c of parsed.data.choices) {
    const s = new Date(c.startDate);
    const e = new Date(c.endDate);
    if (isNaN(s.getTime()) || isNaN(e.getTime())) return { success: false, error: `Choix #${c.rank} : dates invalides.` };
    if (e < s) return { success: false, error: `Choix #${c.rank} : fin avant debut.` };
    if (s < w.coversFrom || e > w.coversTo) {
      return { success: false, error: `Choix #${c.rank} doit etre dans la periode ${w.coversFrom.toLocaleDateString("fr-CA")} -> ${w.coversTo.toLocaleDateString("fr-CA")}.` };
    }
    const days = await calculateWorkingDays(s, e);
    if (days <= 0) return { success: false, error: `Choix #${c.rank} : aucun jour ouvre.` };
    if (days > w.maxDaysPerEmployee) {
      return { success: false, error: `Choix #${c.rank} depasse le plafond ${w.maxDaysPerEmployee} jours.` };
    }
    parsedChoices.push({ rank: c.rank, start: s, end: e, days });
  }

  // Verifie unicite des rank
  const ranks = parsedChoices.map((c) => c.rank);
  if (new Set(ranks).size !== ranks.length) {
    return { success: false, error: t("chaque_choix_doit_avoir_un_rang_unique") };
  }

  // Reset les preferences existantes de cet employe pour cette fenetre, puis re-cree
  await prisma.vacationPreference.deleteMany({
    where: { windowId: parsed.data.windowId, adminId, status: "pending" },
  });

  await prisma.vacationPreference.createMany({
    data: parsedChoices.map((c) => ({
      windowId: parsed.data.windowId,
      adminId,
      rank: c.rank,
      startDate: c.start,
      endDate: c.end,
      daysCount: c.days,
      status: "pending",
    })),
    skipDuplicates: true,
  });

  await logAudit({ adminId, action: "create", entityType: "vacation_preference", entityId: parsed.data.windowId, changes: { count: parsedChoices.length } });
  revalidatePath("/admin/mon-espace/conges");
  return { success: true, data: { count: parsedChoices.length } };
}

// ─── Bulk transitions (ouvrir/fermer toutes les fenetres eligibles) ──
export async function bulkOpenWindowsAction(): Promise<Result<{ opened: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const drafts = await prisma.vacationSelectionWindow.findMany({
    where: { status: "draft" },
    select: { id: true, name: true, closingDate: true },
  });
  if (drafts.length === 0) return { success: true, data: { opened: 0 } };

  const ids = drafts.map((w) => w.id);
  await prisma.vacationSelectionWindow.updateMany({ where: { id: { in: ids } }, data: { status: "open" } });

  // Notifier tous les employes actifs
  const actives = await prisma.admin.findMany({ where: { isActive: true }, select: { id: true } });
  if (actives.length > 0) {
    const notifs = drafts.flatMap((w) =>
      actives.map((a) => ({
        recipientType: "admin" as const,
        recipientId: a.id,
        type: "info",
        title: `Fenetre de vacances ouverte : ${w.name}`,
        body: `Soumettez vos preferences avant le ${w.closingDate.toLocaleDateString("fr-CA")}.`,
        link: "/admin/mon-espace/conges",
        icon: "calendar",
      })),
    );
    await prisma.notification.createMany({ data: notifs, skipDuplicates: true }).catch(() => null);
  }
  await logAudit({ adminId, action: "update", entityType: "vacation_window", entityId: 0, changes: { bulk_open: ids } });
  revalidatePath("/admin/employes/conges/fenetres");
  return { success: true, data: { opened: drafts.length } };
}

export async function bulkCloseWindowsAction(): Promise<Result<{ closed: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const opens = await prisma.vacationSelectionWindow.findMany({
    where: { status: "open" },
    select: { id: true, name: true, preferences: { select: { adminId: true } } },
  });
  if (opens.length === 0) return { success: true, data: { closed: 0 } };

  const ids = opens.map((w) => w.id);
  await prisma.vacationSelectionWindow.updateMany({ where: { id: { in: ids } }, data: { status: "closed" } });

  const supers = await prisma.admin.findMany({
    where: { isActive: true, customRole: { name: "super_admin" } },
    select: { id: true },
  });
  if (supers.length > 0) {
    const notifs = opens.flatMap((w) => {
      const unique = new Set(w.preferences.map((p) => p.adminId)).size;
      return supers.map((s) => ({
        recipientType: "admin" as const,
        recipientId: s.id,
        type: "warning",
        title: `Fenetre fermee : ${w.name}`,
        body: `${unique} employe${unique > 1 ? "s" : ""} a soumis. Lancez l'attribution.`,
        link: "/admin/employes/conges/fenetres",
        icon: "calendar",
      }));
    });
    await prisma.notification.createMany({ data: notifs, skipDuplicates: true }).catch(() => null);
  }
  await logAudit({ adminId, action: "update", entityType: "vacation_window", entityId: 0, changes: { bulk_close: ids } });
  revalidatePath("/admin/employes/conges/fenetres");
  return { success: true, data: { closed: opens.length } };
}

// ─── Simulation/preview de l'attribution (sandbox) ────────────────
// Retourne ce qui SERAIT attribue sans rien creer ni modifier.
export type SimulationResult = {
  granted: Array<{ adminId: number; fullName: string; rank: number; startDate: string; endDate: string; daysCount: number }>;
  denied: Array<{ adminId: number; fullName: string; reasons: string[] }>;
  conflicts: Array<{ adminId: number; fullName: string; reason: string }>;
};

export async function simulateAllocationAction(input: { id: number }): Promise<Result<SimulationResult>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const w = await prisma.vacationSelectionWindow.findUnique({ where: { id: input.id } });
  if (!w) return { success: false, error: "Fenetre introuvable" };
  if (w.status !== "closed" && w.status !== "in_review" && w.status !== "open") {
    return { success: false, error: t("simulation_possible_uniquement_sur_fenetre_ouverte_fermee") };
  }

  const preferences = await prisma.vacationPreference.findMany({
    where: { windowId: input.id, status: "pending" },
    orderBy: [{ adminId: "asc" }, { rank: "asc" }],
  });
  if (preferences.length === 0) return { success: true, data: { granted: [], denied: [], conflicts: [] } };

  const byAdmin = new Map<number, typeof preferences>();
  for (const p of preferences) {
    if (!byAdmin.has(p.adminId)) byAdmin.set(p.adminId, []);
    byAdmin.get(p.adminId)!.push(p);
  }
  const adminIds = Array.from(byAdmin.keys());
  const adminsToOrder = await prisma.admin.findMany({
    where: { id: { in: adminIds } },
    select: { id: true, fullName: true, email: true, startDate: true, createdAt: true },
  });
  const adminMap = new Map(adminsToOrder.map((a) => [a.id, a]));
  const adminLabel = (id: number) => adminMap.get(id)?.fullName || adminMap.get(id)?.email || `#${id}`;

  let adminOrder: number[];
  if (w.allocationMethod === "fcfs") {
    const firstPrefByAdmin = new Map<number, Date>();
    for (const p of preferences) {
      const cur = firstPrefByAdmin.get(p.adminId);
      if (!cur || p.createdAt < cur) firstPrefByAdmin.set(p.adminId, p.createdAt);
    }
    adminOrder = adminIds.sort((a, b) =>
      (firstPrefByAdmin.get(a)?.getTime() ?? 0) - (firstPrefByAdmin.get(b)?.getTime() ?? 0),
    );
  } else {
    adminOrder = adminIds.sort((a, b) => {
      const ad = adminMap.get(a)?.startDate ?? adminMap.get(a)?.createdAt ?? new Date(8640000000000000);
      const bd = adminMap.get(b)?.startDate ?? adminMap.get(b)?.createdAt ?? new Date(8640000000000000);
      return ad.getTime() - bd.getTime();
    });
  }

  // Chevauchements existants (LeaveRequest deja approved/pending)
  const existingLeaves = await prisma.leaveRequest.findMany({
    where: {
      adminId: { in: adminIds },
      status: { in: ["approved", "pending"] },
      startDate: { lte: w.coversTo },
      endDate: { gte: w.coversFrom },
    },
    select: { adminId: true, startDate: true, endDate: true },
  });

  const granted: SimulationResult["granted"] = [];
  const denied: SimulationResult["denied"] = [];
  const conflicts: SimulationResult["conflicts"] = [];

  for (const adId of adminOrder) {
    const prefs = byAdmin.get(adId) ?? [];
    let allocated = false;
    const reasons: string[] = [];
    for (const pref of prefs) {
      const overlap = existingLeaves.some(
        (l) => l.adminId === adId && l.startDate <= pref.endDate && l.endDate >= pref.startDate,
      );
      if (overlap) {
        reasons.push(`Rang #${pref.rank} chevauche un conge existant.`);
        continue;
      }
      granted.push({
        adminId: adId,
        fullName: adminLabel(adId),
        rank: pref.rank,
        startDate: pref.startDate.toISOString().slice(0, 10),
        endDate: pref.endDate.toISOString().slice(0, 10),
        daysCount: Number(pref.daysCount),
      });
      allocated = true;
      break;
    }
    if (!allocated) {
      denied.push({ adminId: adId, fullName: adminLabel(adId), reasons });
    }
  }

  // Detection conflits inter-employes : meme date avec >30% du scope absent
  const dateMap = new Map<string, number>();
  for (const g of granted) {
    const s = new Date(g.startDate);
    const e = new Date(g.endDate);
    const cur = new Date(s);
    while (cur <= e) {
      const k = cur.toISOString().slice(0, 10);
      dateMap.set(k, (dateMap.get(k) ?? 0) + 1);
      cur.setDate(cur.getDate() + 1);
    }
  }
  const activesCount = await prisma.admin.count({ where: { isActive: true } });
  const threshold = Math.max(1, Math.ceil(activesCount * 0.3));
  const heavyDates = Array.from(dateMap.entries()).filter(([, n]) => n >= threshold);
  for (const [date, n] of heavyDates) {
    conflicts.push({
      adminId: 0,
      fullName: "",
      reason: `${date} : ${n} employe${n > 1 ? "s" : ""} simultanement absents (>30% du scope).`,
    });
  }

  return { success: true, data: { granted, denied, conflicts } };
}

// ─── Attribution (cote RH) ────────────────────────────────────────
// Mode standard (seniority/fcfs/manual) : pour chaque employe trie, tente #1 → #2 → #3.
// Mode "seniority_multi_round" (CHU-style) : on fait des rondes :
//   - Ronde 1 : attribuer le choix #1 de chaque employe trie par anciennete
//   - Ronde 2 : les employes sans rien obtiennent leur choix #2 (si dispo)
//   - Ronde 3 : ceux qui n'ont toujours rien obtiennent leur choix #3 (si dispo)
// Le rapport detaille indique le nombre attribue par ronde + denied.
export async function allocateVacationsAction(
  input: { id: number },
): Promise<Result<{ granted: number; denied: number; round1Granted?: number; round2Granted?: number; round3Granted?: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };

  const w = await prisma.vacationSelectionWindow.findUnique({ where: { id: input.id } });
  if (!w) return { success: false, error: "Fenetre introuvable" };
  if (w.status !== "closed" && w.status !== "in_review") {
    return { success: false, error: t("la_fenetre_doit_etre_fermee_ou_en") };
  }

  // Charge toutes les preferences pending
  const preferences = await prisma.vacationPreference.findMany({
    where: { windowId: input.id, status: "pending" },
    orderBy: [{ adminId: "asc" }, { rank: "asc" }],
  });
  if (preferences.length === 0) {
    await prisma.vacationSelectionWindow.update({ where: { id: input.id }, data: { status: "allocated" } });
    return { success: true, data: { granted: 0, denied: 0 } };
  }

  // Map adminId -> liste de preferences triees par rank
  const byAdmin = new Map<number, typeof preferences>();
  for (const p of preferences) {
    if (!byAdmin.has(p.adminId)) byAdmin.set(p.adminId, []);
    byAdmin.get(p.adminId)!.push(p);
  }

  // Tri des employes : seniority/multi_round = startDate asc, fcfs = createdAt asc
  const adminsToOrder = await prisma.admin.findMany({
    where: { id: { in: Array.from(byAdmin.keys()) } },
    select: { id: true, startDate: true, createdAt: true },
  });
  const adminOrder: number[] = (() => {
    if (w.allocationMethod === "fcfs") {
      const firstPrefByAdmin = new Map<number, Date>();
      for (const p of preferences) {
        const cur = firstPrefByAdmin.get(p.adminId);
        if (!cur || p.createdAt < cur) firstPrefByAdmin.set(p.adminId, p.createdAt);
      }
      return Array.from(byAdmin.keys()).sort((a, b) =>
        (firstPrefByAdmin.get(a)?.getTime() ?? 0) - (firstPrefByAdmin.get(b)?.getTime() ?? 0),
      );
    }
    const adminMap = new Map(adminsToOrder.map((a) => [a.id, a]));
    return Array.from(byAdmin.keys()).sort((a, b) => {
      const ad = adminMap.get(a)?.startDate ?? adminMap.get(a)?.createdAt ?? new Date(8640000000000000);
      const bd = adminMap.get(b)?.startDate ?? adminMap.get(b)?.createdAt ?? new Date(8640000000000000);
      return ad.getTime() - bd.getTime();
    });
  })();

  const isMultiRound = w.allocationMethod === "seniority_multi_round";

  // Track des employes deja attribues
  const allocatedByAdmin = new Map<number, { prefId: number; leaveId: number; rank: number; days: number; start: Date; end: Date }>();

  // Helper : tente d'attribuer une pref pour un admin (verifie chevauchement LeaveRequest existant).
  // Wrappe dans une $transaction pour eviter les race conditions entre find + create + update.
  const tryAllocatePref = async (adId: number, pref: (typeof preferences)[number]): Promise<{ ok: true; leaveId: number } | { ok: false }> => {
    if (allocatedByAdmin.has(adId)) return { ok: false };
    try {
      const result = await prisma.$transaction(async (tx) => {
        const overlap = await tx.leaveRequest.findFirst({
          where: {
            adminId: adId,
            status: { in: ["approved", "pending"] },
            startDate: { lte: pref.endDate },
            endDate: { gte: pref.startDate },
          },
          select: { id: true },
        });
        if (overlap) return null;

        const leave = await tx.leaveRequest.create({
          data: {
            adminId: adId,
            type: "vacation",
            startDate: pref.startDate,
            endDate: pref.endDate,
            daysCount: pref.daysCount,
            status: "approved",
            reviewerId: adminId,
            reviewedAt: new Date(),
            reviewNotes: `Attribuee via fenetre "${w.name}" (rang ${pref.rank}${isMultiRound ? `, ronde ${pref.rank}` : ""})`,
          },
          select: { id: true },
        });
        await tx.vacationPreference.update({
          where: { id: pref.id },
          data: { status: "granted", leaveRequestId: leave.id },
        });
        return leave.id;
      });
      if (result === null) return { ok: false };
      allocatedByAdmin.set(adId, {
        prefId: pref.id,
        leaveId: result,
        rank: pref.rank,
        days: Number(pref.daysCount),
        start: pref.startDate,
        end: pref.endDate,
      });
      return { ok: true, leaveId: result };
    } catch {
      return { ok: false };
    }
  };

  let round1Granted = 0;
  let round2Granted = 0;
  let round3Granted = 0;

  if (isMultiRound) {
    // Ronde 1 : choix #1 pour chacun
    for (const adId of adminOrder) {
      const prefs = byAdmin.get(adId) ?? [];
      const choice1 = prefs.find((p) => p.rank === 1);
      if (!choice1) continue;
      const res = await tryAllocatePref(adId, choice1);
      if (res.ok) round1Granted++;
    }
    // Ronde 2 : ceux non attribues -> choix #2
    for (const adId of adminOrder) {
      if (allocatedByAdmin.has(adId)) continue;
      const prefs = byAdmin.get(adId) ?? [];
      const choice2 = prefs.find((p) => p.rank === 2);
      if (!choice2) continue;
      const res = await tryAllocatePref(adId, choice2);
      if (res.ok) round2Granted++;
    }
    // Ronde 3 : ceux non attribues -> choix #3
    for (const adId of adminOrder) {
      if (allocatedByAdmin.has(adId)) continue;
      const prefs = byAdmin.get(adId) ?? [];
      const choice3 = prefs.find((p) => p.rank === 3);
      if (!choice3) continue;
      const res = await tryAllocatePref(adId, choice3);
      if (res.ok) round3Granted++;
    }
  } else {
    // Mode standard (seniority/fcfs/manual) : pour chaque admin, on essaie 1 → 2 → 3
    for (const adId of adminOrder) {
      const prefs = byAdmin.get(adId) ?? [];
      for (const pref of prefs) {
        const res = await tryAllocatePref(adId, pref);
        if (res.ok) break;
      }
    }
  }

  // Toutes les preferences non granted -> denied + notifs batchees
  let denied = 0;
  const idsToReject: number[] = [];
  const notifRows: Array<{
    recipientType: string;
    recipientId: number;
    type: string;
    title: string;
    body: string;
    link: string;
    icon: string;
  }> = [];

  for (const adId of adminOrder) {
    const prefs = byAdmin.get(adId) ?? [];
    const allocated = allocatedByAdmin.get(adId);
    const toReject = prefs.filter((p) => p.id !== allocated?.prefId);
    if (toReject.length > 0) {
      idsToReject.push(...toReject.map((p) => p.id));
      denied += toReject.length;
    }
    if (allocated) {
      notifRows.push({
        recipientType: "admin",
        recipientId: adId,
        type: "success",
        title: `Vacances attribuees : ${w.name}`,
        body: `Choix #${allocated.rank} accorde : du ${allocated.start.toLocaleDateString("fr-CA")} au ${allocated.end.toLocaleDateString("fr-CA")} (${allocated.days} j).`,
        link: "/admin/mon-espace/conges",
        icon: "calendar",
      });
    } else {
      notifRows.push({
        recipientType: "admin",
        recipientId: adId,
        type: "warning",
        title: `Vacances non attribuees : ${w.name}`,
        body: t("aucun_de_vos_choix_n_a_pu"),
        link: "/admin/mon-espace/conges",
        icon: "calendar",
      });
    }
  }

  if (idsToReject.length > 0) {
    await prisma.vacationPreference.updateMany({
      where: { id: { in: idsToReject } },
      data: { status: "denied" },
    });
  }
  if (notifRows.length > 0) {
    await prisma.notification.createMany({ data: notifRows, skipDuplicates: true }).catch(() => null);
  }

  await prisma.vacationSelectionWindow.update({
    where: { id: input.id },
    data: { status: "allocated" },
  });

  const granted = allocatedByAdmin.size;
  await logAudit({
    adminId,
    action: "update",
    entityType: "vacation_window",
    entityId: input.id,
    changes: {
      allocated: granted,
      denied,
      method: w.allocationMethod,
      ...(isMultiRound ? { round1Granted, round2Granted, round3Granted } : {}),
    },
  });
  revalidatePath("/admin/employes/conges/fenetres");
  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/mon-espace/conges");
  return {
    success: true,
    data: isMultiRound
      ? { granted, denied, round1Granted, round2Granted, round3Granted }
      : { granted, denied },
  };
}

// ─── Edition manuelle des preferences avant lock (in_review) ──────
// Permet a RH de forcer une preference en granted/denied/pending avant l'attribution finale.
// Si granted manuel : on cree la LeaveRequest correspondante.
// Si denied/pending : on retire le statut (et supprime le LeaveRequest lie s'il y en a un).
const updatePrefSchema = z.object({
  id: z.number().int(),
  status: z.enum(["pending", "granted", "denied"]),
});
export async function updateVacationPreferenceAction(
  input: z.infer<typeof updatePrefSchema>,
): Promise<Result> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const parsed = updatePrefSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const pref = await prisma.vacationPreference.findUnique({
    where: { id: parsed.data.id },
    include: { window: { select: { id: true, name: true, status: true } } },
  });
  if (!pref) return { success: false, error: "Preference introuvable" };
  if (!pref.window) return { success: false, error: "Fenetre introuvable" };
  if (pref.window.status !== "closed" && pref.window.status !== "in_review") {
    return { success: false, error: t("edition_manuelle_uniquement_quand_fenetre_fermee_ou") };
  }

  // Cas 1 : on veut granted, mais une autre pref du meme employe est deja granted -> erreur
  if (parsed.data.status === "granted") {
    const otherGranted = await prisma.vacationPreference.findFirst({
      where: {
        windowId: pref.window.id,
        adminId: pref.adminId,
        status: "granted",
        id: { not: pref.id },
      },
      select: { id: true, rank: true },
    });
    if (otherGranted) {
      return { success: false, error: `Le rang #${otherGranted.rank} est deja accorde pour cet employe.` };
    }
    // Chevauchement avec un LeaveRequest existant approuve/pending ?
    const overlap = await prisma.leaveRequest.findFirst({
      where: {
        adminId: pref.adminId,
        status: { in: ["approved", "pending"] },
        startDate: { lte: pref.endDate },
        endDate: { gte: pref.startDate },
      },
      select: { id: true },
    });
    if (overlap) return { success: false, error: t("conflit_avec_une_demande_de_conge_existante_2") };

    // Cree la LeaveRequest approuvee + lie a la preference
    const leave = await prisma.leaveRequest.create({
      data: {
        adminId: pref.adminId,
        type: "vacation",
        startDate: pref.startDate,
        endDate: pref.endDate,
        daysCount: pref.daysCount,
        status: "approved",
        reviewerId: adminId,
        reviewedAt: new Date(),
        reviewNotes: `Accorde manuellement par RH (fenetre "${pref.window.name}", rang ${pref.rank})`,
      },
      select: { id: true },
    });
    await prisma.vacationPreference.update({
      where: { id: pref.id },
      data: { status: "granted", leaveRequestId: leave.id },
    });
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: pref.adminId,
        type: "success",
        title: `Vacances accordees (revue manuelle) : ${pref.window.name}`,
        body: `Du ${pref.startDate.toLocaleDateString("fr-CA")} au ${pref.endDate.toLocaleDateString("fr-CA")} (${pref.daysCount} j) — rang ${pref.rank}.`,
        link: "/admin/mon-espace/conges",
        icon: "calendar",
      },
    }).catch(() => null);
  } else {
    // Cas 2 : denied ou pending -> si la pref etait granted avec un LeaveRequest lie, annuler ce dernier
    if (pref.status === "granted" && pref.leaveRequestId) {
      await prisma.leaveRequest.updateMany({
        where: { id: pref.leaveRequestId, status: "approved" },
        data: {
          status: "cancelled",
          reviewerId: adminId,
          reviewedAt: new Date(),
          reviewNotes: `Annulee suite a revue manuelle (fenetre "${pref.window.name}")`,
        },
      });
    }
    await prisma.vacationPreference.update({
      where: { id: pref.id },
      data: { status: parsed.data.status, leaveRequestId: parsed.data.status === "denied" ? null : pref.leaveRequestId },
    });
  }

  await logAudit({
    adminId,
    action: "update",
    entityType: "vacation_preference",
    entityId: pref.id,
    changes: { from: pref.status, to: parsed.data.status, manual: true },
  });
  revalidatePath("/admin/employes/conges/fenetres");
  revalidatePath("/admin/mon-espace/conges");
  return { success: true };
}

// ─── Reversibilite : annuler une attribution complete (P1-12) ─────
// Permet a RH/super_admin de defaire l'attribution d'une fenetre :
//   - Toutes les LeaveRequest issues de l'attribution sont supprimees (cascade TimeClock).
//   - Toutes les preferences granted sont reset a pending (et leaveRequestId = null).
//   - La fenetre repasse a "closed" pour permettre re-attribution.
//   - Tous les employes concernes sont notifies.
const unallocateSchema = z.object({
  windowId: z.number().int().positive(),
  reason: z.string().min(3).max(500),
});

export async function unallocateVacationsAction(
  input: z.infer<typeof unallocateSchema>,
): Promise<Result<{ unallocated: number; deletedLeaves: number; affectedEmployees: number }>> {
  const t = await getTranslations("admin.action_errors");
  const adminId = await requireAdminWrite();
  if (!adminId) return { success: false, error: t(ERR_NO_AUTHORITY) };
  const parsed = unallocateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: t(parsed.error.errors[0].message) };

  const w = await prisma.vacationSelectionWindow.findUnique({
    where: { id: parsed.data.windowId },
    select: { id: true, name: true, status: true },
  });
  if (!w) return { success: false, error: "Fenetre introuvable" };
  if (w.status !== "allocated") {
    return { success: false, error: t("l_unallocation_n_est_possible_que_sur") };
  }

  // Charge toutes les preferences granted avec leaveRequestId
  const grantedPrefs = await prisma.vacationPreference.findMany({
    where: { windowId: parsed.data.windowId, leaveRequestId: { not: null } },
    select: { id: true, adminId: true, leaveRequestId: true, startDate: true, endDate: true, daysCount: true, rank: true },
  });

  const leaveIds = grantedPrefs
    .map((p) => p.leaveRequestId)
    .filter((id): id is number => id !== null);
  const affectedAdminIds = Array.from(new Set(grantedPrefs.map((p) => p.adminId)));

  // Securite : refuse si l'un des leaveRequest est dans une periode payee (TimeClock payStubId)
  if (leaveIds.length > 0) {
    const noteStubs = leaveIds.map((id) => `[CONGÉ AUTO - LeaveRequest #${id}]`);
    const paid = await prisma.timeClock.findFirst({
      where: {
        payStubId: { not: null },
        OR: noteStubs.map((s) => ({ notes: { startsWith: s } })),
      },
      select: { id: true },
    });
    if (paid) {
      return {
        success: false,
        error: t("au_moins_une_attribution_est_deja_payee"),
      };
    }
  }

  let unallocated = 0;
  let deletedLeaves = 0;

  try {
    await prisma.$transaction(async (tx) => {
      if (leaveIds.length > 0) {
        // Supprime les TimeClock auto-crees (non-payes) avant le delete LeaveRequest pour
        // eviter tout etat orphelin (la cascade onDelete n'est pas garantie ici).
        const noteStubs = leaveIds.map((id) => `[CONGÉ AUTO - LeaveRequest #${id}]`);
        await tx.timeClock.deleteMany({
          where: {
            payStubId: null,
            OR: noteStubs.map((s) => ({ notes: { startsWith: s } })),
          },
        });
        // Reset les FK leaveRequestId AVANT delete (la FK est SetNull mais on s'assure)
        await tx.vacationPreference.updateMany({
          where: { windowId: parsed.data.windowId, leaveRequestId: { in: leaveIds } },
          data: { leaveRequestId: null },
        });
        const del = await tx.leaveRequest.deleteMany({
          where: { id: { in: leaveIds } },
        });
        deletedLeaves = del.count;
      }
      // Reset toutes les preferences de la window a pending (granted/denied -> pending)
      const upd = await tx.vacationPreference.updateMany({
        where: { windowId: parsed.data.windowId },
        data: { status: "pending", leaveRequestId: null },
      });
      unallocated = upd.count;
      // Window repasse a closed pour permettre re-attribution
      await tx.vacationSelectionWindow.update({
        where: { id: parsed.data.windowId },
        data: { status: "closed" },
      });
    });
  } catch (err) {
    console.error("[unallocateVacationsAction] transaction failed", err);
    return { success: false, error: t("echec_de_la_transaction_aucune_modification_appliquee") };
  }

  // Resync balances pour les vacances (hors transaction)
  const { syncBalanceForRequest } = await import("@/lib/services/leave-balance");
  await Promise.all(
    grantedPrefs.map((p) =>
      syncBalanceForRequest(
        p.adminId,
        "vacation",
        { id: p.leaveRequestId ?? 0, daysCount: Number(p.daysCount), status: "cancelled" },
        "cancel",
      ).catch(() => null),
    ),
  );

  // Notifs batchees aux employes affectes
  if (affectedAdminIds.length > 0) {
    await prisma.notification.createMany({
      data: affectedAdminIds.map((adId) => ({
        recipientType: "admin",
        recipientId: adId,
        type: "warning",
        title: `Attribution annulee : ${w.name}`,
        body: `L'attribution de vos vacances a ete annulee. Motif : ${parsed.data.reason}`,
        link: "/admin/mon-espace/conges",
        icon: "calendar",
      })),
      skipDuplicates: true,
    }).catch(() => null);
  }

  await logAudit({
    adminId,
    action: "update",
    entityType: "vacation_window",
    entityId: parsed.data.windowId,
    changes: {
      unallocate: true,
      reason: parsed.data.reason,
      unallocated,
      deletedLeaves,
      affectedEmployees: affectedAdminIds.length,
    },
  });
  await logSecurityEvent({
    adminId,
    type: "profile_updated",
    severity: "warning",
    message: `Unallocation de la fenetre de vacances "${w.name}"`,
    metadata: {
      windowId: parsed.data.windowId,
      reason: parsed.data.reason,
      affectedEmployees: affectedAdminIds.length,
      deletedLeaves,
    },
  });

  revalidatePath("/admin/employes/conges/fenetres");
  revalidatePath("/admin/employes/conges");
  revalidatePath("/admin/employes/pointage");
  revalidatePath("/admin/mon-espace/conges");
  revalidatePath("/admin/mon-espace/pointage");

  return {
    success: true,
    data: { unallocated, deletedLeaves, affectedEmployees: affectedAdminIds.length },
  };
}

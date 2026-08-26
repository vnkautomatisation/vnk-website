"use server";
// Actions pointage horaire employé.
// L'employé pointe lui-même son entrée/sortie ; un superviseur peut approuver.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { startOfWeek } from "@/lib/week";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

type Result<T = void> = ({ success: true } & (T extends void ? object : { data: T })) | { success: false; error: string };

// Revalide toutes les routes liees au pointage (admin liste, mon-espace, dashboard)
function revalidateTimeclock() {
  revalidatePath("/admin/employes/pointage");
  revalidatePath("/admin/mon-espace/pointage");
  revalidatePath("/admin/mon-espace");
}

async function requirePayrollWrite(): Promise<number | null> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return null;
  const adminId = session.user.adminId!;
  const admin = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  if (!admin) return null;
  const perms = (admin.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isSuper = admin.customRole?.name === "super_admin";
  return (isSuper || (perms.payroll ?? []).includes("write") || (perms.users ?? []).includes("write") || (perms.timeclock ?? []).includes("write") || (perms.hr ?? []).includes("write")) ? adminId : null;
}

async function isSuperAdmin(adminId: number): Promise<boolean> {
  const a = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  return a?.customRole?.name === "super_admin";
}

async function isFounderAdmin(adminId: number): Promise<boolean> {
  // SQL brut : resilient si le client Prisma n'est pas regenere apres ajout
  // du champ is_founder.
  try {
    const rows = await prisma.$queryRaw<{ is_founder: boolean }[]>`
      SELECT is_founder FROM admins WHERE id = ${adminId} LIMIT 1
    `;
    return rows[0]?.is_founder === true;
  } catch {
    return false;
  }
}

// ── Regle metier : pas d'auto-approbation des heures ──
// Un manager/HR non-fondateur ne peut PAS approuver/rejeter/debloquer ses propres
// entrees. Seul son superieur (ou le fondateur) peut. Le fondateur est la racine
// de la pyramide : personne au-dessus, donc il peut tout faire y compris sur soi.
async function canReviewTargets(actorId: number, targetAdminIds: number[]): Promise<boolean> {
  if (!targetAdminIds.some((id) => id === actorId)) return true;
  return isFounderAdmin(actorId);
}

// ── Securite : verifie que l'acteur a l'autorite hierarchique sur la cible ──
// Cumule : (1) anti-self-approval (sauf fondateur) ET (2) scope hierarchique.
// Returns true si l'acteur peut gerer cet employe :
//   - Fondateur OU super_admin OU permissions users.write / hr.write / payroll.write -> ok
//   - Sinon : doit etre manager direct (target.managerId === actorId)
//     OU chef d'une equipe dont la cible fait partie (team.leadAdminId === actorId)
async function assertCanReviewAdmin(actorId: number, targetAdminId: number): Promise<boolean> {
  // (1) Anti-self-approval (sauf fondateur)
  if (!(await canReviewTargets(actorId, [targetAdminId]))) return false;

  // (2) Scope hierarchique
  const actor = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!actor) return false;

  // Fondateur OU super_admin : bypass scope
  if (await isFounderAdmin(actorId)) return true;
  if (actor.customRole?.name === "super_admin") return true;

  const perms = (actor.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr =
    (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write")
    || (perms.payroll ?? []).includes("write")
    || (perms.timeclock ?? []).includes("write");
  if (isHr) return true;

  // Sinon, le target doit etre dans le scope hierarchique de l'acteur
  const target = await prisma.admin.findUnique({
    where: { id: targetAdminId },
    select: { managerId: true, teamId: true },
  });
  if (!target) return false;

  if (target.managerId === actorId) return true;

  if (target.teamId != null) {
    const team = await prisma.team.findUnique({
      where: { id: target.teamId },
      select: { leadAdminId: true },
    });
    if (team?.leadAdminId === actorId) return true;
  }

  return false;
}

// ── Verification bulk : evite le N+1 en pre-chargeant tous les targets en
// une seule query, puis valide en memoire. Conserve les memes regles que
// assertCanReviewAdmin (anti-self-approval + scope hierarchique).
async function assertCanReviewMany(actorId: number, targetAdminIds: number[]): Promise<boolean> {
  const unique = Array.from(new Set(targetAdminIds));
  if (unique.length === 0) return true;

  // (1) Anti-self-approval (sauf fondateur)
  if (!(await canReviewTargets(actorId, unique))) return false;

  // (2) Privileges actor : founder / super_admin / users.write / hr.write / payroll.write -> bypass scope
  const actor = await prisma.admin.findUnique({
    where: { id: actorId },
    include: { customRole: true },
  });
  if (!actor) return false;

  if (await isFounderAdmin(actorId)) return true;
  if (actor.customRole?.name === "super_admin") return true;

  const perms = (actor.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr =
    (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write")
    || (perms.payroll ?? []).includes("write")
    || (perms.timeclock ?? []).includes("write");
  if (isHr) return true;

  // (3) Sinon : pre-load tous les targets et les teams en 2 queries, verif en memoire
  const targets = await prisma.admin.findMany({
    where: { id: { in: unique } },
    select: { id: true, managerId: true, teamId: true },
  });
  if (targets.length !== unique.length) return false;

  const teamIds = Array.from(new Set(targets.map((t) => t.teamId).filter((id): id is number => id != null)));
  const teams = teamIds.length > 0
    ? await prisma.team.findMany({
        where: { id: { in: teamIds } },
        select: { id: true, leadAdminId: true },
      })
    : [];
  const teamLeadById = new Map(teams.map((t) => [t.id, t.leadAdminId]));

  for (const t of targets) {
    if (t.managerId === actorId) continue;
    if (t.teamId != null && teamLeadById.get(t.teamId) === actorId) continue;
    return false;
  }
  return true;
}

const ERR_NO_AUTHORITY = "Vous n'avez pas l'autorité pour gérer cet employé.";

// ── Helper : verifie qu'une date n'est pas dans une PayPeriod verrouillee/payee ──
// Retourne null si ok, sinon un message d'erreur a renvoyer.
// "paid" : refus dur, meme pour super_admin / fondateur.
// "locked" : refus sauf isPrivileged (super_admin OU fondateur).
async function checkPayPeriodForDate(date: Date, isPrivileged: boolean): Promise<string | null> {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  const period = await prisma.payPeriod.findFirst({
    where: { startDate: { lte: day }, endDate: { gte: day } },
    select: { status: true, startDate: true, endDate: true },
  });
  if (!period) return null;
  if (period.status === "paid") {
    return `La période du ${period.startDate.toLocaleDateString("fr-CA")} au ${period.endDate.toLocaleDateString("fr-CA")} est déjà payée — contactez RH.`;
  }
  if (period.status === "locked" && !isPrivileged) {
    return `La période du ${period.startDate.toLocaleDateString("fr-CA")} au ${period.endDate.toLocaleDateString("fr-CA")} est verrouillée — contactez RH.`;
  }
  return null;
}

async function getActorName(adminId: number): Promise<string> {
  const a = await prisma.admin.findUnique({ where: { id: adminId }, select: { fullName: true, email: true } });
  return a?.fullName || a?.email || `Admin#${adminId}`;
}

// ── Garde-fou : refuse toute action de pointage si le compte est desactive.
// Retourne un Result d'erreur si KO, null si OK.
async function assertAccountActive(adminId: number): Promise<{ success: false; error: string } | null> {
  const a = await prisma.admin.findUnique({ where: { id: adminId }, select: { isActive: true } });
  if (!a || !a.isActive) {
    return { success: false, error: "Compte désactivé — contactez RH." };
  }
  return null;
}

// ── Clock-in ────────────────────────────────────────────────
// REGLE : jobCodeId est OBLIGATOIRE si l'employe a au moins 1 code actif pour
// son poste. Sinon (poste sans codes configures) on autorise pointer sans code.
// Optional lat/lng: GPS capture (settings hr_pointage). When geofencing is
// enabled, web punches outside the configured radius are rejected.
export async function clockInAction(input: { jobCodeId?: number; category?: string; notes?: string; lat?: number; lng?: number }): Promise<Result<{ id: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  // Garde-fou : refus si le compte est desactive
  const inactive = await assertAccountActive(adminId);
  if (inactive) return inactive;

  // Verifier qu'il n'y a pas deja un pointage ouvert
  const open = await prisma.timeClock.findFirst({
    where: { adminId, clockOut: null },
  });
  if (open) return { success: false, error: "Vous avez déjà un pointage ouvert — fermez-le d'abord" };

  // Charger le poste de l'employe + codes dispos
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { positionId: true },
  });
  const availableCodes = me?.positionId
    ? await prisma.jobCode.findMany({
        where: { positionId: me.positionId, isActive: true },
        select: { id: true, code: true },
      })
    : [];

  let jobCodeId: number | null = null;
  if (availableCodes.length > 0) {
    // Au moins 1 code dispo : obligatoire
    if (!input.jobCodeId) {
      return { success: false, error: "Choisissez un code de tâche pour commencer" };
    }
    const valid = availableCodes.find((c) => c.id === input.jobCodeId);
    if (!valid) return { success: false, error: "Code de tâche invalide pour votre poste" };
    jobCodeId = valid.id;
  }

  const cat = ["work", "break", "meeting", "training"].includes(input.category ?? "") ? input.category! : "work";

  // Feature settings: rounding + geolocation + geofencing.
  const { getTimeclockConfig, roundToStep, sanitizeCoords, geofenceError } =
    await import("@/lib/services/timeclock-config");
  const cfg = await getTimeclockConfig();
  const coords = sanitizeCoords(input.lat, input.lng);
  const fenceErr = geofenceError(cfg, coords, "web");
  if (fenceErr) return { success: false, error: fenceErr };

  const tc = await prisma.timeClock.create({
    data: {
      adminId,
      clockIn: roundToStep(new Date(), cfg.roundingMin),
      category: cat,
      notes: input.notes?.slice(0, 500) ?? null,
      jobCodeId,
      // Cast: columns may be missing from a stale generated client.
      ...({
        clockInLat: coords?.lat ?? null,
        clockInLng: coords?.lng ?? null,
      } as object),
    },
    select: { id: true },
  });
  await logAudit({ adminId, action: "create", entityType: "time_clock", entityId: tc.id, changes: { jobCodeId } });
  revalidateTimeclock();
  return { success: true, data: { id: tc.id } };
}

// ── Clock-out ───────────────────────────────────────────────
// Si une pause est en cours au moment du clockOut, on la ferme automatiquement
// (ajoute la duree de la pause au total avant de calculer la duree travaillee).
export async function clockOutAction(input?: { lat?: number; lng?: number }): Promise<Result<{ durationMin: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  // Garde-fou : refus si le compte est desactive
  const inactive = await assertAccountActive(adminId);
  if (inactive) return inactive;

  const open = await prisma.timeClock.findFirst({
    where: { adminId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (!open) return { success: false, error: "Aucun pointage ouvert" };

  // Feature settings: rounding + geolocation capture at clock-out.
  const { getTimeclockConfig, roundToStep, sanitizeCoords } =
    await import("@/lib/services/timeclock-config");
  const cfg = await getTimeclockConfig();
  const coords = sanitizeCoords(input?.lat, input?.lng);
  // Rounded, but never before the (already rounded) clock-in.
  const rawNow = new Date();
  const rounded = roundToStep(rawNow, cfg.roundingMin);
  const now = rounded.getTime() > open.clockIn.getTime() ? rounded : rawNow;
  // ── Verification PayPeriod : refus si paid (toujours) ou locked (sauf privileges) ──
  // Verifie a la fois la date d'ouverture du shift ET le moment present (fin).
  const isPrivileged = (await isFounderAdmin(adminId)) || (await isSuperAdmin(adminId));
  const ppOpenErr = await checkPayPeriodForDate(open.clockIn, isPrivileged);
  if (ppOpenErr) return { success: false, error: ppOpenErr };
  const ppNowErr = await checkPayPeriodForDate(now, isPrivileged);
  if (ppNowErr) return { success: false, error: ppNowErr };

  // Ferme la pause en cours si necessaire (repas = deduite, payee = tracee).
  let totalBreakMin = open.totalBreakMin;
  let paidBreakMin = ((open as unknown as { paidBreakMin?: number }).paidBreakMin) ?? 0;
  if (open.pausedAt) {
    const added = Math.floor((now.getTime() - open.pausedAt.getTime()) / 60000);
    if (((open as unknown as { pausedKind?: string | null }).pausedKind) === "paid") {
      paidBreakMin += added;
    } else {
      totalBreakMin += added;
    }
  }
  const elapsedMin = Math.floor((now.getTime() - open.clockIn.getTime()) / 60000);
  const durationMin = Math.max(0, elapsedMin - totalBreakMin);

  await prisma.timeClock.update({
    where: { id: open.id },
    data: {
      clockOut: now,
      durationMin,
      pausedAt: null,
      totalBreakMin,
      // Cast: columns may be missing from a stale generated client.
      ...({
        paidBreakMin,
        pausedKind: null,
        clockOutLat: coords?.lat ?? null,
        clockOutLng: coords?.lng ?? null,
      } as object),
    },
  });
  await logAudit({ adminId, action: "update", entityType: "time_clock", entityId: open.id, changes: { closed: true, durationMin, totalBreakMin } });

  // Real-time overtime alert: notify employee + direct manager the first
  // time the weekly worked total crosses the 40h threshold (QC default).
  try {
    if (["work", "meeting", "training"].includes(open.category)) {
      const OVERTIME_THRESHOLD_MIN = 40 * 60;
      const ws = startOfWeek(now);
      const weekEndExcl = new Date(ws);
      weekEndExcl.setDate(weekEndExcl.getDate() + 7);
      const agg = await prisma.timeClock.aggregate({
        where: {
          adminId,
          clockIn: { gte: ws, lt: weekEndExcl },
          clockOut: { not: null },
          category: { in: ["work", "meeting", "training"] },
        },
        _sum: { durationMin: true },
      });
      const totalAfter = agg._sum.durationMin ?? 0;
      const totalBefore = totalAfter - durationMin;
      if (totalBefore < OVERTIME_THRESHOLD_MIN && totalAfter >= OVERTIME_THRESHOLD_MIN) {
        const me2 = await prisma.admin.findUnique({
          where: { id: adminId },
          select: { fullName: true, email: true, managerId: true },
        });
        const hours = Math.floor(totalAfter / 60);
        const mins = totalAfter % 60;
        await prisma.notification.create({
          data: {
            recipientType: "admin",
            recipientId: adminId,
            type: "warning",
            title: "Seuil de 40 h atteint cette semaine",
            body: `Vous avez cumulé ${hours} h ${String(mins).padStart(2, "0")} cette semaine — les heures suivantes comptent en temps supplémentaire.`,
            link: "/admin/mon-espace/pointage",
            icon: "clock",
          },
        }).catch(() => null);
        if (me2?.managerId) {
          await prisma.notification.create({
            data: {
              recipientType: "admin",
              recipientId: me2.managerId,
              type: "warning",
              title: "Temps supplémentaire dans votre équipe",
              body: `${me2.fullName ?? me2.email} a dépassé 40 h cette semaine (${hours} h ${String(mins).padStart(2, "0")}).`,
              link: "/admin/employes/pointage",
              icon: "clock",
            },
          }).catch(() => null);
        }
      }
    }
  } catch {
    /* best-effort: never block the clock-out */
  }

  revalidateTimeclock();
  return { success: true, data: { durationMin } };
}

// ── Pause ──────────────────────────────────────────────────
// Two kinds (QC norms):
//   - "meal" (default): UNPAID — deducted from worked time (totalBreakMin)
//   - "paid": short coffee break — tracked but NOT deducted (paidBreakMin)
export async function pauseClockAction(input?: { kind?: "meal" | "paid" }): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  // Garde-fou : refus si le compte est desactive
  const inactive = await assertAccountActive(adminId);
  if (inactive) return inactive;

  const open = await prisma.timeClock.findFirst({
    where: { adminId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (!open) return { success: false, error: "Aucun pointage en cours" };
  if (open.pausedAt) return { success: false, error: "Deja en pause" };

  // Verifie que la PayPeriod du shift en cours n'est pas verrouillee/payee.
  const isPrivilegedP = (await isFounderAdmin(adminId)) || (await isSuperAdmin(adminId));
  const ppErrP = await checkPayPeriodForDate(open.clockIn, isPrivilegedP);
  if (ppErrP) return { success: false, error: ppErrP };

  const kind = input?.kind === "paid" ? "paid" : "meal";
  await prisma.timeClock.update({
    where: { id: open.id },
    data: {
      pausedAt: new Date(),
      ...({ pausedKind: kind } as object),
    },
  });
  await logAudit({ adminId, action: "update", entityType: "time_clock", entityId: open.id, changes: { paused: true, kind } });
  revalidateTimeclock();
  return { success: true };
}

// ── Reprendre ──────────────────────────────────────────────
// L'employe revient de pause. On ajoute la duree de la pause au total cumule.
export async function resumeClockAction(): Promise<Result<{ breakAddedMin: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  // Garde-fou : refus si le compte est desactive
  const inactive = await assertAccountActive(adminId);
  if (inactive) return inactive;

  const open = await prisma.timeClock.findFirst({
    where: { adminId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (!open) return { success: false, error: "Aucun pointage en cours" };
  if (!open.pausedAt) return { success: false, error: "Pas en pause" };

  // Verifie PayPeriod du shift en cours.
  const isPrivilegedR = (await isFounderAdmin(adminId)) || (await isSuperAdmin(adminId));
  const ppErrR = await checkPayPeriodForDate(open.clockIn, isPrivilegedR);
  if (ppErrR) return { success: false, error: ppErrR };

  const now = new Date();
  const breakAddedMin = Math.max(0, Math.floor((now.getTime() - open.pausedAt.getTime()) / 60000));
  const runningKind =
    ((open as unknown as { pausedKind?: string | null }).pausedKind) === "paid" ? "paid" : "meal";
  await prisma.timeClock.update({
    where: { id: open.id },
    data: {
      pausedAt: null,
      // Meal break: deducted. Paid break: tracked separately, not deducted.
      ...(runningKind === "paid"
        ? ({
            paidBreakMin:
              (((open as unknown as { paidBreakMin?: number }).paidBreakMin) ?? 0) + breakAddedMin,
          } as object)
        : { totalBreakMin: open.totalBreakMin + breakAddedMin }),
      ...({ pausedKind: null } as object),
    },
  });
  await logAudit({ adminId, action: "update", entityType: "time_clock", entityId: open.id, changes: { resumed: true, breakAddedMin, kind: runningKind } });
  revalidateTimeclock();
  return { success: true, data: { breakAddedMin } };
}

// ── Saisie manuelle d'une période ──────────────────────────
// `targetAdminId` optionnel : un manager/HR peut créer une entry pour un employé
// de son scope (utile pour rattraper un oubli identifié dans "Pointages du jour").
// Si absent, l'entry est créée pour l'utilisateur courant.
const manualSchema = z.object({
  clockIn: z.string(),
  clockOut: z.string(),
  category: z.enum(["work", "break", "meeting", "training", "sick", "vacation"]).default("work"),
  notes: z.string().max(500).nullable().optional(),
  targetAdminId: z.number().int().positive().optional(),
});

// ── Saisie manuelle : workflow complet de bout en bout ──────────────────
//
// CYCLE COMPLET (de la saisie a la paie) :
//
//   1. CLOCK-IN/OUT REEL ou SAISIE MANUELLE
//      → cree l'entry en "brouillon"
//      → submittedAt = null, approvedAt = null
//      → l'employe peut encore modifier / supprimer
//
//   2. L'EMPLOYE CLIQUE "Soumettre la semaine"
//      → submitWeekTimeClocksAction marque submittedAt = now sur les entries
//        de la semaine
//      → les entries deviennent VERROUILLEES pour l'employe (cadenas affiche)
//      → notification envoyee au superviseur direct (managerId)
//
//   3. LE SUPERVISEUR APPROUVE ou REJETTE
//      → approveTimeClockAction : approvedAt + approvedBy
//      → ou rejectTimeClockAction : retire submittedAt + ajoute note de rejet
//
//   4. CYCLE DE PAIE BI-HEBDO
//      → PayPeriod.status = "locked" : paie en cours, modifications interdites
//      → PayPeriod.status = "paid"   : bulletins emis, intouchable
//
// REGLES D'ACCES :
//   - Employe / manager : ne peut PAS saisir dans une PayPeriod "locked"
//   - Super_admin / founder : peut saisir meme dans une periode "locked",
//     mais pas "paid" (debloquer le bulletin d'abord)
//   - Tous : refus si futur, si > 16h, si chevauchement
const MAX_HOURS_PER_ENTRY = 16;

export async function manualTimeEntryAction(input: z.infer<typeof manualSchema>): Promise<Result<{ id: number; submittedForApproval: boolean }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const actorId = session.user.adminId!;
  const parsed = manualSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // ── Saisie pour autrui (manager/HR rattrape un oubli) ──
  // On vérifie que l'acteur a l'autorité sur la cible. Sinon, la saisie reste
  // pour soi-même (comportement historique).
  let adminId = actorId;
  if (parsed.data.targetAdminId && parsed.data.targetAdminId !== actorId) {
    if (!(await assertCanReviewAdmin(actorId, parsed.data.targetAdminId))) {
      return { success: false, error: ERR_NO_AUTHORITY };
    }
    adminId = parsed.data.targetAdminId;
  }

  const ci = new Date(parsed.data.clockIn);
  const co = new Date(parsed.data.clockOut);
  if (isNaN(ci.getTime()) || isNaN(co.getTime())) return { success: false, error: "Dates invalides" };
  if (co <= ci) return { success: false, error: "L'heure de fin doit être après le début" };

  const durationMs = co.getTime() - ci.getTime();
  if (durationMs > MAX_HOURS_PER_ENTRY * 60 * 60 * 1000) {
    return { success: false, error: `Période > ${MAX_HOURS_PER_ENTRY}h refusée — saisissez plusieurs entrées` };
  }

  const nowDate = new Date();
  if (ci > nowDate) return { success: false, error: "Date de début dans le futur refusée" };
  if (co > nowDate) return { success: false, error: "Date de fin dans le futur refusée" };

  // ── Niveau d'autorite : super_admin ou founder = bypass des periodes "locked" ──
  // Check basé sur l'acteur (qui exécute), pas la cible (qui peut être un employé
  // standard pour qui un manager rattrape une saisie).
  const isFounder = await isFounderAdmin(actorId);
  const isSuper = await isSuperAdmin(actorId);
  const isPrivileged = isFounder || isSuper;

  // ── Verification de la PayPeriod qui couvre la date ─────────────────
  // On cherche la periode qui contient le jour de ci. Si la periode est
  // verrouillee ou payee, on refuse (sauf super_admin pour "locked").
  const ciDay = new Date(ci); ciDay.setHours(0, 0, 0, 0);
  const coDay = new Date(co); coDay.setHours(23, 59, 59, 999);
  const period = await prisma.payPeriod.findFirst({
    where: {
      startDate: { lte: ciDay },
      endDate: { gte: ciDay },
    },
    select: { id: true, status: true, startDate: true, endDate: true, payDate: true },
  });

  if (period) {
    if (period.status === "paid") {
      return {
        success: false,
        error: `La période du ${period.startDate.toLocaleDateString("fr-CA")} au ${period.endDate.toLocaleDateString("fr-CA")} est déjà payée — non modifiable.`,
      };
    }
    if (period.status === "locked" && !isPrivileged) {
      return {
        success: false,
        error: `La période du ${period.startDate.toLocaleDateString("fr-CA")} au ${period.endDate.toLocaleDateString("fr-CA")} est verrouillée pour calcul de paie. Contactez RH.`,
      };
    }
  }

  // ── Refus si chevauchement avec un pointage deja sur un bulletin ──
  // (defense en profondeur au cas ou une PayPeriod aurait ete supprimee mais
  // pas le PayStub lie)
  const paidEntry = await prisma.timeClock.findFirst({
    where: { adminId, clockIn: { gte: ciDay, lte: coDay }, payStubId: { not: null } },
    select: { id: true, clockIn: true },
  });
  if (paidEntry) {
    return {
      success: false,
      error: `La journée du ${paidEntry.clockIn.toLocaleDateString("fr-CA")} est déjà sur un bulletin de paie — non modifiable.`,
    };
  }

  // ── Chevauchement avec un pointage existant (open ou non) ──
  // Cas 1 : entry fermee qui chevauche [ci, co]
  // Cas 2 : entry ouverte (clockOut=null) dont le clockIn precede notre co
  //         -> elle court potentiellement jusqu'a maintenant et entre dans [ci, co]
  const overlap = await prisma.timeClock.findFirst({
    where: {
      adminId,
      OR: [
        { AND: [{ clockOut: { not: null } }, { clockIn: { lt: co } }, { clockOut: { gt: ci } }] },
        { clockOut: null, clockIn: { lt: co } },
      ],
    },
    select: { id: true, clockIn: true },
  });
  if (overlap) {
    return { success: false, error: `Chevauchement avec un pointage existant le ${overlap.clockIn.toLocaleDateString("fr-CA")}` };
  }

  const durationMin = Math.floor(durationMs / 60000);
  // L'entry nait en "brouillon" : pas soumise, pas approuvee. L'employe peut
  // encore la modifier ou supprimer jusqu'a ce qu'il clique "Soumettre la
  // semaine" — c'est CE bouton qui declenche la notification au superviseur
  // et le verrouillage. Pas d'auto-soumission ici.
  const tc = await prisma.timeClock.create({
    data: {
      adminId,
      clockIn: ci,
      clockOut: co,
      durationMin,
      category: parsed.data.category,
      notes: parsed.data.notes ?? null,
      isManual: true,
      submittedAt: null,
      approvedAt: null,
      approvedBy: null,
    },
    select: { id: true },
  });

  await logAudit({
    adminId: actorId, action: "create", entityType: "time_clock", entityId: tc.id,
    changes: { manual: true, durationMin, payPeriodId: period?.id ?? null, targetAdminId: adminId !== actorId ? adminId : undefined },
  });
  revalidateTimeclock();
  return { success: true, data: { id: tc.id, submittedForApproval: false } };
}

function fmtHoursShort(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h${m.toString().padStart(2, "0")}`;
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
  // Workflow rule: submitted entries are locked — unlock request required
  // (founder excepted).
  if (tc.submittedAt && !(await isFounderAdmin(adminId))) {
    return { success: false, error: "Entrée soumise — demandez un déblocage avant de supprimer" };
  }

  await prisma.timeClock.delete({ where: { id: input.id } });
  await logAudit({ adminId, action: "delete", entityType: "time_clock", entityId: input.id });
  revalidateTimeclock();
  return { success: true };
}

// Helper : crée un snapshot pour potentielle annulation (24h TTL)
async function createSnapshot(actorId: number, reason: string, payload: unknown): Promise<number> {
  const snap = await prisma.timeClockSnapshot.create({
    data: {
      actorId,
      reason,
      payload: payload as object,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    select: { id: true },
  });
  return snap.id;
}

// ── Fusion des pointages "work" d'une même journée ──────────
// Combine toutes les entrées non-approuvées/non-payées de la journée en une seule
// (clockIn = plus tôt, clockOut = plus tard, durationMin = somme).
export async function mergeDayTimeClockAction(
  input: { date: string },
): Promise<Result<{ id: number; snapshotId: number; groups: number; punches: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  // Plage [date 00:00, date+1 00:00) en local
  const day = new Date(input.date + "T00:00:00");
  if (isNaN(day.getTime())) return { success: false, error: "Date invalide" };
  const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);

  const entries = await prisma.timeClock.findMany({
    where: {
      adminId,
      clockIn: { gte: day, lt: next },
      clockOut: { not: null },
      approvedAt: null,
      payStubId: null,
      // Server-side mirror of the UI rule: submitted entries are locked and
      // cannot be silently un-submitted by a merge.
      submittedAt: null,
      category: "work",
    },
    orderBy: { clockIn: "asc" },
  });
  if (entries.length < 2) return { success: false, error: "Rien à fusionner (besoin de 2+ pointages éligibles)" };

  // A merged entry spans first start -> last end, so any gap inside it is time
  // that was not worked. Only the mis-punch case (out and back in within
  // minutes) may be bridged. Instead of refusing the whole day when one gap is
  // too wide, split the punches into runs and merge each run separately.
  const MAX_GAP_MIN = 15;
  const runs: (typeof entries)[] = [];
  let run: typeof entries = [entries[0]];
  for (let i = 1; i < entries.length; i++) {
    const gap = Math.round((entries[i].clockIn.getTime() - entries[i - 1].clockOut!.getTime()) / 60000);
    if (gap <= MAX_GAP_MIN) run.push(entries[i]);
    else { runs.push(run); run = [entries[i]]; }
  }
  runs.push(run);
  const mergeable = runs.filter((r) => r.length >= 2);
  if (mergeable.length === 0) {
    return {
      success: false,
      error: `Aucun pointage à fusionner : ils sont tous séparés de plus de ${MAX_GAP_MIN} minutes. Les fusionner créerait des heures non travaillées.`,
    };
  }

  const allIds = mergeable.flatMap((r) => r.map((e) => e.id));
  // Snapshot before a destructive action (undo restores every punch).
  const snapshotId = await createSnapshot(adminId, "merge_day", {
    entries: mergeable.flat().map((e) => ({
      adminId: e.adminId,
      clockIn: e.clockIn.toISOString(),
      clockOut: e.clockOut?.toISOString() ?? null,
      durationMin: e.durationMin,
      category: e.category,
      notes: e.notes,
      jobCodeId: e.jobCodeId,
      isManual: e.isManual,
      pausedAt: e.pausedAt?.toISOString() ?? null,
      totalBreakMin: e.totalBreakMin,
    })),
  });

  const createdIds = await prisma.$transaction(async (tx) => {
    await tx.timeClock.deleteMany({ where: { id: { in: allIds } } });
    const out: number[] = [];
    for (const group of mergeable) {
      const totalMin = group.reduce((s, e) => s + (e.durationMin ?? 0), 0);
      // Gaps inside the bracket are recorded as break time, so
      // gross - breaks = worked and the bracket stays truthful.
      const gapMin = group.slice(1).reduce((s, e, i) => {
        return s + Math.max(0, Math.round((e.clockIn.getTime() - group[i].clockOut!.getTime()) / 60000));
      }, 0);
      const jobCodeIds = Array.from(new Set(group.map((e) => e.jobCodeId).filter((x): x is number => x != null)));
      const created = await tx.timeClock.create({
        data: {
          adminId,
          clockIn: group[0].clockIn,
          clockOut: group[group.length - 1].clockOut!,
          durationMin: totalMin,
          category: "work",
          notes: `[FUSION de ${group.length} pointages]${gapMin > 0 ? ` — ${gapMin} min entre les pointages comptées en pause` : ""}`,
          totalBreakMin: group.reduce((s, e) => s + (e.totalBreakMin ?? 0), 0) + gapMin,
          jobCodeId: jobCodeIds.length === 1 ? jobCodeIds[0] : null,
          ...({
            paidBreakMin: group.reduce(
              (s, e) => s + (((e as unknown as { paidBreakMin?: number }).paidBreakMin) ?? 0),
              0,
            ),
          } as object),
        },
        select: { id: true },
      });
      out.push(created.id);
    }
    return out;
  });

  await logAudit({ adminId, action: "update", entityType: "time_clock_bulk", changes: { merged: allIds, into: createdIds, snapshotId } });
  revalidateTimeclock();
  return {
    success: true,
    data: { id: createdIds[0], snapshotId, groups: createdIds.length, punches: allIds.length },
  };
}

// ── Suppression des pointages courts (< maxMin minutes) d'une journée ──
export async function deleteShortTimeClockAction(input: { date: string; maxMin: number }): Promise<Result<{ deleted: number; snapshotId: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;

  const day = new Date(input.date + "T00:00:00");
  if (isNaN(day.getTime())) return { success: false, error: "Date invalide" };
  const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
  const maxMin = Math.max(1, Math.min(60, Math.floor(input.maxMin || 5)));

  const targets = await prisma.timeClock.findMany({
    where: {
      adminId,
      clockIn: { gte: day, lt: next },
      durationMin: { lt: maxMin, not: null },
      approvedAt: null,
      payStubId: null,
    },
  });
  if (targets.length === 0) return { success: false, error: "Aucun pointage court à supprimer" };

  const ids = targets.map((t) => t.id);

  const snapshotId = await createSnapshot(adminId, "delete_short", {
    entries: targets.map((e) => ({
      adminId: e.adminId,
      clockIn: e.clockIn.toISOString(),
      clockOut: e.clockOut?.toISOString() ?? null,
      durationMin: e.durationMin,
      category: e.category,
      notes: e.notes,
      jobCodeId: e.jobCodeId,
      isManual: e.isManual,
      pausedAt: e.pausedAt?.toISOString() ?? null,
      totalBreakMin: e.totalBreakMin,
    })),
  });

  const r = await prisma.timeClock.deleteMany({ where: { id: { in: ids } } });
  await logAudit({ adminId, action: "delete", entityType: "time_clock_bulk", changes: { deletedShorts: ids, maxMin, snapshotId } });
  revalidateTimeclock();
  return { success: true, data: { deleted: r.count, snapshotId } };
}

// ── Approbation par superviseur ────────────────────────────
export async function approveTimeClockAction(input: { ids: number[] }): Promise<Result<{ approved: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé (rôle paie/RH requis)" };
  if (!Array.isArray(input.ids) || input.ids.length === 0) return { success: false, error: "Aucune entrée fournie" };

  // Pas d'auto-approbation + check du scope hierarchique sur chaque adminId cible.
  const targets = await prisma.timeClock.findMany({
    where: { id: { in: input.ids } },
    select: { adminId: true },
  });
  const targetAdminIds = Array.from(new Set(targets.map((t) => t.adminId)));
  if (!(await canReviewTargets(actorId, targetAdminIds))) {
    return { success: false, error: "Vous ne pouvez pas approuver vos propres heures" };
  }
  if (!(await assertCanReviewMany(actorId, targetAdminIds))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }

  // Workflow rule: only SUBMITTED entries can be approved (drafts stay with
  // the employee until they submit the week).
  const r = await prisma.timeClock.updateMany({
    where: { id: { in: input.ids }, approvedAt: null, payStubId: null, submittedAt: { not: null } },
    data: { approvedBy: actorId, approvedAt: new Date() },
  });
  if (r.count === 0) {
    return { success: false, error: "Aucune entrée soumise à approuver — l'employé doit d'abord soumettre sa semaine" };
  }

  // Notifier chaque employé dont le pointage vient d'être approuvé (batch)
  const approved = await prisma.timeClock.findMany({
    where: { id: { in: input.ids }, approvedBy: actorId },
    select: { id: true, adminId: true, clockIn: true },
  });
  if (approved.length > 0) {
    await prisma.notification.createMany({
      data: approved.map((e) => ({
        recipientType: "admin",
        recipientId: e.adminId,
        type: "success",
        title: "Pointage approuvé",
        body: `Pointage du ${e.clockIn.toLocaleDateString("fr-CA")} validé.`,
        link: "/admin/mon-espace/pointage",
        icon: "check-circle",
      })),
    }).catch(() => null);

    // Historique : trace fine par entry (alimente le popover "Historique")
    await prisma.timeClockHistory.createMany({
      data: approved.map((e) => ({
        timeClockId: e.id,
        actorId,
        event: "approved",
      })),
    }).catch(() => null);
  }

  await logAudit({ adminId: actorId, action: "update", entityType: "time_clock_bulk", changes: { approved: r.count, ids: input.ids } });
  revalidateTimeclock();
  return { success: true, data: { approved: r.count } };
}

// ── Approuver toute la semaine en cours d'un employé ──────
export async function approveWeekTimeClockAction(input: { adminId: number; weekStart?: string }): Promise<Result<{ approved: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé (rôle paie/RH requis)" };

  if (!(await canReviewTargets(actorId, [input.adminId]))) {
    return { success: false, error: "Vous ne pouvez pas approuver vos propres heures" };
  }
  if (!(await assertCanReviewAdmin(actorId, input.adminId))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }

  // Current week (Sunday -> Saturday, project convention) or explicit weekStart.
  // Date-only strings are parsed as LOCAL midnight (UTC parse would shift a day).
  const ref = input.weekStart
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(input.weekStart) ? input.weekStart + "T00:00:00" : input.weekStart)
    : new Date();
  if (isNaN(ref.getTime())) return { success: false, error: "Date invalide" };
  const weekStartD = startOfWeek(ref);
  const weekEndExcl = new Date(weekStartD);
  weekEndExcl.setDate(weekEndExcl.getDate() + 7);

  const targets = await prisma.timeClock.findMany({
    where: {
      adminId: input.adminId,
      clockIn: { gte: weekStartD, lt: weekEndExcl },
      clockOut: { not: null },
      approvedAt: null,
      payStubId: null,
      // Workflow rule: approval only on submitted entries.
      submittedAt: { not: null },
    },
    select: { id: true },
  });
  if (targets.length === 0) {
    // Message clarifie : distinguer "rien dans la semaine" vs "tout deja approuve"
    const totalThisWeek = await prisma.timeClock.count({
      where: {
        adminId: input.adminId,
        clockIn: { gte: weekStartD, lt: weekEndExcl },
        clockOut: { not: null },
      },
    });
    if (totalThisWeek === 0) {
      return { success: false, error: "Aucun pointage cette semaine pour cet employé" };
    }
    return { success: false, error: "Tous les pointages de la semaine sont déjà approuvés ou payés" };
  }

  return approveTimeClockAction({ ids: targets.map((t) => t.id) });
}

// ── Annulation d'une approbation (revient à "En attente") ────
// Le superviseur revient sur sa décision : approvedAt + approvedBy mis à null,
// submittedAt conservé (l'entry reste "soumise" et apparaît à nouveau dans
// "À approuver"). Refusé si l'entrée est déjà sur un bulletin de paie.
// Trace via audit log + notification à l'employé.
export async function unapproveTimeClockAction(input: { ids: number[]; reason?: string }): Promise<Result<{ unapproved: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé (rôle paie/RH requis)" };
  if (!Array.isArray(input.ids) || input.ids.length === 0) return { success: false, error: "Aucune entrée fournie" };

  const targets = await prisma.timeClock.findMany({
    where: { id: { in: input.ids } },
    select: { id: true, adminId: true, clockIn: true, payStubId: true, approvedAt: true, notes: true },
  });
  if (targets.length === 0) return { success: false, error: "Aucune entrée trouvée" };

  // Refus dur si au moins une est déjà payée
  const paid = targets.filter((t) => t.payStubId != null);
  if (paid.length > 0) {
    return { success: false, error: "Une ou plusieurs entrées sont déjà sur un bulletin de paie — non modifiables" };
  }

  const targetAdminIds = Array.from(new Set(targets.map((t) => t.adminId)));
  if (!(await canReviewTargets(actorId, targetAdminIds))) {
    return { success: false, error: "Vous ne pouvez pas modifier vos propres approbations" };
  }
  if (!(await assertCanReviewMany(actorId, targetAdminIds))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }

  // Filtre : seules les entries effectivement approuvées
  const approvedTargets = targets.filter((t) => t.approvedAt != null);
  if (approvedTargets.length === 0) return { success: false, error: "Aucune entrée approuvée à annuler" };

  // ── Pas de préfixage des notes ── l'historique vit dans `TimeClockHistory`.
  // Bulk update : on garde les notes user intactes, on retire juste l'approbation.
  const r = await prisma.timeClock.updateMany({
    where: { id: { in: approvedTargets.map((t) => t.id) }, payStubId: null },
    data: { approvedAt: null, approvedBy: null },
  });
  const unapproved = r.count;

  // Historique : un événement "unapproved" par entry effectivement annulée
  if (unapproved > 0) {
    await prisma.timeClockHistory.createMany({
      data: approvedTargets.map((t) => ({
        timeClockId: t.id,
        actorId,
        event: "unapproved",
        reason: input.reason ?? null,
      })),
    }).catch(() => null);

    // Notifier chaque employé concerné (un message par entry annulée)
    await prisma.notification.createMany({
      data: approvedTargets.map((t) => ({
        recipientType: "admin",
        recipientId: t.adminId,
        type: "warning",
        title: "Approbation annulée",
        body: `L'approbation du pointage du ${t.clockIn.toLocaleDateString("fr-CA")} a été annulée${input.reason ? ` : ${input.reason}` : ""}.`,
        link: "/admin/mon-espace/pointage",
        icon: "alert-circle",
      })),
    }).catch(() => null);
  }

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "time_clock_bulk",
    changes: { unapproved, ids: approvedTargets.map((t) => t.id), reason: input.reason ?? null },
  });
  revalidateTimeclock();
  return { success: true, data: { unapproved } };
}

// ── Rejet (renvoie à l'employé) ────────────────────────────
export async function rejectTimeClockAction(input: { id: number; reason: string }): Promise<Result<{ snapshotId: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  const tc = await prisma.timeClock.findUnique({ where: { id: input.id } });
  if (!tc) return { success: false, error: "Introuvable" };
  if (tc.payStubId) return { success: false, error: "Déjà sur un bulletin — débloquer le bulletin d'abord" };
  if (!tc.submittedAt && !tc.approvedAt) {
    return { success: false, error: "Entrée non soumise — rien à rejeter (brouillon de l'employé)" };
  }
  if (!(await canReviewTargets(actorId, [tc.adminId]))) {
    return { success: false, error: "Vous ne pouvez pas rejeter vos propres heures" };
  }
  if (!(await assertCanReviewAdmin(actorId, tc.adminId))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }

  const snapshotId = await createSnapshot(actorId, "reject", {
    entries: [{
      id: tc.id,
      adminId: tc.adminId,
      clockIn: tc.clockIn.toISOString(),
      clockOut: tc.clockOut?.toISOString() ?? null,
      durationMin: tc.durationMin,
      category: tc.category,
      notes: tc.notes,
      approvedBy: tc.approvedBy,
      approvedAt: tc.approvedAt?.toISOString() ?? null,
      submittedAt: tc.submittedAt?.toISOString() ?? null,
    }],
  });

  // Rejet = retour en brouillon : reset submittedAt pour que l'employe puisse
  // re-modifier l'entry sans demande de deblocage. Trace dans TimeClockHistory
  // (les notes utilisateur ne sont plus polluées).
  await prisma.timeClock.update({
    where: { id: input.id },
    data: {
      approvedAt: null,
      approvedBy: null,
      submittedAt: null,
    },
  });

  // Historique : événement "rejected" avec raison
  await prisma.timeClockHistory.create({
    data: {
      timeClockId: input.id,
      actorId,
      event: "rejected",
      reason: input.reason,
    },
  }).catch(() => null);

  // Notifier l'employé du rejet
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: tc.adminId,
      type: "warning",
      title: "Pointage rejeté",
      body: `Pointage du ${tc.clockIn.toLocaleDateString("fr-CA")} rejeté : ${input.reason}`,
      link: "/admin/mon-espace/pointage",
      icon: "alert-triangle",
    },
  }).catch(() => null);

  await logAudit({ adminId: actorId, action: "update", entityType: "time_clock", entityId: input.id, changes: { rejected: true, reason: input.reason, snapshotId } });
  revalidateTimeclock();
  return { success: true, data: { snapshotId } };
}

// ── Bulk rejet : 1 seul round-trip SQL via updateMany + createMany ────────
// Avant : N appels individuels a rejectTimeClockAction (lent + surcharge audit/snapshot).
// Maintenant : un snapshot global + updateMany + createMany (history + notifications).
export async function rejectManyTimeClockAction(
  input: { ids: number[]; reason: string },
): Promise<Result<{ rejected: number; skipped: number; snapshotId: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  if (!Array.isArray(input.ids) || input.ids.length === 0) {
    return { success: false, error: "Aucune entrée selectionnee" };
  }
  if (!input.reason || input.reason.trim().length < 2) {
    return { success: false, error: "Une raison est requise" };
  }

  const targets = await prisma.timeClock.findMany({
    where: { id: { in: input.ids } },
    select: {
      id: true, adminId: true, clockIn: true, clockOut: true,
      durationMin: true, category: true, notes: true,
      approvedAt: true, approvedBy: true, submittedAt: true, payStubId: true,
    },
  });
  if (targets.length === 0) return { success: false, error: "Aucune entrée trouvée" };

  // Refus dur si une entree est deja payee
  const paid = targets.filter((t) => t.payStubId != null);
  if (paid.length > 0) {
    return { success: false, error: "Une ou plusieurs entrées sont déjà sur un bulletin de paie — non rejetables" };
  }
  // Workflow rule: drafts (never submitted) cannot be rejected.
  if (targets.every((t) => !t.submittedAt && !t.approvedAt)) {
    return { success: false, error: "Aucune entrée soumise dans la sélection — rien à rejeter" };
  }

  const targetAdminIds = Array.from(new Set(targets.map((t) => t.adminId)));
  if (!(await canReviewTargets(actorId, targetAdminIds))) {
    return { success: false, error: "Vous ne pouvez pas rejeter vos propres heures" };
  }
  if (!(await assertCanReviewMany(actorId, targetAdminIds))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }

  const reason = input.reason.trim().slice(0, 500);

  // 1 snapshot global pour permettre un undo
  const snapshotId = await createSnapshot(actorId, "reject_many", {
    entries: targets.map((t) => ({
      id: t.id,
      adminId: t.adminId,
      clockIn: t.clockIn.toISOString(),
      clockOut: t.clockOut?.toISOString() ?? null,
      durationMin: t.durationMin,
      category: t.category,
      notes: t.notes,
      approvedBy: t.approvedBy,
      approvedAt: t.approvedAt?.toISOString() ?? null,
      submittedAt: t.submittedAt?.toISOString() ?? null,
    })),
    reason,
  });

  // 1 SQL : updateMany pour reset approval + submittedAt
  const r = await prisma.timeClock.updateMany({
    where: { id: { in: targets.map((t) => t.id) }, payStubId: null },
    data: { approvedAt: null, approvedBy: null, submittedAt: null },
  });

  // 1 SQL : history bulk
  await prisma.timeClockHistory.createMany({
    data: targets.map((t) => ({
      timeClockId: t.id,
      actorId,
      event: "rejected",
      reason,
    })),
  }).catch(() => null);

  // 1 SQL : notifications bulk
  await prisma.notification.createMany({
    data: targets.map((t) => ({
      recipientType: "admin",
      recipientId: t.adminId,
      type: "warning",
      title: "Pointage rejeté",
      body: `Pointage du ${t.clockIn.toLocaleDateString("fr-CA")} rejeté : ${reason}`,
      link: "/admin/mon-espace/pointage",
      icon: "alert-triangle",
    })),
  }).catch(() => null);

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "time_clock_bulk",
    changes: { rejected: r.count, ids: targets.map((t) => t.id), reason, snapshotId },
  });
  revalidateTimeclock();
  return { success: true, data: { rejected: r.count, skipped: targets.length - r.count, snapshotId } };
}

// ── Update d'une entrée existante (employé ou admin override) ──
const updateSchema = z.object({
  id: z.number().int().positive(),
  clockIn: z.string().optional(),
  clockOut: z.string().nullable().optional(),
  category: z.enum(["work", "break", "meeting", "training", "sick", "vacation"]).optional(),
  notes: z.string().max(500).nullable().optional(),
});

export async function updateTimeClockAction(input: z.infer<typeof updateSchema>): Promise<Result<{ id: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const actorId = session.user.adminId!;
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const tc = await prisma.timeClock.findUnique({ where: { id: parsed.data.id } });
  if (!tc) return { success: false, error: "Introuvable" };

  const isOwner = tc.adminId === actorId;
  const payrollId = await requirePayrollWrite();
  const isAdminOverride = !isOwner && payrollId != null;
  if (!isOwner && !isAdminOverride) return { success: false, error: "Non autorisé" };

  if (tc.payStubId) return { success: false, error: "Déjà sur un bulletin de paie — non modifiable" };

  // ── Regle de modification d'une entree approuvee ──────────────────
  // Une entree approuvee peut etre modifiee dans 2 cas :
  //   1. Admin override : actor != owner ET payroll.write
  //   2. Fondateur : toujours autorise (y compris sur ses propres heures)
  // Dans les deux cas, la modification retire l'approbation (passage en
  // "En attente" pour re-validation).
  const wasApproved = tc.approvedAt != null;
  const isFounder = await isFounderAdmin(actorId);
  if (wasApproved && !isAdminOverride && !isFounder) {
    return {
      success: false,
      error: isOwner
        ? "Vous ne pouvez pas modifier vos propres heures approuvées (fondateur uniquement)"
        : "Approuvée — non modifiable (admin requis)",
    };
  }

  // Workflow rule (server-side mirror of the UI padlock): once SUBMITTED, the
  // owner can no longer edit directly — they must go through an unlock
  // request. Admin override and founder bypass.
  if (tc.submittedAt && isOwner && !isAdminOverride && !isFounder) {
    return { success: false, error: "Entrée soumise — demandez un déblocage pour la modifier" };
  }

  // Construire le nouvel etat
  const newCi = parsed.data.clockIn ? new Date(parsed.data.clockIn) : tc.clockIn;
  const newCo = parsed.data.clockOut === undefined
    ? tc.clockOut
    : (parsed.data.clockOut === null ? null : new Date(parsed.data.clockOut));
  if (isNaN(newCi.getTime())) return { success: false, error: "Date d'entrée invalide" };
  if (newCo && isNaN(newCo.getTime())) return { success: false, error: "Date de sortie invalide" };

  const nowDate = new Date();
  if (newCi > nowDate) return { success: false, error: "Date de début dans le futur refusée" };
  if (newCo && newCo > nowDate) return { success: false, error: "Date de fin dans le futur refusée" };
  if (newCo && newCo <= newCi) return { success: false, error: "Sortie doit être après entrée" };

  // ── Verification PayPeriod (cycle de paie bi-hebdo) ────────────
  // Refus si la nouvelle date tombe dans une periode locked/paid (sauf privileges).
  const _isFounder = await isFounderAdmin(actorId);
  const _isSuper = await isSuperAdmin(actorId);
  const _isPrivileged = _isFounder || _isSuper;
  const _ciDay = new Date(newCi); _ciDay.setHours(0, 0, 0, 0);
  const _period = await prisma.payPeriod.findFirst({
    where: { startDate: { lte: _ciDay }, endDate: { gte: _ciDay } },
    select: { id: true, status: true, startDate: true, endDate: true },
  });
  if (_period) {
    if (_period.status === "paid") {
      return {
        success: false,
        error: `La période du ${_period.startDate.toLocaleDateString("fr-CA")} au ${_period.endDate.toLocaleDateString("fr-CA")} est déjà payée — non modifiable.`,
      };
    }
    if (_period.status === "locked" && !_isPrivileged) {
      return {
        success: false,
        error: `La période ${_period.startDate.toLocaleDateString("fr-CA")} - ${_period.endDate.toLocaleDateString("fr-CA")} est verrouillée. Contactez RH.`,
      };
    }
  }

  // Chevauchement (exclut la ligne en cours)
  if (newCo) {
    const overlap = await prisma.timeClock.findFirst({
      where: {
        adminId: tc.adminId,
        id: { not: tc.id },
        OR: [
          { AND: [{ clockOut: { not: null } }, { clockIn: { lt: newCo } }, { clockOut: { gt: newCi } }] },
          { clockOut: null, clockIn: { lt: newCo } },
        ],
      },
      select: { id: true, clockIn: true },
    });
    if (overlap) return { success: false, error: `Chevauchement avec un pointage du ${overlap.clockIn.toLocaleDateString("fr-CA")}` };
  }

  const durationMin = newCo ? Math.floor((newCo.getTime() - newCi.getTime()) / 60000) : null;
  // Note : on ne pollue plus le champ `notes` avec un tag ADMIN OVERRIDE — c'est
  // tracé dans TimeClockHistory + audit log. Les notes restent celles de l'employe.
  const newNotes = parsed.data.notes !== undefined
    ? (parsed.data.notes ? parsed.data.notes.slice(0, 500) : null)
    : tc.notes;

  const willUnapprove = (isAdminOverride || isFounder) && wasApproved;
  await prisma.timeClock.update({
    where: { id: tc.id },
    data: {
      clockIn: newCi,
      clockOut: newCo,
      durationMin,
      category: parsed.data.category ?? tc.category,
      notes: newNotes,
      // Si admin OU founder modifie une entrée approuvée, on retire l'approbation
      // (passage en "En attente" → re-validation requise)
      ...(willUnapprove ? { approvedAt: null, approvedBy: null } : {}),
      // Editing the TIMES redefines the entry as a net duration: the old
      // accumulated breaks no longer describe it — reset them so the row
      // stays coherent (durée = fin − début − pauses).
      ...(parsed.data.clockIn !== undefined || parsed.data.clockOut !== undefined
        ? {
            totalBreakMin: 0,
            pausedAt: null,
            ...({ paidBreakMin: 0, pausedKind: null } as object),
          }
        : {}),
    },
  });

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "time_clock",
    entityId: tc.id,
    changes: { adminOverride: isAdminOverride, hadApproval: wasApproved },
  });

  // Historique : trace "edited" (utile pour distinguer une modification d'un
  // simple changement d'approbation). On note "admin_override" si applicable.
  await prisma.timeClockHistory.create({
    data: {
      timeClockId: tc.id,
      actorId,
      event: "edited",
      reason: isAdminOverride ? "admin_override" : null,
    },
  }).catch(() => null);

  // ── Notification employe : si l'admin/founder a modifie l'entry et l'a
  // remise en attente, prevenir le proprietaire (sauf si l'auteur EST le owner :
  // cas founder qui modifie ses propres heures).
  if (willUnapprove && !isOwner) {
    const actorName = await getActorName(actorId);
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: tc.adminId,
        type: "warning",
        title: "Pointage modifié et remis en attente",
        body: `${actorName} a modifié votre pointage du ${tc.clockIn.toLocaleDateString("fr-CA")} — il doit être ré-approuvé.`,
        link: "/admin/mon-espace/pointage",
        icon: "alert-triangle",
      },
    }).catch(() => null);
  }

  revalidateTimeclock();
  return { success: true, data: { id: tc.id } };
}

// ── Soumettre la semaine pour validation (employé) ────────
// Soumet UNIQUEMENT les entries work/meeting/training de la semaine indiquee.
// Les pauses (break) restent informatives, les conges (vacation/sick/etc.) sont
// crees automatiquement par le workflow conges et n'ont pas besoin d'etre soumis.
const submitWeekSchema = z.object({ weekStart: z.string().optional() });

export async function submitWeekTimeClocksAction(
  input: z.infer<typeof submitWeekSchema>,
): Promise<Result<{ submitted: number; workMin: number; breakMin: number; leaveMin: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;
  const parsed = submitWeekSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const ref = parsed.data.weekStart ? new Date(parsed.data.weekStart) : new Date();
  if (isNaN(ref.getTime())) return { success: false, error: "Date invalide" };
  const weekStart = startOfWeek(ref);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);

  const all = await prisma.timeClock.findMany({
    where: {
      adminId,
      clockIn: { gte: weekStart, lt: weekEnd },
      clockOut: { not: null },
    },
    select: { id: true, durationMin: true, category: true, submittedAt: true, approvedAt: true },
  });

  const SUBMITTABLE = new Set(["work", "meeting", "training"]);
  const BREAK_CATS = new Set(["break"]);
  const LEAVE_CATS = new Set(["vacation", "sick", "parental", "bereavement"]);

  let workMin = 0;
  let breakMin = 0;
  let leaveMin = 0;
  const toSubmitIds: number[] = [];
  for (const e of all) {
    const dur = e.durationMin ?? 0;
    if (SUBMITTABLE.has(e.category)) {
      workMin += dur;
      if (!e.submittedAt && !e.approvedAt) toSubmitIds.push(e.id);
    } else if (BREAK_CATS.has(e.category)) {
      breakMin += dur;
    } else if (LEAVE_CATS.has(e.category)) {
      leaveMin += dur;
    }
  }

  if (toSubmitIds.length === 0) {
    return { success: false, error: "Aucune entrée éligible à soumettre" };
  }

  const r = await prisma.timeClock.updateMany({
    where: { id: { in: toSubmitIds }, adminId, submittedAt: null, approvedAt: null },
    data: { submittedAt: new Date() },
  });

  // ── Notifier d'abord le manager direct, puis fallback super_admins si absent ──
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { fullName: true, email: true, managerId: true },
  });
  const meName = me?.fullName || me?.email || `Admin#${adminId}`;
  const workHours = (workMin / 60).toFixed(1);
  const weekLabel = weekStart.toLocaleDateString("fr-CA");

  const recipientIds: number[] = [];
  if (me?.managerId) {
    recipientIds.push(me.managerId);
  } else {
    // Pas de manager assigne -> notifier tous les super_admins
    const supers = await prisma.admin.findMany({
      where: { customRole: { name: "super_admin" }, isActive: true },
      select: { id: true },
    });
    recipientIds.push(...supers.map((s) => s.id));
  }
  if (recipientIds.length > 0) {
    await prisma.notification.createMany({
      data: recipientIds.map((rid) => ({
        recipientType: "admin",
        recipientId: rid,
        type: "info",
        title: "Semaine soumise pour validation",
        body: `${meName} a soumis sa semaine du ${weekLabel} (${workHours}h travaillées).`,
        link: `/admin/employes/pointage?focus=${adminId}`,
        icon: "clock",
      })),
    }).catch(() => null);
  }

  await logAudit({
    adminId,
    action: "update",
    entityType: "time_clock_bulk",
    changes: { submitted: r.count, weekStart: weekStart.toISOString(), workMin, breakMin, leaveMin },
  });
  revalidateTimeclock();
  return { success: true, data: { submitted: r.count, workMin, breakMin, leaveMin } };
}

// ── Employe demande de debloquer des entries deja soumises ──
const requestEditSchema = z.object({
  ids: z.array(z.number().int().positive()).min(1),
  reason: z.string().min(3).max(500),
});

export async function requestEditTimeClockAction(
  input: z.infer<typeof requestEditSchema>,
): Promise<Result<{ id: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const adminId = session.user.adminId!;
  const parsed = requestEditSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  // Verifie que les entries appartiennent a l'employe et sont bien soumises
  const entries = await prisma.timeClock.findMany({
    where: { id: { in: parsed.data.ids }, adminId },
    select: { id: true, clockIn: true, submittedAt: true, payStubId: true },
  });
  if (entries.length === 0) return { success: false, error: "Aucune entrée correspondante" };
  if (entries.some((e) => !e.submittedAt)) {
    return { success: false, error: "Certaines entrées ne sont pas verrouillées" };
  }
  if (entries.some((e) => e.payStubId)) {
    return { success: false, error: "Une entrée est déjà sur un bulletin — admin requis" };
  }

  const req = await prisma.timeClockEditRequest.create({
    data: {
      adminId,
      entryIds: parsed.data.ids,
      reason: parsed.data.reason.slice(0, 500),
      status: "pending",
    },
    select: { id: true },
  });

  // Org-chart routing: notify the DIRECT MANAGER first (same rule as the
  // weekly submission); fallback to super_admins only when no manager is set.
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { fullName: true, email: true, managerId: true },
  });
  const meName = me?.fullName || me?.email || `Admin#${adminId}`;
  const firstDate = entries[0].clockIn.toLocaleDateString("fr-CA");
  const recipientIds: number[] = [];
  if (me?.managerId) {
    recipientIds.push(me.managerId);
  } else {
    const supers = await prisma.admin.findMany({
      where: { customRole: { name: "super_admin" }, isActive: true },
      select: { id: true },
    });
    recipientIds.push(...supers.map((s) => s.id));
  }
  await Promise.all(
    recipientIds.map((rid) =>
      prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: rid,
          type: "info",
          title: "Demande de modification de pointage",
          body: `${meName} demande à modifier sa semaine du ${firstDate} · Raison : ${parsed.data.reason.slice(0, 120)}`,
          link: "/admin/employes/pointage",
          icon: "unlock",
        },
      }).catch(() => null),
    ),
  );

  await logAudit({
    adminId,
    action: "create",
    entityType: "time_clock_edit_request",
    entityId: req.id,
    changes: { ids: parsed.data.ids, reason: parsed.data.reason },
  });
  revalidateTimeclock();
  return { success: true, data: { id: req.id } };
}

// ── Admin debloque les entries (reset submittedAt) ──
const unlockSchema = z.object({
  requestId: z.number().int().positive(),
});

export async function unlockTimeClockEntriesAction(
  input: z.infer<typeof unlockSchema>,
): Promise<Result<{ unlocked: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé (rôle paie/RH requis)" };
  const parsed = unlockSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const req = await prisma.timeClockEditRequest.findUnique({ where: { id: parsed.data.requestId } });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "pending") return { success: false, error: "Demande déjà traitée" };
  if (!(await canReviewTargets(actorId, [req.adminId]))) {
    return { success: false, error: "Vous ne pouvez pas approuver votre propre demande de modification" };
  }
  if (!(await assertCanReviewAdmin(actorId, req.adminId))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }

  const ids = Array.isArray(req.entryIds) ? (req.entryIds as number[]).filter((n) => typeof n === "number") : [];
  if (ids.length === 0) return { success: false, error: "Liste d'entrées vide" };

  const r = await prisma.timeClock.updateMany({
    where: { id: { in: ids }, adminId: req.adminId, payStubId: null },
    data: { submittedAt: null, approvedAt: null, approvedBy: null },
  });

  await prisma.timeClockEditRequest.update({
    where: { id: req.id },
    data: { status: "granted", reviewerId: actorId, reviewedAt: new Date() },
  });

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: req.adminId,
      type: "success",
      title: "Pointage déverrouillé",
      body: "Vos heures sont à nouveau modifiables.",
      link: "/admin/mon-espace/pointage",
      icon: "unlock",
    },
  }).catch(() => null);

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "time_clock_edit_request",
    entityId: req.id,
    changes: { granted: true, unlocked: r.count },
  });
  revalidateTimeclock();
  return { success: true, data: { unlocked: r.count } };
}

// ── Admin refuse la demande ──
const denySchema = z.object({
  requestId: z.number().int().positive(),
  reason: z.string().max(500).optional(),
});

export async function denyEditRequestAction(input: z.infer<typeof denySchema>): Promise<Result> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé (rôle paie/RH requis)" };
  const parsed = denySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

  const req = await prisma.timeClockEditRequest.findUnique({ where: { id: parsed.data.requestId } });
  if (!req) return { success: false, error: "Demande introuvable" };
  if (req.status !== "pending") return { success: false, error: "Demande déjà traitée" };
  if (!(await canReviewTargets(actorId, [req.adminId]))) {
    return { success: false, error: "Vous ne pouvez pas refuser votre propre demande de modification" };
  }
  if (!(await assertCanReviewAdmin(actorId, req.adminId))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }

  await prisma.timeClockEditRequest.update({
    where: { id: req.id },
    data: {
      status: "denied",
      reviewerId: actorId,
      reviewedAt: new Date(),
      reviewNote: parsed.data.reason?.slice(0, 500) ?? null,
    },
  });

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: req.adminId,
      type: "warning",
      title: "Modification refusée",
      body: parsed.data.reason
        ? `Modification refusée : ${parsed.data.reason.slice(0, 200)}`
        : "Votre demande de modification a été refusée.",
      link: "/admin/mon-espace/pointage",
      icon: "alert-triangle",
    },
  }).catch(() => null);

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "time_clock_edit_request",
    entityId: req.id,
    changes: { denied: true, reason: parsed.data.reason ?? null },
  });
  revalidateTimeclock();
  return { success: true };
}

// ── Forcer la fermeture d'un pointage ouvert (admin) ──────
// Calcule la duree correctement : (closeAt - clockIn) - totalBreakMin, en
// fermant la pause en cours si necessaire. Verifie aussi PayPeriod (refus si
// "paid", refus si "locked" sauf super_admin/founder).
export async function forceClockOutAction(input: { adminId: number; when?: string }): Promise<Result<{ id: number }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  if (!(await canReviewTargets(actorId, [input.adminId]))) {
    return { success: false, error: "Vous ne pouvez pas forcer la fermeture de votre propre pointage" };
  }
  if (!(await assertCanReviewAdmin(actorId, input.adminId))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }

  const open = await prisma.timeClock.findFirst({
    where: { adminId: input.adminId, clockOut: null },
    orderBy: { clockIn: "desc" },
  });
  if (!open) return { success: false, error: "Aucun pointage ouvert pour cet employé" };

  const closeAt = input.when ? new Date(input.when) : new Date();
  if (isNaN(closeAt.getTime())) return { success: false, error: "Date invalide" };
  if (closeAt <= open.clockIn) return { success: false, error: "La date de fermeture doit être après l'ouverture" };
  if (closeAt > new Date(Date.now() + 60_000)) return { success: false, error: "Date dans le futur refusée" };

  // ── Verification PayPeriod : refus si "paid", refus si "locked" sauf privilege.
  const isPrivileged = (await isFounderAdmin(actorId)) || (await isSuperAdmin(actorId));
  const ppErr = await checkPayPeriodForDate(closeAt, isPrivileged);
  if (ppErr) return { success: false, error: ppErr };

  // Calcule la duree nette : (closeAt - clockIn) - pauses repas (en fermant
  // la pause en cours selon son type).
  const elapsedMin = Math.floor((closeAt.getTime() - open.clockIn.getTime()) / 60000);
  let totalBreakMin = open.totalBreakMin;
  let paidBreakMin = ((open as unknown as { paidBreakMin?: number }).paidBreakMin) ?? 0;
  if (open.pausedAt) {
    const added = Math.floor((closeAt.getTime() - open.pausedAt.getTime()) / 60000);
    if (((open as unknown as { pausedKind?: string | null }).pausedKind) === "paid") {
      paidBreakMin += added;
    } else {
      totalBreakMin += added;
    }
  }
  const durationMin = Math.max(0, elapsedMin - totalBreakMin);

  const actorName = await getActorName(actorId);
  await prisma.timeClock.update({
    where: { id: open.id },
    data: {
      clockOut: closeAt,
      durationMin,
      pausedAt: null,
      totalBreakMin,
      ...({ paidBreakMin, pausedKind: null } as object),
    },
  });

  // Historique fin : trace l'event force_closed (le tag dans notes est retire,
  // l'audit log + history sont la source de verite).
  await prisma.timeClockHistory.create({
    data: {
      timeClockId: open.id,
      actorId,
      event: "force_closed",
    },
  }).catch(() => null);

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: open.adminId,
      type: "warning",
      title: "Pointage fermé par l'administration",
      body: `Votre pointage a été fermé par ${actorName} à ${closeAt.toLocaleString("fr-CA")}.`,
      link: "/admin/mon-espace/pointage",
      icon: "alert-triangle",
    },
  }).catch(() => null);

  await logAudit({ adminId: actorId, action: "update", entityType: "time_clock", entityId: open.id, changes: { forceClosed: true, durationMin, totalBreakMin } });
  revalidateTimeclock();
  return { success: true, data: { id: open.id } };
}

// ── Undo d'un snapshot (merge / delete_short / reject) ───
type SnapshotEntry = {
  id?: number;
  adminId: number;
  clockIn: string;
  clockOut: string | null;
  durationMin: number | null;
  category: string;
  notes: string | null;
  approvedBy?: number | null;
  approvedAt?: string | null;
  submittedAt?: string | null;
  jobCodeId?: number | null;
  isManual?: boolean;
  pausedAt?: string | null;
  totalBreakMin?: number;
};

export async function undoTimeClockSnapshotAction(input: { snapshotId: number }): Promise<Result<{ restored: number }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") return { success: false, error: "Non autorisé" };
  const actorId = session.user.adminId!;

  const snap = await prisma.timeClockSnapshot.findUnique({ where: { id: input.snapshotId } });
  if (!snap) return { success: false, error: "Snapshot introuvable" };
  if (snap.restoredAt) return { success: false, error: "Déjà annulé" };
  if (snap.expiresAt < new Date()) return { success: false, error: "Snapshot expiré (annulation impossible)" };

  const isOriginal = snap.actorId === actorId;
  const isSuper = await isSuperAdmin(actorId);
  if (!isOriginal && !isSuper) return { success: false, error: "Non autorisé" };

  const payload = snap.payload as { entries?: SnapshotEntry[] } | null;
  const entries = payload?.entries ?? [];
  if (entries.length === 0) return { success: false, error: "Snapshot vide" };

  let restored = 0;
  await prisma.$transaction(async (tx) => {
    if (snap.reason === "merge_day") {
      // Trouver le pointage "fusionné" et le supprimer
      const earliest = entries.reduce((min, e) =>
        new Date(e.clockIn).getTime() < new Date(min.clockIn).getTime() ? e : min, entries[0]);
      const latest = entries.reduce((max, e) => {
        const co = e.clockOut ? new Date(e.clockOut).getTime() : 0;
        const cm = max.clockOut ? new Date(max.clockOut).getTime() : 0;
        return co > cm ? e : max;
      }, entries[0]);
      const merged = await tx.timeClock.findFirst({
        where: {
          adminId: entries[0].adminId,
          clockIn: new Date(earliest.clockIn),
          clockOut: latest.clockOut ? new Date(latest.clockOut) : undefined,
          approvedAt: null,
          payStubId: null,
        },
      });
      if (merged) await tx.timeClock.delete({ where: { id: merged.id } });
      // Re-créer les originales (nouveaux IDs)
      for (const e of entries) {
        await tx.timeClock.create({
          data: {
            adminId: e.adminId,
            clockIn: new Date(e.clockIn),
            clockOut: e.clockOut ? new Date(e.clockOut) : null,
            durationMin: e.durationMin,
            category: e.category,
            notes: `[RESTAURÉ de snapshot #${snap.id}] ${e.notes ?? ""}`.slice(0, 500),
            jobCodeId: e.jobCodeId ?? null,
            isManual: e.isManual ?? false,
            pausedAt: e.pausedAt ? new Date(e.pausedAt) : null,
            totalBreakMin: e.totalBreakMin ?? 0,
          },
        });
        restored++;
      }
    } else if (snap.reason === "delete_short") {
      for (const e of entries) {
        await tx.timeClock.create({
          data: {
            adminId: e.adminId,
            clockIn: new Date(e.clockIn),
            clockOut: e.clockOut ? new Date(e.clockOut) : null,
            durationMin: e.durationMin,
            category: e.category,
            notes: `[RESTAURÉ de snapshot #${snap.id}] ${e.notes ?? ""}`.slice(0, 500),
            jobCodeId: e.jobCodeId ?? null,
            isManual: e.isManual ?? false,
            pausedAt: e.pausedAt ? new Date(e.pausedAt) : null,
            totalBreakMin: e.totalBreakMin ?? 0,
          },
        });
        restored++;
      }
    } else if (snap.reason === "reject") {
      // Restore approval + submission state
      for (const e of entries) {
        if (e.id) {
          await tx.timeClock.updateMany({
            where: { id: e.id, payStubId: null },
            data: {
              approvedBy: e.approvedBy ?? null,
              approvedAt: e.approvedAt ? new Date(e.approvedAt) : null,
              submittedAt: e.submittedAt ? new Date(e.submittedAt) : null,
              notes: e.notes,
            },
          });
          restored++;
        }
      }
    }
    await tx.timeClockSnapshot.update({
      where: { id: snap.id },
      data: { restoredAt: new Date() },
    });
  });

  await logAudit({ adminId: actorId, action: "update", entityType: "time_clock_snapshot", entityId: snap.id, changes: { restored, reason: snap.reason } });
  revalidateTimeclock();
  return { success: true, data: { restored } };
}

// ─────────────────────────────────────────────────────────────────
// notifyForgottenDaysAction — signaler a un employe les jours non
// pointes de sa semaine. Cree une Notification de type warning avec
// la liste des jours et un lien vers /admin/mon-espace/pointage.
// Securite : assertCanReviewAdmin (manager direct, chef d'equipe,
// HR/super_admin/fondateur).
// ─────────────────────────────────────────────────────────────────
const notifyForgottenSchema = z.object({
  adminId: z.number().int().positive(),
  days: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).min(1).max(14),
});
export async function notifyForgottenDaysAction(
  input: z.infer<typeof notifyForgottenSchema>,
): Promise<Result<{ notified: boolean }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorisé." };
  }
  const actorId = session.user.adminId!;
  const parsed = notifyForgottenSchema.safeParse(input);
  if (!parsed.success) {
    return { success: false, error: "Paramètres invalides." };
  }
  if (!(await assertCanReviewAdmin(actorId, parsed.data.adminId))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }
  const target = await prisma.admin.findUnique({
    where: { id: parsed.data.adminId },
    select: { id: true, fullName: true, email: true },
  });
  if (!target) return { success: false, error: "Employé introuvable." };

  // ── Idempotence : refuse un second appel pour le meme adminId dans les 24h.
  // On detecte la derniere notification "Pointages manquants" envoyee a cet employe.
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const recent = await prisma.notification.findFirst({
    where: {
      recipientType: "admin",
      recipientId: parsed.data.adminId,
      title: "Pointages manquants à rattraper",
      createdAt: { gte: since24h },
    },
    select: { createdAt: true },
    orderBy: { createdAt: "desc" },
  });
  if (recent) {
    const hoursAgo = Math.max(1, Math.floor((Date.now() - recent.createdAt.getTime()) / (60 * 60 * 1000)));
    return { success: false, error: `Déjà signalé il y a ${hoursAgo}h — attendez 24h avant de relancer.` };
  }

  const actorName = await getActorName(actorId);
  // Format lisible des jours : "lun 18 mai, mar 19 mai..."
  const formatDay = (d: string) => {
    const dt = new Date(`${d}T12:00:00`);
    return dt.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" });
  };
  const daysLabel = parsed.data.days.map(formatDay).join(", ");
  const body = parsed.data.days.length === 1
    ? `${actorName} vous rappelle de saisir votre pointage du ${daysLabel}.`
    : `${actorName} vous rappelle de saisir ${parsed.data.days.length} jours de pointage manquants : ${daysLabel}.`;

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: parsed.data.adminId,
      type: "warning",
      title: "Pointages manquants à rattraper",
      body,
      link: "/admin/mon-espace/pointage",
      icon: "clock",
    },
  }).catch(() => null);

  await logAudit({
    adminId: actorId,
    action: "create",
    entityType: "notification",
    entityId: parsed.data.adminId,
    changes: { kind: "forgotten_days_reminder", days: parsed.data.days, targetAdminId: parsed.data.adminId },
  });

  return { success: true, data: { notified: true } };
}

// ── Remind an employee to SUBMIT their week (approval queue v2) ────
// Sends a notification asking the employee to submit their draft hours.
// Scope-checked like every review action.
export async function remindSubmitWeekAction(input: { adminId: number }): Promise<Result> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  if (!(await assertCanReviewAdmin(actorId, input.adminId))) {
    return { success: false, error: ERR_NO_AUTHORITY };
  }
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: input.adminId,
      type: "warning",
      title: "Heures à soumettre",
      body: "Vos heures de la semaine sont encore en brouillon — cliquez « Soumettre la semaine » pour les envoyer en validation.",
      link: "/admin/mon-espace/pointage",
      icon: "clock",
    },
  }).catch(() => null);
  await logAudit({ adminId: actorId, action: "update", entityType: "time_clock", changes: { remind_submit: input.adminId } });
  return { success: true };
}

// ── Time clock feature settings (HR) ────────────────────────
// The 7 "hr_pointage" settings had no UI at all (DB-only edits). Written
// through a dedicated action so the HR/payroll domain governs them instead
// of the global settings.write permission.
export async function updateTimeclockSettingsAction(input: {
  roundingMin: number;
  geolocEnabled: boolean;
  geofenceEnabled: boolean;
  geofenceLat: number | null;
  geofenceLng: number | null;
  geofenceRadiusM: number;
  kioskEnabled: boolean;
}): Promise<Result> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };

  if (![0, 5, 10, 15].includes(input.roundingMin)) {
    return { success: false, error: "Arrondi invalide" };
  }
  if (input.geofenceEnabled) {
    if (input.geofenceLat === null || input.geofenceLng === null) {
      return { success: false, error: "Coordonnées requises pour activer le géorepérage" };
    }
    if (Math.abs(input.geofenceLat) > 90 || Math.abs(input.geofenceLng) > 180) {
      return { success: false, error: "Coordonnées hors limites" };
    }
  }
  const radius = Math.min(50000, Math.max(10, Math.round(input.geofenceRadiusM)));

  const entries: Array<{ key: string; value: string; label: string }> = [
    { key: "rounding_min", value: String(input.roundingMin), label: "Arrondi des punchs (minutes)" },
    { key: "geoloc_enabled", value: String(input.geolocEnabled), label: "Capture GPS au punch" },
    { key: "geofence_enabled", value: String(input.geofenceEnabled), label: "Géorepérage actif" },
    { key: "geofence_lat", value: input.geofenceLat === null ? "" : String(input.geofenceLat), label: "Latitude du lieu de travail" },
    { key: "geofence_lng", value: input.geofenceLng === null ? "" : String(input.geofenceLng), label: "Longitude du lieu de travail" },
    { key: "geofence_radius_m", value: String(radius), label: "Rayon autorisé (mètres)" },
    { key: "kiosk_enabled", value: String(input.kioskEnabled), label: "Mode kiosque (borne partagée)" },
  ];

  for (const e of entries) {
    await prisma.setting.upsert({
      where: { category_key: { category: "hr_pointage", key: e.key } },
      update: { value: e.value, updatedBy: actorId },
      create: { category: "hr_pointage", key: e.key, value: e.value, label: e.label, type: "string", updatedBy: actorId },
    });
  }
  // getSetting() caches for 60s; without this the UI keeps stale values.
  const { invalidateSettingsCache } = await import("@/lib/settings");
  invalidateSettingsCache();

  await logAudit({
    adminId: actorId,
    action: "update",
    entityType: "settings",
    changes: Object.fromEntries(entries.map((e) => [e.key, e.value])),
  });
  revalidatePath("/admin/employes/pointage");
  return { success: true };
}

// ── Kiosk PIN ───────────────────────────────────────────────
// 4 digits (time-clock standard, and what the kiosk pad shows). Stored twice:
//   - bcrypt hash  → identifies the employee at the kiosk
//   - AES ciphertext → lets the OWNER re-display it after confirming their
//     account password (same reversible scheme already used for SIN / bank
//     details). HR can only RESET a PIN, never read one.
const KIOSK_PIN_DIGITS = 4;

async function generateUniqueKioskPin(excludeAdminId: number): Promise<string | null> {
  const bcrypt = (await import("bcryptjs")).default;
  const { randomInt } = await import("crypto");
  // A collision would punch the wrong person: compare against every hash.
  const others = await prisma.$queryRaw<Array<{ kiosk_pin_hash: string }>>`
    SELECT kiosk_pin_hash FROM admins
    WHERE kiosk_pin_hash IS NOT NULL AND id <> ${excludeAdminId}
  `;
  const min = 10 ** (KIOSK_PIN_DIGITS - 1);
  const max = 10 ** KIOSK_PIN_DIGITS;
  for (let attempt = 0; attempt < 40; attempt++) {
    const candidate = String(randomInt(min, max));
    let taken = false;
    for (const o of others) {
      if (await bcrypt.compare(candidate, o.kiosk_pin_hash)) { taken = true; break; }
    }
    if (!taken) return candidate;
  }
  return null;
}

const ERR_NO_ENCRYPTION =
  "Chiffrement indisponible (CREDENTIALS_ENCRYPTION_KEY absente) : le NIP ne pourrait jamais être réaffiché à l'employé. Corrigez la configuration avant d'en attribuer un.";

/** Stores the PIN (hash + encrypted copy). False when encryption is
  *  unavailable: refuse rather than issue a PIN nobody can read back. */
async function storeKioskPin(adminId: number, pin: string): Promise<boolean> {
  let enc: string;
  try {
    // crypto.ts (CREDENTIALS_ENCRYPTION_KEY) is the key configured here.
    const { encryptSecret } = await import("@/lib/security/crypto");
    enc = encryptSecret(pin);
  } catch {
    return false;
  }
  const bcrypt = (await import("bcryptjs")).default;
  const hash = await bcrypt.hash(pin, 10);
  await prisma.$executeRaw`
    UPDATE admins
    SET kiosk_pin_hash = ${hash}, kiosk_pin_enc = ${enc}, kiosk_pin_set_at = NOW()
    WHERE id = ${adminId}
  `;
  return true;
}

// Re-display the owner's own PIN. Requires the account password — the reveal
// is written to the audit trail.
export async function revealMyKioskPinAction(input: { password: string }): Promise<Result<{ pin: string }>> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorisé" };
  }
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { passwordHash: true },
  });
  if (!me?.passwordHash) return { success: false, error: "Compte sans mot de passe — impossible de vérifier" };
  const bcrypt = (await import("bcryptjs")).default;
  if (!(await bcrypt.compare(input.password ?? "", me.passwordHash))) {
    return { success: false, error: "Mot de passe incorrect" };
  }

  const rows = await prisma.$queryRaw<Array<{ kiosk_pin_enc: string | null; has_hash: boolean }>>`
    SELECT kiosk_pin_enc, (kiosk_pin_hash IS NOT NULL) AS has_hash
    FROM admins WHERE id = ${adminId}
  `;
  const enc = rows[0]?.kiosk_pin_enc;
  if (!enc) {
    // Tell "no PIN" apart from "PIN stored without its encrypted copy".
    return {
      success: false,
      error: rows[0]?.has_hash
        ? "Ce NIP ne peut pas être réaffiché (créé sans chiffrement). Demandez aux RH de le remplacer."
        : "Aucun NIP — demandez-en un aux ressources humaines.",
    };
  }
  let pin: string | null = null;
  try {
    const { decryptSecret } = await import("@/lib/security/crypto");
    pin = decryptSecret(enc);
  } catch {
    pin = null;
  }
  if (!pin) {
    return { success: false, error: "NIP illisible — demandez aux RH de le remplacer." };
  }
  await logAudit({
    adminId, action: "view", entityType: "admin", entityId: adminId,
    changes: { kiosk_pin: "revealed_by_owner" },
  });
  return { success: true, data: { pin } };
}

// HR issues the PIN: generate one FOR an employee and show it once so it can
// be handed over. HR never reads an existing PIN — only replaces it.
export async function resetKioskPinForAction(input: { adminId: number }): Promise<Result<{ pin: string; name: string }>> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };

  const target = await prisma.admin.findUnique({
    where: { id: input.adminId },
    select: { id: true, isActive: true, fullName: true, email: true },
  });
  if (!target || !target.isActive) return { success: false, error: "Employé introuvable ou inactif" };

  const pin = await generateUniqueKioskPin(input.adminId);
  if (!pin) return { success: false, error: "Impossible de générer un NIP unique — réessayez" };
  if (!(await storeKioskPin(input.adminId, pin))) {
    return { success: false, error: ERR_NO_ENCRYPTION };
  }
  // Closes any pending request and notifies the employee. The PIN stays out
  // of the notification: he reveals it himself with his password.
  await prisma.$executeRaw`
    UPDATE admins SET kiosk_pin_requested_at = NULL WHERE id = ${input.adminId}
  `;
  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: input.adminId,
      type: "info",
      title: "Votre NIP de borne est prêt",
      body: "Un NIP à 4 chiffres vous a été attribué pour poinçonner sur la tablette partagée. Affichez-le depuis Mon espace › Mon pointage avec votre mot de passe.",
      link: "/admin/mon-espace/pointage",
      icon: "clock",
    },
  }).catch(() => null);
  await logAudit({
    adminId: actorId, action: "update", entityType: "admin", entityId: input.adminId,
    changes: { kiosk_pin: "issued_by_hr" },
  });
  return { success: true, data: { pin, name: target.fullName || target.email } };
}

// Employee PIN request. Acts as a ticket: stays in the HR list until issued.
export async function requestKioskPinAction(): Promise<Result> {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return { success: false, error: "Non autorisé" };
  }
  const adminId = session.user.adminId!;

  const { getTimeclockConfig } = await import("@/lib/services/timeclock-config");
  const cfg = await getTimeclockConfig();
  if (!cfg.kioskEnabled) return { success: false, error: "Le mode kiosque est désactivé" };

  const rows = await prisma.$queryRaw<Array<{ requested_at: Date | null }>>`
    SELECT kiosk_pin_requested_at AS requested_at FROM admins WHERE id = ${adminId}
  `;
  const last = rows[0]?.requested_at;
  if (last && Date.now() - new Date(last).getTime() < 12 * 3600 * 1000) {
    return { success: false, error: "Votre demande est déjà en attente — les RH vont y répondre." };
  }

  await prisma.$executeRaw`
    UPDATE admins SET kiosk_pin_requested_at = NOW() WHERE id = ${adminId}
  `;

  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { fullName: true, email: true, managerId: true },
  });
  const name = me?.fullName || me?.email || `Admin#${adminId}`;
  const recipients: number[] = [];
  if (me?.managerId) recipients.push(me.managerId);
  const supers = await prisma.admin.findMany({
    where: { customRole: { name: "super_admin" }, isActive: true },
    select: { id: true },
  });
  for (const s of supers) if (!recipients.includes(s.id)) recipients.push(s.id);
  if (recipients.length > 0) {
    await prisma.notification.createMany({
      data: recipients.map((rid) => ({
        recipientType: "admin",
        recipientId: rid,
        type: "warning",
        title: "Demande de NIP de borne",
        body: `${name} demande un NIP pour poinçonner sur la borne.`,
        link: "/admin/employes/pointage/parametres",
        icon: "clock",
      })),
    }).catch(() => null);
  }
  await logAudit({
    adminId, action: "update", entityType: "admin", entityId: adminId,
    changes: { kiosk_pin: "requested" },
  });
  return { success: true };
}

export async function clearKioskPinForAction(input: { adminId: number }): Promise<Result> {
  const actorId = await requirePayrollWrite();
  if (!actorId) return { success: false, error: "Non autorisé" };
  await prisma.$executeRaw`
    UPDATE admins SET kiosk_pin_hash = NULL, kiosk_pin_enc = NULL, kiosk_pin_set_at = NULL
    WHERE id = ${input.adminId}
  `;
  await logAudit({
    adminId: actorId, action: "update", entityType: "admin", entityId: input.adminId,
    changes: { kiosk_pin: "cleared_by_hr" },
  });
  return { success: true };
}

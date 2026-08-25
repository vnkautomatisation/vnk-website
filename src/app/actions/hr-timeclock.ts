"use server";
// Actions pointage horaire employé.
// L'employé pointe lui-même son entrée/sortie ; un superviseur peut approuver.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
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
export async function clockInAction(input: { jobCodeId?: number; category?: string; notes?: string }): Promise<Result<{ id: number }>> {
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
  const tc = await prisma.timeClock.create({
    data: {
      adminId,
      clockIn: new Date(),
      category: cat,
      notes: input.notes?.slice(0, 500) ?? null,
      jobCodeId,
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
export async function clockOutAction(): Promise<Result<{ durationMin: number }>> {
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

  const now = new Date();
  // ── Verification PayPeriod : refus si paid (toujours) ou locked (sauf privileges) ──
  // Verifie a la fois la date d'ouverture du shift ET le moment present (fin).
  const isPrivileged = (await isFounderAdmin(adminId)) || (await isSuperAdmin(adminId));
  const ppOpenErr = await checkPayPeriodForDate(open.clockIn, isPrivileged);
  if (ppOpenErr) return { success: false, error: ppOpenErr };
  const ppNowErr = await checkPayPeriodForDate(now, isPrivileged);
  if (ppNowErr) return { success: false, error: ppNowErr };

  // Ferme la pause en cours si necessaire
  let totalBreakMin = open.totalBreakMin;
  if (open.pausedAt) {
    totalBreakMin += Math.floor((now.getTime() - open.pausedAt.getTime()) / 60000);
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
    },
  });
  await logAudit({ adminId, action: "update", entityType: "time_clock", entityId: open.id, changes: { closed: true, durationMin, totalBreakMin } });
  revalidateTimeclock();
  return { success: true, data: { durationMin } };
}

// ── Pause ──────────────────────────────────────────────────
// L'employe met son pointage en pause. Le compteur s'arrete.
export async function pauseClockAction(): Promise<Result> {
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

  await prisma.timeClock.update({
    where: { id: open.id },
    data: { pausedAt: new Date() },
  });
  await logAudit({ adminId, action: "update", entityType: "time_clock", entityId: open.id, changes: { paused: true } });
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
  await prisma.timeClock.update({
    where: { id: open.id },
    data: {
      pausedAt: null,
      totalBreakMin: open.totalBreakMin + breakAddedMin,
    },
  });
  await logAudit({ adminId, action: "update", entityType: "time_clock", entityId: open.id, changes: { resumed: true, breakAddedMin } });
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
export async function mergeDayTimeClockAction(input: { date: string }): Promise<Result<{ id: number; snapshotId: number }>> {
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
      category: "work",
    },
    orderBy: { clockIn: "asc" },
  });
  if (entries.length < 2) return { success: false, error: "Rien à fusionner (besoin de 2+ pointages éligibles)" };

  const earliestIn = entries.reduce((min, e) => (e.clockIn < min ? e.clockIn : min), entries[0].clockIn);
  const latestOut = entries.reduce((max, e) => (e.clockOut! > max ? e.clockOut! : max), entries[0].clockOut!);
  const totalMin = entries.reduce((s, e) => s + (e.durationMin ?? 0), 0);
  const ids = entries.map((e) => e.id);

  // Snapshot avant action destructive
  const snapshotId = await createSnapshot(adminId, "merge_day", {
    entries: entries.map((e) => ({
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

  const created = await prisma.$transaction(async (tx) => {
    await tx.timeClock.deleteMany({ where: { id: { in: ids } } });
    return tx.timeClock.create({
      data: {
        adminId,
        clockIn: earliestIn,
        clockOut: latestOut,
        durationMin: totalMin,
        category: "work",
        notes: `[FUSION de ${entries.length} pointages]`,
      },
      select: { id: true },
    });
  });

  await logAudit({ adminId, action: "update", entityType: "time_clock_bulk", changes: { merged: ids, into: created.id, snapshotId } });
  revalidateTimeclock();
  return { success: true, data: { id: created.id, snapshotId } };
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

  const r = await prisma.timeClock.updateMany({
    where: { id: { in: input.ids }, approvedAt: null, payStubId: null },
    data: { approvedBy: actorId, approvedAt: new Date() },
  });

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

  // Calcule la semaine courante (lundi -> dimanche) ou utilise weekStart explicite
  const ref = input.weekStart ? new Date(input.weekStart) : new Date();
  if (isNaN(ref.getTime())) return { success: false, error: "Date invalide" };
  const day = ref.getDay(); // 0 dim .. 6 sam
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(ref);
  monday.setHours(0, 0, 0, 0);
  monday.setDate(monday.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(sunday.getDate() + 7);

  const targets = await prisma.timeClock.findMany({
    where: {
      adminId: input.adminId,
      clockIn: { gte: monday, lt: sunday },
      clockOut: { not: null },
      approvedAt: null,
      payStubId: null,
    },
    select: { id: true },
  });
  if (targets.length === 0) {
    // Message clarifie : distinguer "rien dans la semaine" vs "tout deja approuve"
    const totalThisWeek = await prisma.timeClock.count({
      where: {
        adminId: input.adminId,
        clockIn: { gte: monday, lt: sunday },
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

function startOfWeekMondayDate(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  const day = n.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  n.setDate(n.getDate() + diff);
  return n;
}

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
  const weekStart = startOfWeekMondayDate(ref);
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

  const supers = await prisma.admin.findMany({
    where: { customRole: { name: "super_admin" }, isActive: true },
    select: { id: true },
  });
  const me = await prisma.admin.findUnique({ where: { id: adminId }, select: { fullName: true, email: true } });
  const meName = me?.fullName || me?.email || `Admin#${adminId}`;
  const firstDate = entries[0].clockIn.toLocaleDateString("fr-CA");
  await Promise.all(
    supers.map((s) =>
      prisma.notification.create({
        data: {
          recipientType: "admin",
          recipientId: s.id,
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

  // Calcule la duree nette : (closeAt - clockIn) - totalBreakMin (en fermant
  // la pause en cours si pausedAt != null).
  const elapsedMin = Math.floor((closeAt.getTime() - open.clockIn.getTime()) / 60000);
  let totalBreakMin = open.totalBreakMin;
  if (open.pausedAt) {
    totalBreakMin += Math.floor((closeAt.getTime() - open.pausedAt.getTime()) / 60000);
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

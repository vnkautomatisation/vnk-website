// Scope hierarchique du module pointage
// ─────────────────────────────────────────────────────────────
// Determine quels adminId un utilisateur peut consulter dans la file
// de revue/export :
//   - Founder : voit tout, y compris ses propres heures
//   - Super_admin / permission users.write / hr.write / payroll.write :
//     voit tous les autres (s'exclut lui-meme pour ne pas auto-approuver)
//   - Manager (Admin.managerId pointe sur lui) ou Team lead (Team.leadAdminId)
//     voit ses subordonnes directs + membres des equipes qu'il dirige
//
// Reutilise par la page admin, l'export CSV, et tout endpoint qui
// recapitule des pointages cross-employes.
import "server-only";
import { prisma } from "@/lib/prisma";

export type TimesheetScope = {
  isHr: boolean;
  isFounder: boolean;
  /** null = aucun filtre adminId necessaire (acces "tous les autres") */
  allowedAdminIds: number[] | null;
  /** null si fondateur ; sinon currentAdminId pour exclure ses propres entries */
  excludeSelfId: number | null;
  myTeams: Array<{ id: number; name: string; color: string | null }>;
};

async function isFounderAdmin(adminId: number): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ is_founder: boolean }[]>`
      SELECT is_founder FROM admins WHERE id = ${adminId} LIMIT 1
    `;
    return rows[0]?.is_founder === true;
  } catch {
    return false;
  }
}

export async function getTimesheetScope(currentAdminId: number): Promise<TimesheetScope> {
  const me = await prisma.admin.findUnique({
    where: { id: currentAdminId },
    include: { customRole: true, ledTeams: true },
  });
  if (!me) {
    return {
      isHr: false,
      isFounder: false,
      allowedAdminIds: [],
      excludeSelfId: currentAdminId,
      myTeams: [],
    };
  }

  const isFounder = await isFounderAdmin(currentAdminId);
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr =
    me.customRole?.name === "super_admin"
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write")
    || (perms.payroll ?? []).includes("write");

  if (isFounder) {
    return { isHr: true, isFounder: true, allowedAdminIds: null, excludeSelfId: null, myTeams: [] };
  }

  if (isHr) {
    return {
      isHr: true,
      isFounder: false,
      allowedAdminIds: null,
      excludeSelfId: currentAdminId,
      myTeams: [],
    };
  }

  const [directReports, ledTeams] = await Promise.all([
    prisma.admin.findMany({
      where: { managerId: currentAdminId, isActive: true },
      select: { id: true },
    }),
    prisma.team.findMany({
      where: { leadAdminId: currentAdminId },
      include: { members: { where: { isActive: true }, select: { id: true } } },
    }),
  ]);

  const allowedIds = Array.from(
    new Set<number>([
      ...directReports.map((d) => d.id),
      ...ledTeams.flatMap((t) => t.members.map((m) => m.id)),
    ]),
  ).filter((id) => id !== currentAdminId);

  return {
    isHr: false,
    isFounder: false,
    allowedAdminIds: allowedIds,
    excludeSelfId: currentAdminId,
    myTeams: ledTeams.map((t) => ({ id: t.id, name: t.name, color: t.color })),
  };
}

/**
 * Construit le where Prisma pour la table TimeClock selon le scope.
 * - HR/founder : pas de filtre adminId (ou exclude soi-meme)
 * - Manager : adminId in liste
 */
export function timeClockScopeWhere(scope: TimesheetScope): Record<string, unknown> {
  if (scope.isHr) {
    return scope.excludeSelfId ? { adminId: { not: scope.excludeSelfId } } : {};
  }
  return { adminId: { in: scope.allowedAdminIds ?? [] } };
}

// ─────────────────────────────────────────────────────────────
// Regles d'autorite pour la revue des conges (LeaveRequest).
// Reutilise les memes principes que assertCanReviewAdmin du module pointage :
//   - Fondateur : peut tout, y compris soi-meme
//   - super_admin / users.write / hr.write / payroll.write : tout sauf soi-meme
//   - Manager direct (target.managerId === actorId) : ok
//   - Lead d'equipe (team.leadAdminId === actorId) : ok
//   - Delegue (target manager a delegueApprovalTo === actorId) : ok
// ─────────────────────────────────────────────────────────────
export async function assertCanReviewLeave(
  actorId: number,
  targetAdminId: number,
): Promise<boolean> {
  // Anti-self-approval (sauf fondateur)
  if (actorId === targetAdminId) {
    return await isFounderAdmin(actorId);
  }

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
    || (perms.leaves ?? []).includes("write");
  if (isHr) return true;

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

  // Delegation : si le manager du target a delegue ses approbations a l'acteur
  if (target.managerId != null) {
    try {
      const rows = await prisma.$queryRaw<{ delegate_approval_to: number | null }[]>`
        SELECT delegate_approval_to FROM admins WHERE id = ${target.managerId} LIMIT 1
      `;
      if (rows[0]?.delegate_approval_to === actorId) return true;
    } catch {
      // colonne pas encore migree -> ignore
    }
  }

  return false;
}

// ─── Scope conges : qui peut etre vu/revue par l'acteur. ────────
// Distinct de getTimesheetScope : pour un employe STANDARD (pas manager, pas HR),
// on inclut ses pairs (meme teamId, ou a defaut meme managerId) afin que la vue
// "Equipe" du module conges affiche les vrais collegues plutot que rien.
//
// Regle :
//   - Founder      : allowedAdminIds = null (tout)
//   - HR/SuperAdmin: allowedAdminIds = null (tout sauf soi)
//   - Manager      : subordonnes + membres des teams qu'il dirige
//   - Employe std  : autres membres de SA teamId, ou a defaut autres directReports de SON managerId
//
// `peerSource` est ajoute pour permettre a l'UI de savoir d'ou viennent les pairs
// (utile pour empty states "Aucun collegue d'equipe").
export type LeavesScope = TimesheetScope & {
  /** Source des pairs pour un employe std : "team" / "manager" / "none" / "manager-or-hr" */
  peerSource: "founder" | "hr" | "manager" | "team" | "directReports" | "none";
};

export async function getLeavesScope(currentAdminId: number): Promise<LeavesScope> {
  const base = await getTimesheetScope(currentAdminId);
  if (base.isFounder) return { ...base, peerSource: "founder" };
  if (base.isHr) return { ...base, peerSource: "hr" };

  // Manager : si on a deja des subordonnes/teams, on les retourne tels quels
  if ((base.allowedAdminIds?.length ?? 0) > 0) {
    return { ...base, peerSource: "manager" };
  }

  // Employe standard : peer fallback via teamId puis managerId
  const me = await prisma.admin.findUnique({
    where: { id: currentAdminId },
    select: { teamId: true, managerId: true },
  });
  if (!me) return { ...base, peerSource: "none" };

  // 1) Autres membres actifs de SA team
  if (me.teamId != null) {
    const peers = await prisma.admin.findMany({
      where: { teamId: me.teamId, isActive: true, id: { not: currentAdminId } },
      select: { id: true },
    });
    if (peers.length > 0) {
      return {
        ...base,
        allowedAdminIds: peers.map((p) => p.id),
        peerSource: "team",
      };
    }
  }

  // 2) Sinon : autres directReports du meme manager
  if (me.managerId != null) {
    const peers = await prisma.admin.findMany({
      where: { managerId: me.managerId, isActive: true, id: { not: currentAdminId } },
      select: { id: true },
    });
    if (peers.length > 0) {
      return {
        ...base,
        allowedAdminIds: peers.map((p) => p.id),
        peerSource: "directReports",
      };
    }
  }

  // 3) Employe orphelin : aucun pair
  return { ...base, allowedAdminIds: [], peerSource: "none" };
}

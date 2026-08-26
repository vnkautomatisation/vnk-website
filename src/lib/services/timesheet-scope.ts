// Scope hierarchique du module pointage
// Which adminIds a user may see in the review queue and the exports:
//   - founder: everyone, their own hours included
//   - super_admin / users.write / hr.write / payroll.write: everyone else
//     (themselves excluded, so nobody approves their own hours)
//   - manager (Admin.managerId) or team lead (Team.leadAdminId): their direct
//     reports plus the members of the teams they lead
//
// Shared by the admin page, the CSV export, and every endpoint that
// summarizes hours across employees.
import "server-only";
import { prisma } from "@/lib/prisma";

export type TimesheetScope = {
  isHr: boolean;
  isFounder: boolean;
  /** null = no adminId filter needed (access to everyone else). */
  allowedAdminIds: number[] | null;
  /** null for the founder; otherwise currentAdminId, to exclude their own entries. */
  excludeSelfId: number | null;
  myTeams: Array<{ id: number; name: string; color: string | null }>;
};

// Access rules live in ./timesheet-access (dependency-free so tests can
// reach the refusal paths). Re-exported so routes have a single import.
export { checkReadAccess, checkReviewAccess, type ScopeAccess } from "./timesheet-access";

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
    || (perms.payroll ?? []).includes("write") || (perms.timeclock ?? []).includes("write");

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
 * The Prisma `where` for TimeClock under a given scope.
 * HR and founder get no adminId filter (or self excluded); a manager gets the
 * list of adminIds they may see.
 */
export function timeClockScopeWhere(scope: TimesheetScope): Record<string, unknown> {
  if (scope.isHr) {
    return scope.excludeSelfId ? { adminId: { not: scope.excludeSelfId } } : {};
  }
  return { adminId: { in: scope.allowedAdminIds ?? [] } };
}

// Authority to review leave requests. Same principles as
// assertCanReviewAdmin in the time clock module:
//   - founder: everything, themselves included
//   - super_admin / users.write / hr.write / payroll.write: everyone but self
//   - direct manager (target.managerId === actorId)
//   - team lead (team.leadAdminId === actorId)
//   - delegate (the target's manager set delegateApprovalTo === actorId)
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
    || (perms.payroll ?? []).includes("write") || (perms.timeclock ?? []).includes("write")
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
      // column not migrated yet: ignored
    }
  }

  return false;
}

// ─── Leave scope: who the actor may see and review ─────────────
// Unlike getTimesheetScope, a STANDARD employee (no management, no HR) also
// sees their peers — same teamId, or failing that same managerId — so the
// leave module's "Equipe" view shows real colleagues rather than nothing.
//
//   - founder:        allowedAdminIds = null (everyone)
//   - HR/super_admin: allowedAdminIds = null (everyone but self)
//   - manager:        reports plus the members of the teams they lead
//   - employee:       the other members of their team, else the other direct
//                     reports of their manager
//
// `peerSource` tells the UI where the peers came from, which its empty states
// need.
export type LeavesScope = TimesheetScope & {
  /** Where a standard employee's peers came from. */
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

  // 3) Orphan employee: no peer at all.
  return { ...base, allowedAdminIds: [], peerSource: "none" };
}

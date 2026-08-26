// Org-chart approval guard, shared by every module with an approval-type
// action (timeclock, leaves, appeals, uploads, personal docs, performance,
// payroll, employer counter-signature...).
//
// Company-wide rule: NOBODY approves/validates their own records — only
// their superior (direct manager / team lead / HR chain) can. The single
// exception is the FOUNDER, who has no superior.
import "server-only";
import { prisma } from "@/lib/prisma";

export async function isFounder(adminId: number): Promise<boolean> {
  try {
    const rows = await prisma.$queryRaw<{ is_founder: boolean }[]>`
      SELECT is_founder FROM admins WHERE id = ${adminId} LIMIT 1
    `;
    return rows[0]?.is_founder === true;
  } catch {
    return false;
  }
}

/**
 * Returns an error message when `actorId` tries an approval-type action on
 * their OWN record (and is not the founder), null when allowed.
 */
export async function selfApprovalError(
  actorId: number,
  targetAdminId: number | null | undefined,
): Promise<string | null> {
  if (!targetAdminId || actorId !== targetAdminId) return null;
  if (await isFounder(actorId)) return null;
  return "Vous ne pouvez pas approuver vos propres éléments — seul votre supérieur direct peut le faire.";
}

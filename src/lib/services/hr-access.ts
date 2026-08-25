// Acces RH partage pour les pages du module Personnel (/admin/employes).
// Regle standard du projet (identique aux checks inline existants :
// compensation, documents, contrats...) :
//   super_admin OU users.write OU hr.write
// `includePayroll` ajoute payroll.write (pages paie / docs fiscaux).
//
// NB : les managers / chefs d'equipe NON-RH gardent leur acces via le
// scope hierarchique (cf. timesheet-scope.ts) sur Conges et Pointage —
// ce helper ne s'applique qu'aux pages purement RH.
import "server-only";
import { prisma } from "@/lib/prisma";

/** Domaines RH fins de la matrice (hr.write reste le passe-partout). */
export type HrDomain =
  | "hr_documents" | "leaves" | "timeclock" | "payroll"
  | "performance" | "safety" | "hr_comms";

export async function isHrAdmin(
  adminId: number,
  opts?: { includePayroll?: boolean; domain?: HrDomain },
): Promise<boolean> {
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!me) return false;
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  return (
    me.customRole?.name === "super_admin"
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write")
    || (!!opts?.includePayroll && (perms.payroll ?? []).includes("write"))
    || (!!opts?.domain && (perms[opts.domain] ?? []).includes("write"))
  );
}

/**
 * Domaines RH accordés en écriture à cet admin (pour filtrer le menu du
 * module). Retourne aussi le flag passe-partout `isHr`.
 */
export async function getHrDomains(
  adminId: number,
): Promise<{ isHr: boolean; domains: HrDomain[] }> {
  const me = await prisma.admin.findUnique({
    where: { id: adminId },
    include: { customRole: true },
  });
  if (!me) return { isHr: false, domains: [] };
  const perms = (me.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr =
    me.customRole?.name === "super_admin"
    || (perms.users ?? []).includes("write")
    || (perms.hr ?? []).includes("write");
  const all: HrDomain[] = [
    "hr_documents", "leaves", "timeclock", "payroll",
    "performance", "safety", "hr_comms",
  ];
  const domains = isHr ? all : all.filter((d) => (perms[d] ?? []).includes("write"));
  return { isHr, domains };
}

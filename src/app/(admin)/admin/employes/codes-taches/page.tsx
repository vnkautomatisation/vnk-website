// Codes de tache — gestion par poste.
// Chaque poste (Comptable, Programmeur, ...) a sa propre liste de codes.
// Au pointage, l'employe doit choisir un code parmi ceux de son poste.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { JobCodesView } from "./job-codes-view";
import type { Metadata } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Codes de tâche" };

export default async function JobCodesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!, { domain: "timeclock" }))) redirect("/admin/employes/organigramme");

  const [positions, jobCodes] = await Promise.all([
    prisma.position.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, color: true },
    }),
    prisma.jobCode.findMany({
      orderBy: [{ positionId: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
      include: {
        position: { select: { id: true, name: true, color: true } },
        _count: { select: { timeClocks: true } },
      },
    }),
  ]);

  return (
    <JobCodesView
      positions={positions}
      jobCodes={JSON.parse(JSON.stringify(jobCodes))}
    />
  );
}

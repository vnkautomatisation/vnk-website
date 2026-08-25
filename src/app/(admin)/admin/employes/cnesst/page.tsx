import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { CnesstView } from "./cnesst-view";

export default async function CnesstPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!, { domain: "safety" }))) redirect("/admin/employes/organigramme");

  const [incidents, employees] = await Promise.all([
    prisma.cnesstIncident.findMany({
      orderBy: { incidentDate: "desc" },
      include: {
        admin: { select: { id: true, fullName: true, email: true } },
        reporter: { select: { fullName: true, email: true } },
      },
    }),
    prisma.admin.findMany({ where: { isActive: true }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true, email: true } }),
  ]);

  return <CnesstView incidents={JSON.parse(JSON.stringify(incidents))} employees={employees} />;
}

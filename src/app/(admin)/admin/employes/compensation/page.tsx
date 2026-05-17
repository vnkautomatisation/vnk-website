// HR · Vue compensation : salaires + bonus par employé.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CompensationView } from "./compensation-view";

export default async function CompensationPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isHr = me?.customRole?.name === "super_admin" || (perms.hr ?? []).includes("write") || (perms.users ?? []).includes("write");
  if (!isHr) redirect("/admin/employes");

  const [employees, salaryHistory, bonuses] = await Promise.all([
    prisma.admin.findMany({
      where: { isActive: true }, orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true, position: { select: { name: true } } },
    }),
    prisma.salaryHistory.findMany({
      orderBy: [{ adminId: "asc" }, { effectiveDate: "desc" }],
      include: { admin: { select: { id: true, fullName: true, email: true } } },
    }),
    prisma.bonusRecord.findMany({
      orderBy: { awardedAt: "desc" },
      take: 50,
      include: { admin: { select: { id: true, fullName: true, email: true } } },
    }),
  ]);

  return <CompensationView
    employees={employees}
    salaryHistory={JSON.parse(JSON.stringify(salaryHistory))}
    bonuses={JSON.parse(JSON.stringify(bonuses))}
  />;
}

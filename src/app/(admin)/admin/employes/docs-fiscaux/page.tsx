// HR · Emission T4 / Releve 1 par employe.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { TaxDocsView } from "./tax-docs-view";

export const metadata: Metadata = { title: "Employes — Documents fiscaux" };
export const dynamic = "force-dynamic";

export default async function TaxDocsAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // RH ou paie : T4/RL-1 de tous les employes.
  if (!(await isHrAdmin(session.user.adminId!, { includePayroll: true }))) {
    redirect("/admin/employes/organigramme");
  }

  const [employees, docs] = await Promise.all([
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
    prisma.taxDocument.findMany({
      orderBy: [{ taxYear: "desc" }, { issuedAt: "desc" }],
      include: { admin: { select: { id: true, fullName: true, email: true } } },
    }),
  ]);

  return <TaxDocsView employees={employees} docs={JSON.parse(JSON.stringify(docs))} />;
}

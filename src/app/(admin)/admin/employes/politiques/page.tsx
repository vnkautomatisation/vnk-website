import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { PoliciesAdminView } from "./policies-view";

export default async function PoliciesAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!, { domain: "hr_documents" }))) redirect("/admin/employes/organigramme");

  const [policies, activeAdminCount] = await Promise.all([
    prisma.hrPolicy.findMany({
      orderBy: [{ isActive: "desc" }, { title: "asc" }],
      include: { publisher: { select: { fullName: true, email: true } } },
    }),
    prisma.admin.count({ where: { isActive: true } }),
  ]);

  return (
    <PoliciesAdminView
      policies={JSON.parse(JSON.stringify(policies))}
      activeAdminCount={activeAdminCount}
    />
  );
}

// Liste des politiques RH en vigueur — consultable par tous.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PoliciesEmployeeView } from "./policies-employee-view";

export default async function HrPoliciesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const policies = await prisma.hrPolicy.findMany({
    where: { isActive: true },
    orderBy: [{ effectiveFrom: "desc" }, { title: "asc" }],
    select: {
      id: true,
      key: true,
      title: true,
      version: true,
      bodyMarkdown: true,
      effectiveFrom: true,
      publisher: { select: { fullName: true, email: true } },
    },
  });

  return <PoliciesEmployeeView policies={JSON.parse(JSON.stringify(policies))} />;
}

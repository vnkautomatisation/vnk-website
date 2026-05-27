import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PoliciesAdminView } from "./policies-view";

export default async function PoliciesAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

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

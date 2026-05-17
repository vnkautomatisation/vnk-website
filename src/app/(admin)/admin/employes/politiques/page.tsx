import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { PoliciesAdminView } from "./policies-view";

export default async function PoliciesAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const policies = await prisma.hrPolicy.findMany({
    orderBy: { title: "asc" },
    include: { publisher: { select: { fullName: true, email: true } } },
  });
  return <PoliciesAdminView policies={JSON.parse(JSON.stringify(policies))} />;
}

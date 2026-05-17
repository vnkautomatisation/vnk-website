import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { FamilyView } from "./family-view";

export default async function FamilyPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;
  const dependents = await prisma.familyDependent.findMany({
    where: { adminId },
    orderBy: [{ type: "asc" }, { fullName: "asc" }],
  });
  return <FamilyView adminId={adminId} dependents={JSON.parse(JSON.stringify(dependents))} />;
}

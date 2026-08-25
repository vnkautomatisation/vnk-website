import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { OffboardingView } from "./offboarding-view";

export default async function OffboardingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!))) redirect("/admin/employes/organigramme");

  const [checklists, candidates] = await Promise.all([
    prisma.offboardingChecklist.findMany({
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      include: {
        admin: { select: { id: true, fullName: true, email: true, avatarUrl: true, isActive: true, endDate: true } },
        successor: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true },
    }),
  ]);

  return <OffboardingView checklists={JSON.parse(JSON.stringify(checklists))} candidates={candidates} />;
}

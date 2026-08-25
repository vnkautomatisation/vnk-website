import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { LettersView } from "./letters-view";

export default async function LettersAdminPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!))) redirect("/admin/employes/organigramme");

  const requests = await prisma.employmentLetterRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    include: {
      admin: {
        select: { id: true, fullName: true, email: true, avatarUrl: true },
      },
    },
  });

  return <LettersView requests={JSON.parse(JSON.stringify(requests))} />;
}

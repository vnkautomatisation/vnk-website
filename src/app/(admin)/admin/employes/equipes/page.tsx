// Page Équipes — CRUD des sous-équipes avec hiérarchie + assignation membres.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { TeamsView } from "./teams-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("employes_equipes") };
}

export default async function EmployesTeamsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  if (!(await isHrAdmin(session.user.adminId!))) redirect("/admin/employes/organigramme");

  const [teams, admins] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        lead: { select: { id: true, fullName: true, email: true, avatarUrl: true } },
        parent: { select: { id: true, name: true } },
        members: {
          select: {
            id: true, fullName: true, email: true, avatarUrl: true,
            isActive: true,
            position: { select: { name: true, color: true } },
          },
        },
        _count: { select: { members: true, children: true } },
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true, fullName: true, email: true, avatarUrl: true,
        teamId: true, managerId: true,
        position: { select: { name: true, color: true } },
      },
    }),
  ]);

  return (
    <TeamsView
      teams={JSON.parse(JSON.stringify(teams))}
      admins={JSON.parse(JSON.stringify(admins))}
    />
  );
}

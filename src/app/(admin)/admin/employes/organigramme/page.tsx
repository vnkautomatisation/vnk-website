// Page Organigramme — visualisation arborescente : équipes (parents/enfants) + hiérarchie managériale.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { OrgChartView } from "./org-chart-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employés — Organigramme" };

export default async function OrganigrammePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const [teams, admins] = await Promise.all([
    prisma.team.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: {
        id: true, name: true, color: true, parentTeamId: true, leadAdminId: true,
        lead: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      orderBy: { fullName: "asc" },
      select: {
        id: true, fullName: true, email: true, avatarUrl: true,
        title: true, department: true,
        teamId: true, managerId: true,
        position: { select: { name: true, color: true } },
        customRole: { select: { name: true, color: true } },
      },
    }),
  ]);

  return (
    <OrgChartView
      teams={JSON.parse(JSON.stringify(teams))}
      admins={JSON.parse(JSON.stringify(admins))}
    />
  );
}

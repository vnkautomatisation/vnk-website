import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TeamView } from "../../settings/team/team-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employés — Postes" };

export default async function EmployesPostesPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const [users, roles, positions] = await Promise.all([
    prisma.admin.findMany({
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      select: {
        id: true, email: true, fullName: true, isActive: true, avatarUrl: true,
        title: true, department: true, phone: true, startDate: true, endDate: true,
        lastLogin: true, twoFactorEnabled: true, presenceStatus: true, presenceUntil: true,
        recoveryEmail: true, loginAlertsEnabled: true, defaultLanding: true, bio: true,
        internalNotes: true, createdAt: true, updatedAt: true, roleId: true, positionId: true,
        teamId: true, managerId: true,
        customRole: { select: { id: true, name: true, color: true } },
        position: { select: { id: true, name: true, color: true } },
      },
    }),
    prisma.role.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: { _count: { select: { admins: true, positions: true } } },
    }),
    prisma.position.findMany({
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      include: {
        defaultRole: { select: { id: true, name: true, color: true } },
        _count: { select: { admins: true } },
      },
    }),
  ]);

  return (
    <TeamView
      users={JSON.parse(JSON.stringify(users))}
      roles={JSON.parse(JSON.stringify(roles))}
      positions={JSON.parse(JSON.stringify(positions))}
      invitations={[]}
      currentAdminId={session.user.adminId!}
      defaultTab="positions"
      hideTabs
    />
  );
}

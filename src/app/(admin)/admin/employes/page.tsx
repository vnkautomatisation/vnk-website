// Module Employés — Page principale (Liste).
// Réutilise la TeamView existante pour ne pas dupliquer la logique.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { isHrAdmin } from "@/lib/services/hr-access";
import { redirect } from "next/navigation";
import { TeamView } from "../settings/team/team-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Employés — Liste",
};

export default async function EmployesListPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/admin/login");
  }
  // RH uniquement : la liste expose des champs sensibles (notes internes,
  // recovery email, invitations en attente). Les non-RH consultent
  // l'organigramme.
  if (!(await isHrAdmin(session.user.adminId!))) {
    redirect("/admin/employes/organigramme");
  }

  const [users, roles, positions, invitations] = await Promise.all([
    prisma.admin.findMany({
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
      select: {
        id: true,
        email: true,
        fullName: true,
        isActive: true,
        avatarUrl: true,
        title: true,
        department: true,
        phone: true,
        startDate: true,
        endDate: true,
        lastLogin: true,
        twoFactorEnabled: true,
        presenceStatus: true,
        presenceUntil: true,
        recoveryEmail: true,
        loginAlertsEnabled: true,
        defaultLanding: true,
        bio: true,
        internalNotes: true,
        civility: true,
        gender: true,
        preferredPronouns: true,
        createdAt: true,
        updatedAt: true,
        roleId: true,
        positionId: true,
        teamId: true,
        managerId: true,
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
    prisma.adminInvitation.findMany({
      where: { acceptedAt: null, revokedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
      take: 50,
    }).catch(() => []),
  ]);

  return (
    <TeamView
      users={JSON.parse(JSON.stringify(users))}
      roles={JSON.parse(JSON.stringify(roles))}
      positions={JSON.parse(JSON.stringify(positions))}
      invitations={JSON.parse(JSON.stringify(invitations))}
      currentAdminId={session.user.adminId!}
      defaultTab="users"
      hideTabs
    />
  );
}

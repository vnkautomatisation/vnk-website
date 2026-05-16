// Settings · Équipe (Utilisateurs / Rôles / Postes)
// Page d'administration no-code pour gérer les comptes employés, les rôles
// RBAC custom et les postes templates.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TeamView } from "./team-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Équipe — Utilisateurs, rôles et postes",
};

export default async function TeamPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/admin/login");
  }

  const [users, roles, positions] = await Promise.all([
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
        createdAt: true,
        roleId: true,
        positionId: true,
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
      currentAdminId={session.user.adminId!}
    />
  );
}

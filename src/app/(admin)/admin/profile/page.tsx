// Mon profil admin — banniere + 4 onglets (compte, securite, sessions, activite)
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "./profile-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon profil",
};

export default async function ProfilePage() {
  const session = await auth();
  const adminId = session!.user.adminId!;

  const [admin, sessions, auditLogs] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true,
        email: true,
        fullName: true,
        role: true,
        twoFactorEnabled: true,
        lastLogin: true,
        createdAt: true,
      },
    }),
    prisma.adminSession.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 20,
      select: {
        id: true,
        userAgent: true,
        ipAddress: true,
        createdAt: true,
        expiresAt: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        changes: true,
        ipAddress: true,
        createdAt: true,
      },
    }),
  ]);

  if (!admin) return null;

  return (
    <ProfileView
      admin={{
        ...admin,
        fullName: admin.fullName,
        lastLogin: admin.lastLogin?.toISOString() ?? null,
        createdAt: admin.createdAt.toISOString(),
      }}
      sessions={sessions.map((s) => ({
        id: s.id,
        userAgent: s.userAgent,
        ipAddress: s.ipAddress,
        createdAt: s.createdAt.toISOString(),
        expiresAt: s.expiresAt.toISOString(),
      }))}
      auditLogs={auditLogs.map((l) => ({
        id: l.id,
        action: l.action,
        entityType: l.entityType,
        entityId: l.entityId,
        changes: l.changes,
        ipAddress: l.ipAddress,
        createdAt: l.createdAt.toISOString(),
      }))}
    />
  );
}

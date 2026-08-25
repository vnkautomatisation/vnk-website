// Settings · Activité équipe — qui fait quoi sur le portail.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { TeamActivityView } from "./team-activity-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Activité équipe — VNK" };

export default async function TeamActivityPage({
  searchParams,
}: {
  searchParams: Promise<{ admin?: string; entity?: string; action?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");

  const params = await searchParams;
  const adminFilter = params.admin ? Number(params.admin) : undefined;
  const entityFilter = params.entity;
  const actionFilter = params.action;

  const where: Record<string, unknown> = {};
  if (adminFilter) where.adminId = adminFilter;
  if (entityFilter) where.entityType = entityFilter;
  if (actionFilter) where.action = actionFilter;

  const [logs, admins, entityTypes, actions, totalLogs] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 100,
      include: {
        admin: { select: { id: true, email: true, fullName: true, avatarUrl: true, position: { select: { color: true } } } },
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: {
        id: true, email: true, fullName: true, avatarUrl: true, lastLogin: true,
        position: { select: { name: true, color: true } },
        customRole: { select: { name: true, color: true } },
      },
      orderBy: { lastLogin: "desc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["entityType"], select: { entityType: true }, orderBy: { entityType: "asc" },
    }),
    prisma.auditLog.findMany({
      distinct: ["action"], select: { action: true }, orderBy: { action: "asc" },
    }),
    prisma.auditLog.count(),
  ]);

  return (
    <TeamActivityView
      logs={JSON.parse(JSON.stringify(logs))}
      admins={JSON.parse(JSON.stringify(admins))}
      entityTypes={entityTypes.map((e) => e.entityType)}
      actions={actions.map((a) => a.action)}
      totalLogs={totalLogs}
      currentFilters={{ admin: adminFilter, entity: entityFilter, action: actionFilter }}
    />
  );
}

// Settings · Sécurité — politique globale, events critiques, gestion des comptes.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { SecurityView } from "./security-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("securite_vnk") };
}

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");

  const [policySettings, recentEvents, lockedAdmins, allAdmins, currentAdmin] = await Promise.all([
    prisma.setting.findMany({ where: { category: "security" } }),
    prisma.adminSecurityEvent.findMany({
      where: { severity: { in: ["warning", "critical"] } },
      orderBy: { createdAt: "desc" },
      take: 30,
      include: { admin: { select: { email: true, fullName: true } } },
    }),
    prisma.admin.findMany({
      where: { OR: [{ lockedUntil: { gt: new Date() } }, { failedLoginAttempts: { gte: 3 } }] },
      select: { id: true, email: true, fullName: true, lockedUntil: true, failedLoginAttempts: true, lastLogin: true },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: {
        id: true, email: true, fullName: true, twoFactorEnabled: true,
        lastLogin: true, lockedUntil: true, failedLoginAttempts: true,
        customRole: { select: { name: true, color: true } },
      },
      orderBy: { lastLogin: "desc" },
    }),
    prisma.admin.findUnique({
      where: { id: session.user.adminId! },
      include: { customRole: true },
    }),
  ]);

  const policy: Record<string, string> = {};
  for (const s of policySettings) policy[s.key] = s.value ?? "";

  return (
    <SecurityView
      policy={policy}
      recentEvents={JSON.parse(JSON.stringify(recentEvents))}
      lockedAdmins={JSON.parse(JSON.stringify(lockedAdmins))}
      allAdmins={JSON.parse(JSON.stringify(allAdmins))}
      currentAdminId={session.user.adminId!}
      isSuperAdmin={currentAdmin?.customRole?.name === "super_admin"}
    />
  );
}

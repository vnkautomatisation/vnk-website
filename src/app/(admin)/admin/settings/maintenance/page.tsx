// Settings · Maintenance — fenêtres planifiées, incidents, bandeau d'annonce.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { MaintenanceView } from "./maintenance-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("maintenance_vnk") };
}

export default async function MaintenancePage() {
  const t = await getTranslations("admin.maintenance");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write") && !canAct(perms, "client_portal", "write") && !canAct(perms, "website", "write")) redirect("/admin");

  const [windows, incidents, bannerSettings] = await Promise.all([
    prisma.maintenanceWindow.findMany({ orderBy: { startsAt: "desc" } }),
    prisma.incidentReport.findMany({ orderBy: { startedAt: "desc" }, take: 50 }),
    prisma.setting.findMany({ where: { category: "system", key: { startsWith: "banner_" } } }),
  ]);

  const banner: Record<string, string> = {};
  for (const s of bannerSettings) banner[s.key] = s.value ?? "";

  return (
    <MaintenanceView
      windows={JSON.parse(JSON.stringify(windows))}
      incidents={JSON.parse(JSON.stringify(incidents))}
      banner={banner}
    />
  );
}

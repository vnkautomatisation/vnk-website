// Settings · Maintenance — fenêtres planifiées, incidents, bandeau d'annonce.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MaintenanceView } from "./maintenance-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Maintenance — VNK" };

export default async function MaintenancePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

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

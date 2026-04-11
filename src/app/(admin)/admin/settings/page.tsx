// Admin · Paramètres (Server Component)
// Charge tous les settings groupés par catégorie + délègue au composant client
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { SettingsView } from "./settings-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations({ namespace: "settings" });
  return {
    title: t("page_title"),
    description: t("page_subtitle"),
  };
}

export default async function SettingsPage() {
  const rows = await prisma.setting.findMany({
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }],
  });

  // Group by category
  const byCategory: Record<string, typeof rows> = {};
  for (const r of rows) {
    byCategory[r.category] ??= [];
    byCategory[r.category].push(r);
  }

  return <SettingsView settingsByCategory={byCategory} />;
}

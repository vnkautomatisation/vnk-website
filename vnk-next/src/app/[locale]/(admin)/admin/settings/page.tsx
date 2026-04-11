// Admin · Paramètres (Server Component)
// Charge tous les settings groupés par catégorie + délègue au composant client
import { getTranslations, setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { SettingsView } from "./settings-view";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "settings" });
  return {
    title: t("page_title"),
    description: t("page_subtitle"),
  };
}

export default async function SettingsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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

// Settings · Finance · Fiscalité · Loi 25
// Charge tous les paramètres regroupés des catégories finance, fiscal, legal.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { FinanceView } from "./finance-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("finance_fiscalite_vnk") };
}

export default async function FinancePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");

  const rows = await prisma.setting.findMany({
    where: { category: { in: ["finance", "fiscal", "legal", "billing"] } },
  });
  const settings: Record<string, string> = {};
  for (const r of rows) settings[`${r.category}.${r.key}`] = r.value ?? "";

  return <FinanceView initial={settings} />;
}

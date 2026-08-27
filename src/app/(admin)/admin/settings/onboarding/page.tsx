// Settings · Onboarding — assistant guidé pour la configuration initiale.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "./onboarding-wizard";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("configuration_guidee_vnk") };
}

export default async function OnboardingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");

  // Pré-charger les settings existants pour pré-remplir les étapes
  const [settings, hasLogo, hasRprp, adminsCount, fiscalCount] = await Promise.all([
    prisma.setting.findMany({
      where: { category: { in: ["company", "fiscal", "legal", "appearance", "finance"] } },
    }),
    prisma.setting.findUnique({ where: { category_key: { category: "appearance", key: "logo_primary" } } }),
    prisma.setting.findUnique({ where: { category_key: { category: "legal", key: "rprp_name" } } }),
    prisma.admin.count({ where: { isActive: true } }),
    prisma.setting.count({ where: { category: "fiscal", key: { in: ["neq", "gst_number", "qst_number"] }, value: { not: null } } }),
  ]);

  const initial: Record<string, string> = {};
  for (const s of settings) initial[`${s.category}.${s.key}`] = s.value ?? "";

  const progress = {
    company: !!(initial["company.name"] || initial["company.legal_name"]),
    branding: !!hasLogo?.value,
    fiscal: fiscalCount === 3,
    finance: !!(initial["finance.bank_institution"] && initial["finance.bank_transit"]),
    law25: !!hasRprp?.value,
    team: adminsCount > 1,
  };

  return <OnboardingWizard initial={initial} progress={progress} />;
}

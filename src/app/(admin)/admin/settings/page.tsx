// Admin · Paramètres (Server Component)
// Charge tous les settings groupés par catégorie + métriques d'overview du no-code
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { getCurrentAdminPermissions, canAccessSettingsArea } from "@/lib/permissions";
import { redirect } from "next/navigation";
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
  // Hub reglages : settings.write OU une ressource de la famille config
  // (informaticien : portail client / site web / integrations / contenu).
  const perms = await getCurrentAdminPermissions();
  if (!perms) redirect("/admin/login");
  if (!canAccessSettingsArea(perms)) redirect("/admin");

  // Settings + KPIs en parallèle
  const [
    rows, adminsActive, roles, positions, catalogItems,
    posts, faqs, testimonials, emailTpl, pdfTpl, services, promos,
    appearanceCount, fiscalSet, rprpSet, integrations,
  ] = await Promise.all([
    prisma.setting.findMany({ orderBy: [{ category: "asc" }, { sortOrder: "asc" }] }),
    prisma.admin.count({ where: { isActive: true } }),
    prisma.role.count(),
    prisma.position.count(),
    prisma.catalogItem.count(),
    prisma.blogPost.count({ where: { status: "published" } }),
    prisma.faqItem.count({ where: { isPublished: true } }),
    prisma.testimonial.count({ where: { isApproved: true } }),
    prisma.emailTemplate.count({ where: { isEnabled: true } }),
    prisma.pdfTemplate.count({ where: { isEnabled: true } }),
    prisma.serviceCatalog.count({ where: { isActive: true } }),
    prisma.discountCode.count({ where: { isActive: true } }),
    prisma.setting.count({ where: { category: "appearance", key: { startsWith: "logo_" }, value: { not: null } } }),
    prisma.setting.findFirst({ where: { category: "fiscal", key: "neq", value: { not: null } } }),
    prisma.setting.findFirst({ where: { category: "legal", key: "rprp_name", value: { not: null } } }),
    prisma.integration.count({ where: { isEnabled: true } }),
  ]);

  // Group settings by category
  const byCategory: Record<string, typeof rows> = {};
  for (const r of rows) {
    byCategory[r.category] ??= [];
    byCategory[r.category].push(r);
  }

  // Overview KPIs
  const overview = {
    adminsActive,
    roles, positions,
    catalogItems,
    contentPublished: posts + faqs + testimonials,
    posts, faqs, testimonials,
    emailTpl, pdfTpl,
    services, promos,
    logosUploaded: appearanceCount,
    fiscalDone: !!fiscalSet,
    rprpDone: !!rprpSet,
    integrationsEnabled: integrations,
  };

  return <SettingsView settingsByCategory={byCategory} overview={overview} />;
}

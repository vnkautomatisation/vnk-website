// Settings · Charte graphique — logos, couleurs, polices.
// Vue server qui charge tous les paramètres de la catégorie appearance + custom CSS.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { BrandingView } from "./branding-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("charte_graphique_vnk") };
}

export default async function BrandingPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    redirect("/admin/login");
  }
  // Acces reglages : settings.write (ou branding.write) requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write") && !canAct(perms, "branding", "write") && !canAct(perms, "website", "write") && !canAct(perms, "client_portal", "write")) redirect("/admin");

  const rows = await prisma.setting.findMany({
    where: { category: "appearance" },
    orderBy: { key: "asc" },
  });

  // Construire un map key → value pour passage facile
  const settings: Record<string, string | null> = {};
  for (const r of rows) settings[r.key] = r.value;

  return <BrandingView initial={settings} />;
}

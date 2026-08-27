// Settings · Mode démo — créer/purger des données fictives.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { DemoView } from "./demo-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("mode_demo_vnk") };
}

export default async function DemoPage() {
  const t = await getTranslations("admin.demo");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");

  const [demoSetting, demoClients, demoQuotes, demoInvoices, currentAdmin] = await Promise.all([
    prisma.setting.findUnique({ where: { category_key: { category: "system", key: "demo_mode" } } }),
    prisma.client.count({ where: { internalNotes: { contains: "[DEMO]" } } }),
    prisma.quote.count({ where: { quoteNumber: { startsWith: "DEV-DEMO-" } } }),
    prisma.invoice.count({ where: { invoiceNumber: { startsWith: "FAC-DEMO-" } } }),
    prisma.admin.findUnique({
      where: { id: session.user.adminId! },
      include: { customRole: true },
    }),
  ]);

  return (
    <DemoView
      enabled={demoSetting?.value === "true"}
      counts={{ clients: demoClients, quotes: demoQuotes, invoices: demoInvoices }}
      isSuperAdmin={currentAdmin?.customRole?.name === "super_admin"}
    />
  );
}

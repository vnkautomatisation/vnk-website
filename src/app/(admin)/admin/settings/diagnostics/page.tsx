// Settings · Diagnostics — page client qui appelle /api/admin/diagnostics.
import { auth } from "@/lib/auth";
import { getTranslations } from "next-intl/server";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { DiagnosticsView } from "./diagnostics-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("diagnostics_vnk") };
}

export default async function DiagnosticsPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write")) redirect("/admin");
  return <DiagnosticsView />;
}

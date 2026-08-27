// Settings · API — tokens d'accès personnels.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { ApiTokensView } from "./api-tokens-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("api_tokens_vnk") };
}

export default async function ApiTokensPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write (ou integrations.write) requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write") && !canAct(perms, "integrations", "write")) redirect("/admin");

  const tokens = await prisma.adminApiToken.findMany({
    where: { adminId: session.user.adminId! },
    orderBy: { createdAt: "desc" },
  });

  return <ApiTokensView tokens={JSON.parse(JSON.stringify(tokens))} />;
}

// Settings · Webhooks — sortants (vers partenaires) + entrants (debug & replay).
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { getCurrentAdminPermissions, canAct } from "@/lib/permissions";
import { redirect } from "next/navigation";
import { WebhooksView } from "./webhooks-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("webhooks_vnk") };
}

export default async function WebhooksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  // Acces reglages : settings.write (ou integrations.write) requis.
  const perms = await getCurrentAdminPermissions();
  if (!canAct(perms, "settings", "write") && !canAct(perms, "integrations", "write")) redirect("/admin");

  const [outgoing, incoming] = await Promise.all([
    prisma.outgoingWebhook.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.incomingWebhookLog.findMany({
      orderBy: { receivedAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <WebhooksView
      outgoing={JSON.parse(JSON.stringify(outgoing))}
      incoming={JSON.parse(JSON.stringify(incoming))}
    />
  );
}

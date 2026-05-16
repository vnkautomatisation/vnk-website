// Settings · Webhooks — sortants (vers partenaires) + entrants (debug & replay).
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { WebhooksView } from "./webhooks-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Webhooks — VNK" };

export default async function WebhooksPage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

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

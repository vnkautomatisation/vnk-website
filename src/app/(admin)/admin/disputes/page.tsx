import { prisma } from "@/lib/prisma";
import { DisputesView } from "./disputes-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Litiges" };

export default async function DisputesPage() {
  const [rawDisputes, clients] = await Promise.all([
    prisma.dispute.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const disputes = rawDisputes.map((d) => ({
    id: d.id,
    clientId: d.clientId,
    clientName: d.client.fullName,
    companyName: d.client.companyName,
    title: d.title,
    description: d.description,
    status: d.status,
    priority: d.priority,
    resolution: d.resolution,
    openedAt: d.openedAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  const kpis = {
    total: disputes.length,
    open: disputes.filter((d) => d.status === "open").length,
    resolved: disputes.filter((d) => d.status === "resolved").length,
  };

  return <DisputesView disputes={disputes} clients={clients} kpis={kpis} />;
}

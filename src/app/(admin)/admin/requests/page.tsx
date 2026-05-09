import { prisma } from "@/lib/prisma";
import { RequestsView } from "./requests-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Demandes de projet" };

export default async function RequestsPage() {
  const rawRequests = await prisma.projectRequest.findMany({
    orderBy: { createdAt: "desc" },
  });

  const clientIds = [...new Set(rawRequests.map((r) => r.clientId))];
  const clientsMap = new Map(
    (
      await prisma.client.findMany({
        where: { id: { in: clientIds } },
        select: { id: true, fullName: true, companyName: true },
      })
    ).map((c) => [c.id, c])
  );

  const requests = rawRequests.map((r) => {
    const client = clientsMap.get(r.clientId);
    return {
      id: r.id,
      clientId: r.clientId,
      clientName: client?.fullName ?? "Client inconnu",
      companyName: client?.companyName ?? null,
      title: r.title,
      description: r.description,
      serviceType: r.serviceType,
      urgency: r.urgency,
      status: r.status,
      plcBrand: r.plcBrand,
      budgetRange: r.budgetRange,
      convertedToMandateId: r.convertedToMandateId,
      convertedToQuoteId: r.convertedToQuoteId,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  });

  const kpis = {
    total: requests.length,
    newCount: requests.filter((r) => r.status === "new").length,
    inProgress: requests.filter((r) => r.status === "in_progress").length,
    converted: requests.filter((r) => r.status === "converted").length,
    criticalCount: requests.filter((r) => r.urgency === "critical" && r.status !== "converted" && r.status !== "closed").length,
  };

  return <RequestsView requests={requests} kpis={kpis} />;
}

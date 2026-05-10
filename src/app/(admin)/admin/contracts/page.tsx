// Admin · Contrats — KPIs + filtres + creation + signature + PDF + envoi client
import { prisma } from "@/lib/prisma";
import { ContractsView } from "./contracts-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contrats" };

export default async function ContractsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [rawContracts, clients, mandates, quotes] = await Promise.all([
    prisma.contract.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        mandate: { select: { id: true, title: true } },
        quote: { select: { id: true, quoteNumber: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.mandate.findMany({
      select: { id: true, title: true, clientId: true, status: true },
      orderBy: { title: "asc" },
    }),
    prisma.quote.findMany({
      where: { status: { in: ["accepted", "signed"] } },
      select: { id: true, quoteNumber: true, clientId: true, title: true, amountTtc: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const contracts = rawContracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    clientId: c.clientId,
    clientName: c.client.fullName,
    companyName: c.client.companyName,
    mandateId: c.mandateId,
    mandateTitle: c.mandate?.title ?? null,
    quoteId: c.quoteId,
    quoteNumber: c.quote?.quoteNumber ?? null,
    title: c.title,
    status: c.status,
    amountTtc: c.amountTtc != null ? Number(c.amountTtc) : null,
    clientSignatureData: !!c.clientSignatureData,
    adminSignatureData: !!c.adminSignatureData,
    signedAt: c.signedAt?.toISOString() ?? null,
    expiresAt: c.expiresAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  const pendingCount = contracts.filter((c) => c.status === "pending").length;
  const signedCount = contracts.filter((c) => c.status === "signed").length;
  const signedThisMonth = contracts.filter((c) => c.status === "signed" && c.signedAt && new Date(c.signedAt) >= monthStart).length;
  const totalValue = contracts.filter((c) => c.status === "signed").reduce((s, c) => s + (c.amountTtc ?? 0), 0);

  return (
    <ContractsView
      contracts={contracts}
      clients={clients}
      mandates={mandates}
      acceptedQuotes={quotes.map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        clientId: q.clientId,
        title: q.title,
        amountTtc: Number(q.amountTtc),
      }))}
      kpis={{ total: contracts.length, pendingCount, signedCount, signedThisMonth, totalValue }}
    />
  );
}

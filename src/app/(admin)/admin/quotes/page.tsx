// Admin · Devis — KPIs + table filtres + creation
import { prisma } from "@/lib/prisma";
import { QuotesView } from "./quotes-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Devis" };

export default async function QuotesPage() {
  const [rawQuotes, clients, rawMandates] = await Promise.all([
    prisma.quote.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        mandate: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.mandate.findMany({
      where: { status: { notIn: ["completed", "cancelled"] } },
      select: { id: true, title: true, clientId: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const quotes = rawQuotes.map((q) => ({
    id: q.id,
    quoteNumber: q.quoteNumber,
    clientId: q.clientId,
    clientName: q.client.fullName,
    companyName: q.client.companyName,
    mandateId: q.mandateId,
    mandateTitle: q.mandate?.title ?? null,
    title: q.title,
    description: q.description,
    serviceType: q.serviceType,
    status: q.status,
    amountHt: Number(q.amountHt),
    tpsAmount: Number(q.tpsAmount),
    tvqAmount: Number(q.tvqAmount),
    amountTtc: Number(q.amountTtc),
    paymentPlan: q.paymentPlan,
    paymentPct1: q.paymentPct1,
    paymentPct2: q.paymentPct2,
    paymentConditions: q.paymentConditions,
    expiryDate: q.expiryDate?.toISOString() ?? null,
    acceptedAt: q.acceptedAt?.toISOString() ?? null,
    createdAt: q.createdAt.toISOString(),
  }));

  return <QuotesView quotes={quotes} clients={clients} mandates={rawMandates} />;
}

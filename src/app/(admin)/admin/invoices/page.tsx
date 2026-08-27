// Admin · Factures — KPIs + table filtres + creation + actions (mark paid, PDF, send)
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { InvoicesView } from "./invoices-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("factures") };
}

export default async function InvoicesPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [rawInvoices, clients, mandates, quotes, contracts] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        contract: { select: { id: true, contractNumber: true } },
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
    prisma.contract.findMany({
      where: { status: "signed" },
      select: { id: true, contractNumber: true, clientId: true, title: true, amountTtc: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const invoices = rawInvoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId,
    clientName: i.client.fullName,
    companyName: i.client.companyName,
    contractId: i.contractId,
    contractNumber: i.contract?.contractNumber ?? null,
    quoteId: i.quoteId,
    quoteNumber: i.quote?.quoteNumber ?? null,
    title: i.title,
    description: i.description,
    serviceType: i.serviceType,
    status: i.status,
    amountHt: Number(i.amountHt),
    tpsAmount: Number(i.tpsAmount),
    tvqAmount: Number(i.tvqAmount),
    amountTtc: Number(i.amountTtc),
    paymentMethod: i.paymentMethod,
    invoicePhase: i.invoicePhase,
    phaseNumber: i.phaseNumber,
    dueDate: i.dueDate?.toISOString() ?? null,
    paidAt: i.paidAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  }));

  const unpaidTotal = invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").reduce((s, i) => s + i.amountTtc, 0);
  const overdueTotal = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amountTtc, 0);
  const paidThisMonth = invoices.filter((i) => i.status === "paid" && i.paidAt && new Date(i.paidAt) >= monthStart).reduce((s, i) => s + i.amountTtc, 0);

  return (
    <InvoicesView
      invoices={invoices}
      clients={clients}
      mandates={mandates}
      acceptedQuotes={quotes.map((q) => ({
        id: q.id,
        quoteNumber: q.quoteNumber,
        clientId: q.clientId,
        title: q.title,
        amountTtc: Number(q.amountTtc),
      }))}
      signedContracts={contracts.map((c) => ({
        id: c.id,
        contractNumber: c.contractNumber,
        clientId: c.clientId,
        title: c.title,
        amountTtc: c.amountTtc != null ? Number(c.amountTtc) : null,
      }))}
      kpis={{
        unpaidTotal,
        overdueTotal,
        paidThisMonth,
        overdueCount: invoices.filter((i) => i.status === "overdue").length,
        unpaidCount: invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").length,
      }}
    />
  );
}

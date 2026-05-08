// Admin · Factures — KPIs + table filtres + creation + actions (mark paid, PDF)
import { prisma } from "@/lib/prisma";
import { InvoicesView } from "./invoices-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Factures" };

export default async function InvoicesPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [rawInvoices, clients] = await Promise.all([
    prisma.invoice.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const invoices = rawInvoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    clientId: i.clientId,
    clientName: i.client.fullName,
    companyName: i.client.companyName,
    title: i.title,
    status: i.status,
    amountHt: Number(i.amountHt),
    tpsAmount: Number(i.tpsAmount),
    tvqAmount: Number(i.tvqAmount),
    amountTtc: Number(i.amountTtc),
    dueDate: i.dueDate?.toISOString() ?? null,
    paidAt: i.paidAt?.toISOString() ?? null,
    createdAt: i.createdAt.toISOString(),
  }));

  // KPI counts
  const unpaidTotal = invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").reduce((s, i) => s + i.amountTtc, 0);
  const overdueTotal = invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + i.amountTtc, 0);
  const paidThisMonth = invoices.filter((i) => i.status === "paid" && i.paidAt && new Date(i.paidAt) >= monthStart).reduce((s, i) => s + i.amountTtc, 0);

  return (
    <InvoicesView
      invoices={invoices}
      clients={clients}
      kpis={{ unpaidTotal, overdueTotal, paidThisMonth, overdueCount: invoices.filter((i) => i.status === "overdue").length }}
    />
  );
}

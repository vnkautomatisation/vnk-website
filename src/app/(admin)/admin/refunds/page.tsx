import { prisma } from "@/lib/prisma";
import { RefundsView } from "./refunds-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Remboursements" };

export default async function RefundsPage() {
  const [rawRefunds, clients, invoices] = await Promise.all([
    prisma.refund.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        invoice: { select: { id: true, invoiceNumber: true, stripePaymentIntentId: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.invoice.findMany({
      where: { status: { in: ["paid", "unpaid", "overdue"] } },
      select: { id: true, invoiceNumber: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const refunds = rawRefunds.map((r) => ({
    id: r.id,
    refundNumber: r.refundNumber,
    clientId: r.clientId,
    clientName: r.client.fullName,
    companyName: r.client.companyName,
    invoiceId: r.invoiceId,
    invoiceNumber: r.invoice?.invoiceNumber ?? null,
    invoiceStripePaymentIntentId: r.invoice?.stripePaymentIntentId ?? null,
    stripeRefundId: r.stripeRefundId,
    reason: r.reason,
    amount: Number(r.amount),
    tpsAmount: Number(r.tpsAmount),
    tvqAmount: Number(r.tvqAmount),
    totalAmount: Number(r.totalAmount),
    status: r.status,
    notes: r.notes,
    processedAt: r.processedAt?.toISOString() ?? null,
    createdAt: r.createdAt.toISOString(),
  }));

  const kpis = {
    total: refunds.length,
    pending: refunds.filter((r) => r.status === "pending").length,
    processed: refunds.filter((r) => r.status === "processed" || r.status === "confirmed").length,
  };

  return <RefundsView refunds={refunds} clients={clients} invoices={invoices} kpis={kpis} />;
}

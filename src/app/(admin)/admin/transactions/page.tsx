import { prisma } from "@/lib/prisma";
import { TransactionsView } from "./transactions-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Transactions" };

export default async function TransactionsPage() {
  const rawPayments = await prisma.payment.findMany({
    include: {
      client: { select: { id: true, fullName: true, companyName: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const payments = rawPayments.map((p) => ({
    id: p.id,
    invoiceId: p.invoiceId,
    clientId: p.clientId,
    clientName: p.client?.fullName ?? "\u2014",
    companyName: p.client?.companyName ?? null,
    invoiceNumber: p.invoice?.invoiceNumber ?? "\u2014",
    stripePaymentIntentId: p.stripePaymentIntentId,
    stripeChargeId: p.stripeChargeId,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  const totalPaid = payments.filter((p) => p.status === "succeeded" || p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const totalRefunded = payments.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount, 0);

  return (
    <TransactionsView
      payments={payments}
      kpis={{ totalPaid, totalRefunded, count: payments.length }}
    />
  );
}

import { prisma } from "@/lib/prisma";
import { SettlementsView } from "./settlements-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Rapport de règlement" };

export default async function SettlementsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;
  const from = params.from ? new Date(params.from) : new Date(new Date().setDate(new Date().getDate() - 90));
  const to = params.to ? new Date(params.to) : new Date();

  const payments = await prisma.payment.findMany({
    where: {
      paidAt: { gte: from, lte: to },
      status: { in: ["succeeded", "paid", "refunded"] },
    },
    orderBy: { paidAt: "asc" },
    include: {
      client: { select: { fullName: true, companyName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    take: 5000,
  });

  const rows = payments.map((p) => ({
    id: p.id,
    paidAt: p.paidAt?.toISOString() ?? null,
    settledAt: p.settledAt?.toISOString() ?? null,
    payoutAt: p.payoutAt?.toISOString() ?? null,
    clientName: p.client?.fullName ?? "—",
    cardholderName: p.cardholderName ?? p.client?.fullName ?? "—",
    type: p.type ?? "charge",
    status: p.status,
    amount: Number(p.amount),
    currency: (p.currency ?? "cad").toUpperCase(),
    processingFee: p.processingFee != null ? Number(p.processingFee) : null,
    netAmount: p.netAmount != null ? Number(p.netAmount) : null,
    stripePaymentIntentId: p.stripePaymentIntentId,
    paymentMethod: p.paymentMethod,
    stripeBalanceTxId: p.stripeBalanceTxId,
    stripePayoutId: p.stripePayoutId,
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
  }));

  // KPIs
  let totalGross = 0, totalFees = 0, totalNet = 0;
  let chargeCount = 0, refundCount = 0, chargebackCount = 0;
  rows.forEach((r) => {
    totalGross += r.amount;
    totalFees += r.processingFee ?? 0;
    totalNet += r.netAmount ?? r.amount;
    if (r.type === "charge") chargeCount++;
    else if (r.type === "refund") refundCount++;
    else if (r.type === "chargeback") chargebackCount++;
  });

  return (
    <SettlementsView
      rows={rows}
      kpis={{ totalGross, totalFees, totalNet, chargeCount, refundCount, chargebackCount, count: rows.length }}
      dateRange={{ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }}
    />
  );
}

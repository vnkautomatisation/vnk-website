import { prisma } from "@/lib/prisma";
import { PaymentsView } from "./payments-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tous les paiements" };

export default async function PaymentsPage() {
  const payments = await prisma.payment.findMany({
    orderBy: { paidAt: "desc" },
    take: 500,
    include: {
      client: { select: { id: true, fullName: true, companyName: true, country: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  // Agrégats par type pour les KPI
  const byType: Record<string, { count: number; total: number }> = {};
  let totalNet = 0;
  let totalFees = 0;
  for (const p of payments) {
    const t = (p.type ?? "charge").toLowerCase();
    if (!byType[t]) byType[t] = { count: 0, total: 0 };
    byType[t].count += 1;
    byType[t].total += Number(p.amountCad ?? p.amount);
    totalFees += Number(p.processingFee ?? 0);
    totalNet += Number(p.netAmount ?? p.amountCad ?? p.amount);
  }

  const data = payments.map((p) => ({
    id: p.id,
    invoiceId: p.invoiceId,
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
    clientId: p.client?.id ?? null,
    clientName: p.client?.fullName ?? "—",
    companyName: p.client?.companyName ?? null,
    country: p.client?.country ?? null,
    amount: Number(p.amount),
    amountCad: p.amountCad != null ? Number(p.amountCad) : null,
    currency: (p.currency ?? "cad").toUpperCase(),
    fxRate: p.fxRate != null ? Number(p.fxRate) : null,
    fxRateSource: p.fxRateSource,
    processingFee: p.processingFee != null ? Number(p.processingFee) : null,
    netAmount: p.netAmount != null ? Number(p.netAmount) : null,
    status: p.status,
    type: p.type ?? "charge",
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt?.toISOString() ?? null,
    settledAt: p.settledAt?.toISOString() ?? null,
    payoutAt: p.payoutAt?.toISOString() ?? null,
    cardBrand: p.cardBrand,
    cardLast4: p.cardLast4,
    cardCountry: p.cardCountry,
    cardholderName: p.cardholderName,
    stripePaymentIntentId: p.stripePaymentIntentId,
    stripeChargeId: p.stripeChargeId,
    stripePayoutId: p.stripePayoutId,
    stripeBalanceTxId: p.stripeBalanceTxId,
    stripeReceiptUrl: p.stripeReceiptUrl,
  }));

  return (
    <PaymentsView
      payments={data}
      kpis={{
        total: data.length,
        totalNet,
        totalFees,
        byType,
      }}
    />
  );
}

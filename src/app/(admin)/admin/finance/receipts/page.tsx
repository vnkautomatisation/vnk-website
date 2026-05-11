import { prisma } from "@/lib/prisma";
import { ReceiptsView } from "./receipts-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reçus" };

export default async function ReceiptsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string; method?: string }>;
}) {
  const params = await searchParams;

  // Validation defensive des dates
  function parseSafe(s: string | undefined): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  let from = parseSafe(params.from);
  let to = parseSafe(params.to);
  if (from && to && from > to) [from, to] = [to, from];

  const where: Record<string, unknown> = {
    status: { in: ["succeeded", "paid"] },
    paidAt: from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: (() => { const t = new Date(to); t.setDate(t.getDate() + 1); return t; })() } : {}),
          not: null,
        }
      : { not: null },
    type: { in: ["charge", "topup"] },
  };

  // Filtre méthode (carte = stripe, manuel = autre)
  if (params.method === "card") where.paymentMethod = "stripe";
  else if (params.method === "manual") where.paymentMethod = { not: "stripe" };

  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paidAt: "desc" },
    take: 500,
    include: {
      client: { select: { id: true, fullName: true, companyName: true, email: true } },
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });

  const data = payments.map((p) => ({
    id: p.id,
    paidAt: p.paidAt?.toISOString() ?? null,
    clientId: p.client?.id ?? null,
    clientName: p.client?.fullName ?? "—",
    companyName: p.client?.companyName ?? null,
    clientEmail: p.client?.email ?? null,
    invoiceId: p.invoice?.id ?? null,
    invoiceNumber: p.invoice?.invoiceNumber ?? null,
    amount: Number(p.amount),
    amountCad: p.amountCad != null ? Number(p.amountCad) : null,
    currency: (p.currency ?? "cad").toUpperCase(),
    paymentMethod: p.paymentMethod,
    cardBrand: p.cardBrand,
    cardLast4: p.cardLast4,
    receiptUrl: p.stripeReceiptUrl,
    receiptNumber: p.stripeReceiptNumber,
    receiptEmail: p.stripeReceiptEmail,
    stripePaymentIntentId: p.stripePaymentIntentId,
    internalReceiptUrl: `/api/payments/${p.id}/receipt`,
    isCardPayment: p.paymentMethod === "stripe" || !!p.stripeChargeId,
  }));

  const kpis = {
    total: data.length,
    sentByEmail: data.filter((d) => d.receiptEmail).length,
    withStripeUrl: data.filter((d) => d.receiptUrl).length,
    totalAmount: data.reduce((s, d) => s + (d.amountCad ?? d.amount), 0),
    cardCount: data.filter((d) => d.isCardPayment).length,
    manualCount: data.filter((d) => !d.isCardPayment).length,
  };

  return (
    <ReceiptsView
      receipts={data}
      kpis={kpis}
      dateRange={{ from: from ? from.toISOString().slice(0, 10) : "", to: to ? to.toISOString().slice(0, 10) : "" }}
      methodFilter={(params.method === "card" || params.method === "manual") ? params.method : "all"}
    />
  );
}

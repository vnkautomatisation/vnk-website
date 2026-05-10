import { prisma } from "@/lib/prisma";
import { ReceiptsView } from "./receipts-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Reçus" };

export default async function ReceiptsPage() {
  // On considère un Payment comme "ayant un reçu" s'il a paidAt + (stripeReceiptUrl OU invoice OU type = charge)
  const payments = await prisma.payment.findMany({
    where: {
      status: { in: ["succeeded", "paid"] },
      paidAt: { not: null },
      type: { in: ["charge", "topup"] },
    },
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
    // URL du reçu interne VNK généré par notre système
    internalReceiptUrl: `/api/payments/${p.id}/receipt`,
  }));

  const kpis = {
    total: data.length,
    sentByEmail: data.filter((d) => d.receiptEmail).length,
    withStripeUrl: data.filter((d) => d.receiptUrl).length,
    totalAmount: data.reduce((s, d) => s + (d.amountCad ?? d.amount), 0),
  };

  return <ReceiptsView receipts={data} kpis={kpis} />;
}

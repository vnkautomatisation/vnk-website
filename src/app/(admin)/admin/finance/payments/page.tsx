import { prisma } from "@/lib/prisma";
import { PaymentsView } from "./payments-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Tous les paiements" };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ payoutId?: string }>;
}) {
  const params = await searchParams;
  // Si on arrive depuis la page Versements avec un drill-down, on filtre par versement
  const where: Record<string, unknown> = {};
  if (params.payoutId) where.stripePayoutId = params.payoutId;

  const [payments, accountants] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { paidAt: "desc" },
      take: 1000,
      include: {
        client: { select: { id: true, fullName: true, companyName: true, country: true } },
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            refunds: {
              select: { amount: true, totalAmount: true, status: true },
              where: { status: { in: ["processed", "confirmed"] } },
            },
          },
        },
        assignedAccountant: { select: { id: true, fullName: true, email: true } },
      },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  // Agrégats par type + réconciliation
  const byType: Record<string, { count: number; total: number }> = {};
  let totalNet = 0;
  let totalFees = 0;
  let reconciledCount = 0;
  let unreconciledCount = 0;
  for (const p of payments) {
    const t = (p.type ?? "charge").toLowerCase();
    if (!byType[t]) byType[t] = { count: 0, total: 0 };
    byType[t].count += 1;
    byType[t].total += Number(p.amountCad ?? p.amount);
    totalFees += Number(p.processingFee ?? 0);
    totalNet += Number(p.netAmount ?? p.amountCad ?? p.amount);
    if (p.reconciledAt) reconciledCount += 1;
    else unreconciledCount += 1;
  }

  // Listes pour filtres
  const methodSet = new Set<string>();
  const statusSet = new Set<string>();
  const countrySet = new Set<string>();
  payments.forEach((p) => {
    if (p.paymentMethod) methodSet.add(p.paymentMethod);
    if (p.status) statusSet.add(p.status);
    if (p.client?.country) countrySet.add(p.client.country);
  });

  const data = payments.map((p) => {
    // Calcul du remboursement effectif pour ce paiement (somme des refunds liés à sa facture)
    const refundsList = p.invoice?.refunds ?? [];
    const refundedAmount = refundsList.reduce((s, r) => s + Number(r.totalAmount ?? r.amount ?? 0), 0);
    const paymentTotal = Number(p.amount ?? 0);
    let refundedStatus: "none" | "partial" | "full" = "none";
    if (p.type === "charge" && refundedAmount > 0 && paymentTotal > 0) {
      refundedStatus = refundedAmount >= paymentTotal - 0.01 ? "full" : "partial";
    }
    return ({
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
    // Workflow comptable
    reconciledAt: p.reconciledAt?.toISOString() ?? null,
    reconciledBy: p.reconciledBy,
    accountingCategory: p.accountingCategory,
    assignedAccountantId: p.assignedAccountantId,
    assignedAccountantName: p.assignedAccountant?.fullName ?? p.assignedAccountant?.email ?? null,
    accountantNotes: p.accountantNotes,
    exportedAt: p.exportedAt?.toISOString() ?? null,
    exportFormat: p.exportFormat,
    // Statut remboursement calculé (depuis Refund table)
    refundedAmount,
    refundedStatus,
    });
  });

  return (
    <PaymentsView
      payments={data}
      accountants={accountants.map((a) => ({ id: a.id, name: a.fullName ?? a.email }))}
      methodList={Array.from(methodSet).sort()}
      statusList={Array.from(statusSet).sort()}
      countryList={Array.from(countrySet).sort()}
      kpis={{
        total: data.length,
        totalNet,
        totalFees,
        byType,
        reconciledCount,
        unreconciledCount,
      }}
    />
  );
}

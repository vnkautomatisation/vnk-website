import { prisma } from "@/lib/prisma";
import { PayoutsView } from "./payouts-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Versements" };

export default async function PayoutsPage() {
  const payouts = await prisma.payout.findMany({
    orderBy: { initiatedAt: "desc" },
    take: 200,
    include: {
      payments: {
        select: { id: true, amount: true, currency: true, type: true, processingFee: true, netAmount: true },
      },
    },
  });

  // Agrégats KPI
  let totalPaid = 0, totalPending = 0, totalFailed = 0;
  let countPaid = 0, countPending = 0, countFailed = 0;
  payouts.forEach((p) => {
    if (p.status === "paid") { totalPaid += Number(p.amount); countPaid++; }
    else if (p.status === "failed") { totalFailed += Number(p.amount); countFailed++; }
    else { totalPending += Number(p.amount); countPending++; }
  });

  const data = payouts.map((p) => ({
    id: p.id,
    stripePayoutId: p.stripePayoutId,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    arrivalDate: p.arrivalDate?.toISOString() ?? null,
    initiatedAt: p.initiatedAt.toISOString(),
    paidAt: p.paidAt?.toISOString() ?? null,
    method: p.method,
    destinationLast4: p.destinationLast4,
    destinationBank: p.destinationBank,
    failureReason: p.failureReason,
    description: p.description,
    itemCount: p.itemCount,
    feeTotal: Number(p.feeTotal),
    paymentCount: p.payments.length,
    paymentSum: p.payments.reduce((s, x) => s + Number(x.netAmount ?? x.amount), 0),
  }));

  return (
    <PayoutsView
      payouts={data}
      kpis={{ totalPaid, totalPending, totalFailed, countPaid, countPending, countFailed, count: data.length }}
    />
  );
}

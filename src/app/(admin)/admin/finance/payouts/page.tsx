import { prisma } from "@/lib/prisma";
import { PayoutsView } from "./payouts-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Versements" };

export default async function PayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const params = await searchParams;

  // Validation defensive — new Date("foo") retourne Invalid Date qui plante Prisma
  function parseSafe(s: string | undefined): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return isNaN(d.getTime()) ? null : d;
  }
  let from = parseSafe(params.from);
  let to = parseSafe(params.to);
  if (from && to && from > to) [from, to] = [to, from];

  const where: Record<string, unknown> = {};
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) range.gte = from;
    if (to) {
      const end = new Date(to);
      end.setDate(end.getDate() + 1);
      range.lte = end;
    }
    where.initiatedAt = range;
  }

  const payouts = await prisma.payout.findMany({
    where,
    orderBy: { initiatedAt: "desc" },
    take: 200,
    include: {
      payments: {
        select: {
          id: true,
          amount: true,
          currency: true,
          type: true,
          processingFee: true,
          netAmount: true,
          // Inclut le client pour permettre la recherche cote client
          client: { select: { fullName: true, companyName: true } },
        },
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
    // Noms clients agreges pour la recherche cote client (search libre)
    clientNames: p.payments
      .map((x) => [x.client?.fullName, x.client?.companyName].filter(Boolean).join(" "))
      .filter(Boolean)
      .join(" | "),
  }));

  return (
    <PayoutsView
      payouts={data}
      kpis={{ totalPaid, totalPending, totalFailed, countPaid, countPending, countFailed, count: data.length }}
      dateRange={{ from: from ? from.toISOString().slice(0, 10) : "", to: to ? to.toISOString().slice(0, 10) : "" }}
    />
  );
}

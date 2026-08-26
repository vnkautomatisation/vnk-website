// GET /api/tax-declarations/preview?from=YYYY-MM-DD&to=YYYY-MM-DD
// Calcule revenu HT, TPS, TVQ et taxes payees pour la periode SANS creer la declaration.
// Utilise pour la prevision live dans le modal Nouvelle declaration.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("tax_declarations", "read")) {
    return forbiddenJson();
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to) {
    return NextResponse.json({ error: "Paramètres from et to requis" }, { status: 400 });
  }

  const periodStart = new Date(from);
  const periodEnd = new Date(to);
  if (isNaN(periodStart.getTime()) || isNaN(periodEnd.getTime())) {
    return NextResponse.json({ error: "Dates invalides" }, { status: 400 });
  }
  if (periodEnd < periodStart) {
    return NextResponse.json({ error: "La date de fin doit être après la date de début" }, { status: 400 });
  }

  const periodEndExclusive = new Date(periodEnd);
  periodEndExclusive.setDate(periodEndExclusive.getDate() + 1);

  // Revenus + taxes collectees (factures payees dans la periode)
  const [invoiceAggs, expenseAggs] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { amountHt: true, tpsAmount: true, tvqAmount: true },
      _count: { _all: true },
      where: { status: "paid", paidAt: { gte: periodStart, lt: periodEndExclusive } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true, tpsPaid: true, tvqPaid: true },
      _count: { _all: true },
      where: { expenseDate: { gte: periodStart, lt: periodEndExclusive } },
    }),
  ]);

  const totalRevenueHt = Number(invoiceAggs._sum.amountHt ?? 0);
  const totalTps = Number(invoiceAggs._sum.tpsAmount ?? 0);
  const totalTvq = Number(invoiceAggs._sum.tvqAmount ?? 0);
  const totalTaxes = totalTps + totalTvq;

  const totalExpensesHt = Number(expenseAggs._sum.amount ?? 0);
  const tpsPaid = Number(expenseAggs._sum.tpsPaid ?? 0);
  const tvqPaid = Number(expenseAggs._sum.tvqPaid ?? 0);

  // Net a remettre : taxes collectees - taxes payees (peut etre negatif = remboursement attendu)
  const netTps = totalTps - tpsPaid;
  const netTvq = totalTvq - tvqPaid;
  const netTaxesToRemit = netTps + netTvq;

  return NextResponse.json({
    period: { from, to },
    invoices: {
      count: invoiceAggs._count._all,
      revenueHt: totalRevenueHt,
      tpsCollected: totalTps,
      tvqCollected: totalTvq,
      totalTaxesCollected: totalTaxes,
    },
    expenses: {
      count: expenseAggs._count._all,
      expensesHt: totalExpensesHt,
      tpsPaid,
      tvqPaid,
      totalTaxesPaid: tpsPaid + tvqPaid,
    },
    netToRemit: {
      tps: netTps,
      tvq: netTvq,
      total: netTaxesToRemit,
    },
  });
}

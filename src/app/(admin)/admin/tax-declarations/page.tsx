import { prisma } from "@/lib/prisma";
import { TaxView } from "./tax-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Déclarations fiscales" };

export default async function TaxDeclarationsPage() {
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1); // exclusif

  const [rawDeclarations, invoiceYtd, expenseYtd, quarterPreviews] = await Promise.all([
    prisma.taxDeclaration.findMany({ orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }] }),
    prisma.invoice.aggregate({
      _sum: { amountHt: true, tpsAmount: true, tvqAmount: true },
      where: { status: "paid", paidAt: { gte: yearStart, lt: yearEnd } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true, tpsPaid: true, tvqPaid: true },
      where: { expenseDate: { gte: yearStart, lt: yearEnd } },
    }),
    // Aperçu T1, T2, T3, T4 année courante
    Promise.all([0, 1, 2, 3].map(async (q) => {
      const qStart = new Date(year, q * 3, 1);
      const qEnd = new Date(year, q * 3 + 3, 1); // exclusif (debut du trimestre suivant)
      const [invAgg, expAgg] = await Promise.all([
        prisma.invoice.aggregate({
          _sum: { amountHt: true, tpsAmount: true, tvqAmount: true },
          _count: { _all: true },
          where: { status: "paid", paidAt: { gte: qStart, lt: qEnd } },
        }),
        prisma.expense.aggregate({
          _sum: { tpsPaid: true, tvqPaid: true },
          where: { expenseDate: { gte: qStart, lt: qEnd } },
        }),
      ]);
      const periodEndInclusive = new Date(qEnd);
      periodEndInclusive.setDate(periodEndInclusive.getDate() - 1);
      return {
        quarter: q + 1,
        label: `T${q + 1} ${year}`,
        from: qStart.toISOString().slice(0, 10),
        to: periodEndInclusive.toISOString().slice(0, 10),
        invoiceCount: invAgg._count._all,
        revenueHt: Number(invAgg._sum.amountHt ?? 0),
        tpsCollected: Number(invAgg._sum.tpsAmount ?? 0),
        tvqCollected: Number(invAgg._sum.tvqAmount ?? 0),
        tpsPaid: Number(expAgg._sum.tpsPaid ?? 0),
        tvqPaid: Number(expAgg._sum.tvqPaid ?? 0),
      };
    })),
  ]);

  const declarations = rawDeclarations.map((d) => ({
    id: d.id,
    periodType: d.periodType,
    periodLabel: d.periodLabel,
    periodStart: d.periodStart.toISOString(),
    periodEnd: d.periodEnd.toISOString(),
    totalRevenueHt: Number(d.totalRevenueHt),
    totalTps: Number(d.totalTps),
    totalTvq: Number(d.totalTvq),
    totalTaxes: Number(d.totalTaxes),
    status: d.status,
    notes: d.notes,
    submittedAt: d.submittedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
  }));

  const tpsCollected = Number(invoiceYtd._sum.tpsAmount ?? 0);
  const tvqCollected = Number(invoiceYtd._sum.tvqAmount ?? 0);
  const tpsPaid = Number(expenseYtd._sum.tpsPaid ?? 0);
  const tvqPaid = Number(expenseYtd._sum.tvqPaid ?? 0);

  const kpis = {
    year,
    revenueHt: Number(invoiceYtd._sum.amountHt ?? 0),
    tpsCollected,
    tvqCollected,
    totalTaxesCollected: tpsCollected + tvqCollected,
    expensesHt: Number(expenseYtd._sum.amount ?? 0),
    tpsPaid,
    tvqPaid,
    netTps: tpsCollected - tpsPaid,
    netTvq: tvqCollected - tvqPaid,
    netToRemit: tpsCollected + tvqCollected - tpsPaid - tvqPaid,
    countDraft: declarations.filter((d) => d.status === "draft").length,
    countSubmitted: declarations.filter((d) => d.status === "submitted").length,
    countConfirmed: declarations.filter((d) => d.status === "confirmed").length,
    quarterPreviews,
  };

  return <TaxView declarations={declarations} kpis={kpis} />;
}

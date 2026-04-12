import { prisma } from "@/lib/prisma";
import { TaxDeclarationsTable } from "./tax-table";

export default async function TaxPage() {
  // Calcul du résumé annuel depuis les factures payées
  const yearStart = new Date(new Date().getFullYear(), 0, 1);
  const [declarations, yearAggregate] = await Promise.all([
    prisma.taxDeclaration.findMany({ orderBy: { periodStart: "desc" } }).then((rows) =>
      rows.map((d) => ({
        ...d,
        totalRevenueHt: Number(d.totalRevenueHt),
        totalTps: Number(d.totalTps),
        totalTvq: Number(d.totalTvq),
        totalTaxes: Number(d.totalTaxes),
      }))
    ),
    prisma.invoice.aggregate({
      _sum: { amountHt: true, tpsAmount: true, tvqAmount: true, amountTtc: true },
      where: { status: "paid", paidAt: { gte: yearStart } },
    }),
  ]);

  const summary = {
    revenueHt: Number(yearAggregate._sum.amountHt ?? 0),
    tps: Number(yearAggregate._sum.tpsAmount ?? 0),
    tvq: Number(yearAggregate._sum.tvqAmount ?? 0),
    totalTaxes:
      Number(yearAggregate._sum.tpsAmount ?? 0) +
      Number(yearAggregate._sum.tvqAmount ?? 0),
  };

  return <TaxDeclarationsTable declarations={declarations} summary={summary} />;
}

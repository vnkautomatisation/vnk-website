import { prisma } from "@/lib/prisma";
import { TaxView } from "./tax-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Déclarations fiscales" };

export default async function TaxDeclarationsPage() {
  const yearStart = new Date(new Date().getFullYear(), 0, 1);

  const [rawDeclarations, invoiceAggs] = await Promise.all([
    prisma.taxDeclaration.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.invoice.aggregate({
      _sum: { amountHt: true, tpsAmount: true, tvqAmount: true },
      where: { status: "paid", paidAt: { gte: yearStart } },
    }),
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

  const kpis = {
    revenueHt: Number(invoiceAggs._sum.amountHt ?? 0),
    tpsCollected: Number(invoiceAggs._sum.tpsAmount ?? 0),
    tvqCollected: Number(invoiceAggs._sum.tvqAmount ?? 0),
    totalTaxes: Number(invoiceAggs._sum.tpsAmount ?? 0) + Number(invoiceAggs._sum.tvqAmount ?? 0),
  };

  return <TaxView declarations={declarations} kpis={kpis} />;
}

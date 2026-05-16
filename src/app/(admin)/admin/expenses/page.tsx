import { prisma } from "@/lib/prisma";
import { ExpensesView } from "./expenses-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Dépenses" };

export default async function ExpensesPage() {
  const now = new Date();
  const yearStart = new Date(now.getFullYear(), 0, 1);
  const quarterStart = new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1);

  const [rawExpenses, aggAll, aggYtd, aggQuarter, byCategory, byVendor] = await Promise.all([
    prisma.expense.findMany({ orderBy: { expenseDate: "desc" } }),
    prisma.expense.aggregate({ _sum: { amount: true, tpsPaid: true, tvqPaid: true } }),
    prisma.expense.aggregate({
      _sum: { amount: true, tpsPaid: true, tvqPaid: true },
      where: { expenseDate: { gte: yearStart } },
    }),
    prisma.expense.aggregate({
      _sum: { amount: true, tpsPaid: true, tvqPaid: true },
      where: { expenseDate: { gte: quarterStart } },
    }),
    prisma.expense.groupBy({
      by: ["category"],
      _sum: { amount: true },
      _count: { _all: true },
      orderBy: { _sum: { amount: "desc" } },
    }),
    prisma.expense.groupBy({
      by: ["vendor"],
      _sum: { amount: true },
      _count: { _all: true },
      where: { vendor: { not: null } },
      orderBy: { _sum: { amount: "desc" } },
      take: 5,
    }),
  ]);

  const expenses = rawExpenses.map((e) => ({
    id: e.id,
    title: e.title,
    category: e.category,
    amount: Number(e.amount),
    tpsPaid: Number(e.tpsPaid),
    tvqPaid: Number(e.tvqPaid),
    vendor: e.vendor,
    receiptUrl: e.receiptUrl,
    expenseDate: e.expenseDate.toISOString(),
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  }));

  const kpis = {
    total: Number(aggAll._sum.amount ?? 0),
    tps: Number(aggAll._sum.tpsPaid ?? 0),
    tvq: Number(aggAll._sum.tvqPaid ?? 0),
    ytdTotal: Number(aggYtd._sum.amount ?? 0),
    ytdTps: Number(aggYtd._sum.tpsPaid ?? 0),
    ytdTvq: Number(aggYtd._sum.tvqPaid ?? 0),
    quarterTotal: Number(aggQuarter._sum.amount ?? 0),
    quarterTps: Number(aggQuarter._sum.tpsPaid ?? 0),
    quarterTvq: Number(aggQuarter._sum.tvqPaid ?? 0),
    byCategory: byCategory.map((c) => ({
      category: c.category,
      total: Number(c._sum.amount ?? 0),
      count: c._count._all,
    })),
    topVendors: byVendor.map((v) => ({
      vendor: v.vendor ?? "—",
      total: Number(v._sum.amount ?? 0),
      count: v._count._all,
    })),
  };

  return <ExpensesView expenses={expenses} kpis={kpis} />;
}

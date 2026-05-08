import { prisma } from "@/lib/prisma";
import { ExpensesView } from "./expenses-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Depenses" };

export default async function ExpensesPage() {
  const [rawExpenses, aggregates] = await Promise.all([
    prisma.expense.findMany({ orderBy: { expenseDate: "desc" } }),
    prisma.expense.aggregate({
      _sum: { amount: true, tpsPaid: true, tvqPaid: true },
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
    expenseDate: e.expenseDate.toISOString(),
    notes: e.notes,
    createdAt: e.createdAt.toISOString(),
  }));

  const kpis = {
    total: Number(aggregates._sum.amount ?? 0),
    tps: Number(aggregates._sum.tpsPaid ?? 0),
    tvq: Number(aggregates._sum.tvqPaid ?? 0),
  };

  return <ExpensesView expenses={expenses} kpis={kpis} />;
}

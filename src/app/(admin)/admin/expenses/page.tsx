import { prisma } from "@/lib/prisma";
import { ExpensesTable } from "./expenses-table";

export default async function ExpensesPage() {
  const [rawExpenses, totals] = await Promise.all([
    prisma.expense.findMany({ orderBy: { expenseDate: "desc" } }),
    prisma.expense.aggregate({
      _sum: { amount: true, tpsPaid: true, tvqPaid: true },
    }),
  ]);
  const expenses = rawExpenses.map((e) => ({
    ...e,
    amount: Number(e.amount),
    tpsPaid: Number(e.tpsPaid),
    tvqPaid: Number(e.tvqPaid),
  }));

  return (
    <ExpensesTable
      expenses={expenses}
      totals={{
        total: Number(totals._sum.amount ?? 0),
        tps: Number(totals._sum.tpsPaid ?? 0),
        tvq: Number(totals._sum.tvqPaid ?? 0),
      }}
    />
  );
}

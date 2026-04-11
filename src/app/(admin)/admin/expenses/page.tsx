import { prisma } from "@/lib/prisma";
import { ExpensesTable } from "./expenses-table";

export default async function ExpensesPage() {
  const [expenses, totals] = await Promise.all([
    prisma.expense.findMany({ orderBy: { expenseDate: "desc" } }),
    prisma.expense.aggregate({
      _sum: { amount: true, tpsPaid: true, tvqPaid: true },
    }),
  ]);

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

import { prisma } from "@/lib/prisma";
import { TransactionsTable } from "./transactions-table";

export default async function TransactionsPage() {
  const rawPayments = await prisma.payment.findMany({
    include: {
      client: { select: { fullName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const payments = rawPayments.map((p) => ({
    ...p,
    amount: Number(p.amount),
  }));
  return <TransactionsTable payments={payments} />;
}

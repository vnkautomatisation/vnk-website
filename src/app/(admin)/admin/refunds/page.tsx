import { prisma } from "@/lib/prisma";
import { RefundsTable } from "./refunds-table";

export default async function RefundsPage() {
  const rawRefunds = await prisma.refund.findMany({
    include: {
      client: { select: { fullName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  const refunds = rawRefunds.map((r) => ({
    ...r,
    amount: Number(r.amount),
    tpsAmount: Number(r.tpsAmount),
    tvqAmount: Number(r.tvqAmount),
    totalAmount: Number(r.totalAmount),
  }));
  return <RefundsTable refunds={refunds} />;
}

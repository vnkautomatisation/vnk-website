import { prisma } from "@/lib/prisma";
import { FinanceView } from "./finance-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [paid, unpaid, invoiced, paidThisMonth, rawPayments] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: "paid" } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: { in: ["unpaid", "overdue"] } } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: "paid", paidAt: { gte: monthStart } } }),
    prisma.payment.findMany({
      include: {
        client: { select: { fullName: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  return (
    <FinanceView
      kpis={{
        totalPaid: Number(paid._sum.amountTtc ?? 0),
        totalUnpaid: Number(unpaid._sum.amountTtc ?? 0),
        totalInvoiced: Number(invoiced._sum.amountTtc ?? 0),
        paidThisMonth: Number(paidThisMonth._sum.amountTtc ?? 0),
      }}
      payments={rawPayments.map((p) => ({
        id: p.id,
        clientName: p.client?.fullName ?? "—",
        invoiceNumber: p.invoice?.invoiceNumber ?? "—",
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        paymentMethod: p.paymentMethod,
        paidAt: p.paidAt?.toISOString() ?? null,
        createdAt: p.createdAt.toISOString(),
      }))}
    />
  );
}

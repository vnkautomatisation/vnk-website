import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { TransactionsView } from "./transactions-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("transactions") };
}

export default async function TransactionsPage() {
  const [rawPayments, clients, accountants] = await Promise.all([
    prisma.payment.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        invoice: { select: { id: true, invoiceNumber: true, title: true } },
        assignedAccountant: { select: { id: true, fullName: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 2000,
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const payments = rawPayments.map((p) => ({
    id: p.id,
    invoiceId: p.invoiceId,
    clientId: p.clientId,
    clientName: p.client?.fullName ?? "—",
    companyName: p.client?.companyName ?? null,
    invoiceNumber: p.invoice?.invoiceNumber ?? "—",
    invoiceTitle: p.invoice?.title ?? null,
    stripePaymentIntentId: p.stripePaymentIntentId,
    stripeChargeId: p.stripeChargeId,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
    reconciledAt: p.reconciledAt?.toISOString() ?? null,
    reconciledBy: p.reconciledBy ?? null,
    exportedAt: p.exportedAt?.toISOString() ?? null,
    exportedBy: p.exportedBy ?? null,
    accountingCategory: p.accountingCategory ?? null,
    fiscalPeriod: p.fiscalPeriod ?? null,
    assignedAccountantId: p.assignedAccountantId ?? null,
    assignedAccountantName: p.assignedAccountant?.fullName ?? p.assignedAccountant?.email ?? null,
    accountantNotes: p.accountantNotes ?? null,
  }));

  // KPIs minimaux (le détail vit sur /admin/finance)
  const now = new Date();
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const succeeded = payments.filter((p) => p.status === "succeeded" || p.status === "paid");
  const totalPaid = succeeded.reduce((s, p) => s + p.amount, 0);
  const thisMonthAmount = succeeded
    .filter((p) => new Date(p.paidAt ?? p.createdAt) >= firstOfMonth)
    .reduce((s, p) => s + p.amount, 0);
  const toReconcileCount = succeeded.filter((p) => !p.reconciledAt).length;

  const methodsSet = new Set<string>();
  payments.forEach((p) => p.paymentMethod && methodsSet.add(p.paymentMethod));
  const methods = Array.from(methodsSet);

  return (
    <TransactionsView
      payments={payments}
      clients={clients}
      methods={methods}
      accountants={accountants}
      kpis={{
        totalPaid,
        thisMonthAmount,
        toReconcileCount,
        count: payments.length,
      }}
    />
  );
}

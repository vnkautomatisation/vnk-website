import { prisma } from "@/lib/prisma";
import { ReconciliationView } from "./reconciliation-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Confirmation banque" };

export default async function ReconciliationPage() {
  const [toReconcileRaw, accountants, methods] = await Promise.all([
    prisma.payment.findMany({
      where: {
        status: { in: ["succeeded", "paid"] },
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ...(({ reconciledAt: null } as unknown) as any), // champ existe après prisma db push
      },
      include: {
        client: { select: { id: true, fullName: true, companyName: true, country: true } },
        invoice: { select: { id: true, invoiceNumber: true, title: true, amountTtc: true } },
      },
      orderBy: { paidAt: "desc" },
      take: 1000,
    }).catch(async () => {
      // Fallback si le champ n'existe pas encore : tout récupérer et filtrer côté JS
      const all = await prisma.payment.findMany({
        where: { status: { in: ["succeeded", "paid"] } },
        include: {
          client: { select: { id: true, fullName: true, companyName: true, country: true } },
          invoice: { select: { id: true, invoiceNumber: true, title: true, amountTtc: true } },
        },
        orderBy: { paidAt: "desc" },
        take: 1000,
      });
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return all.filter((p) => !((p as any).reconciledAt));
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.payment.findMany({ select: { paymentMethod: true }, distinct: ["paymentMethod"] }),
  ]);

  const payments = toReconcileRaw.map((p) => ({
    id: p.id,
    invoiceId: p.invoiceId,
    clientId: p.clientId,
    clientName: p.client?.fullName ?? "—",
    companyName: p.client?.companyName ?? null,
    invoiceNumber: p.invoice?.invoiceNumber ?? "—",
    invoiceTitle: p.invoice?.title ?? null,
    amount: Number(p.amount),
    currency: p.currency,
    paymentMethod: p.paymentMethod,
    stripePaymentIntentId: p.stripePaymentIntentId,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  // Totaux par méthode pour aider le comptable à matcher avec les relevés bancaires
  const byMethod = new Map<string, { count: number; total: number }>();
  payments.forEach((p) => {
    const m = p.paymentMethod ?? "inconnu";
    const cur = byMethod.get(m) ?? { count: 0, total: 0 };
    cur.count += 1;
    cur.total += p.amount;
    byMethod.set(m, cur);
  });

  return (
    <ReconciliationView
      payments={payments}
      accountants={accountants}
      byMethod={Array.from(byMethod.entries()).map(([method, v]) => ({ method, ...v }))}
      methodList={methods.map((m) => m.paymentMethod).filter(Boolean) as string[]}
    />
  );
}

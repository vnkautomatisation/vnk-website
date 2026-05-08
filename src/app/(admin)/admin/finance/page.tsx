import { prisma } from "@/lib/prisma";
import { StatCard } from "@/components/admin/stat-card";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { TrendingUp, CheckCircle2, Clock, FileText, Calendar } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Finance" };

export default async function FinancePage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [paid, unpaid, invoiced, paidThisMonth, paidThisYear, rawPayments] = await Promise.all([
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: "paid" } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: { in: ["unpaid", "overdue"] } } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: "paid", paidAt: { gte: monthStart } } }),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { status: "paid", paidAt: { gte: yearStart } } }),
    prisma.payment.findMany({
      include: {
        client: { select: { fullName: true } },
        invoice: { select: { invoiceNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
  ]);

  const payments = rawPayments.map((p) => ({
    id: p.id,
    clientName: p.client?.fullName ?? "\u2014",
    invoiceNumber: p.invoice?.invoiceNumber ?? "\u2014",
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    paymentMethod: p.paymentMethod,
    paidAt: p.paidAt?.toISOString() ?? null,
    createdAt: p.createdAt.toISOString(),
  }));

  type PaymentRow = (typeof payments)[number];

  const columns: Column<PaymentRow>[] = [
    { key: "date", header: "Date", accessor: (r) => formatDate(new Date(r.paidAt ?? r.createdAt)), sortable: true, sortBy: (r) => r.paidAt ?? r.createdAt },
    { key: "client", header: "Client", accessor: (r) => r.clientName, sortable: true, sortBy: (r) => r.clientName },
    { key: "invoice", header: "Facture", accessor: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
    { key: "amount", header: "Montant", accessor: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span>, sortable: true, sortBy: (r) => r.amount },
    { key: "method", header: "Methode", accessor: (r) => <span className="text-xs capitalize">{r.paymentMethod ?? "\u2014"}</span>, hiddenOnMobile: true },
    { key: "status", header: "Statut", accessor: (r) => <span className="text-xs capitalize">{r.status}</span> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <TrendingUp className="h-6 w-6" />
          Finance
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Vue d&apos;ensemble des paiements et revenus</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total paye" value={formatCurrency(Number(paid._sum.amountTtc ?? 0))} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatCard label="Impaye" value={formatCurrency(Number(unpaid._sum.amountTtc ?? 0))} icon={Clock} accent="bg-amber-500" />
        <StatCard label="Total facture" value={formatCurrency(Number(invoiced._sum.amountTtc ?? 0))} icon={FileText} accent="bg-blue-500" />
        <StatCard label="Ce mois" value={formatCurrency(Number(paidThisMonth._sum.amountTtc ?? 0))} icon={Calendar} accent="bg-indigo-500" />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Paiements recents</h2>
        <DataTable data={payments} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="paiements" storageKey="admin-finance-payments" />
      </div>
    </div>
  );
}

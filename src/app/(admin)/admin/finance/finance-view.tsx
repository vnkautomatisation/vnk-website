"use client";
import {
  TrendingUp,
  CheckCircle2,
  Clock,
  FileText,
  Calendar,
} from "lucide-react";
import { StatCard } from "@/components/admin/stat-card";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { formatCurrency, formatDate } from "@/lib/utils";

type PaymentRow = {
  id: number;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
};

export function FinanceView({
  kpis,
  payments,
}: {
  kpis: {
    totalPaid: number;
    totalUnpaid: number;
    totalInvoiced: number;
    paidThisMonth: number;
  };
  payments: PaymentRow[];
}) {
  const columns: Column<PaymentRow>[] = [
    { key: "date", header: "Date", accessor: (r) => formatDate(new Date(r.paidAt ?? r.createdAt)), sortable: true, sortBy: (r) => r.paidAt ?? r.createdAt },
    { key: "client", header: "Client", accessor: (r) => r.clientName, sortable: true, sortBy: (r) => r.clientName },
    { key: "invoice", header: "Facture", accessor: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
    { key: "amount", header: "Montant", accessor: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span>, sortable: true, sortBy: (r) => r.amount },
    { key: "method", header: "Methode", accessor: (r) => <span className="text-xs capitalize">{r.paymentMethod ?? "—"}</span>, hiddenOnMobile: true },
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
        <StatCard label="Total paye" value={formatCurrency(kpis.totalPaid)} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatCard label="Impaye" value={formatCurrency(kpis.totalUnpaid)} icon={Clock} accent="bg-amber-500" />
        <StatCard label="Total facture" value={formatCurrency(kpis.totalInvoiced)} icon={FileText} accent="bg-blue-500" />
        <StatCard label="Ce mois" value={formatCurrency(kpis.paidThisMonth)} icon={Calendar} accent="bg-indigo-500" />
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-3">Paiements recents</h2>
        <DataTable data={payments} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="paiements" storageKey="admin-finance-payments" />
      </div>
    </div>
  );
}

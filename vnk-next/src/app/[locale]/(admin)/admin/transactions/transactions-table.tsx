"use client";
import { useTranslations } from "next-intl";
import { CreditCard } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

type P = {
  id: number;
  amount: any;
  currency: string;
  status: string;
  paymentMethod: string | null;
  stripePaymentIntentId: string | null;
  paidAt: Date | null;
  createdAt: Date;
  client: { fullName: string } | null;
  invoice: { invoiceNumber: string } | null;
};

export function TransactionsTable({ payments }: { payments: P[] }) {
  const t = useTranslations("admin.transactions");

  const columns: Column<P>[] = [
    { key: "date", header: "Date", accessor: (r) => formatDate(r.paidAt ?? r.createdAt), sortable: true, sortBy: (r) => (r.paidAt ?? r.createdAt).getTime() },
    { key: "client", header: "Client", accessor: (r) => r.client?.fullName ?? "—" },
    { key: "invoice", header: "Facture", accessor: (r) => r.invoice?.invoiceNumber ?? "—", hiddenOnMobile: true },
    { key: "amount", header: "Montant", accessor: (r) => <span className="font-semibold">{formatCurrency(Number(r.amount), r.currency.toUpperCase())}</span>, sortable: true, sortBy: (r) => Number(r.amount) },
    { key: "method", header: "Méthode", accessor: (r) => r.paymentMethod ?? "Stripe", hiddenOnMobile: true },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "stripe_id", header: "Stripe ID", accessor: (r) => r.stripePaymentIntentId ? (<a href={`https://dashboard.stripe.com/payments/${r.stripePaymentIntentId}`} target="_blank" rel="noreferrer" className="text-primary text-xs hover:underline">{r.stripePaymentIntentId.slice(0, 16)}…</a>) : "—", hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-2">
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} icon={CreditCard} />
      <DataTable data={payments} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher…" exportFilename="transactions" />
    </div>
  );
}

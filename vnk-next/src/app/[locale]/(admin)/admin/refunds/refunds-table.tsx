"use client";
import { useTranslations } from "next-intl";
import { RotateCcw } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

type R = {
  id: number;
  refundNumber: string;
  reason: string;
  totalAmount: any;
  status: string;
  createdAt: Date;
  client: { fullName: string };
  invoice: { invoiceNumber: string } | null;
};

export function RefundsTable({ refunds }: { refunds: R[] }) {
  const t = useTranslations("admin.refunds");

  const columns: Column<R>[] = [
    { key: "number", header: "Réf.", accessor: (r) => r.refundNumber, sortable: true, sortBy: (r) => r.refundNumber },
    { key: "client", header: "Client", accessor: (r) => r.client.fullName },
    { key: "invoice", header: "Facture", accessor: (r) => r.invoice?.invoiceNumber ?? "—", hiddenOnMobile: true },
    { key: "reason", header: "Raison", accessor: (r) => r.reason, hiddenOnMobile: true },
    { key: "amount", header: "Montant", accessor: (r) => <span className="font-semibold">{formatCurrency(Number(r.totalAmount))}</span>, sortable: true, sortBy: (r) => Number(r.totalAmount) },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "date", header: "Date", accessor: (r) => formatDate(r.createdAt), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-2">
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} icon={RotateCcw} />
      <DataTable data={refunds} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher un remboursement…" exportFilename="remboursements" />
    </div>
  );
}

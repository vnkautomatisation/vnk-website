"use client";
import { useTranslations } from "next-intl";
import { Receipt } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

type I = {
  id: number;
  invoiceNumber: string;
  title: string;
  status: string;
  amountHt: any;
  amountTtc: any;
  dueDate: Date | null;
  paidAt: Date | null;
  client: { fullName: string; companyName: string | null };
};

export function InvoicesTable({ invoices }: { invoices: I[] }) {
  const t = useTranslations("admin.invoices");

  const columns: Column<I>[] = [
    { key: "number", header: "Numéro", accessor: (r) => r.invoiceNumber, sortable: true, sortBy: (r) => r.invoiceNumber },
    { key: "client", header: "Client", accessor: (r) => r.client.fullName, sortable: true, sortBy: (r) => r.client.fullName },
    { key: "title", header: "Titre", accessor: (r) => r.title, hiddenOnMobile: true },
    { key: "ht", header: "HT", accessor: (r) => formatCurrency(Number(r.amountHt)), sortable: true, sortBy: (r) => Number(r.amountHt), hiddenOnMobile: true },
    { key: "ttc", header: "TTC", accessor: (r) => <span className="font-semibold">{formatCurrency(Number(r.amountTtc))}</span>, sortable: true, sortBy: (r) => Number(r.amountTtc) },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "due", header: "Échéance", accessor: (r) => formatDate(r.dueDate), hiddenOnMobile: true },
    { key: "paid", header: "Payée le", accessor: (r) => (r.paidAt ? formatDate(r.paidAt) : "—"), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-2">
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} icon={Receipt} action={{ label: t("new") }} />
      <DataTable data={invoices} columns={columns} getRowId={(r) => r.id} searchPlaceholder={t("search_placeholder")} exportFilename="factures" />
    </div>
  );
}

"use client";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatCurrency, formatDate } from "@/lib/utils";

type Q = {
  id: number;
  quoteNumber: string;
  title: string;
  status: string;
  amountHt: any;
  amountTtc: any;
  expiryDate: Date | null;
  client: { fullName: string; companyName: string | null };
};

export function QuotesTable({ quotes }: { quotes: Q[] }) {
  const t = useTranslations("admin.quotes");

  const columns: Column<Q>[] = [
    { key: "number", header: t("columns.number"), accessor: (r) => r.quoteNumber, sortable: true, sortBy: (r) => r.quoteNumber },
    { key: "client", header: t("columns.client"), accessor: (r) => r.client.fullName, sortable: true, sortBy: (r) => r.client.fullName },
    { key: "title", header: t("columns.title"), accessor: (r) => r.title, hiddenOnMobile: true },
    { key: "ht", header: t("columns.ht"), accessor: (r) => formatCurrency(Number(r.amountHt)), sortable: true, sortBy: (r) => Number(r.amountHt), hiddenOnMobile: true },
    { key: "ttc", header: t("columns.ttc"), accessor: (r) => <span className="font-semibold">{formatCurrency(Number(r.amountTtc))}</span>, sortable: true, sortBy: (r) => Number(r.amountTtc) },
    { key: "status", header: t("columns.status"), accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "expiry", header: t("columns.expiry"), accessor: (r) => formatDate(r.expiryDate), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-2">
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} icon={FileText} action={{ label: t("new") }} />
      <DataTable data={quotes} columns={columns} getRowId={(r) => r.id} searchPlaceholder={t("search_placeholder")} exportFilename="devis" />
    </div>
  );
}

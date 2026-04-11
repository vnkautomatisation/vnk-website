"use client";
import { useTranslations } from "next-intl";
import { FileBarChart } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

type TD = {
  id: number;
  periodLabel: string;
  periodType: string;
  periodStart: Date;
  periodEnd: Date;
  totalRevenueHt: any;
  totalTps: any;
  totalTvq: any;
  totalTaxes: any;
  status: string;
  submittedAt: Date | null;
};

export function TaxDeclarationsTable({
  declarations,
  summary,
}: {
  declarations: TD[];
  summary: { revenueHt: number; tps: number; tvq: number; totalTaxes: number };
}) {
  const t = useTranslations("admin.tax_decl");

  const columns: Column<TD>[] = [
    { key: "period", header: "Période", accessor: (r) => r.periodLabel, sortable: true, sortBy: (r) => r.periodStart.getTime() },
    { key: "type", header: "Type", accessor: (r) => r.periodType, hiddenOnMobile: true },
    { key: "revenue", header: "Revenus HT", accessor: (r) => formatCurrency(Number(r.totalRevenueHt)), hiddenOnMobile: true },
    { key: "tps", header: "TPS", accessor: (r) => formatCurrency(Number(r.totalTps)), hiddenOnMobile: true },
    { key: "tvq", header: "TVQ", accessor: (r) => formatCurrency(Number(r.totalTvq)), hiddenOnMobile: true },
    { key: "total", header: "Total taxes", accessor: (r) => <span className="font-semibold">{formatCurrency(Number(r.totalTaxes))}</span> },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "submitted", header: "Soumise le", accessor: (r) => formatDate(r.submittedAt), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} icon={FileBarChart} action={{ label: t("new") }} />

      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold text-base mb-4">{t("annual_summary")}</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t("gross_revenue")}</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(summary.revenueHt)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t("tps_collected")}</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(summary.tps)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t("tvq_collected")}</p>
              <p className="text-xl font-bold mt-1">{formatCurrency(summary.tvq)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase">{t("total_taxes")}</p>
              <p className="text-xl font-bold mt-1 text-primary">{formatCurrency(summary.totalTaxes)}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <DataTable data={declarations} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher une déclaration…" exportFilename="declarations" />
    </div>
  );
}

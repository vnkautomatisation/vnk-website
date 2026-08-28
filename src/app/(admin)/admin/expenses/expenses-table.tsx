"use client";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";


type E = {
  id: number;
  title: string;
  category: string;
  amount: any;
  tpsPaid: any;
  tvqPaid: any;
  vendor: string | null;
  expenseDate: Date;
};

export function ExpensesTable({
  expenses,
  totals,
}: {
  expenses: E[];
  totals: { total: number; tps: number; tvq: number };
}) {
  const t = useTranslations("admin.expenses");
  const formatCurrency = useCurrency();

  const columns: Column<E>[] = [
    { key: "date", header: t("date"), accessor: (r) => formatDate(r.expenseDate), sortable: true, sortBy: (r) => r.expenseDate.getTime() },
    { key: "title", header: t("titre"), accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title },
    { key: "category", header: t("categorie"), accessor: (r) => r.category, hiddenOnMobile: true },
    { key: "vendor", header: t("fournisseur"), accessor: (r) => r.vendor ?? "—", hiddenOnMobile: true },
    { key: "amount", header: t("montant_ht"), accessor: (r) => formatCurrency(Number(r.amount)), sortable: true, sortBy: (r) => Number(r.amount) },
    { key: "tps", header: t("tps"), accessor: (r) => formatCurrency(Number(r.tpsPaid)), hiddenOnMobile: true },
    { key: "tvq", header: t("tvq"), accessor: (r) => formatCurrency(Number(r.tvqPaid)), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} icon={Wallet} action={{ label: t("new") }} />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase">{t("total")}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totals.total)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase">{t("tps_reclaimable")}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totals.tps)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-xs text-muted-foreground uppercase">{t("tvq_reclaimable")}</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(totals.tvq)}</p>
          </CardContent>
        </Card>
      </div>

      <DataTable data={expenses} columns={columns} getRowId={(r) => r.id} searchPlaceholder={t("rechercher_depense")} exportFilename="depenses" />
    </div>
  );
}

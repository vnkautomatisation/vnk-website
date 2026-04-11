"use client";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

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

  const columns: Column<E>[] = [
    { key: "date", header: "Date", accessor: (r) => formatDate(r.expenseDate), sortable: true, sortBy: (r) => r.expenseDate.getTime() },
    { key: "title", header: "Titre", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title },
    { key: "category", header: "Catégorie", accessor: (r) => r.category, hiddenOnMobile: true },
    { key: "vendor", header: "Fournisseur", accessor: (r) => r.vendor ?? "—", hiddenOnMobile: true },
    { key: "amount", header: "Montant HT", accessor: (r) => formatCurrency(Number(r.amount)), sortable: true, sortBy: (r) => Number(r.amount) },
    { key: "tps", header: "TPS", accessor: (r) => formatCurrency(Number(r.tpsPaid)), hiddenOnMobile: true },
    { key: "tvq", header: "TVQ", accessor: (r) => formatCurrency(Number(r.tvqPaid)), hiddenOnMobile: true },
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

      <DataTable data={expenses} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher une dépense…" exportFilename="depenses" />
    </div>
  );
}

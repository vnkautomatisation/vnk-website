"use client";
import { useTranslations } from "next-intl";
import { Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { initials, formatDate } from "@/lib/utils";

type Client = {
  id: number;
  fullName: string;
  email: string;
  companyName: string | null;
  sector: string | null;
  city: string | null;
  isActive: boolean;
  lastLogin: Date | null;
  _count: { mandates: number; invoices: number };
};

export function ClientsTableClient({ clients }: { clients: Client[] }) {
  const t = useTranslations("admin.clients");

  const columns: Column<Client>[] = [
    {
      key: "client",
      header: t("columns.client"),
      accessor: (r) => (
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9">
            <AvatarFallback className="vnk-gradient text-white text-xs">
              {initials(r.fullName)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-sm">{r.fullName}</div>
            <div className="text-xs text-muted-foreground">{r.email}</div>
          </div>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.fullName,
    },
    {
      key: "company",
      header: t("columns.company"),
      accessor: (r) => r.companyName ?? "—",
      sortable: true,
      sortBy: (r) => r.companyName ?? "",
      hiddenOnMobile: true,
    },
    {
      key: "sector",
      header: t("columns.sector"),
      accessor: (r) => r.sector ?? "—",
      hiddenOnMobile: true,
    },
    {
      key: "status",
      header: t("columns.status"),
      accessor: (r) => <StatusBadge status={r.isActive ? "active" : "paused"} />,
    },
    {
      key: "mandates",
      header: t("columns.mandates"),
      accessor: (r) => r._count.mandates,
      sortable: true,
      sortBy: (r) => r._count.mandates,
      hiddenOnMobile: true,
    },
    {
      key: "last_login",
      header: t("columns.last_login"),
      accessor: (r) => (r.lastLogin ? formatDate(r.lastLogin) : t("never_connected")),
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Users className="h-6 w-6" />
            {t("page_title")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">{t("page_subtitle")}</p>
        </div>
        <Button>
          <Plus className="h-4 w-4" />
          {t("new_client")}
        </Button>
      </div>

      <DataTable
        data={clients}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder={t("search_placeholder")}
        exportFilename="clients"
      />
    </div>
  );
}

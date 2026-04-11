"use client";
import { useTranslations } from "next-intl";
import { Briefcase } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/utils";

type M = {
  id: number;
  title: string;
  status: string;
  progress: number;
  serviceType: string | null;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
  client: { fullName: string; companyName: string | null };
};

export function MandatesTable({ mandates }: { mandates: M[] }) {
  const t = useTranslations("admin.mandates");

  const columns: Column<M>[] = [
    {
      key: "client",
      header: "Client",
      accessor: (r) => (
        <div>
          <div className="font-medium text-sm">{r.client.fullName}</div>
          {r.client.companyName && (
            <div className="text-xs text-muted-foreground">{r.client.companyName}</div>
          )}
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.client.fullName,
    },
    {
      key: "title",
      header: "Titre",
      accessor: (r) => r.title,
      sortable: true,
      sortBy: (r) => r.title,
    },
    {
      key: "service",
      header: "Service",
      accessor: (r) => r.serviceType ?? "—",
      hiddenOnMobile: true,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "progress",
      header: "Progression",
      accessor: (r) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary transition-all"
              style={{ width: `${r.progress}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{r.progress}%</span>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.progress,
      hiddenOnMobile: true,
    },
    {
      key: "start",
      header: "Début",
      accessor: (r) => formatDate(r.startDate),
      hiddenOnMobile: true,
    },
    {
      key: "end",
      header: "Fin est.",
      accessor: (r) => formatDate(r.endDate),
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-2">
      <PageHeader
        title={t("page_title")}
        subtitle={t("page_subtitle")}
        icon={Briefcase}
        action={{ label: t("new") }}
      />
      <DataTable
        data={mandates}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Rechercher un mandat…"
        exportFilename="mandats"
      />
    </div>
  );
}

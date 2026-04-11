"use client";
import { useTranslations } from "next-intl";
import { AlertCircle } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/utils";

type D = {
  id: number;
  title: string;
  status: string;
  priority: string;
  openedAt: Date;
  resolvedAt: Date | null;
  client: { fullName: string };
};

export function DisputesTable({ disputes }: { disputes: D[] }) {
  const t = useTranslations("admin.disputes");

  const columns: Column<D>[] = [
    { key: "client", header: "Client", accessor: (r) => r.client.fullName, sortable: true, sortBy: (r) => r.client.fullName },
    { key: "title", header: "Titre", accessor: (r) => r.title },
    { key: "priority", header: "Priorité", accessor: (r) => <StatusBadge status={r.priority} /> },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "opened", header: "Ouvert le", accessor: (r) => formatDate(r.openedAt), hiddenOnMobile: true },
    { key: "resolved", header: "Résolu le", accessor: (r) => formatDate(r.resolvedAt), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-2">
      <PageHeader title={t("page_title")} subtitle={t("page_subtitle")} icon={AlertCircle} />
      <DataTable data={disputes} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher un litige…" exportFilename="litiges" />
    </div>
  );
}

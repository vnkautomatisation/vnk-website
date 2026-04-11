"use client";
import { Inbox } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/utils";

type R = {
  id: number;
  title: string;
  serviceType: string | null;
  urgency: string;
  status: string;
  createdAt: Date;
};

export function RequestsTable({ requests }: { requests: R[] }) {
  const columns: Column<R>[] = [
    { key: "title", header: "Titre", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title },
    { key: "service", header: "Service", accessor: (r) => r.serviceType ?? "—", hiddenOnMobile: true },
    { key: "urgency", header: "Urgence", accessor: (r) => <StatusBadge status={r.urgency} /> },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "date", header: "Reçue le", accessor: (r) => formatDate(r.createdAt), sortable: true, sortBy: (r) => r.createdAt.getTime() },
  ];

  return (
    <div className="space-y-2">
      <PageHeader title="Demandes de projet" subtitle="Nouvelles demandes reçues via le portail et le formulaire contact" icon={Inbox} />
      <DataTable data={requests} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher une demande…" exportFilename="demandes" />
    </div>
  );
}

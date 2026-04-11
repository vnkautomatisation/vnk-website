"use client";
import { FolderOpen } from "lucide-react";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type D = {
  id: number;
  title: string;
  fileType: string | null;
  category: string | null;
  isRead: boolean;
  createdAt: Date;
  client: { fullName: string };
  mandate: { title: string } | null;
};

export function DocumentsTable({ documents }: { documents: D[] }) {
  const columns: Column<D>[] = [
    { key: "client", header: "Client", accessor: (r) => r.client.fullName, sortable: true, sortBy: (r) => r.client.fullName },
    { key: "title", header: "Titre", accessor: (r) => (
      <div>
        <div className="font-medium text-sm">{r.title}</div>
        {r.mandate && <div className="text-xs text-muted-foreground">{r.mandate.title}</div>}
      </div>
    ) },
    { key: "type", header: "Type", accessor: (r) => <Badge variant="outline" className="uppercase">{r.fileType ?? "pdf"}</Badge>, hiddenOnMobile: true },
    { key: "category", header: "Catégorie", accessor: (r) => r.category ? <Badge variant="secondary">{r.category}</Badge> : "—", hiddenOnMobile: true },
    { key: "read", header: "Statut", accessor: (r) => <Badge variant={r.isRead ? "secondary" : "info"}>{r.isRead ? "Lu" : "Non lu"}</Badge> },
    { key: "date", header: "Déposé le", accessor: (r) => formatDate(r.createdAt), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-2">
      <PageHeader title="Documents" subtitle="Déposer des livrables, rapports, fichiers" icon={FolderOpen} action={{ label: "Déposer un document" }} />
      <DataTable data={documents} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher un document…" exportFilename="documents" />
    </div>
  );
}

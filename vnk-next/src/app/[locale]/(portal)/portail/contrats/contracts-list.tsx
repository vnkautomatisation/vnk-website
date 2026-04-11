"use client";
import { FileSignature, PenLine, Download } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";

type C = {
  id: number;
  contractNumber: string;
  title: string;
  status: string;
  clientSignatureData: string | null;
  signedAt: Date | null;
};

export function PortalContractsList({ contracts }: { contracts: C[] }) {
  const columns: Column<C>[] = [
    { key: "number", header: "Numéro", accessor: (r) => r.contractNumber },
    { key: "title", header: "Titre", accessor: (r) => r.title },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "signed", header: "Signé le", accessor: (r) => formatDate(r.signedAt), hiddenOnMobile: true },
    { key: "actions", header: "Actions", accessor: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="outline"><Download className="h-3 w-3" /></Button>
        {!r.clientSignatureData && <Button size="sm"><PenLine className="h-3 w-3" />Signer</Button>}
      </div>
    ) },
  ];

  const renderCard = (c: C) => (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{c.contractNumber}</p>
            <p className="font-semibold">{c.title}</p>
          </div>
          <StatusBadge status={c.status} />
        </div>
        {!c.clientSignatureData ? (
          <Button size="sm" className="w-full">
            <PenLine className="h-4 w-4" /> Signer
          </Button>
        ) : (
          <Button size="sm" variant="outline" className="w-full">
            <Download className="h-4 w-4" /> Télécharger
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileSignature className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Mes contrats</h1>
      </div>
      <DataTable data={contracts} columns={columns} getRowId={(r) => r.id} renderCard={renderCard} />
    </div>
  );
}

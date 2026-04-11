"use client";
import { FileText } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

type Q = {
  id: number;
  quoteNumber: string;
  title: string;
  status: string;
  amountTtc: any;
  expiryDate: Date | null;
};

export function PortalQuotesList({ quotes }: { quotes: Q[] }) {
  const columns: Column<Q>[] = [
    { key: "number", header: "Numéro", accessor: (r) => r.quoteNumber, sortable: true, sortBy: (r) => r.quoteNumber },
    { key: "title", header: "Titre", accessor: (r) => r.title },
    { key: "amount", header: "Montant", accessor: (r) => <span className="font-semibold">{formatCurrency(Number(r.amountTtc))}</span>, sortable: true, sortBy: (r) => Number(r.amountTtc) },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "expiry", header: "Expire le", accessor: (r) => formatDate(r.expiryDate), hiddenOnMobile: true },
    { key: "actions", header: "Actions", accessor: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="outline">Voir</Button>
        {r.status === "pending" && <Button size="sm">Accepter</Button>}
      </div>
    ) },
  ];

  const renderCard = (q: Q) => (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{q.quoteNumber}</p>
            <p className="font-semibold">{q.title}</p>
          </div>
          <StatusBadge status={q.status} />
        </div>
        <p className="text-xl font-bold text-primary">{formatCurrency(Number(q.amountTtc))}</p>
        {q.status === "pending" && (
          <div className="flex gap-2">
            <Button size="sm" className="flex-1">Accepter</Button>
            <Button size="sm" variant="outline" className="flex-1">Voir PDF</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <FileText className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Mes devis</h1>
      </div>
      <DataTable data={quotes} columns={columns} getRowId={(r) => r.id} renderCard={renderCard} />
    </div>
  );
}

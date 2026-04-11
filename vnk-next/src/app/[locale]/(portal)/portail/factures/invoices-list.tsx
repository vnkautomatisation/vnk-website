"use client";
import { Receipt, CreditCard, Download } from "lucide-react";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

type I = {
  id: number;
  invoiceNumber: string;
  title: string;
  status: string;
  amountTtc: any;
  dueDate: Date | null;
  paidAt: Date | null;
};

export function PortalInvoicesList({ invoices }: { invoices: I[] }) {
  const columns: Column<I>[] = [
    { key: "number", header: "Numéro", accessor: (r) => r.invoiceNumber, sortable: true, sortBy: (r) => r.invoiceNumber },
    { key: "title", header: "Titre", accessor: (r) => r.title },
    { key: "amount", header: "Montant", accessor: (r) => <span className="font-semibold">{formatCurrency(Number(r.amountTtc))}</span>, sortable: true, sortBy: (r) => Number(r.amountTtc) },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "due", header: "Échéance", accessor: (r) => formatDate(r.dueDate), hiddenOnMobile: true },
    { key: "actions", header: "Actions", accessor: (r) => (
      <div className="flex gap-1">
        <Button size="sm" variant="outline"><Download className="h-3 w-3" /></Button>
        {r.status === "unpaid" && <Button size="sm"><CreditCard className="h-3 w-3" />Payer</Button>}
      </div>
    ) },
  ];

  const renderCard = (i: I) => (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{i.invoiceNumber}</p>
            <p className="font-semibold">{i.title}</p>
          </div>
          <StatusBadge status={i.status} />
        </div>
        <p className="text-xl font-bold">{formatCurrency(Number(i.amountTtc))}</p>
        {i.dueDate && (
          <p className="text-xs text-muted-foreground">Échéance : {formatDate(i.dueDate)}</p>
        )}
        {i.status === "unpaid" && (
          <Button size="sm" className="w-full">
            <CreditCard className="h-4 w-4" /> Payer maintenant
          </Button>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Mes factures</h1>
      </div>
      <DataTable data={invoices} columns={columns} getRowId={(r) => r.id} renderCard={renderCard} />
    </div>
  );
}

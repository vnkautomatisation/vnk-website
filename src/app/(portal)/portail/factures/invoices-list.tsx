"use client";

import { Receipt, CreditCard, Download } from "lucide-react";
import { toast } from "sonner";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

// ── Types ────────────────────────────────────────────────
type Invoice = {
  id: number;
  invoiceNumber: string;
  title: string;
  status: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  dueDate: string | null;
  createdAt: string;
  paidAt: string | null;
};

// ── Status color mapping for card top bar ────────────────
const STATUS_BAR_COLORS: Record<string, string> = {
  unpaid: "bg-amber-500",
  paid: "bg-emerald-600",
  overdue: "bg-red-600",
  cancelled: "bg-gray-400",
  draft: "bg-gray-300",
  refunded: "bg-gray-400",
};

// ── Filter options ───────────────────────────────────────
const filterOptions: FilterOption[] = [
  { value: "unpaid", label: "Non payee" },
  { value: "paid", label: "Payee" },
  { value: "overdue", label: "En retard" },
  { value: "cancelled", label: "Annulee" },
];

// ── Component ────────────────────────────────────────────
export function PortalInvoicesList({ invoices }: { invoices: Invoice[] }) {
  const handlePay = (inv: Invoice) => {
    toast.info("Stripe non configure");
  };

  const handleDownloadPdf = (inv: Invoice) => {
    window.open(`/api/portal/invoices/${inv.id}/pdf`, "_blank");
  };

  // ── Columns ──────────────────────────────────────────
  const columns: Column<Invoice>[] = [
    {
      key: "number",
      header: "Numero",
      accessor: (r) => (
        <span className="font-mono text-sm">{r.invoiceNumber}</span>
      ),
      sortable: true,
      sortBy: (r) => r.invoiceNumber,
    },
    {
      key: "title",
      header: "Titre",
      accessor: (r) => r.title,
      sortable: true,
      sortBy: (r) => r.title,
    },
    {
      key: "amount",
      header: "Montant TTC",
      accessor: (r) => (
        <span className="font-semibold text-[#0F2D52]">
          {formatCurrency(r.amountTtc)}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.amountTtc,
    },
    {
      key: "due",
      header: "Echeance",
      accessor: (r) => formatDate(r.dueDate),
      sortable: true,
      sortBy: (r) => (r.dueDate ? new Date(r.dueDate) : null),
      hiddenOnMobile: true,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (r) => (
        <div className="flex gap-1">
          {(r.status === "unpaid" || r.status === "overdue") && (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={(e) => {
                e.stopPropagation();
                handlePay(r);
              }}
            >
              <CreditCard className="h-3 w-3 mr-1" />
              Payer
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={(e) => {
              e.stopPropagation();
              handleDownloadPdf(r);
            }}
          >
            <Download className="h-3 w-3 mr-1" />
            PDF
          </Button>
        </div>
      ),
    },
  ];

  // ── Card renderer ────────────────────────────────────
  const renderCard = (inv: Invoice) => (
    <Card className="overflow-hidden">
      <div
        className={`h-1.5 ${STATUS_BAR_COLORS[inv.status] ?? "bg-gray-300"}`}
      />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-mono">
              {inv.invoiceNumber}
            </p>
            <p className="font-semibold text-sm truncate">{inv.title}</p>
          </div>
          <StatusBadge status={inv.status} />
        </div>

        <p className="text-xl font-bold text-[#0F2D52]">
          {formatCurrency(inv.amountTtc)}
        </p>

        {inv.dueDate && (
          <p className="text-xs text-muted-foreground">
            Echeance : {formatDate(inv.dueDate)}
          </p>
        )}

        <div className="flex gap-2">
          {(inv.status === "unpaid" || inv.status === "overdue") && (
            <Button
              size="sm"
              className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white"
              onClick={() => handlePay(inv)}
            >
              <CreditCard className="h-4 w-4 mr-1" />
              Payer
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className={
              inv.status === "unpaid" || inv.status === "overdue"
                ? ""
                : "w-full"
            }
            onClick={() => handleDownloadPdf(inv)}
          >
            <Download className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Receipt className="h-6 w-6 text-[#0F2D52]" />
        <div>
          <h1 className="text-2xl font-bold">Mes factures</h1>
          <p className="text-sm text-muted-foreground">
            Suivi de vos factures et paiements
          </p>
        </div>
      </div>

      <DataTable
        data={invoices}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-invoices"
        searchPlaceholder="Rechercher par numero ou titre..."
        searchFn={(r) => `${r.invoiceNumber} ${r.title}`}
        filterOptions={filterOptions}
        filterFn={(r) => r.status}
        filterLabel="Tous les statuts"
        exportFilename="factures"
        emptyMessage="Aucune facture"
        emptyIcon={
          <Receipt className="h-12 w-12 text-muted-foreground/40 mb-4" />
        }
      />
    </div>
  );
}

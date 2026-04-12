"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt, CreditCard, Eye, FileText, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

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

const STATUS_BAR_COLORS: Record<string, string> = {
  unpaid: "bg-amber-500",
  paid: "bg-emerald-600",
  overdue: "bg-red-600",
  cancelled: "bg-gray-400",
};

const filterOptions: FilterOption[] = [
  { value: "unpaid", label: "Non payee" },
  { value: "paid", label: "Payee" },
  { value: "overdue", label: "En retard" },
  { value: "cancelled", label: "Annulee" },
];

export function PortalInvoicesList({ invoices }: { invoices: Invoice[] }) {
  const router = useRouter();
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const [paying, startPayTransition] = useTransition();

  const openPdf = (inv: Invoice, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPdfInvoice(inv);
  };

  const handlePay = (inv: Invoice) => {
    startPayTransition(async () => {
      try {
        const res = await fetch("/api/payments/create-intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: inv.id }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.url) {
            window.location.href = data.url;
          } else {
            toast.success("Paiement en cours de traitement");
            router.refresh();
          }
        } else {
          toast.error("Erreur lors de la creation du paiement");
        }
      } catch {
        toast.error("Erreur de connexion");
      }
    });
  };

  const columns: Column<Invoice>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10",
      accessor: () => (
        <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
          <FileText className="h-4 w-4 text-[#0F2D52]" />
        </div>
      ),
    },
    {
      key: "info",
      header: "Facture",
      accessor: (r) => (
        <div>
          <span className="font-mono text-xs text-muted-foreground">{r.invoiceNumber}</span>
          <p className="font-medium text-sm">{r.title}</p>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.invoiceNumber,
    },
    {
      key: "amount",
      header: "Montant",
      accessor: (r) => (
        <span className="font-bold text-[#0F2D52]">{formatCurrency(r.amountTtc)}</span>
      ),
      sortable: true,
      sortBy: (r) => r.amountTtc,
    },
    {
      key: "due",
      header: "Echeance",
      accessor: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.dueDate ? formatDate(new Date(r.dueDate)) : "\u2014"}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.dueDate ? new Date(r.dueDate).getTime() : 0,
      hiddenOnMobile: true,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "actions",
      header: "",
      className: "w-[120px]",
      accessor: (r) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {(r.status === "unpaid" || r.status === "overdue") ? (
            <Button
              size="sm"
              className="bg-[#0F2D52] hover:bg-[#1a3a66]"
              onClick={(e) => openPdf(r, e)}
            >
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              Payer
            </Button>
          ) : r.status === "paid" ? (
            <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(r, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  const renderCard = (inv: Invoice) => (
    <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <div className={`h-1.5 ${STATUS_BAR_COLORS[inv.status] ?? "bg-gray-300"}`} />
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber}</p>
            <p className="font-semibold truncate">{inv.title}</p>
          </div>
          <StatusBadge status={inv.status} />
        </div>
        <p className="text-2xl font-bold text-[#0F2D52]">{formatCurrency(inv.amountTtc)}</p>
        {inv.dueDate && (
          <p className="text-xs text-muted-foreground">
            Echeance : {formatDate(new Date(inv.dueDate))}
          </p>
        )}
        <div className="pt-1">
          {(inv.status === "unpaid" || inv.status === "overdue") ? (
            <Button
              size="sm"
              className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]"
              onClick={(e) => openPdf(inv, e)}
            >
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              Payer
            </Button>
          ) : inv.status === "paid" ? (
            <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(inv, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg">
          <Receipt className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes factures</h1>
          <p className="text-sm text-muted-foreground">Suivi de vos factures et paiements</p>
        </div>
      </div>

      {/* KPI strip */}
      {(() => {
        const totalCount = invoices.length;
        const unpaidInvoices = invoices.filter((i) => i.status === "unpaid" || i.status === "overdue");
        const aPayerCount = unpaidInvoices.length;
        const aPayerSum = unpaidInvoices.reduce((sum, i) => sum + i.amountTtc, 0);
        const enRetardCount = invoices.filter((i) => i.status === "overdue").length;
        const payeesCount = invoices.filter((i) => i.status === "paid").length;
        return (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="vnk-kpi-card vnk-stat-blue bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center shadow-sm">
                  <FileText className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total factures</p>
                  <p className="text-xl font-bold tracking-tight">{totalCount}</p>
                </div>
              </div>
            </div>
            <div className="vnk-kpi-card vnk-stat-amber bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shadow-sm">
                  <Clock className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">A payer</p>
                  <p className="text-xl font-bold tracking-tight">{aPayerCount}</p>
                  <p className="text-xs text-muted-foreground">{formatCurrency(aPayerSum)}</p>
                </div>
              </div>
            </div>
            <div className="vnk-kpi-card vnk-stat-red bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-sm">
                  <AlertTriangle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">En retard</p>
                  <p className="text-xl font-bold tracking-tight">{enRetardCount}</p>
                </div>
              </div>
            </div>
            <div className="vnk-kpi-card vnk-stat-emerald bg-card p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center shadow-sm">
                  <CheckCircle className="h-4 w-4 text-white" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Payees</p>
                  <p className="text-xl font-bold tracking-tight">{payeesCount}</p>
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      <DataTable
        data={invoices}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-invoices"
        searchPlaceholder="Rechercher une facture..."
        searchFn={(r) => `${r.invoiceNumber} ${r.title}`}
        filterOptions={filterOptions}
        filterFn={(r) => r.status}
        exportFilename="factures"
        emptyMessage="Aucune facture"
      />

      {/* PDF preview — with Pay button if unpaid */}
      {pdfInvoice && (
        <PdfViewerModal
          open={!!pdfInvoice}
          onClose={() => setPdfInvoice(null)}
          pdfUrl={`/api/invoices/${pdfInvoice.id}/pdf`}
          title={pdfInvoice.title}
          documentNumber={pdfInvoice.invoiceNumber}
          date={pdfInvoice.dueDate ? formatDate(new Date(pdfInvoice.dueDate)) : undefined}
          downloadName={`facture-${pdfInvoice.invoiceNumber}`}
          actions={
            (pdfInvoice.status === "unpaid" || pdfInvoice.status === "overdue") ? (
              <Button
                className="bg-[#0F2D52] hover:bg-[#1a3a66]"
                size="sm"
                onClick={() => handlePay(pdfInvoice)}
                disabled={paying}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                {paying ? "Redirection..." : "Payer maintenant"}
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt, CreditCard, Download, Eye, X, FileText } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
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
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [pdfOpen, setPdfOpen] = useState(false);
  const [paying, startPayTransition] = useTransition();

  const openDetail = (inv: Invoice, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedInvoice(inv);
  };

  const openPdf = (inv: Invoice, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setSelectedInvoice(inv);
    setPdfOpen(true);
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
      accessor: (r) => (
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
          {r.dueDate ? formatDate(new Date(r.dueDate)) : "—"}
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
      className: "w-[180px]",
      accessor: (r) => (
        <div className="flex gap-1.5 justify-end" onClick={(e) => e.stopPropagation()}>
          {(r.status === "unpaid" || r.status === "overdue") ? (
            <Button
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700"
              onClick={(e) => { e.stopPropagation(); openDetail(r); }}
            >
              <CreditCard className="h-3.5 w-3.5 mr-1" />
              Payer
            </Button>
          ) : (
            <Button size="sm" variant="outline" onClick={(e) => openPdf(r, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir
            </Button>
          )}
          <Button size="sm" variant="ghost" onClick={(e) => openPdf(r, e)} title="Voir PDF">
            <Download className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];

  const renderCard = (inv: Invoice) => (
    <Card className="overflow-hidden hover:shadow-md transition-shadow">
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
        <div className="flex gap-2">
          {(inv.status === "unpaid" || inv.status === "overdue") ? (
            <>
              <Button
                size="sm"
                className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                onClick={(e) => { e.stopPropagation(); openDetail(inv); }}
              >
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                Payer
              </Button>
              <Button size="sm" variant="outline" onClick={(e) => openPdf(inv, e)}>
                <Download className="h-3.5 w-3.5" />
              </Button>
            </>
          ) : (
            <Button size="sm" variant="outline" className="flex-1" onClick={(e) => openPdf(inv, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir PDF
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
          <Receipt className="h-5 w-5 text-[#0F2D52]" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes factures</h1>
          <p className="text-sm text-muted-foreground">Suivi de vos factures et paiements</p>
        </div>
      </div>

      <DataTable
        data={invoices}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        onRowClick={(inv) => openDetail(inv)}
        storageKey="portal-invoices"
        searchPlaceholder="Rechercher une facture..."
        searchFn={(r) => `${r.invoiceNumber} ${r.title}`}
        filterOptions={filterOptions}
        filterFn={(r) => r.status}
        exportFilename="factures"
        emptyMessage="Aucune facture"
      />

      {/* Invoice detail modal (before payment) */}
      {selectedInvoice && !pdfOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedInvoice(null)} />
          <div className="relative z-10 w-full max-w-md mx-4 rounded-xl overflow-hidden bg-background shadow-2xl">
            {/* Header */}
            <div className="bg-[#0F2D52] text-white p-5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-mono opacity-70">{selectedInvoice.invoiceNumber}</span>
                <button onClick={() => setSelectedInvoice(null)} className="h-8 w-8 rounded hover:bg-white/10 flex items-center justify-center">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <h2 className="font-bold text-lg">{selectedInvoice.title}</h2>
              <div className="mt-3 flex items-end justify-between">
                <div className="text-3xl font-bold">{formatCurrency(selectedInvoice.amountTtc)}</div>
                <StatusBadge status={selectedInvoice.status} />
              </div>
            </div>

            {/* Breakdown */}
            <div className="p-5 space-y-3">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Montant HT</span>
                  <span className="font-medium">{formatCurrency(selectedInvoice.amountHt)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TPS (5%)</span>
                  <span>{formatCurrency(selectedInvoice.tpsAmount)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">TVQ (9.975%)</span>
                  <span>{formatCurrency(selectedInvoice.tvqAmount)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total TTC</span>
                  <span className="text-[#0F2D52]">{formatCurrency(selectedInvoice.amountTtc)}</span>
                </div>
              </div>

              {selectedInvoice.dueDate && (
                <p className="text-xs text-muted-foreground">
                  Echeance : {formatDate(new Date(selectedInvoice.dueDate))}
                </p>
              )}

              {selectedInvoice.paidAt && (
                <p className="text-xs text-emerald-600 font-medium">
                  Payee le {formatDate(new Date(selectedInvoice.paidAt))}
                </p>
              )}

              <div className="flex gap-2 pt-2">
                {(selectedInvoice.status === "unpaid" || selectedInvoice.status === "overdue") && (
                  <Button
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    onClick={() => handlePay(selectedInvoice)}
                    disabled={paying}
                  >
                    <CreditCard className="h-4 w-4 mr-2" />
                    {paying ? "Redirection..." : "Payer maintenant"}
                  </Button>
                )}
                <Button
                  variant="outline"
                  onClick={() => { setPdfOpen(true); }}
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Voir PDF
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* PDF preview modal */}
      {selectedInvoice && pdfOpen && (
        <PdfViewerModal
          open={pdfOpen}
          onClose={() => { setPdfOpen(false); setSelectedInvoice(null); }}
          pdfUrl={`/api/invoices/${selectedInvoice.id}/pdf`}
          title={selectedInvoice.title}
          documentNumber={selectedInvoice.invoiceNumber}
          date={selectedInvoice.dueDate ? formatDate(new Date(selectedInvoice.dueDate)) : undefined}
          downloadName={`facture-${selectedInvoice.invoiceNumber}`}
          actions={
            (selectedInvoice.status === "unpaid" || selectedInvoice.status === "overdue") ? (
              <Button
                className="bg-emerald-600 hover:bg-emerald-700"
                size="sm"
                onClick={() => handlePay(selectedInvoice)}
                disabled={paying}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Payer
              </Button>
            ) : undefined
          }
        />
      )}
    </div>
  );
}

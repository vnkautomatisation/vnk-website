"use client";

import { useState, useMemo } from "react";
import { Receipt, CreditCard, Eye, FileText, AlertTriangle, CheckCircle, Clock } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { PaymentModal } from "./payment-modal";
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
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const [payInvoice, setPayInvoice] = useState<Invoice | null>(null);

  const invoiceKpis = useMemo(() => {
    const totalCount = invoices.length;
    const unpaidInvoices = invoices.filter((i) => i.status === "unpaid" || i.status === "overdue");
    const aPayerCount = unpaidInvoices.length;
    const aPayerSum = unpaidInvoices.reduce((sum, i) => sum + i.amountTtc, 0);
    const enRetardCount = invoices.filter((i) => i.status === "overdue").length;
    const payeesCount = invoices.filter((i) => i.status === "paid").length;
    return { totalCount, aPayerCount, aPayerSum, enRetardCount, payeesCount };
  }, [invoices]);

  const openPdf = (inv: Invoice, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPdfInvoice(inv);
  };

  const handlePay = (inv: Invoice) => {
    setPayInvoice(inv);
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
          <p className="text-[11px] text-muted-foreground">Emise le {formatDate(new Date(r.createdAt))}</p>
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

  const renderCard = (inv: Invoice) => {
    const isOverdue = inv.status === "overdue";
    const isPaid = inv.status === "paid";
    return (
      <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow border-l-[3px]" style={{ borderLeftColor: isOverdue ? "#dc2626" : isPaid ? "#059669" : inv.status === "unpaid" ? "#f59e0b" : "#d1d5db" }}>
        <CardContent className="p-4 space-y-3">
          {/* Header: number + title + badge */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber}</p>
              <p className="font-semibold truncate">{inv.title}</p>
            </div>
            <StatusBadge status={inv.status} />
          </div>

          {/* Amount prominent */}
          <p className="text-2xl font-bold text-[#0F2D52]">{formatCurrency(inv.amountTtc)}</p>

          {/* Tax breakdown */}
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {formatCurrency(inv.amountHt)} HT + TPS {formatCurrency(inv.tpsAmount)} + TVQ {formatCurrency(inv.tvqAmount)}
          </p>

          {/* Dates */}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              Emise le {formatDate(new Date(inv.createdAt))}
            </p>
            {inv.dueDate && (
              <p className={`text-xs flex items-center gap-1 ${isOverdue ? "text-red-600 font-medium" : "text-muted-foreground"}`}>
                {isOverdue && <AlertTriangle className="h-3 w-3 shrink-0" />}
                Echeance : {formatDate(new Date(inv.dueDate))}
              </p>
            )}
            {isPaid && inv.paidAt && (
              <p className="text-xs text-emerald-600 font-medium">
                Payee le {formatDate(new Date(inv.paidAt))}
              </p>
            )}
          </div>

          {/* Action */}
          <div className="pt-1">
            {(inv.status === "unpaid" || isOverdue) ? (
              <Button
                size="sm"
                className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]"
                onClick={(e) => openPdf(inv, e)}
              >
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                Payer
              </Button>
            ) : isPaid ? (
              <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(inv, e)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                Voir
              </Button>
            ) : null}
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <DataTable
        stickyHeader={
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Mes factures</h1>
                <p className="text-sm text-muted-foreground">Suivi de vos factures et paiements</p>
              </div>
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total factures</p>
                    <p className="text-2xl font-bold">{invoiceKpis.totalCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-amber-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-600">A payer</p>
                    <p className="text-2xl font-bold">{invoiceKpis.aPayerCount}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(invoiceKpis.aPayerSum)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-red-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-red-600">En retard</p>
                    <p className="text-2xl font-bold">{invoiceKpis.enRetardCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 p-4">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600">Payees</p>
                    <p className="text-2xl font-bold">{invoiceKpis.payeesCount}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        }
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
                onClick={() => {
                  setPdfInvoice(null);
                  setPayInvoice(pdfInvoice);
                }}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                Payer maintenant
              </Button>
            ) : undefined
          }
        />
      )}

      {/* Payment recap modal before Stripe redirect */}
      <PaymentModal
        invoice={payInvoice}
        open={!!payInvoice}
        onClose={() => setPayInvoice(null)}
      />
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Receipt, CreditCard, Eye, FileText, AlertTriangle, CheckCircle, Clock, Download } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { StripePaymentModal } from "./stripe-payment-modal";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";


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

const FILTER_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "unpaid", labelKey: "opt_non_payee" },
  { value: "paid", labelKey: "opt_payee" },
  { value: "overdue", labelKey: "opt_en_retard" },
  { value: "cancelled", labelKey: "opt_annulee" },
];

export function PortalInvoicesList({ invoices }: { invoices: Invoice[] }) {
  const t = useTranslations("portal");
  const router = useRouter();
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const [showPayment, setShowPayment] = useState(false);
  const [paid, setPaid] = useState(false);
  const [pdfKey, setPdfKey] = useState(0);
  const formatCurrency = useCurrency();

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

  const startPay = () => {
    setShowPayment(true);
  };

  const handlePaid = () => {
    setShowPayment(false);
    setPaid(true);
    setPdfKey((k) => k + 1);
    toast.success(t("paiement_effectue_merci"));
    router.refresh();
  };

  const closePdf = () => {
    setPdfInvoice(null);
    setShowPayment(false);
    setPaid(false);
  };

  const columns: Column<Invoice>[] = [
    {
      key: "icon",
      header: "",
      className: "w-10", hiddenOnMobile: true,
      accessor: () => (
        <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
          <FileText className="h-4 w-4 text-[#0F2D52]" />
        </div>
      ),
    },
    {
      key: "info",
      header: t("facture"),
      accessor: (r) => (
        <div>
          <span className="font-mono text-xs text-muted-foreground">{r.invoiceNumber}</span>
          <p className="font-medium text-sm">{r.title}</p>
          <p className="text-[11px] text-muted-foreground">{t("emise_le", { date: formatDate(new Date(r.createdAt)) })}</p>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.invoiceNumber,
    },
    {
      key: "amount",
      header: t("montant"),
      accessor: (r) => (
        <span className="font-bold text-[#0F2D52]">{formatCurrency(r.amountTtc)}</span>
      ),
      sortable: true,
      sortBy: (r) => r.amountTtc,
    },
    {
      key: "due",
      header: t("echeance"),
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
      header: t("statut"),
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "paidAt",
      header: t("paye"),
      accessor: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.paidAt ? formatDate(r.paidAt) : "\u2014"}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.paidAt ? new Date(r.paidAt).getTime() : 0,
      hiddenOnMobile: true,
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
              {t("payer_2")}
            </Button>
          ) : r.status === "paid" ? (
            <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(r, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              {t("voir")}
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

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-mono">{inv.invoiceNumber}</p>
              <p className="font-semibold truncate">{inv.title}</p>
            </div>
            <StatusBadge status={inv.status} />
          </div>


          <p className="text-2xl font-bold text-[#0F2D52]">{formatCurrency(inv.amountTtc)}</p>


          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {formatCurrency(inv.amountHt)} {t("ht")} + {t("tps")} {formatCurrency(inv.tpsAmount)} + {t("tvq")} {formatCurrency(inv.tvqAmount)}
          </p>


          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">
              {t("emise_le", { date: formatDate(new Date(inv.createdAt)) })}
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


          <div className="pt-1">
            {(inv.status === "unpaid" || isOverdue) ? (
              <Button
                size="sm"
                className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]"
                onClick={(e) => openPdf(inv, e)}
              >
                <CreditCard className="h-3.5 w-3.5 mr-1" />
                {t("payer_2")}
              </Button>
            ) : isPaid ? (
              <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(inv, e)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                {t("voir")}
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
              <div className="portal-icon-lg rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                <Receipt className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="portal-title">{t("factures")}</h1>
                <p className="text-sm text-muted-foreground">{t("suivi_factures_paiements")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 portal-kpi-grid mb-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <FileText className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("total_factures")}</p>
                    <p className="portal-kpi-number">{invoiceKpis.totalCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-amber-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-amber-600">{t("payer")}</p>
                    <p className="portal-kpi-number">{invoiceKpis.aPayerCount}</p>
                    <p className="text-xs text-muted-foreground">{formatCurrency(invoiceKpis.aPayerSum)}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-red-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-red-100 flex items-center justify-center">
                    <AlertTriangle className="h-4 w-4 text-red-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-red-600">{t("retard")}</p>
                    <p className="portal-kpi-number">{invoiceKpis.enRetardCount}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-emerald-600">{t("payees")}</p>
                    <p className="portal-kpi-number">{invoiceKpis.payeesCount}</p>
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
        searchPlaceholder={t("rechercher_facture")}
        searchFn={(r) => `${r.invoiceNumber} ${r.title}`}
        filterOptions={FILTER_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        filterFn={(r) => r.status}
        exportFilename="factures"
        emptyMessage={t("aucune_facture")}
      />


      {pdfInvoice && (
        <PdfViewerModal
          open={!!pdfInvoice}
          onClose={closePdf}
          pdfUrl={`/api/invoices/${pdfInvoice.id}/pdf`}
          refreshKey={pdfKey}
          title={pdfInvoice.title}
          documentNumber={pdfInvoice.invoiceNumber}
          date={pdfInvoice.dueDate ? formatDate(new Date(pdfInvoice.dueDate)) : undefined}
          downloadName={`facture-${pdfInvoice.invoiceNumber}`}
          actions={
            paid ? (
              <Button className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white" size="sm" onClick={() => {
                const a = document.createElement("a");
                a.href = `/api/invoices/${pdfInvoice.id}/pdf`;
                a.download = `facture-${pdfInvoice.invoiceNumber}.pdf`;
                a.click();
              }}>
                <Download className="h-4 w-4 mr-1.5" />
                {t("telecharger_facture")}
              </Button>
            ) : showPayment ? null
              : (pdfInvoice.status === "unpaid" || pdfInvoice.status === "overdue") ? (
              <Button
                className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                size="sm"
                onClick={startPay}
              >
                <CreditCard className="h-4 w-4 mr-1" />
                {t("payer_maintenant")}
              </Button>
            ) : undefined
          }
        />
      )}


      {pdfInvoice && showPayment && (
        <StripePaymentModal
          invoice={pdfInvoice}
          open={showPayment}
          onClose={() => setShowPayment(false)}
          onPaid={handlePaid}
        />
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Eye, CheckCircle, PenLine, Clock, Hash, DollarSign, AlertTriangle, Calendar, X, Download } from "lucide-react";
import { DataTable, type Column, type FilterOption } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { SignatureCanvas } from "@/components/signature/signature-canvas";
import { StatusBadge } from "@/components/admin/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils";

type Q = {
  id: number;
  quoteNumber: string;
  title: string;
  status: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  discountAmount: number | null;
  expiryDate: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

const FILTER_OPTIONS: { value: string; labelKey: string }[] = [
  { value: "pending", labelKey: "opt_en_attente" },
  { value: "accepted", labelKey: "opt_accepte" },
  { value: "expired", labelKey: "opt_expire" },
  { value: "declined", labelKey: "opt_refuse" },
];

const STATUS_BAR_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  accepted: "bg-emerald-600",
  expired: "bg-gray-400",
  declined: "bg-red-500",
};

export function PortalQuotesList({ quotes }: { quotes: Q[] }) {
  const t = useTranslations("portal");
  const router = useRouter();
  const [pdfQuote, setPdfQuote] = useState<Q | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [accepted, setAccepted] = useState(false);
  const [pdfKey, setPdfKey] = useState(0);
  const [, startTransition] = useTransition();

  const openPdf = (q: Q, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPdfQuote(q);
    setShowSignature(false);
  };

  const closePdf = () => {
    setPdfQuote(null);
    setShowSignature(false);
    setAccepted(false);
  };


  const startAccept = () => {
    setShowSignature(true);
  };


  const handleSignAndAccept = async (signatureDataUrl: string) => {
    if (!pdfQuote) return;
    setAccepting(true);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/quotes/${pdfQuote.id}/accept`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureData: signatureDataUrl }),
        });
        if (res.ok) {
          toast.success(t("devis_accepte_signe_contrat_genere"));
          setShowSignature(false);
          setAccepted(true);
          setPdfKey((k) => k + 1);
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error ?? t("erreur_lors_acceptation"));
        }
      } catch {
        toast.error(t("erreur_connexion"));
      } finally {
        setAccepting(false);
      }
    });
  };

  const columns: Column<Q>[] = [
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
      header: t("devis"),
      accessor: (r) => (
        <div>
          <span className="font-mono text-xs text-muted-foreground">{r.quoteNumber}</span>
          <p className="font-medium text-sm">{r.title}</p>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.quoteNumber,
    },
    {
      key: "amount",
      header: t("montant_ttc"),
      accessor: (r) => (
        <span className="font-bold text-[#0F2D52]">{formatCurrency(r.amountTtc)}</span>
      ),
      sortable: true,
      sortBy: (r) => r.amountTtc,
    },
    {
      key: "date",
      header: t("date"),
      accessor: (r) => (
        <span className="text-muted-foreground text-sm">
          {formatDate(new Date(r.createdAt))}
        </span>
      ),
      hiddenOnMobile: true,
      sortable: true,
      sortBy: (r) => new Date(r.createdAt).getTime(),
    },
    {
      key: "status",
      header: t("statut"),
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "acceptedAt",
      header: t("accepte"),
      accessor: (r) => (
        <span className="text-sm text-muted-foreground">
          {r.acceptedAt ? formatDate(r.acceptedAt) : "\u2014"}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.acceptedAt ? new Date(r.acceptedAt).getTime() : 0,
      hiddenOnMobile: true,
    },
    {
      key: "expiry",
      header: t("expire"),
      accessor: (r) => (
        <span className="text-muted-foreground text-sm">
          {r.expiryDate ? formatDate(new Date(r.expiryDate)) : "\u2014"}
        </span>
      ),
      hiddenOnMobile: true,
      sortable: true,
      sortBy: (r) => r.expiryDate ? new Date(r.expiryDate).getTime() : 0,
    },
    {
      key: "actions",
      header: "",
      className: "w-[120px]",
      accessor: (r) => (
        <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
          {r.status === "pending" ? (
            <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(r, e)}>
              <CheckCircle className="h-3.5 w-3.5 mr-1" />
              {t("accepter")}
            </Button>
          ) : (
            <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(r, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              {t("voir")}
            </Button>
          )}
        </div>
      ),
    },
  ];

  const renderCard = (q: Q) => {
    const expiryClose =
      q.status === "pending" &&
      q.expiryDate &&
      (new Date(q.expiryDate).getTime() - Date.now()) / 86_400_000 <= 7 &&
      new Date(q.expiryDate).getTime() > Date.now();

    return (
      <Card className="overflow-hidden shadow-sm hover:shadow-md transition-shadow">
        <div className={`h-1 ${STATUS_BAR_COLORS[q.status] ?? "bg-gray-300"}`} />
        <CardContent className="p-4 space-y-3">

          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground font-mono">{q.quoteNumber}</p>
              <p className="font-semibold truncate mt-0.5">{q.title}</p>
              <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                <Calendar className="h-3 w-3" />
                <span>{formatDate(new Date(q.createdAt))}</span>
              </div>
            </div>
            <StatusBadge status={q.status} />
          </div>


          <p className="text-2xl font-bold text-[#0F2D52]">{formatCurrency(q.amountTtc)}</p>


          <div className="grid grid-cols-3 gap-2 text-xs text-muted-foreground border-t pt-2">
            <div>
              <span className="block text-[10px] uppercase tracking-wide font-medium">HT</span>
              <span className="font-semibold text-foreground">{formatCurrency(q.amountHt)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide font-medium">TPS</span>
              <span className="font-semibold text-foreground">{formatCurrency(q.tpsAmount)}</span>
            </div>
            <div>
              <span className="block text-[10px] uppercase tracking-wide font-medium">TVQ</span>
              <span className="font-semibold text-foreground">{formatCurrency(q.tvqAmount)}</span>
            </div>
          </div>


          {q.expiryDate && (
            <div className={`flex items-center gap-1.5 text-xs ${expiryClose ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
              {expiryClose && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              <span>
                {expiryClose ? t("expire_bientot") : t("expire")}
                {formatDate(new Date(q.expiryDate))}
              </span>
            </div>
          )}


          <div className="pt-1">
            {q.status === "pending" ? (
              <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(q, e)}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                {t("accepter")}
              </Button>
            ) : (
              <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(q, e)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                {t("voir")}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };


  const pdfActions = accepted ? (
    <Button className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white" size="sm" onClick={() => {
      const a = document.createElement("a");
      a.href = `/api/quotes/${pdfQuote!.id}/pdf`;
      a.download = `devis-${pdfQuote!.quoteNumber}.pdf`;
      a.click();
    }}>
      <Download className="h-4 w-4 mr-1.5" />
      {t("telecharger_devis")}
    </Button>
  ) : pdfQuote?.status === "pending" ? (
    showSignature ? null : (
      <Button className="bg-[#0F2D52] hover:bg-[#1a3a66]" size="sm" onClick={startAccept}>
        <PenLine className="h-4 w-4 mr-1.5" />
        {t("accepter_devis_2")}
      </Button>
    )
  ) : undefined;

  return (
    <div className="space-y-4">
      <DataTable
        stickyHeader={
          <>
            <div className="flex items-center gap-3 mb-4">
              <div className="portal-icon-lg rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h1 className="portal-title">{t("devis")}</h1>
                <p className="text-sm text-muted-foreground">{t("consultez_acceptez_devis")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 portal-kpi-grid mb-3">
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <Hash className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("total_devis")}</p>
                    <p className="portal-kpi-number">{quotes.length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-amber-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-amber-100 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-amber-600">{t("attente")}</p>
                    <p className="portal-kpi-number">{quotes.filter((q) => q.status === "pending").length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-emerald-50/60 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="portal-icon-sm rounded-lg bg-emerald-100 flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-emerald-600">{t("acceptes")}</p>
                    <p className="portal-kpi-number">{quotes.filter((q) => q.status === "accepted").length}</p>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border bg-[#0F2D52]/5 portal-kpi-card">
                <div className="flex items-center gap-3">
                  <div className="h-7 w-7 sm:h-9 sm:w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
                    <DollarSign className="h-4 w-4 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="portal-kpi-label text-muted-foreground">{t("montant_total")}</p>
                    <p className="portal-kpi-number">{formatCurrency(quotes.reduce((s, q) => s + q.amountTtc, 0))}</p>
                  </div>
                </div>
              </div>
            </div>
          </>
        }
        data={quotes}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-quotes"
        searchPlaceholder={t("rechercher_devis")}
        searchFn={(r) => `${r.quoteNumber} ${r.title}`}
        filterOptions={FILTER_OPTIONS.map((o) => ({ value: o.value, label: t(o.labelKey) }))}
        filterFn={(r) => r.status}
        emptyMessage={t("aucun_devis")}
      />


      {pdfQuote && (
        <PdfViewerModal
          open={!!pdfQuote}
          onClose={closePdf}
          pdfUrl={`/api/quotes/${pdfQuote.id}/pdf`}
          refreshKey={pdfKey}
          title={pdfQuote.title}
          documentNumber={pdfQuote.quoteNumber}
          date={pdfQuote.expiryDate ? `Expire le ${formatDate(new Date(pdfQuote.expiryDate))}` : undefined}
          downloadName={`devis-${pdfQuote.quoteNumber}`}
          actions={pdfActions}
        />
      )}


      {pdfQuote && showSignature && (
        <div className="fixed inset-0 bottom-14 lg:bottom-0 z-[10000] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSignature(false)} />
          <div className="relative z-10 w-full max-w-xl mx-4 mb-4 sm:mb-0 bg-white rounded-2xl shadow-2xl overflow-hidden">

            <div className="bg-[#0F2D52] px-6 py-5 text-white relative">
              <button
                onClick={() => setShowSignature(false)}
                className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center transition-colors"
              >
                <X className="h-4 w-4 text-white/70" />
              </button>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center shrink-0">
                  <FileText className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h2 className="text-lg font-bold">{t("accepter_devis")}</h2>
                  <p className="text-white/60 text-sm mt-0.5">
                    {pdfQuote.quoteNumber} — {pdfQuote.title}
                  </p>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <div className="bg-white/10 rounded-lg px-3 py-2">
                  <span className="text-white/70 text-xs">{t("montant_ttc")}</span>
                  <p className="text-white font-bold text-lg">{formatCurrency(pdfQuote.amountTtc)}</p>
                </div>
                {pdfQuote.expiryDate && (
                  <div className="bg-white/10 rounded-lg px-3 py-2">
                    <span className="text-white/70 text-xs">{t("expire")}</span>
                    <p className="text-white font-medium text-sm">{formatDate(new Date(pdfQuote.expiryDate))}</p>
                  </div>
                )}
              </div>
            </div>


            <div className="mx-6 mt-5 rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 px-4 py-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {t("signant_vous_acceptez_devis_contrat")}
              </p>
            </div>


            <div className="px-6 py-4">
              <SignatureCanvas
                onSave={handleSignAndAccept}
                height={180}
                disabled={accepting}
                legalText={t("conditions_devis")}
              />
              {accepting && (
                <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse">
                  {t("acceptation_cours")}
                </p>
              )}
            </div>


            <div className="px-6 py-4 border-t bg-muted/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <CheckCircle className="h-3.5 w-3.5" />
                <span>{t("contrat_genere_automatiquement")}</span>
              </div>
              <Button variant="outline" size="sm" onClick={() => setShowSignature(false)} disabled={accepting}>
                {t("annuler")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FileText, Eye, CheckCircle, PenLine, Clock, Hash, DollarSign, AlertTriangle, Calendar } from "lucide-react";
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
  createdAt: string;
};

const FILTER_OPTIONS: FilterOption[] = [
  { value: "pending", label: "En attente" },
  { value: "accepted", label: "Accepte" },
  { value: "expired", label: "Expire" },
  { value: "declined", label: "Refuse" },
];

const STATUS_BAR_COLORS: Record<string, string> = {
  pending: "bg-amber-500",
  accepted: "bg-emerald-600",
  expired: "bg-gray-400",
  declined: "bg-red-500",
};

export function PortalQuotesList({ quotes }: { quotes: Q[] }) {
  const router = useRouter();
  const [pdfQuote, setPdfQuote] = useState<Q | null>(null);
  const [showSignature, setShowSignature] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [, startTransition] = useTransition();

  const openPdf = (q: Q, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setPdfQuote(q);
    setShowSignature(false);
  };

  const closePdf = () => {
    setPdfQuote(null);
    setShowSignature(false);
  };

  // Step 1: user clicks "Accepter ce devis" in footer → show signature canvas
  const startAccept = () => {
    setShowSignature(true);
  };

  // Step 2: user draws signature and clicks save → submit acceptance
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
          toast.success("Devis accepte et signe — contrat genere automatiquement");
          closePdf();
          router.refresh();
        } else {
          const data = await res.json().catch(() => ({}));
          toast.error(data.error ?? "Erreur lors de l'acceptation");
        }
      } catch {
        toast.error("Erreur de connexion");
      } finally {
        setAccepting(false);
      }
    });
  };

  const columns: Column<Q>[] = [
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
      header: "Devis",
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
      header: "Montant TTC",
      accessor: (r) => (
        <span className="font-bold text-[#0F2D52]">{formatCurrency(r.amountTtc)}</span>
      ),
      sortable: true,
      sortBy: (r) => r.amountTtc,
    },
    {
      key: "date",
      header: "Date",
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
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "expiry",
      header: "Expire le",
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
              Accepter
            </Button>
          ) : (
            <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(r, e)}>
              <Eye className="h-3.5 w-3.5 mr-1" />
              Voir
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
          {/* Header: quote number + date + status badge */}
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

          {/* Amount TTC prominent */}
          <p className="text-2xl font-bold text-[#0F2D52]">{formatCurrency(q.amountTtc)}</p>

          {/* Tax breakdown */}
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

          {/* Expiry + warning */}
          {q.expiryDate && (
            <div className={`flex items-center gap-1.5 text-xs ${expiryClose ? "text-amber-600 font-medium" : "text-muted-foreground"}`}>
              {expiryClose && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
              <span>
                {expiryClose ? "Expire bientot : " : "Expire le "}
                {formatDate(new Date(q.expiryDate))}
              </span>
            </div>
          )}

          {/* Action button */}
          <div className="pt-1">
            {q.status === "pending" ? (
              <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(q, e)}>
                <CheckCircle className="h-3.5 w-3.5 mr-1" />
                Accepter
              </Button>
            ) : (
              <Button size="sm" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={(e) => openPdf(q, e)}>
                <Eye className="h-3.5 w-3.5 mr-1" />
                Voir
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  // Build footer actions for PDF modal
  const pdfActions = pdfQuote?.status === "pending" ? (
    showSignature ? null : (
      <Button className="bg-[#0F2D52] hover:bg-[#1a3a66]" size="sm" onClick={startAccept}>
        <PenLine className="h-4 w-4 mr-1.5" />
        Accepter ce devis
      </Button>
    )
  ) : undefined;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
          <FileText className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Mes devis</h1>
          <p className="text-sm text-muted-foreground">Consultez et acceptez vos devis</p>
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
              <Hash className="h-4 w-4 text-[#0F2D52]" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total devis</p>
              <p className="text-2xl font-bold">{quotes.length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-amber-50/60 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-amber-100 flex items-center justify-center">
              <Clock className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-amber-600">En attente</p>
              <p className="text-2xl font-bold">{quotes.filter((q) => q.status === "pending").length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-emerald-50/60 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-emerald-100 flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-emerald-600" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600">Acceptes</p>
              <p className="text-2xl font-bold">{quotes.filter((q) => q.status === "accepted").length}</p>
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center">
              <DollarSign className="h-4 w-4 text-[#0F2D52]" />
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Montant total</p>
              <p className="text-2xl font-bold">{formatCurrency(quotes.reduce((s, q) => s + q.amountTtc, 0))}</p>
            </div>
          </div>
        </div>
      </div>

      <DataTable
        data={quotes}
        columns={columns}
        getRowId={(r) => r.id}
        renderCard={renderCard}
        storageKey="portal-quotes"
        searchPlaceholder="Rechercher un devis..."
        searchFn={(r) => `${r.quoteNumber} ${r.title}`}
        filterOptions={FILTER_OPTIONS}
        filterFn={(r) => r.status}
        emptyMessage="Aucun devis"
      />

      {/* PDF preview modal */}
      {pdfQuote && (
        <PdfViewerModal
          open={!!pdfQuote}
          onClose={closePdf}
          pdfUrl={`/api/quotes/${pdfQuote.id}/pdf`}
          title={pdfQuote.title}
          documentNumber={pdfQuote.quoteNumber}
          date={pdfQuote.expiryDate ? `Expire le ${formatDate(new Date(pdfQuote.expiryDate))}` : undefined}
          downloadName={`devis-${pdfQuote.quoteNumber}`}
          actions={pdfActions}
        />
      )}

      {/* Signature overlay — appears on top of the PDF modal */}
      {pdfQuote && showSignature && (
        <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowSignature(false)} />
          <div className="relative z-10 w-full max-w-lg mx-4 mb-4 sm:mb-0 bg-white rounded-xl shadow-2xl overflow-hidden">
            <div className="bg-[#0F2D52] text-white px-5 py-3">
              <h3 className="font-semibold">Signez pour accepter le devis</h3>
              <p className="text-xs text-white/60">{pdfQuote.quoteNumber} — {formatCurrency(pdfQuote.amountTtc)}</p>
            </div>
            <div className="p-5">
              <p className="text-xs text-muted-foreground mb-3">
                En signant, vous acceptez le devis et un contrat sera automatiquement genere.
              </p>
              <SignatureCanvas
                onSave={handleSignAndAccept}
                width={460}
                height={180}
                disabled={accepting}
              />
              {accepting && (
                <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse">
                  Acceptation en cours...
                </p>
              )}
            </div>
            <div className="px-5 py-3 border-t flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => setShowSignature(false)} disabled={accepting}>
                Annuler
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

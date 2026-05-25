"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Receipt, Search, FileText, Send, Eye, ExternalLink, Mail, CheckCircle2,
  Calendar, CreditCard, Banknote, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type ReceiptRow = {
  id: number;
  paidAt: string | null;
  clientId: number | null;
  clientName: string;
  companyName: string | null;
  clientEmail: string | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
  amount: number;
  amountCad: number | null;
  currency: string;
  paymentMethod: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  receiptUrl: string | null;
  receiptNumber: string | null;
  receiptEmail: string | null;
  stripePaymentIntentId: string | null;
  internalReceiptUrl: string;
  isCardPayment: boolean;
};

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex",
  discover: "Discover", diners: "Diners", jcb: "JCB", unionpay: "UnionPay",
};

const METHOD_LABELS: Record<string, string> = {
  stripe: "Carte de crédit",
  interac: "Interac",
  cheque: "Chèque",
  virement: "Virement bancaire",
  comptant: "Comptant",
  manual: "Manuel",
  autre: "Autre",
};

// Presets de periode
function getPresetRange(preset: string): { from: string; to: string } | null {
  const now = new Date();
  const toIso = (d: Date) => d.toISOString().slice(0, 10);
  switch (preset) {
    case "30d": {
      const f = new Date(now); f.setDate(f.getDate() - 30);
      return { from: toIso(f), to: toIso(now) };
    }
    case "thisMonth": {
      const f = new Date(now.getFullYear(), now.getMonth(), 1);
      return { from: toIso(f), to: toIso(now) };
    }
    case "lastMonth": {
      const f = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const t = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: toIso(f), to: toIso(t) };
    }
    case "thisQuarter": {
      const q = Math.floor(now.getMonth() / 3);
      const f = new Date(now.getFullYear(), q * 3, 1);
      return { from: toIso(f), to: toIso(now) };
    }
    case "thisYear": {
      const f = new Date(now.getFullYear(), 0, 1);
      return { from: toIso(f), to: toIso(now) };
    }
    default:
      return null;
  }
}

export function ReceiptsView({
  receipts,
  kpis,
  dateRange,
  methodFilter,
}: {
  receipts: ReceiptRow[];
  kpis: { total: number; sentByEmail: number; withStripeUrl: number; totalAmount: number; cardCount: number; manualCount: number };
  dateRange: { from: string; to: string };
  methodFilter: "all" | "card" | "manual";
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { open: openEntity } = useEntityPanels();
  const [searchQuery, setSearchQuery] = useState("");
  const [resending, setResending] = useState<number | null>(null);
  const [from, setFrom] = useState(dateRange.from);
  const [to, setTo] = useState(dateRange.to);

  // PDF preview modal — le PDF du reçu est l'objet principal de cette page
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; downloadName?: string } | null>(null);

  // Ouvre le PDF du recu d'un Receipt row
  const openReceiptPdf = (r: ReceiptRow) => {
    setPdfPreview({
      url: r.internalReceiptUrl,
      title: `Reçu ${r.receiptNumber ?? `#${r.id}`} — ${r.clientName}`,
      downloadName: r.receiptNumber ?? `recu-${r.id}`,
    });
  };

  // Sticky scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // URL update
  const updateUrl = (overrides: Partial<{ from: string; to: string; method: string }>) => {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "" || v === "all") p.delete(k);
      else p.set(k, v);
    });
    router.push(`/admin/finance/receipts?${p.toString()}`);
  };

  const applyDates = () => updateUrl({ from, to });
  const clearDates = () => { setFrom(""); setTo(""); updateUrl({ from: "", to: "" }); };
  const applyPreset = (preset: string) => {
    const r = getPresetRange(preset);
    if (!r) return;
    setFrom(r.from); setTo(r.to);
    updateUrl({ from: r.from, to: r.to });
  };
  const changeMethod = (v: string) => updateUrl({ method: v });

  // Detection preset actif
  const activePreset = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return "noFilter";
    for (const k of ["30d", "thisMonth", "lastMonth", "thisQuarter", "thisYear"]) {
      const r = getPresetRange(k);
      if (r && r.from === dateRange.from && r.to === dateRange.to) return k;
    }
    return "custom";
  }, [dateRange.from, dateRange.to]);

  const filtered = useMemo(() => {
    if (!searchQuery) return receipts;
    const q = searchQuery.toLowerCase();
    return receipts.filter((r) =>
      r.clientName.toLowerCase().includes(q) ||
      (r.companyName?.toLowerCase().includes(q) ?? false) ||
      (r.invoiceNumber?.toLowerCase().includes(q) ?? false) ||
      (r.receiptNumber?.toLowerCase().includes(q) ?? false) ||
      (r.clientEmail?.toLowerCase().includes(q) ?? false)
    );
  }, [receipts, searchQuery]);

  const handleResend = async (r: ReceiptRow) => {
    setResending(r.id);
    try {
      const res = await fetch(`/api/payments/${r.id}/resend-receipt`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Reçu renvoyé à ${data.email ?? "client"}`);
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "Échec de l'envoi");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setResending(null);
    }
  };

  const columns: Column<ReceiptRow>[] = [
    {
      key: "number",
      header: "N° reçu",
      accessor: (r) => r.receiptNumber
        ? <span className="font-mono text-xs">{r.receiptNumber}</span>
        : r.invoiceNumber
          ? <span className="font-mono text-xs text-muted-foreground">{r.invoiceNumber}</span>
          : <span className="font-mono text-xs text-muted-foreground">RC-{String(r.id).padStart(5, "0")}</span>,
    },
    {
      key: "client",
      header: "Client",
      accessor: (r) => (
        <button
          onClick={(e) => { e.stopPropagation(); r.clientId && openEntity("client", r.clientId); }}
          className="text-left hover:underline"
        >
          <div className="font-medium text-sm">{r.clientName}</div>
          {r.companyName && <div className="text-[10px] text-muted-foreground">{r.companyName}</div>}
        </button>
      ),
      sortable: true, sortBy: (r) => r.clientName,
    },
    {
      key: "method",
      header: "Méthode",
      accessor: (r) => r.cardBrand ? (
        <div className="inline-flex items-center gap-1.5">
          <CreditCard className="h-3 w-3 text-indigo-600" />
          <span className="text-xs">{CARD_BRAND_LABELS[r.cardBrand] ?? r.cardBrand}</span>
          {r.cardLast4 && <span className="text-xs text-muted-foreground">···{r.cardLast4}</span>}
        </div>
      ) : (
        <div className="inline-flex items-center gap-1.5">
          <Banknote className="h-3 w-3 text-slate-600" />
          <span className="text-xs">{r.paymentMethod ? METHOD_LABELS[r.paymentMethod] ?? r.paymentMethod : "—"}</span>
        </div>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "amount",
      header: "Montant",
      accessor: (r) => (
        <div>
          <div className="font-bold tabular-nums">{r.amount.toFixed(2)} {r.currency}</div>
          {r.currency !== "CAD" && r.amountCad != null && (
            <div className="text-[10px] text-muted-foreground tabular-nums">≈ {formatCurrency(r.amountCad)}</div>
          )}
        </div>
      ),
      sortable: true, sortBy: (r) => Math.abs(r.amount),
    },
    {
      key: "email",
      header: "Envoyé à",
      accessor: (r) => r.receiptEmail
        ? <span className="text-xs inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-500" />{r.receiptEmail}</span>
        : r.clientEmail
          ? <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><Mail className="h-3 w-3" />{r.clientEmail}</span>
          : <span className="text-xs text-muted-foreground italic">aucun courriel</span>,
      hiddenOnMobile: true,
    },
    {
      key: "date",
      header: "Date",
      accessor: (r) => r.paidAt ? <span className="text-xs">{formatDate(new Date(r.paidAt))}</span> : "—",
      sortable: true, sortBy: (r) => r.paidAt ?? "",
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (r) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <ActionTooltip label="Prévisualiser le reçu VNK (PDF)">
            <button
              onClick={() => openReceiptPdf(r)}
              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              aria-label="Prévisualiser le reçu VNK"
            >
              <Eye className="h-3.5 w-3.5" />
            </button>
          </ActionTooltip>
          {r.receiptUrl && (
            <ActionTooltip label="Reçu officiel de la plateforme de paiement">
              <a
                href={r.receiptUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                aria-label="Reçu officiel de la plateforme"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </ActionTooltip>
          )}
          {r.clientEmail && (
            <ActionTooltip label="Renvoyer le reçu par courriel">
              <button
                onClick={() => handleResend(r)}
                disabled={resending === r.id}
                className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
                aria-label="Renvoyer le reçu par courriel"
              >
                <Send className={cn("h-3.5 w-3.5", resending === r.id && "animate-pulse")} />
              </button>
            </ActionTooltip>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Receipt className="h-5 w-5" />
              Reçus
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Reçus émis aux clients · PDF VNK officiel pour tous + reçu de la plateforme (cartes uniquement)
              {dateRange.from && ` · ${dateRange.from} → ${dateRange.to}`}
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total reçus</p>
          <p className="text-lg font-bold tabular-nums">{kpis.total}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.cardCount} carte · {kpis.manualCount} manuel</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Envoyés par courriel</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{kpis.sentByEmail}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.total > 0 ? Math.round((kpis.sentByEmail / kpis.total) * 100) : 0}% confirmés</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avec reçu plateforme</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{kpis.withStripeUrl}</p>
          <p className="text-[10px] text-muted-foreground">reçu officiel disponible</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Montant total</p>
          <p className="text-lg font-bold text-[#0F2D52] tabular-nums">{formatCurrency(kpis.totalAmount)}</p>
        </div>
      </div>

      {/* Sentinel — détecte fin des KPI */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Sticky compact bar — KPI seulement (pattern dashboard finance) */}
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Receipt className="h-4 w-4" />
              Reçus
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            <span className="text-muted-foreground">{kpis.sentByEmail}/{kpis.total} envoyés</span>
            <span className="text-muted-foreground">Total <span className="font-semibold">{formatCurrency(kpis.totalAmount)}</span></span>
          </div>
        </div>
      )}

      {/* Filtres en flow normal */}
      <div>
        {/* Première ligne : presets periode */}
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="text-[10px] text-muted-foreground mr-1">Période :</span>
          {[
            { k: "noFilter", l: "Tous" },
            { k: "30d", l: "30 jours" },
            { k: "thisMonth", l: "Ce mois" },
            { k: "lastMonth", l: "Mois dernier" },
            { k: "thisQuarter", l: "Ce trimestre" },
            { k: "thisYear", l: "Cette année" },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => p.k === "noFilter" ? clearDates() : applyPreset(p.k)}
              className={cn(
                "px-2 py-1 rounded text-[10px] font-medium border transition-colors",
                activePreset === p.k
                  ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                  : "bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
              )}
            >
              {p.l}
            </button>
          ))}
          {activePreset === "custom" && (
            <span className="px-2 py-1 rounded text-[10px] font-medium border bg-amber-50 text-amber-800 border-amber-200">
              Personnalisé
            </span>
          )}
        </div>

        {/* Recherche (mobile + desktop) + Dates (desktop only) + filtre methode */}
        <div className="flex flex-wrap items-end gap-2">
          {/* Recherche — visible mobile + desktop */}
          <div className="relative flex-1 min-w-[180px] max-w-md">
            <Label className="text-[10px]">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Client, n° reçu, n° facture, courriel…"
                className="pl-9 h-9 text-xs"
              />
            </div>
          </div>

          {/* Dates filtres */}
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <Label className="text-[10px]">Du</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
            </div>
            <div>
              <Label className="text-[10px]">Au</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
            </div>
            <Button onClick={applyDates} size="sm" className="h-9">
              <Calendar className="h-3.5 w-3.5 mr-1.5" />
              Appliquer
            </Button>
            {(dateRange.from || dateRange.to) && (
              <Button onClick={clearDates} size="sm" variant="ghost" className="h-9">
                <X className="h-3.5 w-3.5 mr-1" />
                Effacer
              </Button>
            )}
          </div>

          {/* Filtre methode */}
          <div className="flex bg-muted rounded-lg p-0.5 ml-auto">
            {[
              { key: "all", label: "Tous", icon: Receipt },
              { key: "card", label: "Carte", icon: CreditCard },
              { key: "manual", label: "Manuel", icon: Banknote },
            ].map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.key}
                  onClick={() => changeMethod(tab.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                    methodFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder=""
        exportFilename="recus"
        storageKey="admin-finance-receipts"
        onRowClick={(r) => openReceiptPdf(r)}
        emptyMessage={
          searchQuery || methodFilter !== "all" || dateRange.from || dateRange.to
            ? "Aucun reçu ne correspond aux filtres."
            : "Aucun reçu pour le moment. Les reçus sont générés automatiquement à chaque paiement complété."
        }
      />

      {/* PDF preview du reçu (modal principal de la page) */}
      {pdfPreview && (
        <PdfViewerModal
          open={!!pdfPreview}
          onClose={() => setPdfPreview(null)}
          pdfUrl={pdfPreview.url}
          title={pdfPreview.title}
          downloadName={pdfPreview.downloadName}
        />
      )}
    </div>
  );
}

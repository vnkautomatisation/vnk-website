"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { toast } from "sonner";
import {
  Receipt, Search, FileText, Send, Eye, ExternalLink, Mail, CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/data-table/data-table";
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
};

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex", discover: "Discover",
};

export function ReceiptsView({ receipts, kpis }: {
  receipts: ReceiptRow[];
  kpis: { total: number; sentByEmail: number; withStripeUrl: number; totalAmount: number };
}) {
  const { open: openEntity } = useEntityPanels();
  const [searchQuery, setSearchQuery] = useState("");
  const [resending, setResending] = useState<number | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
      if (res.ok) toast.success("Reçu renvoyé par courriel");
      else {
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
          onClick={() => r.clientId && openEntity("client", r.clientId)}
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
        <div>
          <span className="text-xs">{CARD_BRAND_LABELS[r.cardBrand] ?? r.cardBrand}</span>
          {r.cardLast4 && <span className="text-xs text-muted-foreground"> ···{r.cardLast4}</span>}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">{r.paymentMethod ?? "—"}</span>
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
        <div className="flex items-center gap-1">
          <a
            href={r.internalReceiptUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Voir reçu PDF VNK"
          >
            <Eye className="h-3.5 w-3.5" />
          </a>
          {r.receiptUrl && (
            <a
              href={r.receiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Reçu Stripe officiel"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
          {r.clientEmail && (
            <button
              onClick={() => handleResend(r)}
              disabled={resending === r.id}
              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground disabled:opacity-50"
              title="Renvoyer par courriel"
            >
              <Send className={cn("h-3.5 w-3.5", resending === r.id && "animate-pulse")} />
            </button>
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
              Reçus de paiement émis aux clients · PDF VNK officiel + lien Stripe (si disponible)
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total reçus</p>
          <p className="text-lg font-bold tabular-nums">{kpis.total}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Envoyés par courriel</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{kpis.sentByEmail}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.total > 0 ? Math.round((kpis.sentByEmail / kpis.total) * 100) : 0}% confirmés</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avec lien Stripe</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{kpis.withStripeUrl}</p>
          <p className="text-[10px] text-muted-foreground">reçu hébergé Stripe</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Montant total</p>
          <p className="text-lg font-bold text-[#0F2D52] tabular-nums">{formatCurrency(kpis.totalAmount)}</p>
        </div>
      </div>

      {/* Sentinel + sticky bar */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      <div
        className={cn(
          "sticky top-[64px] z-20 bg-background -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-shadow",
          scrolled && "shadow-sm border-b backdrop-blur"
        )}
      >
        {scrolled && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Receipt className="h-4 w-4" />
              Reçus
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            <span className="text-muted-foreground">{kpis.sentByEmail}/{kpis.total} envoyés</span>
            <span className="text-muted-foreground">Total <span className="font-semibold">{formatCurrency(kpis.totalAmount)}</span></span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Client, n° reçu, n° facture, courriel…" className="pl-9 h-9" />
          </div>
          <Button variant="outline" size="sm" className="h-9" asChild>
            <a href="/api/payments/export?type=receipts" target="_blank" rel="noreferrer">
              <FileText className="h-3.5 w-3.5 mr-1.5" />
              Export complet
            </a>
          </Button>
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
        emptyMessage="Aucun reçu pour le moment. Les reçus sont générés automatiquement à chaque paiement reçu."
      />
    </div>
  );
}

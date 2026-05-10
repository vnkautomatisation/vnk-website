"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  CreditCard, Search, Filter, TrendingUp, RotateCcw, AlertTriangle, Coins, ArrowUpRight, ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Payment = {
  id: number;
  invoiceId: number | null;
  invoiceNumber: string | null;
  clientId: number | null;
  clientName: string;
  companyName: string | null;
  country: string | null;
  amount: number;
  amountCad: number | null;
  currency: string;
  fxRate: number | null;
  fxRateSource: string | null;
  processingFee: number | null;
  netAmount: number | null;
  status: string;
  type: string;
  paymentMethod: string | null;
  paidAt: string | null;
  settledAt: string | null;
  payoutAt: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardCountry: string | null;
  cardholderName: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripePayoutId: string | null;
  stripeBalanceTxId: string | null;
  stripeReceiptUrl: string | null;
};

type Kpis = {
  total: number;
  totalNet: number;
  totalFees: number;
  byType: Record<string, { count: number; total: number }>;
};

type TypeFilter = "all" | "charge" | "refund" | "chargeback" | "chargeback_fee" | "adjustment" | "topup";

const TYPE_LABELS: Record<string, { label: string; color: string }> = {
  charge: { label: "Crédit", color: "bg-emerald-100 text-emerald-700" },
  refund: { label: "Remboursement", color: "bg-amber-100 text-amber-700" },
  chargeback: { label: "Rétrofacturation", color: "bg-red-100 text-red-700" },
  chargeback_fee: { label: "Frais rétrofact.", color: "bg-rose-100 text-rose-700" },
  adjustment: { label: "Ajustement", color: "bg-purple-100 text-purple-700" },
  topup: { label: "Fonds ajoutés", color: "bg-blue-100 text-blue-700" },
};

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "charge", label: "Crédits" },
  { key: "refund", label: "Remboursements" },
  { key: "chargeback", label: "Rétrofacturations" },
  { key: "chargeback_fee", label: "Frais rétrofact." },
  { key: "adjustment", label: "Ajustements" },
  { key: "topup", label: "Fonds ajoutés" },
];

const COUNTRY_FLAGS: Record<string, string> = {
  CA: "🇨🇦", US: "🇺🇸", FR: "🇫🇷", DE: "🇩🇪", GB: "🇬🇧",
  IT: "🇮🇹", ES: "🇪🇸", BE: "🇧🇪", CH: "🇨🇭",
};

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex",
  discover: "Discover", diners: "Diners", jcb: "JCB", unionpay: "UnionPay",
};

export function PaymentsView({ payments, kpis }: { payments: Payment[]; kpis: Kpis }) {
  const { open: openEntity } = useEntityPanels();
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");

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

  const currencies = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => set.add(p.currency));
    return Array.from(set).sort();
  }, [payments]);

  const filtered = useMemo(() => {
    let result = payments;
    if (typeFilter !== "all") result = result.filter((p) => (p.type ?? "charge") === typeFilter);
    if (currencyFilter !== "all") result = result.filter((p) => p.currency === currencyFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.clientName.toLowerCase().includes(q) ||
        (p.companyName?.toLowerCase().includes(q) ?? false) ||
        (p.invoiceNumber?.toLowerCase().includes(q) ?? false) ||
        (p.stripePaymentIntentId?.toLowerCase().includes(q) ?? false) ||
        (p.cardLast4?.includes(q) ?? false) ||
        (p.cardholderName?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [payments, typeFilter, currencyFilter, searchQuery]);

  const columns: Column<Payment>[] = [
    {
      key: "type",
      header: "Type",
      accessor: (p) => {
        const meta = TYPE_LABELS[p.type] ?? { label: p.type, color: "bg-gray-100 text-gray-700" };
        return <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-medium", meta.color)}>{meta.label}</span>;
      },
    },
    {
      key: "client",
      header: "Client",
      accessor: (p) => (
        <button
          onClick={() => p.clientId && openEntity("client", p.clientId)}
          className="text-left hover:underline"
        >
          <div className="font-medium text-sm">{p.clientName}</div>
          {p.companyName && <div className="text-[10px] text-muted-foreground">{p.companyName}</div>}
        </button>
      ),
      sortable: true, sortBy: (p) => p.clientName,
    },
    {
      key: "card",
      header: "Carte / méthode",
      accessor: (p) => p.cardBrand ? (
        <div>
          <span className="text-xs font-medium">{CARD_BRAND_LABELS[p.cardBrand] ?? p.cardBrand}</span>
          {p.cardLast4 && <span className="text-xs text-muted-foreground"> ···{p.cardLast4}</span>}
          {p.cardCountry && <span className="text-[10px] text-muted-foreground ml-1">{COUNTRY_FLAGS[p.cardCountry] ?? p.cardCountry}</span>}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">{p.paymentMethod ?? "—"}</span>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "amount",
      header: "Montant",
      accessor: (p) => (
        <div>
          <div className={cn("font-bold tabular-nums", p.amount < 0 ? "text-red-600" : "")}>
            {p.amount < 0 ? "−" : ""}{Math.abs(p.amount).toFixed(2)} {p.currency}
          </div>
          {p.currency !== "CAD" && p.amountCad != null && (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              ≈ {formatCurrency(Math.abs(p.amountCad))}
            </div>
          )}
        </div>
      ),
      sortable: true, sortBy: (p) => Math.abs(p.amount),
    },
    {
      key: "fees",
      header: "Frais",
      accessor: (p) => p.processingFee != null
        ? <span className="text-xs tabular-nums text-muted-foreground">{p.processingFee.toFixed(2)}</span>
        : <span className="text-xs text-muted-foreground italic">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "net",
      header: "Net",
      accessor: (p) => p.netAmount != null
        ? <span className="text-sm font-semibold tabular-nums">{p.netAmount.toFixed(2)}</span>
        : <span className="text-xs text-muted-foreground italic">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "paidAt",
      header: "Date",
      accessor: (p) => p.paidAt ? <span className="text-xs">{formatDate(new Date(p.paidAt))}</span> : "—",
      sortable: true, sortBy: (p) => p.paidAt ?? "",
    },
    {
      key: "status",
      header: "Statut",
      accessor: (p) => <StatusBadge status={p.status} />,
    },
    {
      key: "stripe",
      header: "Stripe",
      accessor: (p) => p.stripePaymentIntentId ? (
        <a
          href={`https://dashboard.stripe.com/payments/${p.stripePaymentIntentId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="font-mono truncate max-w-[80px]">{p.stripePaymentIntentId.slice(0, 14)}…</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : "—",
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Tous les paiements
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Vue plate de toutes les transactions individuelles · {payments.length} entrées · {currencies.length} devise{currencies.length > 1 ? "s" : ""}
            </p>
          </div>
          <Link href="/admin/finance/settlements" className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur">
            Rapport de règlement <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* KPIs par type */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Crédits</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.byType.charge?.total ?? 0)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.byType.charge?.count ?? 0} paiement{(kpis.byType.charge?.count ?? 0) > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Remboursés</span>
            <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(Math.abs(kpis.byType.refund?.total ?? 0))}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.byType.refund?.count ?? 0} entrée{(kpis.byType.refund?.count ?? 0) > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Rétrofact.</span>
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(Math.abs(kpis.byType.chargeback?.total ?? 0))}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.byType.chargeback?.count ?? 0} entrée{(kpis.byType.chargeback?.count ?? 0) > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Net total</span>
            <Coins className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-[#0F2D52] tabular-nums">{formatCurrency(kpis.totalNet)}</p>
          <p className="text-[10px] text-muted-foreground">après {formatCurrency(kpis.totalFees)} de frais</p>
        </div>
      </div>

      {/* Sentinel + sticky compact bar */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />

      <div
        className={cn(
          "sticky top-[64px] z-20 bg-background -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-shadow",
          scrolled && "shadow-sm border-b backdrop-blur"
        )}
      >
        {scrolled && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <CreditCard className="h-4 w-4" />
              Tous les paiements
            </span>
            <span className="font-semibold text-[#0F2D52]">{filtered.length} affichés</span>
            <span className="text-muted-foreground">Crédits : <span className="font-semibold text-emerald-600">{formatCurrency(kpis.byType.charge?.total ?? 0)}</span></span>
            <span className="text-muted-foreground">Remb. : <span className="font-semibold text-amber-600">{formatCurrency(Math.abs(kpis.byType.refund?.total ?? 0))}</span></span>
            <span className="text-muted-foreground">Net : <span className="font-semibold">{formatCurrency(kpis.totalNet)}</span></span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Client, facture, ID Stripe, last4…" className="pl-9 h-9" />
          </div>
          <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                  typeFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {currencies.length > 1 && (
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Filtrer par devise"
            >
              <option value="all">Toutes devises</option>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1.5">
            <Filter className="h-3 w-3" />
            {filtered.length} sur {payments.length}
          </span>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(p) => p.id}
        searchPlaceholder=""
        exportFilename="paiements"
        storageKey="admin-finance-payments"
      />
    </div>
  );
}

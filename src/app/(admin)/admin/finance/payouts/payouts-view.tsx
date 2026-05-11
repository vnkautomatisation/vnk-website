"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Banknote, Search, ArrowDownToLine, CheckCircle2, Clock, XCircle, ExternalLink, ArrowUpRight,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Payout = {
  id: number;
  stripePayoutId: string;
  amount: number;
  currency: string;
  status: string;
  arrivalDate: string | null;
  initiatedAt: string;
  paidAt: string | null;
  method: string | null;
  destinationLast4: string | null;
  destinationBank: string | null;
  failureReason: string | null;
  description: string | null;
  itemCount: number;
  feeTotal: number;
  paymentCount: number;
  paymentSum: number;
};

type Kpis = {
  count: number;
  countPaid: number;
  countPending: number;
  countFailed: number;
  totalPaid: number;
  totalPending: number;
  totalFailed: number;
};

type StatusFilter = "all" | "paid" | "pending" | "in_transit" | "failed" | "canceled";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "paid", label: "Versés" },
  { key: "in_transit", label: "En transit" },
  { key: "pending", label: "En attente" },
  { key: "failed", label: "Échoués" },
  { key: "canceled", label: "Annulés" },
];

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  paid: { label: "Versé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  in_transit: { label: "En transit", color: "bg-blue-100 text-blue-700", icon: ArrowDownToLine },
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: Clock },
  failed: { label: "Échoué", color: "bg-red-100 text-red-700", icon: XCircle },
  canceled: { label: "Annulé", color: "bg-gray-100 text-gray-700", icon: XCircle },
};

export function PayoutsView({ payouts, kpis }: { payouts: Payout[]; kpis: Kpis }) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

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

  const filtered = useMemo(() => {
    let result = payouts;
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.stripePayoutId.toLowerCase().includes(q) ||
        (p.destinationLast4?.includes(q) ?? false) ||
        (p.destinationBank?.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [payouts, statusFilter, searchQuery]);

  const columns: Column<Payout>[] = [
    {
      key: "status",
      header: "Statut",
      accessor: (p) => {
        const m = STATUS_META[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-700", icon: Clock };
        const Icon = m.icon;
        return <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium", m.color)}><Icon className="h-3 w-3" />{m.label}</span>;
      },
    },
    {
      key: "arrival",
      header: "Date arrivée",
      accessor: (p) => p.arrivalDate ? <span className="text-sm">{formatDate(new Date(p.arrivalDate))}</span> : "—",
      sortable: true, sortBy: (p) => p.arrivalDate ?? "",
    },
    {
      key: "amount",
      header: "Montant",
      accessor: (p) => (
        <div>
          <div className="font-bold tabular-nums">{formatCurrency(p.amount)}</div>
          <div className="text-[10px] text-muted-foreground">{p.currency}</div>
        </div>
      ),
      sortable: true, sortBy: (p) => p.amount,
    },
    {
      key: "items",
      header: "Paiements",
      accessor: (p) => (
        <div>
          <div className="text-sm font-semibold">{p.paymentCount} liés</div>
          <div className="text-[10px] text-muted-foreground">{formatCurrency(p.paymentSum)}</div>
        </div>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "destination",
      header: "Destination",
      accessor: (p) => p.destinationBank ? (
        <div>
          <div className="text-sm">{p.destinationBank}</div>
          {p.destinationLast4 && <div className="text-[10px] text-muted-foreground font-mono">···{p.destinationLast4}</div>}
        </div>
      ) : (
        <span className="text-xs text-muted-foreground italic">—</span>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "method",
      header: "Méthode",
      accessor: (p) => <span className="text-xs">{p.method === "instant" ? "Instantané" : p.method === "standard" ? "Standard" : p.method ?? "—"}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "fees",
      header: "Frais",
      accessor: (p) => p.feeTotal > 0
        ? <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(p.feeTotal)}</span>
        : <span className="text-xs text-muted-foreground italic">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "stripe",
      header: "Référence",
      accessor: (p) => (
        <a
          href={`https://dashboard.stripe.com/payouts/${p.stripePayoutId}`}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <span className="font-mono truncate max-w-[80px]">{p.stripePayoutId.slice(0, 14)}…</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "drilldown",
      header: "",
      accessor: (p) => (
        <Link
          href={`/admin/finance/payments?payoutId=${p.stripePayoutId}`}
          className="text-xs text-[#0F2D52] hover:underline inline-flex items-center gap-1"
        >
          Voir détails <ArrowUpRight className="h-3 w-3" />
        </Link>
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
              <Banknote className="h-5 w-5" />
              Versements
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Transferts vers votre compte bancaire · {payouts.length} versements
            </p>
          </div>
          <Link href="/admin/finance/settlements" className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur">
            Rapport de règlement <ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Versés</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.totalPaid)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.countPaid} versement{kpis.countPaid > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">En attente / transit</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(kpis.totalPending)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.countPending} en cours</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Échoués</p>
          <p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(kpis.totalFailed)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.countFailed} à investiguer</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-lg font-bold tabular-nums">{kpis.count}</p>
          <p className="text-[10px] text-muted-foreground">versements suivis</p>
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
              <Banknote className="h-4 w-4" />
              Versements
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            <span className="text-muted-foreground">Versés <span className="font-semibold text-emerald-600">{formatCurrency(kpis.totalPaid)}</span></span>
            <span className="text-muted-foreground">En cours <span className="font-semibold text-amber-600">{formatCurrency(kpis.totalPending)}</span></span>
            {kpis.countFailed > 0 && (
              <span className="text-muted-foreground">Échoués <span className="font-semibold text-red-600">{formatCurrency(kpis.totalFailed)}</span></span>
            )}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Référence, banque, 4 derniers chiffres…" className="pl-9 h-9" />
          </div>
          <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                  statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(p) => p.id}
        searchPlaceholder=""
        exportFilename="versements"
        storageKey="admin-finance-payouts"
        emptyMessage="Aucun versement enregistré pour le moment. Les versements apparaîtront automatiquement dès que vos premiers fonds seront débloqués."
      />
    </div>
  );
}

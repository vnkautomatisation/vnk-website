"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  Banknote, Search, ArrowDownToLine, CheckCircle2, Clock, XCircle, ExternalLink, ArrowUpRight,
  Calendar, Eye, X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { PayoutDetailDialog } from "./payout-detail-dialog";

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
  clientNames: string;
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

const STATUS_TABS: { key: StatusFilter; label: string; tooltip: string }[] = [
  { key: "all", label: "Tous", tooltip: "Tous les versements" },
  { key: "paid", label: "Versés", tooltip: "Fonds reçus en banque" },
  { key: "in_transit", label: "En transit", tooltip: "Versement initié, en route vers la banque" },
  { key: "pending", label: "En attente", tooltip: "Versement créé, pas encore initié" },
  { key: "failed", label: "Échoués", tooltip: "Versement échoué — fonds retournés dans votre solde" },
  { key: "canceled", label: "Annulés", tooltip: "Versement annulé avant exécution" },
];

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2; tooltip: string }> = {
  paid: { label: "Versé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, tooltip: "Fonds reçus en banque" },
  in_transit: { label: "En transit", color: "bg-blue-100 text-blue-700", icon: ArrowDownToLine, tooltip: "En route vers la banque" },
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: Clock, tooltip: "Versement créé, pas encore initié" },
  failed: { label: "Échoué", color: "bg-red-100 text-red-700", icon: XCircle, tooltip: "Versement échoué — vérifier les informations bancaires" },
  canceled: { label: "Annulé", color: "bg-gray-100 text-gray-700", icon: XCircle, tooltip: "Versement annulé" },
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

export function PayoutsView({
  payouts,
  kpis,
  dateRange,
}: {
  payouts: Payout[];
  kpis: Kpis;
  dateRange: { from: string; to: string };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [from, setFrom] = useState(dateRange.from);
  const [to, setTo] = useState(dateRange.to);

  // Modal détail
  const [detailPayoutId, setDetailPayoutId] = useState<number | null>(null);

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

  // URL update pour dates
  const updateUrl = (overrides: Partial<{ from: string; to: string }>) => {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "") p.delete(k);
      else p.set(k, v);
    });
    router.push(`/admin/finance/payouts?${p.toString()}`);
  };

  const applyDates = () => updateUrl({ from, to });
  const clearDates = () => { setFrom(""); setTo(""); updateUrl({ from: "", to: "" }); };
  const applyPreset = (preset: string) => {
    const r = getPresetRange(preset);
    if (!r) return;
    setFrom(r.from); setTo(r.to);
    updateUrl({ from: r.from, to: r.to });
  };

  // Détection preset actif
  const activePreset = useMemo(() => {
    if (!dateRange.from && !dateRange.to) return "noFilter";
    for (const k of ["30d", "thisMonth", "lastMonth", "thisQuarter", "thisYear"]) {
      const r = getPresetRange(k);
      if (r && r.from === dateRange.from && r.to === dateRange.to) return k;
    }
    return "custom";
  }, [dateRange.from, dateRange.to]);

  const filtered = useMemo(() => {
    let result = payouts;
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.stripePayoutId.toLowerCase().includes(q) ||
        (p.destinationLast4?.includes(q) ?? false) ||
        (p.destinationBank?.toLowerCase().includes(q) ?? false) ||
        (p.description?.toLowerCase().includes(q) ?? false) ||
        p.clientNames.toLowerCase().includes(q)
      );
    }
    return result;
  }, [payouts, statusFilter, searchQuery]);

  const columns: Column<Payout>[] = [
    {
      key: "status",
      header: "Statut",
      accessor: (p) => {
        const m = STATUS_META[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-700", icon: Clock, tooltip: p.status };
        const Icon = m.icon;
        return (
          <span
            className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium", m.color)}
            title={m.tooltip}
          >
            <Icon className="h-3 w-3" />{m.label}
          </span>
        );
      },
    },
    {
      key: "arrival",
      header: "Date arrivée",
      accessor: (p) => p.arrivalDate ? <span className="text-sm">{formatDate(new Date(p.arrivalDate))}</span> : <span className="text-xs text-muted-foreground italic">—</span>,
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
      accessor: (p) => <span className="text-xs" title={p.method === "instant" ? "Versement instantané — frais supplémentaires" : p.method === "standard" ? "Versement standard — gratuit" : ""}>
        {p.method === "instant" ? "Instantané" : p.method === "standard" ? "Standard" : p.method ?? "—"}
      </span>,
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
        <ActionTooltip label="Ouvrir le versement sur la plateforme de paiement">
          <a
            href={`https://dashboard.stripe.com/payouts/${p.stripePayoutId}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label="Ouvrir le versement sur la plateforme"
          >
            <span className="font-mono truncate max-w-[80px]">{p.stripePayoutId.slice(0, 14)}…</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </ActionTooltip>
      ),
      hiddenOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      accessor: (p) => (
        <ActionTooltip label="Voir détail du versement">
          <button
            onClick={(e) => { e.stopPropagation(); setDetailPayoutId(p.id); }}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label="Voir détail du versement"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </ActionTooltip>
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
              Transferts vers votre compte bancaire · {kpis.count} versement{kpis.count > 1 ? "s" : ""}
              {dateRange.from && ` · ${dateRange.from} → ${dateRange.to}`}
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

        {/* Deuxième ligne : recherche + dates + tabs statut */}
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

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Label className="text-[10px]">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Référence, banque, client…"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto ml-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                title={tab.tooltip}
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
        onRowClick={(p) => setDetailPayoutId(p.id)}
        emptyMessage={
          searchQuery || statusFilter !== "all" || dateRange.from || dateRange.to
            ? "Aucun versement ne correspond aux filtres."
            : "Aucun versement enregistré pour le moment. Les versements apparaîtront automatiquement dès que vos premiers fonds seront débloqués."
        }
      />

      {/* Modal détail */}
      <PayoutDetailDialog
        payoutId={detailPayoutId}
        open={detailPayoutId !== null}
        onOpenChange={(o) => { if (!o) setDetailPayoutId(null); }}
      />

      {/* Note pédagogique */}
      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
        <p className="font-semibold">Comprendre les versements</p>
        <p>Un versement regroupe plusieurs paiements clients dans un seul transfert vers votre compte bancaire (ex : tous les paiements reçus lundi → un versement mercredi). Cliquez sur un versement pour voir la liste des paiements composant le montant.</p>
        <p className="pt-1"><strong>Cycle</strong> : Paiement client → Règlement (fonds disponibles) → Versement (vers votre banque). Au Canada, le délai standard est de 2 à 5 jours ouvrés.</p>
      </div>
    </div>
  );
}

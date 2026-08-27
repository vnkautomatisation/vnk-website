"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
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

const STATUS_TABS: { key: StatusFilter; labelKey: string; tooltipKey: string }[] = [
  { key: "all", labelKey: "tous", tooltipKey: "versements" },
  { key: "paid", labelKey: "verses", tooltipKey: "fonds_recus_banque" },
  { key: "in_transit", labelKey: "transit", tooltipKey: "versement_initie_route_vers_banque" },
  { key: "pending", labelKey: "attente", tooltipKey: "versement_cree_pas_encore_initie" },
  { key: "failed", labelKey: "echoues", tooltipKey: "versement_echoue_fonds_retournes_votre" },
  { key: "canceled", labelKey: "annules", tooltipKey: "versement_annule_avant_execution" },
];

const STATUS_META: Record<string, { labelKey: string; color: string; icon: typeof CheckCircle2; tooltipKey: string }> = {
  paid: { labelKey: "verse", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2, tooltipKey: "fonds_recus_banque" },
  in_transit: { labelKey: "transit", color: "bg-blue-100 text-blue-700", icon: ArrowDownToLine, tooltipKey: "route_vers_banque" },
  pending: { labelKey: "attente", color: "bg-amber-100 text-amber-700", icon: Clock, tooltipKey: "versement_cree_pas_encore_initie" },
  failed: { labelKey: "echoue", color: "bg-red-100 text-red-700", icon: XCircle, tooltipKey: "versement_echoue_verifier_informations_bancaires" },
  canceled: { labelKey: "annule", color: "bg-gray-100 text-gray-700", icon: XCircle, tooltipKey: "versement_annule" },
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
  const t = useTranslations("admin.payouts");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [from, setFrom] = useState(dateRange.from);
  const [to, setTo] = useState(dateRange.to);


  const [detailPayoutId, setDetailPayoutId] = useState<number | null>(null);


  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);


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
      header: t("statut"),
      accessor: (p) => {
        const m = STATUS_META[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-700", icon: Clock, tooltip: p.status };
        const Icon = m.icon;
        return (
          <span
            className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium", m.color)}
            title={t(m.tooltipKey)}
          >
            <Icon className="h-3 w-3" />{t(m.labelKey)}
          </span>
        );
      },
    },
    {
      key: "arrival",
      header: t("date_arrivee"),
      accessor: (p) => p.arrivalDate ? <span className="text-sm">{formatDate(new Date(p.arrivalDate))}</span> : <span className="text-xs text-muted-foreground italic">—</span>,
      sortable: true, sortBy: (p) => p.arrivalDate ?? "",
    },
    {
      key: "amount",
      header: t("montant"),
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
      header: t("paiements"),
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
      header: t("destination"),
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
      header: t("methode"),
      accessor: (p) => <span className="text-xs" title={p.method === "instant" ? t("versement_instantane_frais") : p.method === "standard" ? t("versement_standard_gratuit") : ""}>
        {p.method === "instant" ? t("instantane") : p.method === "standard" ? t("standard") : p.method ?? "—"}
      </span>,
      hiddenOnMobile: true,
    },
    {
      key: "fees",
      header: t("frais"),
      accessor: (p) => p.feeTotal > 0
        ? <span className="text-xs tabular-nums text-muted-foreground">{formatCurrency(p.feeTotal)}</span>
        : <span className="text-xs text-muted-foreground italic">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "stripe",
      header: t("reference"),
      accessor: (p) => (
        <ActionTooltip label={t("ouvrir_versement_plateforme_paiement")}>
          <a
            href={`https://dashboard.stripe.com/payouts/${p.stripePayoutId}`}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
            aria-label={t("ouvrir_versement_plateforme")}
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
        <ActionTooltip label={t("voir_detail_versement")}>
          <button
            onClick={(e) => { e.stopPropagation(); setDetailPayoutId(p.id); }}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            aria-label={t("voir_detail_versement")}
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </ActionTooltip>
      ),
    },
  ];

  return (
    <div className="space-y-5">

      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              {t("versements")}
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Transferts vers votre compte bancaire · {kpis.count} versement{kpis.count > 1 ? "s" : ""}
              {dateRange.from && ` · ${dateRange.from} → ${dateRange.to}`}
            </p>
          </div>
          <Link href="/admin/finance/settlements" className="text-xs text-white/80 hover:text-white inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/10 hover:bg-white/20 backdrop-blur">{t("payouts_view_rapport_de_reglement")}<ArrowUpRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("verses")}</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.totalPaid)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.countPaid} versement{kpis.countPaid > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("attente_transit")}</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(kpis.totalPending)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.countPending} en cours</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("echoues")}</p>
          <p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(kpis.totalFailed)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.countFailed} à investiguer</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("total")}</p>
          <p className="text-lg font-bold tabular-nums">{kpis.count}</p>
          <p className="text-[10px] text-muted-foreground">{t("versements_suivis")}</p>
        </div>
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Banknote className="h-4 w-4" />
              {t("versements")}
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            <span className="text-muted-foreground">{t("verses")} <span className="font-semibold text-emerald-600">{formatCurrency(kpis.totalPaid)}</span></span>
            <span className="text-muted-foreground">{t("cours")} <span className="font-semibold text-amber-600">{formatCurrency(kpis.totalPending)}</span></span>
            {kpis.countFailed > 0 && (
              <span className="text-muted-foreground">{t("echoues")} <span className="font-semibold text-red-600">{formatCurrency(kpis.totalFailed)}</span></span>
            )}
          </div>
        </div>
      )}


      <div>

        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="text-[10px] text-muted-foreground mr-1">{t("periode")}</span>
          {[
            { k: "noFilter", l: t("tous") },
            { k: "30d", l: t("30_jours") },
            { k: "thisMonth", l: t("mois") },
            { k: "lastMonth", l: t("mois_dernier") },
            { k: "thisQuarter", l: t("trimestre") },
            { k: "thisYear", l: t("annee") },
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
              {t("personnalise")}
            </span>
          )}
        </div>


        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-[10px]">{t("du")}</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div>
            <Label className="text-[10px]">{t("au")}</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="h-9 w-36" />
          </div>
          <Button onClick={applyDates} size="sm" className="h-9">
            <Calendar className="h-3.5 w-3.5 mr-1.5" />
            {t("appliquer")}
          </Button>
          {(dateRange.from || dateRange.to) && (
            <Button onClick={clearDates} size="sm" variant="ghost" className="h-9">
              <X className="h-3.5 w-3.5 mr-1" />
              {t("effacer")}
            </Button>
          )}

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Label className="text-[10px]">{t("recherche")}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("reference_banque_client")}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto ml-auto">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                title={t(tab.tooltipKey)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                  statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t(tab.labelKey)}
              </button>
            ))}
          </div>
        </div>
      </div>


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
            ? t("aucun_versement_ne_correspond_filtres")
            : t("aucun_versement_enregistre_moment")
        }
      />


      <PayoutDetailDialog
        payoutId={detailPayoutId}
        open={detailPayoutId !== null}
        onOpenChange={(o) => { if (!o) setDetailPayoutId(null); }}
      />


      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
        <p className="font-semibold">{t("comprendre_versements")}</p>
        <p>{t("versement_regroupe_plusieurs_paiements_clients")}</p>
        <p className="pt-1"><strong>{t("cycle")}</strong>{t("cycle_detail")}</p>
      </div>
    </div>
  );
}

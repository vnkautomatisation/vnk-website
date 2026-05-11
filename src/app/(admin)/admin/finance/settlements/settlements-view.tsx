"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText, Download, Calendar, TrendingUp, RotateCcw, AlertTriangle, Eye, Search,
  ArrowUp, ArrowDown, ArrowUpDown, Banknote, CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { getStatusDisplay, TYPE_META, TYPE_LABELS } from "@/lib/payment-status";
import { PaymentDetailDialog } from "@/app/(admin)/admin/transactions/payment-detail-dialog";

type Row = {
  id: number;
  paidAt: string | null;
  settledAt: string | null;
  payoutAt: string | null;
  clientName: string;
  cardholderName: string;
  type: string;
  status: string;
  amount: number;
  currency: string;
  processingFee: number | null;
  netAmount: number | null;
  stripePaymentIntentId: string | null;
  paymentMethod: string | null;
  stripeBalanceTxId: string | null;
  stripePayoutId: string | null;
  invoiceNumber: string | null;
};

type Kpis = {
  count: number;
  totalGross: number;
  totalFees: number;
  totalNet: number;
  chargeCount: number;
  refundCount: number;
  chargebackCount: number;
};

type DateField = "paidAt" | "settledAt" | "payoutAt";
type SortKey = "paidAt" | "settledAt" | "payoutAt" | "clientName" | "amount" | "type" | "status";
type SortDir = "asc" | "desc";

const FILTER_BY_OPTIONS: { value: DateField; label: string; description: string }[] = [
  { value: "paidAt", label: "Date de paiement", description: "Quand le client a payé" },
  { value: "settledAt", label: "Date de règlement", description: "Quand les fonds sont disponibles" },
  { value: "payoutAt", label: "Date de versement", description: "Quand l'argent arrive en banque" },
];

const TYPE_FILTER_TABS = [
  { key: "all", label: "Tous" },
  { key: "charge", label: "Ventes" },
  { key: "refund", label: "Remboursements" },
  { key: "chargeback", label: "Rétrofact." },
  { key: "chargeback_fee", label: "Frais rétrofact." },
  { key: "adjustment", label: "Ajustements" },
  { key: "topup", label: "Fonds ajoutés" },
] as const;

const PAGE_SIZE_OPTIONS = [25, 50, 100, 200];

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function formatDateOnly(iso: string | null): string {
  if (!iso) return "N/A";
  return iso.slice(0, 10);
}

// Helper : determine si un paiement est manuel (pas de paiement en ligne par carte)
function isManualPayment(r: Row): boolean {
  return !r.stripePaymentIntentId && !r.stripeBalanceTxId;
}

// Affichage uniformise pour cellules vides selon contexte
function emptyCell(isManual: boolean, label = "Manuel") {
  return isManual
    ? <span className="text-[10px] italic text-muted-foreground/70" title="Paiement saisi manuellement — pas de référence de paiement en ligne">{label}</span>
    : <span className="text-[10px] italic text-amber-700" title="Donnée pas encore reçue (confirmation automatique en attente)">En attente</span>;
}

// Compute date range for a preset
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
    case "lastYear": {
      const f = new Date(now.getFullYear() - 1, 0, 1);
      const t = new Date(now.getFullYear() - 1, 11, 31);
      return { from: toIso(f), to: toIso(t) };
    }
    default:
      return null;
  }
}

export function SettlementsView({
  rows,
  kpis,
  dateRange,
  filterBy,
  typeFilter,
}: {
  rows: Row[];
  kpis: Kpis;
  dateRange: { from: string; to: string };
  filterBy: DateField;
  typeFilter: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [from, setFrom] = useState(dateRange.from);
  const [to, setTo] = useState(dateRange.to);

  // Search libre côté client
  const [searchQuery, setSearchQuery] = useState("");

  // Tri client
  const [sortKey, setSortKey] = useState<SortKey>(filterBy);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // pageSize avec persistance localStorage
  const PAGESIZE_KEY = "vnk-pagesize-settlements";
  const [pageSize, setPageSizeState] = useState<number>(() => {
    if (typeof window === "undefined") return 50;
    const saved = localStorage.getItem(PAGESIZE_KEY);
    const n = saved ? parseInt(saved, 10) : NaN;
    return Number.isFinite(n) && n > 0 ? n : 50;
  });
  const setPageSize = (n: number) => {
    setPageSizeState(n);
    if (typeof window !== "undefined") localStorage.setItem(PAGESIZE_KEY, String(n));
    setPage(0);
  };
  const [page, setPage] = useState(0);

  // Modal détail
  const [detailPaymentId, setDetailPaymentId] = useState<number | null>(null);

  // Sticky scroll detection
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // ─── Mise à jour des params URL (déclenche reload server) ─────────
  const updateUrl = (overrides: Partial<{ from: string; to: string; filterBy: string; type: string }>) => {
    const p = new URLSearchParams(searchParams.toString());
    Object.entries(overrides).forEach(([k, v]) => {
      if (v === undefined || v === "" || v === "all") p.delete(k);
      else p.set(k, v);
    });
    router.push(`/admin/finance/settlements?${p.toString()}`);
  };

  const applyDates = () => updateUrl({ from, to });
  const applyPreset = (preset: string) => {
    const r = getPresetRange(preset);
    if (!r) return;
    setFrom(r.from); setTo(r.to);
    updateUrl({ from: r.from, to: r.to });
  };
  const changeFilterBy = (v: string) => updateUrl({ filterBy: v });
  const changeType = (v: string) => updateUrl({ type: v });

  // Détection preset actif basé sur from/to courants
  const activePreset = useMemo(() => {
    for (const k of ["30d", "thisMonth", "lastMonth", "thisQuarter", "thisYear", "lastYear"]) {
      const r = getPresetRange(k);
      if (r && r.from === dateRange.from && r.to === dateRange.to) return k;
    }
    return "custom";
  }, [dateRange.from, dateRange.to]);

  // ─── Filtres côté client (recherche libre) + tri ──────────────────
  const filteredRows = useMemo(() => {
    if (!searchQuery.trim()) return rows;
    const q = searchQuery.toLowerCase();
    return rows.filter((r) =>
      r.clientName.toLowerCase().includes(q)
      || r.cardholderName.toLowerCase().includes(q)
      || (r.invoiceNumber?.toLowerCase().includes(q) ?? false)
      || (r.stripePaymentIntentId?.toLowerCase().includes(q) ?? false)
      || (r.stripeBalanceTxId?.toLowerCase().includes(q) ?? false)
      || (r.stripePayoutId?.toLowerCase().includes(q) ?? false)
      || (r.paymentMethod?.toLowerCase().includes(q) ?? false)
    );
  }, [rows, searchQuery]);

  const sortedRows = useMemo(() => {
    const arr = [...filteredRows];
    arr.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "paidAt":
        case "settledAt":
        case "payoutAt": {
          const av = a[sortKey] ?? "";
          const bv = b[sortKey] ?? "";
          cmp = av.localeCompare(bv);
          break;
        }
        case "clientName":
          cmp = a.clientName.localeCompare(b.clientName);
          break;
        case "amount":
          cmp = a.amount - b.amount;
          break;
        case "type":
          cmp = a.type.localeCompare(b.type);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
    return arr;
  }, [filteredRows, sortKey, sortDir]);

  // Reset à la page 0 quand search / sort change
  useEffect(() => { setPage(0); }, [searchQuery, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const pageRows = useMemo(() => sortedRows.slice(page * pageSize, (page + 1) * pageSize), [sortedRows, page, pageSize]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir(sortDir === "asc" ? "desc" : "asc");
    else { setSortKey(key); setSortDir("asc"); }
  };

  // Helper rendu icône tri
  const sortIcon = (key: SortKey) => {
    if (sortKey !== key) return <ArrowUpDown className="h-2.5 w-2.5 opacity-40 inline-block ml-0.5" />;
    return sortDir === "asc"
      ? <ArrowUp className="h-2.5 w-2.5 inline-block ml-0.5" />
      : <ArrowDown className="h-2.5 w-2.5 inline-block ml-0.5" />;
  };

  // ─── Export CSV (utilise sortedRows pour respecter les filtres client) ────────
  const exportCsv = () => {
    const headers = [
      "Date de paiement",
      "Date de règlement",
      "Date de versement",
      "Nom du client",
      "Nom du titulaire de la carte",
      "Type",
      "Statut",
      "Montant",
      "Devise",
      "Frais de traitement",
      "Montant net",
      "ID de paiement",
      "Moyen de paiement",
      "ID de transaction",
      "ID de versement",
      "N° de commande",
    ];
    const lines = [headers.map(csvEscape).join(",")];
    sortedRows.forEach((r) => {
      lines.push([
        formatDateOnly(r.paidAt),
        formatDateOnly(r.settledAt),
        formatDateOnly(r.payoutAt),
        r.clientName,
        r.cardholderName,
        TYPE_LABELS[r.type] ?? r.type,
        getStatusDisplay(r.type, r.status).label,
        r.amount.toFixed(2),
        r.currency,
        r.processingFee != null ? r.processingFee.toFixed(2) : "0.00",
        (r.netAmount != null ? r.netAmount : r.amount).toFixed(2),
        r.stripePaymentIntentId ?? "",
        r.paymentMethod ?? "",
        r.stripeBalanceTxId ?? "",
        r.stripePayoutId ?? "N/A",
        r.invoiceNumber ?? "N/A",
      ].map(csvEscape).join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `rapport-reglement_${from}_${to}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const filterByLabel = FILTER_BY_OPTIONS.find((o) => o.value === filterBy)?.label ?? "Date";

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Rapport de règlement
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Filtré par <strong>{filterByLabel}</strong> · {dateRange.from} → {dateRange.to} · {kpis.count} transaction{kpis.count > 1 ? "s" : ""}
            </p>
          </div>
          <Button onClick={exportCsv} size="sm" variant="secondary" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
            <Download className="h-4 w-4 mr-1.5" />
            Exporter CSV
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Brut</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(kpis.totalGross)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.count} transaction{kpis.count > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Frais de traitement</p>
          <p className="text-lg font-bold text-red-600 tabular-nums">−{formatCurrency(kpis.totalFees)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.totalGross > 0 ? ((kpis.totalFees / kpis.totalGross) * 100).toFixed(2) : "0,00"}% effectif</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.totalNet)}</p>
          <p className="text-[10px] text-muted-foreground">déposé en banque</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between text-xs">
            <span className="inline-flex items-center gap-1"><TrendingUp className="h-3 w-3 text-emerald-500" /> Ventes</span>
            <span className="font-semibold tabular-nums">{kpis.chargeCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="inline-flex items-center gap-1"><RotateCcw className="h-3 w-3 text-amber-500" /> Remb.</span>
            <span className="font-semibold tabular-nums">{kpis.refundCount}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="inline-flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-red-500" /> Rétrofact.</span>
            <span className="font-semibold tabular-nums">{kpis.chargebackCount}</span>
          </div>
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
              <FileText className="h-4 w-4" />
              Rapport de règlement
            </span>
            <span className="font-semibold">{sortedRows.length} tx</span>
            <span className="text-muted-foreground">Brut <span className="font-semibold">{formatCurrency(kpis.totalGross)}</span></span>
            <span className="text-muted-foreground">Frais <span className="font-semibold text-red-600">{formatCurrency(kpis.totalFees)}</span></span>
            <span className="text-muted-foreground">Net <span className="font-semibold text-emerald-600">{formatCurrency(kpis.totalNet)}</span></span>
            <span className="ml-auto">{filterByLabel} · {dateRange.from} → {dateRange.to}</span>
          </div>
        )}

        {/* Première ligne : présets de période */}
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="text-[10px] text-muted-foreground mr-1">Période :</span>
          {[
            { k: "30d", l: "30 jours" },
            { k: "thisMonth", l: "Ce mois" },
            { k: "lastMonth", l: "Mois dernier" },
            { k: "thisQuarter", l: "Ce trimestre" },
            { k: "thisYear", l: "Cette année" },
            { k: "lastYear", l: "Année dernière" },
          ].map((p) => (
            <button
              key={p.k}
              onClick={() => applyPreset(p.k)}
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
              Période personnalisée
            </span>
          )}
        </div>

        {/* Deuxième ligne : dates from/to + filterBy + apply */}
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-[10px]">Filtrer par</Label>
            <Select value={filterBy} onValueChange={changeFilterBy}>
              <SelectTrigger className="h-9 w-[180px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {FILTER_BY_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value} className="text-xs">
                    <div>
                      <p className="font-medium">{o.label}</p>
                      <p className="text-[9px] text-muted-foreground">{o.description}</p>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
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

          {/* Recherche libre */}
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Label className="text-[10px]">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Client, facture, référence…"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>

          <span className="ml-auto text-xs text-muted-foreground">
            {sortedRows.length > 0 ? `Page ${page + 1} / ${pageCount}` : "Aucune donnée"}
          </span>
        </div>

        {/* Troisième ligne : tabs filtre type */}
        <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto mt-2 w-fit max-w-full">
          {TYPE_FILTER_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => changeType(tab.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                typeFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table CSV-like : 16 colonnes */}
      <div className="rounded-lg border bg-card overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50 border-b">
            <tr>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Origine</th>
              <th onClick={() => toggleSort("paidAt")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Date paiement{sortIcon("paidAt")}
              </th>
              <th onClick={() => toggleSort("settledAt")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Date règlement{sortIcon("settledAt")}
              </th>
              <th onClick={() => toggleSort("payoutAt")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Date versement{sortIcon("payoutAt")}
              </th>
              <th onClick={() => toggleSort("clientName")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Client{sortIcon("clientName")}
              </th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Titulaire carte</th>
              <th onClick={() => toggleSort("type")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Type{sortIcon("type")}
              </th>
              <th onClick={() => toggleSort("status")} className="px-2 py-2 text-left font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Statut{sortIcon("status")}
              </th>
              <th onClick={() => toggleSort("amount")} className="px-2 py-2 text-right font-semibold text-muted-foreground cursor-pointer hover:text-foreground select-none">
                Montant{sortIcon("amount")}
              </th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Frais</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Net</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">ID paiement</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Méthode</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">ID transaction</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">ID versement</th>
              <th className="px-2 py-2 text-left font-semibold text-muted-foreground">N° commande</th>
              <th className="px-2 py-2 text-right font-semibold text-muted-foreground"></th>
            </tr>
          </thead>
          <tbody>
            {pageRows.length === 0 ? (
              <tr>
                <td colSpan={17} className="text-center py-8 text-muted-foreground italic">
                  {searchQuery ? "Aucun résultat pour cette recherche." : "Aucune transaction sur la période sélectionnée."}
                </td>
              </tr>
            ) : pageRows.map((r) => {
              const typeMeta = TYPE_META[r.type] ?? { label: r.type, color: "bg-gray-100 text-gray-700", description: r.type };
              const statusDisplay = getStatusDisplay(r.type, r.status);
              const manual = isManualPayment(r);
              return (
                <tr
                  key={r.id}
                  onClick={() => setDetailPaymentId(r.id)}
                  className="border-t hover:bg-muted/30 cursor-pointer"
                >
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    {manual ? (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-slate-100 text-slate-700"
                        title="Paiement saisi manuellement par l'admin"
                      >
                        <Banknote className="h-2.5 w-2.5" />
                        Manuel
                      </span>
                    ) : (
                      <span
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-indigo-100 text-indigo-700"
                        title="Paiement en ligne par carte"
                      >
                        <CreditCard className="h-2.5 w-2.5" />
                        Carte
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">{r.paidAt ? formatDate(new Date(r.paidAt)) : "—"}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                    {r.settledAt ? formatDate(new Date(r.settledAt)) : emptyCell(manual)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap text-muted-foreground">
                    {r.payoutAt ? formatDate(new Date(r.payoutAt)) : emptyCell(manual)}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap max-w-[140px] truncate" title={r.clientName}>{r.clientName}</td>
                  <td className="px-2 py-1.5 whitespace-nowrap max-w-[140px] truncate text-muted-foreground" title={r.cardholderName}>
                    {manual ? <span className="italic text-muted-foreground/70" title="Pas de carte (paiement manuel)">—</span> : r.cardholderName}
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span
                      className={cn("inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium", typeMeta.color)}
                      title={typeMeta.description}
                    >
                      {typeMeta.label}
                    </span>
                  </td>
                  <td className="px-2 py-1.5 whitespace-nowrap">
                    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-semibold border", statusDisplay.cls)}>
                      {statusDisplay.label}
                    </span>
                  </td>
                  <td className={cn("px-2 py-1.5 text-right font-semibold tabular-nums", r.amount < 0 ? "text-red-600" : "")}>
                    {r.amount < 0 ? "−" : ""}{Math.abs(r.amount).toFixed(2)} {r.currency}
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                    {r.processingFee != null ? r.processingFee.toFixed(2) : <span className="italic text-muted-foreground/70" title={manual ? "Pas de frais (paiement manuel)" : "Frais pas encore reçus"}>—</span>}
                  </td>
                  <td className="px-2 py-1.5 text-right font-semibold tabular-nums">{(r.netAmount ?? r.amount).toFixed(2)}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px] max-w-[120px] truncate" title={r.stripePaymentIntentId ?? ""}>
                    {r.stripePaymentIntentId ?? emptyCell(manual)}
                  </td>
                  <td className="px-2 py-1.5 text-muted-foreground">{r.paymentMethod ?? "—"}</td>
                  <td className="px-2 py-1.5 font-mono text-[10px] max-w-[120px] truncate" title={r.stripeBalanceTxId ?? ""}>
                    {r.stripeBalanceTxId ?? emptyCell(manual)}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] max-w-[120px] truncate text-muted-foreground" title={r.stripePayoutId ?? ""}>
                    {r.stripePayoutId ?? emptyCell(manual)}
                  </td>
                  <td className="px-2 py-1.5 font-mono text-[10px] text-muted-foreground">{r.invoiceNumber ?? "—"}</td>
                  <td className="px-2 py-1.5 text-right">
                    <button
                      onClick={(e) => { e.stopPropagation(); setDetailPaymentId(r.id); }}
                      className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                      title="Voir détail"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20 text-xs flex-wrap gap-2">
          <span className="text-muted-foreground">{sortedRows.length} transaction{sortedRows.length > 1 ? "s" : ""} affichées</span>
          <div className="flex items-center gap-2">
            <label className="inline-flex items-center gap-1.5 text-muted-foreground">
              Lignes :
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="h-7 rounded border border-input bg-background px-1.5 text-xs"
              >
                {PAGE_SIZE_OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}
              </select>
            </label>
            {pageCount > 1 && (
              <>
                <Button size="sm" variant="ghost" disabled={page === 0} onClick={() => setPage(p => Math.max(0, p - 1))} className="h-7 text-xs">← Précédent</Button>
                <span className="text-muted-foreground">Page {page + 1} / {pageCount}</span>
                <Button size="sm" variant="ghost" disabled={page === pageCount - 1} onClick={() => setPage(p => Math.min(pageCount - 1, p + 1))} className="h-7 text-xs">Suivant →</Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Note pédagogique */}
      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 space-y-2">
        <div>
          <p className="font-semibold">Comprendre les 3 dates</p>
          <ul className="list-disc list-inside space-y-0.5 mt-0.5">
            <li><strong>Date de paiement</strong> : moment où le client a payé.</li>
            <li><strong>Date de règlement</strong> : moment où les fonds sont disponibles dans votre solde (généralement +2 jours ouvrés au Canada).</li>
            <li><strong>Date de versement</strong> : moment où l&apos;argent arrive sur votre compte bancaire.</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Pourquoi certaines cellules sont vides ?</p>
          <ul className="list-disc list-inside space-y-0.5 mt-0.5">
            <li><strong>Manuel</strong> (Interac, chèque, virement, comptant…) : paiement saisi manuellement, pas de date de règlement/versement automatique, pas de frais. C&apos;est normal.</li>
            <li><strong>En attente</strong> : paiement par carte pour lequel la confirmation de règlement/versement n&apos;est pas encore arrivée (généralement quelques jours après le paiement).</li>
          </ul>
        </div>
        <p className="pt-1 border-t border-blue-200">
          Utilisez le sélecteur <strong>Filtrer par</strong> pour adapter la période au besoin :
          paiement (rapport fiscal TPS/TVQ),
          règlement (suivi des disponibilités),
          versement (réconciliation avec relevé bancaire).
        </p>
      </div>

      {/* Modal détail */}
      <PaymentDetailDialog
        paymentId={detailPaymentId}
        open={detailPaymentId !== null}
        onOpenChange={(o) => { if (!o) setDetailPaymentId(null); }}
      />
    </div>
  );
}

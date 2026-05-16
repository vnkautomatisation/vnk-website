"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { toast } from "sonner";
import {
  Banknote,
  RefreshCw,
  ArrowRightLeft,
  Globe,
  Download,
  ChevronDown,
  ChevronUp,
  Info,
  Clock,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type FxRate = {
  currency: string;
  rate: number | null;
  source: string | null;
  date: string | null;
};

// Couleur dominante adoucie par devise (SVG circle minimaliste)
const CURRENCY_NAMES: Record<string, { name: string; color: string; region: string }> = {
  CAD: { name: "Dollar canadien", color: "#DC2626", region: "Canada (devise base)" },
  USD: { name: "Dollar américain", color: "#1E40AF", region: "États-Unis" },
  EUR: { name: "Euro", color: "#1E40AF", region: "Union européenne" },
  GBP: { name: "Livre sterling", color: "#1E40AF", region: "Royaume-Uni" },
  CHF: { name: "Franc suisse", color: "#DC2626", region: "Suisse" },
  AUD: { name: "Dollar australien", color: "#16A34A", region: "Australie" },
  JPY: { name: "Yen japonais", color: "#DC2626", region: "Japon" },
  CNY: { name: "Yuan chinois", color: "#DC2626", region: "Chine" },
  MXN: { name: "Peso mexicain", color: "#16A34A", region: "Mexique" },
  INR: { name: "Roupie indienne", color: "#F59E0B", region: "Inde" },
  HKD: { name: "Dollar de Hong Kong", color: "#DC2626", region: "Hong Kong" },
  XOF: { name: "Franc CFA UEMOA", color: "#16A34A", region: "Afrique de l'Ouest (parité fixe EUR)" },
  XAF: { name: "Franc CFA CEMAC", color: "#16A34A", region: "Afrique centrale (parité fixe EUR)" },
};

const QUICK_AMOUNTS = [100, 500, 1000, 5000];

function CurrencyDot({ code, size = 10 }: { code: string; size?: number }) {
  const fill = CURRENCY_NAMES[code]?.color ?? "#94A3B8";
  return (
    <span
      className="inline-block rounded-full align-middle shrink-0 mr-2"
      style={{ width: size, height: size, backgroundColor: fill }}
      aria-hidden
    />
  );
}

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

// Format date ISO "2026-05-09" → "9 mai 2026"
function formatDateFr(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" });
}

function sourceLabel(s: string | null | undefined): string {
  if (s === "BOC") return "Banque du Canada";
  if (s === "ECB") return "Banque centrale européenne";
  if (s === "fallback") return "Cache local";
  return s ?? "—";
}

function decimalsFor(currency: string): number {
  // Devises avec très faible valeur unitaire ou parité fixe → plus de décimales
  return ["JPY", "XOF", "XAF", "INR", "MXN"].includes(currency) ? 6 : 4;
}

export function FxView({ rates }: { rates: FxRate[] }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [convAmount, setConvAmount] = useState<string>("100");
  const [convCurrency, setConvCurrency] = useState<string>("USD");
  const [convDirection, setConvDirection] = useState<"to-cad" | "from-cad">("to-cad");
  const [convResult, setConvResult] = useState<{ amount: number; rate: number; source: string; date: string } | null>(null);
  const [converting, setConverting] = useState(false);

  // Reset le résultat dès qu'un input change (évite des résultats périmés affichés)
  useEffect(() => {
    setConvResult(null);
  }, [convAmount, convCurrency, convDirection]);

  // Sticky scroll detection (Wix pattern)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Notes section collapsible
  const [notesOpen, setNotesOpen] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/fx?refresh=1");
      if (!res.ok) throw new Error();
      const data = await res.json();
      const failures = Object.values(data.rates ?? {}).filter((q) => q === null).length;
      if (failures > 0) {
        toast.warning(`Taux rafraîchis (${failures} indisponible${failures > 1 ? "s" : ""})`);
      } else {
        toast.success("Taux rafraîchis");
      }
      router.refresh();
    } catch {
      toast.error("Échec du rafraîchissement");
    } finally {
      setRefreshing(false);
    }
  };

  const swap = () => {
    setConvDirection((d) => (d === "to-cad" ? "from-cad" : "to-cad"));
  };

  const convert = async () => {
    const amt = parseFloat(convAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(`/api/fx?currency=${convCurrency}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      // data.rate = 1 unité de convCurrency en CAD
      // to-cad : amt convCurrency × rate = amt × rate CAD
      // from-cad : amt CAD ÷ rate = amt / rate convCurrency
      const result = convDirection === "to-cad" ? amt * data.rate : amt / data.rate;
      setConvResult({
        amount: result,
        rate: data.rate,
        source: data.source,
        date: data.date,
      });
    } catch {
      toast.error("Erreur de conversion");
    } finally {
      setConverting(false);
    }
  };

  const lastUpdated = useMemo(() => {
    const dates = rates.map((r) => r.date).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort().reverse()[0];
  }, [rates]);

  // KPIs : compteurs par source
  const kpis = useMemo(() => {
    const total = rates.length;
    const available = rates.filter((r) => r.rate !== null).length;
    const fromBoc = rates.filter((r) => r.source === "BOC").length;
    const fromEcb = rates.filter((r) => r.source === "ECB").length;
    const unavailable = rates.filter((r) => r.rate === null).length;
    return { total, available, fromBoc, fromEcb, unavailable };
  }, [rates]);

  // Export CSV des taux courants
  const exportCsv = () => {
    const headers = ["Devise", "Nom", "Région", "Taux (vs CAD)", "Source", "Date"];
    const lines = [headers.map(csvEscape).join(",")];
    rates.forEach((r) => {
      const meta = CURRENCY_NAMES[r.currency];
      lines.push([
        r.currency,
        meta?.name ?? r.currency,
        meta?.region ?? "",
        r.rate !== null ? r.rate.toFixed(decimalsFor(r.currency)) : "indisponible",
        sourceLabel(r.source),
        r.date ?? "",
      ].map(csvEscape).join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `taux-de-change_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const targetCurrency = convDirection === "to-cad" ? "CAD" : convCurrency;
  const sourceCurrency = convDirection === "to-cad" ? convCurrency : "CAD";

  return (
    <div className="space-y-5">
      {/* Hero VNK */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Taux de change (FX)
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Source : Banque du Canada (officielle) + Banque centrale européenne (fallback)
              {lastUpdated ? ` · Dernière mise à jour : ${formatDateFr(lastUpdated)}` : " · Chargement…"}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ActionTooltip label="Exporter tous les taux courants en CSV">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={exportCsv}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                Exporter CSV
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Forcer la mise à jour depuis la Banque du Canada (ignore le cache 24 h)">
              <Button
                size="sm"
                variant="secondary"
                className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
                {refreshing ? "Rafraîchissement…" : "Rafraîchir"}
              </Button>
            </ActionTooltip>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Devises suivies</p>
          <p className="text-lg font-bold tabular-nums">{kpis.total}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.available} disponible{kpis.available > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Banque du Canada</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{kpis.fromBoc}</p>
          <p className="text-[10px] text-muted-foreground">source officielle</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Banque centrale EU</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{kpis.fromEcb}</p>
          <p className="text-[10px] text-muted-foreground">fallback</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Dernière MAJ</p>
          <p className="text-sm font-bold tabular-nums truncate" title={lastUpdated ?? "—"}>
            {lastUpdated ? formatDateFr(lastUpdated) : "—"}
          </p>
          <p className={cn("text-[10px]", kpis.unavailable > 0 ? "text-amber-600" : "text-muted-foreground")}>
            {kpis.unavailable > 0 ? `${kpis.unavailable} indisponible${kpis.unavailable > 1 ? "s" : ""}` : "Toutes à jour"}
          </p>
        </div>
      </div>

      {/* Sentinel — détecte quand les KPI quittent le viewport */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {/* Sticky bar : rendue uniquement quand scrollée pour éviter l'espace vide */}
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Banknote className="h-4 w-4" />
              Taux de change
            </span>
            <span className="text-muted-foreground">{kpis.available}/{kpis.total} devises</span>
            {lastUpdated && (
              <span className="inline-flex items-center gap-1 text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span className="font-semibold">{formatDateFr(lastUpdated)}</span>
              </span>
            )}
            {kpis.unavailable > 0 && (
              <span className="text-amber-600">{kpis.unavailable} indisponible{kpis.unavailable > 1 ? "s" : ""}</span>
            )}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto h-7 px-2 text-xs"
              onClick={refresh}
              disabled={refreshing}
            >
              <RefreshCw className={cn("h-3 w-3 mr-1", refreshing && "animate-spin")} />
              Rafraîchir
            </Button>
          </div>
        </div>
      )}

      {/* Convertisseur rapide */}
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-[#0F2D52]" />
            Convertisseur rapide
          </h2>
          {convResult && (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              Source : {sourceLabel(convResult.source)} · {formatDateFr(convResult.date)}
            </span>
          )}
        </div>

        {/* Montants rapides */}
        <div className="flex flex-wrap items-center gap-1 mb-3">
          <span className="text-[10px] text-muted-foreground mr-1">Montant rapide :</span>
          {QUICK_AMOUNTS.map((amt) => (
            <button
              key={amt}
              onClick={() => setConvAmount(String(amt))}
              className={cn(
                "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                convAmount === String(amt)
                  ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                  : "bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
              )}
            >
              {amt.toLocaleString("fr-CA")}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="space-y-1">
            <Label className="text-[10px]">Montant</Label>
            <Input
              type="number"
              value={convAmount}
              onChange={(e) => setConvAmount(e.target.value)}
              className="w-32 h-9"
              step="0.01"
              min="0"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px]">De</Label>
            {convDirection === "to-cad" ? (
              <Select value={convCurrency} onValueChange={setConvCurrency}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rates.filter((r) => r.currency !== "CAD" && r.rate !== null).map((r) => (
                    <SelectItem key={r.currency} value={r.currency}>
                      <span className="inline-flex items-center">
                        <CurrencyDot code={r.currency} />
                        {r.currency}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-9 w-32 px-3 rounded-md border bg-muted flex items-center font-mono text-sm">
                <CurrencyDot code="CAD" />
                CAD
              </div>
            )}
          </div>
          <ActionTooltip label="Inverser le sens de conversion">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={swap}
              aria-label="Inverser"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </ActionTooltip>
          <div className="space-y-1">
            <Label className="text-[10px]">Vers</Label>
            {convDirection === "from-cad" ? (
              <Select value={convCurrency} onValueChange={setConvCurrency}>
                <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {rates.filter((r) => r.currency !== "CAD" && r.rate !== null).map((r) => (
                    <SelectItem key={r.currency} value={r.currency}>
                      <span className="inline-flex items-center">
                        <CurrencyDot code={r.currency} />
                        {r.currency}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div className="h-9 w-32 px-3 rounded-md border bg-muted flex items-center font-mono text-sm">
                <CurrencyDot code="CAD" />
                CAD
              </div>
            )}
          </div>
          <Button
            onClick={convert}
            disabled={converting || !convAmount || Number(convAmount) <= 0}
            size="sm"
            className="h-9 bg-[#0F2D52] hover:bg-[#1a3a66]"
          >
            {converting ? "Conversion…" : "Convertir"}
          </Button>
        </div>

        {convResult && (
          <div className="mt-3 p-3 rounded-md bg-emerald-50 border border-emerald-200">
            <p className="text-2xl font-bold text-emerald-700 tabular-nums">
              {convResult.amount.toLocaleString("fr-CA", { style: "currency", currency: targetCurrency, maximumFractionDigits: 2 })}
            </p>
            <p className="text-xs text-emerald-800 mt-0.5">
              {Number(convAmount).toLocaleString("fr-CA")} {sourceCurrency}
              {convDirection === "to-cad" ? " × " : " ÷ "}
              {convResult.rate.toFixed(decimalsFor(convCurrency))}
              {" = "}
              <span className="font-semibold">{convResult.amount.toFixed(2)} {targetCurrency}</span>
            </p>
          </div>
        )}
      </div>

      {/* Table des taux */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#0F2D52]" />
            Taux courants — 1 unité = X CAD
          </h2>
          <span className="text-[10px] text-muted-foreground">{rates.length} devise{rates.length > 1 ? "s" : ""} suivie{rates.length > 1 ? "s" : ""}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Devise</th>
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Description</th>
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold text-right">Taux (vs CAD)</th>
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Source</th>
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">Date</th>
              </tr>
            </thead>
            <tbody>
              {rates.map((r) => {
                const meta = CURRENCY_NAMES[r.currency];
                return (
                  <tr key={r.currency} className="border-t hover:bg-muted/30 transition-colors">
                    <td className="p-2.5 whitespace-nowrap">
                      <CurrencyDot code={r.currency} size={10} />
                      <span className="font-mono font-bold">{r.currency}</span>
                    </td>
                    <td className="p-2.5">
                      <p className="font-medium">{meta?.name ?? r.currency}</p>
                      <p className="text-[10px] text-muted-foreground">{meta?.region}</p>
                    </td>
                    <td className="p-2.5 text-right font-mono whitespace-nowrap">
                      {r.rate !== null ? (
                        <span className="font-bold text-[#0F2D52]">{r.rate.toFixed(decimalsFor(r.currency))}</span>
                      ) : (
                        <ActionTooltip label="Taux non disponible — réessayer le rafraîchissement">
                          <span className="text-muted-foreground italic cursor-help">indisponible</span>
                        </ActionTooltip>
                      )}
                    </td>
                    <td className="p-2.5">
                      {r.source ? (
                        <ActionTooltip label={r.source === "BOC" ? "Taux officiel de la Banque du Canada (série Valet)" : r.source === "ECB" ? "Conversion via la Banque centrale européenne puis EUR → CAD" : "Source de secours"}>
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-help",
                            r.source === "BOC" && "bg-emerald-100 text-emerald-700",
                            r.source === "ECB" && "bg-blue-100 text-blue-700",
                            r.source !== "BOC" && r.source !== "ECB" && "bg-gray-100 text-gray-700",
                          )}>
                            {r.source === "BOC" ? "Banque du Canada" : r.source === "ECB" ? "Banque centrale EU" : r.source}
                          </span>
                        </ActionTooltip>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="p-2.5 text-xs text-muted-foreground whitespace-nowrap">{formatDateFr(r.date)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Notes pédagogiques (collapsible) */}
      <div className="rounded-lg border bg-blue-50 overflow-hidden">
        <button
          onClick={() => setNotesOpen((o) => !o)}
          className="w-full px-3 py-2.5 flex items-center gap-2 text-xs text-blue-900 hover:bg-blue-100 transition-colors"
          aria-expanded={notesOpen}
        >
          <Info className="h-4 w-4 shrink-0" />
          <span className="font-semibold flex-1 text-left">Comment fonctionne la conversion FX dans le système</span>
          {notesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {notesOpen && (
          <div className="px-4 py-3 text-xs text-blue-900 space-y-2 border-t border-blue-200 bg-blue-50/50">
            <ul className="space-y-1 list-disc list-inside">
              <li>Quand un client paie une facture en USD/EUR/etc., le taux du jour (Banque du Canada) est <strong>figé</strong> sur le paiement pour audit (conformité ARC règle 3300-2-r + IFRS IAS 21).</li>
              <li>Les rapports financiers consolidés (Tableau de bord) convertissent toutes les devises en CAD au taux figé à la transaction.</li>
              <li>L&apos;écart de change entre la facture (taux d&apos;émission) et le paiement (taux du jour) génère un gain/perte qui doit être comptabilisé séparément.</li>
              <li>Les devises XOF/XAF (Afrique francophone) ont une parité fixe à l&apos;EUR (655,957) garantie par le Trésor français.</li>
              <li>Le cache des taux a une durée de 24 h. Utiliser <strong>Rafraîchir</strong> pour forcer la mise à jour si nécessaire.</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";
import { useState, useEffect, useRef, useMemo } from "react";
import { useTranslations } from "next-intl";
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
const CURRENCY_NAMES: Record<string, { nameKey: string; color: string; regionKey: string }> = {
  CAD: { nameKey: "cur_CAD", color: "#DC2626", regionKey: "reg_CAD" },
  USD: { nameKey: "cur_USD", color: "#1E40AF", regionKey: "reg_USD" },
  EUR: { nameKey: "cur_EUR", color: "#1E40AF", regionKey: "reg_EUR" },
  GBP: { nameKey: "cur_GBP", color: "#1E40AF", regionKey: "reg_GBP" },
  CHF: { nameKey: "cur_CHF", color: "#DC2626", regionKey: "reg_CHF" },
  AUD: { nameKey: "cur_AUD", color: "#16A34A", regionKey: "reg_AUD" },
  JPY: { nameKey: "cur_JPY", color: "#DC2626", regionKey: "reg_JPY" },
  CNY: { nameKey: "cur_CNY", color: "#DC2626", regionKey: "reg_CNY" },
  MXN: { nameKey: "cur_MXN", color: "#16A34A", regionKey: "reg_MXN" },
  INR: { nameKey: "cur_INR", color: "#F59E0B", regionKey: "reg_INR" },
  HKD: { nameKey: "cur_HKD", color: "#DC2626", regionKey: "reg_HKD" },
  XOF: { nameKey: "cur_XOF", color: "#16A34A", regionKey: "reg_XOF" },
  XAF: { nameKey: "cur_XAF", color: "#16A34A", regionKey: "reg_XAF" },
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

function sourceKey(s: string | null | undefined): string | null {
  if (s === "BOC") return "banque_canada";
  if (s === "ECB") return "banque_centrale_europeenne";
  if (s === "fallback") return "cache_local";
  return null;
}

function decimalsFor(currency: string): number {

  return ["JPY", "XOF", "XAF", "INR", "MXN"].includes(currency) ? 6 : 4;
}

export function FxView({ rates }: { rates: FxRate[] }) {
  const t = useTranslations("admin.fx");
  const tc = useTranslations("common");
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [convAmount, setConvAmount] = useState<string>("100");
  const [convCurrency, setConvCurrency] = useState<string>("USD");
  const [convDirection, setConvDirection] = useState<"to-cad" | "from-cad">("to-cad");
  const [convResult, setConvResult] = useState<{ amount: number; rate: number; source: string; date: string } | null>(null);
  const [converting, setConverting] = useState(false);


  useEffect(() => {
    setConvResult(null);
  }, [convAmount, convCurrency, convDirection]);


  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);


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
        toast.success(t("taux_rafraichis"));
      }
      router.refresh();
    } catch {
      toast.error(t("echec_rafraichissement"));
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
      toast.error(t("montant_invalide"));
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(`/api/fx?currency=${convCurrency}`);
      if (!res.ok) throw new Error();
      const data = await res.json();



      const result = convDirection === "to-cad" ? amt * data.rate : amt / data.rate;
      setConvResult({
        amount: result,
        rate: data.rate,
        source: data.source,
        date: data.date,
      });
    } catch {
      toast.error(t("erreur_conversion"));
    } finally {
      setConverting(false);
    }
  };

  const lastUpdated = useMemo(() => {
    const dates = rates.map((r) => r.date).filter(Boolean) as string[];
    if (dates.length === 0) return null;
    return dates.sort().reverse()[0];
  }, [rates]);


  const kpis = useMemo(() => {
    const total = rates.length;
    const available = rates.filter((r) => r.rate !== null).length;
    const fromBoc = rates.filter((r) => r.source === "BOC").length;
    const fromEcb = rates.filter((r) => r.source === "ECB").length;
    const unavailable = rates.filter((r) => r.rate === null).length;
    return { total, available, fromBoc, fromEcb, unavailable };
  }, [rates]);


  const exportCsv = () => {
    const headers = [t("devise"), t("nom"), t("region"), t("taux_vs_cad"), t("source"), t("date")];
    const lines = [headers.map(csvEscape).join(",")];
    rates.forEach((r) => {
      const meta = CURRENCY_NAMES[r.currency];
      lines.push([
        r.currency,
        meta ? t(meta.nameKey) : r.currency,
        meta ? t(meta.regionKey) : "",
        r.rate !== null ? r.rate.toFixed(decimalsFor(r.currency)) : "indisponible",
        sourceKey(r.source) ? t(sourceKey(r.source)!) : (r.source ?? "—"),
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

      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              {t("taux_change_fx")}
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Source : Banque du Canada (officielle) + Banque centrale européenne (fallback)
              {lastUpdated ? ` · Dernière mise à jour : ${formatDateFr(lastUpdated)}` : t("chargement")}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <ActionTooltip label={t("exporter_tous_taux_courants_csv")}>
              <Button
                size="sm"
                variant="secondary"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
                onClick={exportCsv}
              >
                <Download className="h-3.5 w-3.5 mr-1.5" />
                {t("exporter_csv")}
              </Button>
            </ActionTooltip>
            <ActionTooltip label={t("forcer_mise_jour_depuis_banque")}>
              <Button
                size="sm"
                variant="secondary"
                className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
                onClick={refresh}
                disabled={refreshing}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 mr-1.5", refreshing && "animate-spin")} />
                {refreshing ? t("rafraichissement_cours") : t("rafraichir")}
              </Button>
            </ActionTooltip>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("devises_suivies")}</p>
          <p className="text-lg font-bold tabular-nums">{kpis.total}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.available} disponible{kpis.available > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("banque_canada")}</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{kpis.fromBoc}</p>
          <p className="text-[10px] text-muted-foreground">{t("source_officielle")}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("banque_centrale_eu")}</p>
          <p className="text-lg font-bold text-blue-600 tabular-nums">{kpis.fromEcb}</p>
          <p className="text-[10px] text-muted-foreground">fallback</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("derniere_maj")}</p>
          <p className="text-sm font-bold tabular-nums truncate" title={lastUpdated ?? "—"}>
            {lastUpdated ? formatDateFr(lastUpdated) : "—"}
          </p>
          <p className={cn("text-[10px]", kpis.unavailable > 0 ? "text-amber-600" : "text-muted-foreground")}>
            {kpis.unavailable > 0 ? `${kpis.unavailable} indisponible${kpis.unavailable > 1 ? "s" : ""}` : "Toutes à jour"}
          </p>
        </div>
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />

      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Banknote className="h-4 w-4" />
              {t("taux_change")}
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
              {tc("refresh")}
            </Button>
          </div>
        </div>
      )}


      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <ArrowRightLeft className="h-4 w-4 text-[#0F2D52]" />
            {t("convertisseur_rapide")}
          </h2>
          {convResult && (
            <span className="text-[10px] text-muted-foreground inline-flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              {t("source")} : {sourceKey(convResult.source) ? t(sourceKey(convResult.source)!) : (convResult.source ?? "—")} · {formatDateFr(convResult.date)}
            </span>
          )}
        </div>


        <div className="flex flex-wrap items-center gap-1 mb-3">
          <span className="text-[10px] text-muted-foreground mr-1">{t("montant_rapide")}</span>
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
            <Label className="text-[10px]">{tc("amount")}</Label>
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
            <Label className="text-[10px]">{t("de")}</Label>
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
          <ActionTooltip label={t("inverser_sens_conversion")}>
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={swap}
              aria-label={t("inverser")}
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>
          </ActionTooltip>
          <div className="space-y-1">
            <Label className="text-[10px]">{t("vers")}</Label>
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
            {converting ? t("conversion") : t("convertir")}
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


      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4 text-[#0F2D52]" />
            {t("taux_courants_1_unite_x")}
          </h2>
          <span className="text-[10px] text-muted-foreground">{rates.length} devise{rates.length > 1 ? "s" : ""} suivie{rates.length > 1 ? "s" : ""}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr className="text-left">
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("devise")}</th>
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("description")}</th>
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold text-right">{t("taux_vs_cad")}</th>
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{t("source")}</th>
                <th className="p-2.5 text-xs uppercase tracking-wider text-muted-foreground font-semibold">{tc("date")}</th>
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
                      <p className="font-medium">{meta ? t(meta.nameKey) : r.currency}</p>
                      <p className="text-[10px] text-muted-foreground">{meta ? t(meta.regionKey) : null}</p>
                    </td>
                    <td className="p-2.5 text-right font-mono whitespace-nowrap">
                      {r.rate !== null ? (
                        <span className="font-bold text-[#0F2D52]">{r.rate.toFixed(decimalsFor(r.currency))}</span>
                      ) : (
                        <ActionTooltip label={t("taux_non_disponible_reessayer_rafraichissement")}>
                          <span className="text-muted-foreground italic cursor-help">indisponible</span>
                        </ActionTooltip>
                      )}
                    </td>
                    <td className="p-2.5">
                      {r.source ? (
                        <ActionTooltip label={r.source === "BOC" ? t("taux_officiel_banque_canada_serie") : r.source === "ECB" ? t("conversion_via_banque_centrale_europeenne") : t("source_secours")}>
                          <span className={cn(
                            "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium cursor-help",
                            r.source === "BOC" && "bg-emerald-100 text-emerald-700",
                            r.source === "ECB" && "bg-blue-100 text-blue-700",
                            r.source !== "BOC" && r.source !== "ECB" && "bg-gray-100 text-gray-700",
                          )}>
                            {r.source === "BOC" ? t("banque_canada") : r.source === "ECB" ? t("banque_centrale_eu") : r.source}
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


      <div className="rounded-lg border bg-blue-50 overflow-hidden">
        <button
          onClick={() => setNotesOpen((o) => !o)}
          className="w-full px-3 py-2.5 flex items-center gap-2 text-xs text-blue-900 hover:bg-blue-100 transition-colors"
          aria-expanded={notesOpen}
        >
          <Info className="h-4 w-4 shrink-0" />
          <span className="font-semibold flex-1 text-left">{t("comment_fonctionne_conversion_fx_systeme")}</span>
          {notesOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {notesOpen && (
          <div className="px-4 py-3 text-xs text-blue-900 space-y-2 border-t border-blue-200 bg-blue-50/50">
            <ul className="space-y-1 list-disc list-inside">
              <li>{t("quand_client_paie_facture_usd")} <strong>{t("fige")}</strong> {t("paiement_audit_conformite_arc_regle")}</li>
              <li>{t("rapports_financiers_consolides_tableau_bord")}</li>
              <li>{t("apos_ecart_change_entre_facture")}</li>
              <li>{t("devises_xof_xaf_afrique_francophone")}</li>
              <li>{t("cache_taux_duree_24_h")} <strong>{tc("refresh")}</strong> {t("forcer_mise_jour_si_necessaire")}</li>
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

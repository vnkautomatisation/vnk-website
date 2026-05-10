"use client";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Banknote, RefreshCw, ArrowRightLeft, Globe } from "lucide-react";
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
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

type FxRate = {
  currency: string;
  rate: number | null;
  source: string | null;
  date: string | null;
};

const CURRENCY_NAMES: Record<string, { name: string; flag: string; region: string }> = {
  CAD: { name: "Dollar canadien", flag: "🇨🇦", region: "Canada (devise base)" },
  USD: { name: "Dollar américain", flag: "🇺🇸", region: "États-Unis" },
  EUR: { name: "Euro", flag: "🇪🇺", region: "Union européenne" },
  GBP: { name: "Livre sterling", flag: "🇬🇧", region: "Royaume-Uni" },
  CHF: { name: "Franc suisse", flag: "🇨🇭", region: "Suisse" },
  AUD: { name: "Dollar australien", flag: "🇦🇺", region: "Australie" },
  JPY: { name: "Yen japonais", flag: "🇯🇵", region: "Japon" },
  CNY: { name: "Yuan chinois", flag: "🇨🇳", region: "Chine" },
  MXN: { name: "Peso mexicain", flag: "🇲🇽", region: "Mexique" },
  INR: { name: "Roupie indienne", flag: "🇮🇳", region: "Inde" },
  HKD: { name: "Dollar de Hong Kong", flag: "🇭🇰", region: "Hong Kong" },
  XOF: { name: "Franc CFA UEMOA", flag: "🌍", region: "Afrique de l'Ouest (peggué EUR)" },
  XAF: { name: "Franc CFA CEMAC", flag: "🌍", region: "Afrique centrale (peggué EUR)" },
};

export function FxView({ rates }: { rates: FxRate[] }) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [convAmount, setConvAmount] = useState<string>("100");
  const [convFrom, setConvFrom] = useState<string>("USD");
  const [convResult, setConvResult] = useState<{ amount: number; rate: number; source: string; date: string } | null>(null);
  const [converting, setConverting] = useState(false);

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

  const refresh = async () => {
    setRefreshing(true);
    try {
      // Force refresh en passant param "refresh"
      await fetch("/api/fx?refresh=1");
      toast.success("Taux rafraîchis");
      router.refresh();
    } catch {
      toast.error("Échec du rafraîchissement");
    } finally {
      setRefreshing(false);
    }
  };

  const convert = async () => {
    const amt = parseFloat(convAmount);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Montant invalide");
      return;
    }
    setConverting(true);
    try {
      const res = await fetch(`/api/fx?currency=${convFrom}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setConvResult({
        amount: amt * data.rate,
        rate: data.rate,
        source: data.source,
        date: data.date,
      });
    } catch {
      toast.error("Erreur conversion");
    } finally {
      setConverting(false);
    }
  };

  const lastUpdated = rates.find((r) => r.date)?.date;

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Taux de change (FX)
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Source : Banque du Canada (officiel) + ECB (fallback) ·
              {lastUpdated ? ` Dernière mise à jour : ${lastUpdated}` : " Chargement…"}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${refreshing ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Sentinel — détecte quand le hero quitte le viewport */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />

      {/* Bandeau sticky compact (Wix pattern) — apparaît au scroll */}
      <div
        className={cn(
          "sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-all",
          scrolled
            ? "bg-background/95 backdrop-blur shadow-sm border-b"
            : "bg-transparent pointer-events-none opacity-0 -translate-y-2"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
          <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
            <Banknote className="h-4 w-4" />
            Taux de change
          </span>
          <span className="text-muted-foreground">{rates.length} devises</span>
          {lastUpdated && <span className="text-muted-foreground">MAJ : <span className="font-semibold">{lastUpdated}</span></span>}
          <Button
            size="sm"
            variant="ghost"
            className="ml-auto h-7 px-2 text-xs"
            onClick={refresh}
            disabled={refreshing}
          >
            <RefreshCw className={`h-3 w-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Convertisseur rapide */}
      <div className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold flex items-center gap-2 mb-3">
          <ArrowRightLeft className="h-4 w-4" />
          Convertisseur rapide
        </h2>
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <Label className="text-xs">Montant</Label>
            <Input
              type="number"
              value={convAmount}
              onChange={(e) => setConvAmount(e.target.value)}
              className="w-32 h-9"
              step="0.01"
            />
          </div>
          <div>
            <Label className="text-xs">De</Label>
            <Select value={convFrom} onValueChange={setConvFrom}>
              <SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {rates.filter((r) => r.currency !== "CAD" && r.rate !== null).map((r) => (
                  <SelectItem key={r.currency} value={r.currency}>{r.currency}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <ArrowRightLeft className="h-4 w-4 text-muted-foreground mb-2" />
          <div>
            <Label className="text-xs">Vers</Label>
            <div className="h-9 px-3 rounded-md border bg-muted flex items-center font-mono text-sm w-32">CAD</div>
          </div>
          <Button onClick={convert} disabled={converting} size="sm" className="h-9">
            Convertir
          </Button>
        </div>
        {convResult && (
          <div className="mt-3 p-3 rounded-md bg-emerald-50 border border-emerald-200">
            <p className="text-2xl font-bold text-emerald-700">
              {convResult.amount.toLocaleString("fr-CA", { style: "currency", currency: "CAD" })}
            </p>
            <p className="text-xs text-emerald-800 mt-0.5">
              {convAmount} {convFrom} × {convResult.rate.toFixed(4)} = {convResult.amount.toFixed(2)} CAD
              <span className="ml-2 text-emerald-600">({convResult.source} · {convResult.date})</span>
            </p>
          </div>
        )}
      </div>

      {/* Table des taux */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30">
          <h2 className="text-sm font-semibold flex items-center gap-2">
            <Globe className="h-4 w-4" />
            Taux courants — 1 unité = X CAD
          </h2>
        </div>
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
                <tr key={r.currency} className="border-t hover:bg-muted/30">
                  <td className="p-2.5">
                    <span className="text-lg mr-2">{meta?.flag ?? "🌍"}</span>
                    <span className="font-mono font-bold">{r.currency}</span>
                  </td>
                  <td className="p-2.5">
                    <p className="font-medium">{meta?.name ?? r.currency}</p>
                    <p className="text-[10px] text-muted-foreground">{meta?.region}</p>
                  </td>
                  <td className="p-2.5 text-right font-mono">
                    {r.rate !== null ? (
                      <span className="font-bold">{r.rate.toFixed(r.currency === "JPY" || r.currency === "XOF" || r.currency === "XAF" ? 6 : 4)}</span>
                    ) : (
                      <span className="text-muted-foreground italic">indisponible</span>
                    )}
                  </td>
                  <td className="p-2.5">
                    {r.source && (
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                        r.source === "BOC" ? "bg-emerald-100 text-emerald-700" :
                        r.source === "ECB" ? "bg-blue-100 text-blue-700" :
                        "bg-gray-100 text-gray-700"
                      }`}>
                        {r.source === "BOC" ? "Banque du Canada" : r.source === "ECB" ? "Banque centrale EU" : r.source}
                      </span>
                    )}
                  </td>
                  <td className="p-2.5 text-xs text-muted-foreground font-mono">{r.date ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Notes */}
      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 space-y-2">
        <p className="font-semibold">Comment fonctionne la conversion FX dans le système</p>
        <ul className="space-y-0.5 list-disc list-inside">
          <li>Quand un client paie une facture en USD/EUR/etc., le taux du jour (Banque du Canada) est <strong>figé</strong> sur le paiement pour audit (conformité ARC règle 3300-2-r + IFRS IAS 21).</li>
          <li>Les rapports financiers consolidés (Tableau de bord) convertissent toutes les devises en CAD au taux figé à la transaction.</li>
          <li>L&apos;écart de change entre la facture (taux d&apos;émission) et le paiement (taux du jour) génère un gain/perte qui doit être comptabilisé séparément.</li>
          <li>Les devises XOF/XAF (Afrique francophone) ont une parité fixe à l&apos;EUR (655.957) garantie par le Trésor français.</li>
        </ul>
      </div>
    </div>
  );
}

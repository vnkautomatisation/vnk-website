"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { cn } from "@/lib/utils";
import {
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  Clock,
  FileText,
  AlertCircle,
  RotateCcw,
  Globe,
  Users,
  CreditCard,
  ArrowRight,
  MapPin,
  Briefcase,
  UserPlus,
  Repeat,
  Banknote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";

type Kpis = {
  totalPaid: number;
  totalPaidCount: number;
  totalUnpaid: number;
  totalUnpaidCount: number;
  totalOverdue: number;
  totalOverdueCount: number;
  totalInvoiced: number;
  paidThisMonth: number;
  paidLastMonth: number;
  monthDeltaPct: number | null;
  paidThisYear: number;
  totalRefunded: number;
  refundedCount: number;
  totalDisputed: number;
  disputedCount: number;
  windowTotal: number;
  windowDeltaPct: number | null;
  windowDays: number;
  newClientCount: number;
  returningClientCount: number;
};

type DailyRevenue = { date: string; total: number };
type MonthlyRevenue = { month: string; ttc: number; count: number };
type JurisdictionRow = { country: string; count: number; total: number; clientCount: number };
type CurrencyRow = { currency: string; count: number; total: number; totalCad: number; clientCount: number };
type PaymentMethodRow = { method: string; count: number; total: number };
type ServiceRow = { service: string; total: number; count: number };
type CityRow = { city: string; country: string; total: number; count: number };
type ClientRow = { id: number; name: string; company: string | null; total: number; count: number; city: string | null; country: string };

const COUNTRY_NAMES: Record<string, string> = {
  CA: "Canada", US: "États-Unis", FR: "France", DE: "Allemagne", GB: "Royaume-Uni",
  IT: "Italie", ES: "Espagne", BE: "Belgique", CH: "Suisse", LU: "Luxembourg",
  CI: "Côte d'Ivoire", SN: "Sénégal", CM: "Cameroun", MA: "Maroc", TN: "Tunisie",
  BJ: "Bénin", TG: "Togo", BF: "Burkina Faso",
};

const COUNTRY_FLAGS: Record<string, string> = {
  CA: "🇨🇦", US: "🇺🇸", FR: "🇫🇷", DE: "🇩🇪", GB: "🇬🇧",
  IT: "🇮🇹", ES: "🇪🇸", BE: "🇧🇪", CH: "🇨🇭", LU: "🇱🇺",
  CI: "🇨🇮", SN: "🇸🇳", CM: "🇨🇲", MA: "🇲🇦", TN: "🇹🇳",
};

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  stripe: "Carte de crédit",
  card: "Carte de crédit",
  interac: "Interac",
  cheque: "Chèque",
  transfert: "Virement bancaire",
  cash: "Comptant",
  autre: "Autre",
};

// Palette VNK
const PIE_COLORS = ["#0F2D52", "#15406d", "#1B4F8A", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd", "#bfdbfe"];
const NEW_COLOR = "#10B981";
const RETURNING_COLOR = "#0F2D52";

function formatMonth(yyyymm: string): string {
  const [y, m] = yyyymm.split("-");
  const months = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sept", "Oct", "Nov", "Déc"];
  return `${months[Number(m) - 1]} ${y.slice(2)}`;
}

function formatDayShort(iso: string): string {
  const d = new Date(iso + "T12:00:00");
  return `${d.getDate()} ${["jan", "fév", "mar", "avr", "mai", "juin", "juil", "août", "sept", "oct", "nov", "déc"][d.getMonth()]}`;
}

// Tooltip custom recharts (style Wix). Props typés loose pour matcher l'API recharts.
type TooltipPayloadItem = { value: number; name: string; color: string };
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function ChartTooltip(props: any) {
  const active = props.active as boolean | undefined;
  const payload = props.payload as TooltipPayloadItem[] | undefined;
  const label = props.label as string | number | undefined;
  const formatter = props.formatter as ((v: number) => string) | undefined;
  if (!active || !payload || !payload.length) return null;
  return (
    <div className="bg-[#0F2D52] text-white px-3 py-2 rounded-md shadow-lg text-xs">
      {label !== undefined && label !== "" && <p className="font-semibold mb-0.5">{String(label)}</p>}
      {payload.map((p, i) => (
        <p key={i} className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: p.color }} />
          <span className="opacity-80">{p.name}</span>
          <span className="ml-auto font-bold">{formatter ? formatter(p.value) : p.value}</span>
        </p>
      ))}
    </div>
  );
}

export function FinanceView({
  kpis,
  dailyRevenue,
  monthlyRevenue,
  byJurisdiction,
  byCurrency,
  byPaymentMethod,
  byService,
  topCities,
  topClients,
}: {
  kpis: Kpis;
  dailyRevenue: DailyRevenue[];
  monthlyRevenue: MonthlyRevenue[];
  byJurisdiction: JurisdictionRow[];
  byCurrency: CurrencyRow[];
  byPaymentMethod: PaymentMethodRow[];
  byService: ServiceRow[];
  topCities: CityRow[];
  topClients: ClientRow[];
}) {
  const totalCurrencies = byCurrency.length;
  const isInternational = byJurisdiction.length > 1;
  const totalClientsWindow = kpis.newClientCount + kpis.returningClientCount;
  const newPct = totalClientsWindow > 0 ? Math.round((kpis.newClientCount / totalClientsWindow) * 100) : 0;
  const returningPct = totalClientsWindow > 0 ? 100 - newPct : 0;

  // Sticky scroll detection (Wix pattern) — la barre compact apparaît une fois les KPI passés
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  // Données pour les donuts
  const clientMixData = [
    { name: "Nouveaux", value: kpis.newClientCount, color: NEW_COLOR },
    { name: "Récurrents", value: kpis.returningClientCount, color: RETURNING_COLOR },
  ];
  const paymentMethodData = byPaymentMethod.map((m, i) => ({
    name: PAYMENT_METHOD_LABELS[m.method] ?? m.method,
    value: m.total,
    count: m.count,
    color: PIE_COLORS[i % PIE_COLORS.length],
  }));

  // Top villes pour bar chart horizontal
  const cityChartData = topCities.slice(0, 6).map((c) => ({
    name: c.city,
    total: c.total,
    country: c.country,
  }));

  const serviceChartData = byService.slice(0, 6).map((s) => ({
    name: s.service.length > 18 ? s.service.slice(0, 17) + "…" : s.service,
    total: s.total,
    count: s.count,
  }));

  return (
    <div className="space-y-5">
      {/* Hero compact avec accès rapide */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-5 text-white">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              Tableau de bord finance
            </h1>
            <p className="text-white/70 text-sm mt-1">
              {totalCurrencies > 1 ? `${totalCurrencies} devises actives · ` : ""}
              {byJurisdiction.length} {byJurisdiction.length > 1 ? "juridictions" : "juridiction"} ·
              Vue 90 derniers jours
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Link href="/admin/finance/payments"><CreditCard className="h-3.5 w-3.5 mr-1.5" />Tous les paiements</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Link href="/admin/finance/settlements"><FileText className="h-3.5 w-3.5 mr-1.5" />Rapport de règlement</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Link href="/admin/finance/payouts"><Banknote className="h-3.5 w-3.5 mr-1.5" />Versements</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Link href="/admin/refunds"><RotateCcw className="h-3.5 w-3.5 mr-1.5" />Remboursements</Link>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs principaux */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Ce mois</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600">{formatCurrency(kpis.paidThisMonth)}</p>
          {kpis.monthDeltaPct !== null && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${kpis.monthDeltaPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
              {kpis.monthDeltaPct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {kpis.monthDeltaPct >= 0 ? "+" : ""}{kpis.monthDeltaPct}% vs mois dernier
            </p>
          )}
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">Cette année</span>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </div>
          <p className="text-2xl font-bold">{formatCurrency(kpis.paidThisYear)}</p>
          <p className="text-xs text-muted-foreground mt-1">{kpis.totalPaidCount} factures payées au total</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">À recevoir</span>
            <Clock className="h-4 w-4 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600">{formatCurrency(kpis.totalUnpaid)}</p>
          <p className="text-xs text-muted-foreground mt-1">{kpis.totalUnpaidCount} facture{kpis.totalUnpaidCount > 1 ? "s" : ""} impayée{kpis.totalUnpaidCount > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs uppercase tracking-wider text-muted-foreground">En retard</span>
            <AlertCircle className="h-4 w-4 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600">{formatCurrency(kpis.totalOverdue)}</p>
          <p className="text-xs text-muted-foreground mt-1">{kpis.totalOverdueCount} facture{kpis.totalOverdueCount > 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Sentinel — détecte quand les KPI quittent le viewport */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />

      {/* Barre sticky compacte — apparaît une fois les KPI passés (pattern Wix) */}
      <div
        className={cn(
          "sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-all",
          scrolled
            ? "bg-background/95 backdrop-blur shadow-sm border-b"
            : "bg-transparent pointer-events-none opacity-0 -translate-y-2"
        )}
      >
        <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs">
          <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
            <TrendingUp className="h-4 w-4" />
            Tableau de bord finance
          </span>
          <span className="flex items-baseline gap-1.5 font-semibold">
            <span className="text-muted-foreground">{kpis.windowDays}j :</span>
            <span className="text-[#0F2D52] text-sm">{formatCurrency(kpis.windowTotal)}</span>
            {kpis.windowDeltaPct !== null && (
              <span className={kpis.windowDeltaPct >= 0 ? "text-emerald-600" : "text-red-600"}>
                {kpis.windowDeltaPct >= 0 ? "+" : ""}{kpis.windowDeltaPct}%
              </span>
            )}
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">Ce mois :</span>
            <span className="font-semibold text-emerald-600">{formatCurrency(kpis.paidThisMonth)}</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">À recevoir :</span>
            <span className="font-semibold text-amber-600">{formatCurrency(kpis.totalUnpaid)}</span>
          </span>
          <span className="flex items-baseline gap-1.5">
            <span className="text-muted-foreground">En retard :</span>
            <span className="font-semibold text-red-600">{formatCurrency(kpis.totalOverdue)}</span>
          </span>
          <span className="ml-auto flex items-center gap-3 text-muted-foreground">
            <span>{byJurisdiction.length} {byJurisdiction.length > 1 ? "juridictions" : "juridiction"}</span>
            <span>·</span>
            <span>{totalCurrencies} devise{totalCurrencies > 1 ? "s" : ""}</span>
          </span>
        </div>
      </div>

      {/* GRAPHIQUE PRINCIPAL : Évolution journalière (style Wix) */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-start justify-between gap-4 flex-wrap mb-4">
          <div>
            <p className="text-xs uppercase tracking-wider text-muted-foreground">Total des ventes</p>
            <div className="flex items-baseline gap-3 mt-1">
              <p className="text-3xl font-bold text-[#0F2D52]">{formatCurrency(kpis.windowTotal)}</p>
              {kpis.windowDeltaPct !== null && (
                <span className={`text-sm flex items-center gap-1 ${kpis.windowDeltaPct >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                  {kpis.windowDeltaPct >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {kpis.windowDeltaPct >= 0 ? "+" : ""}{kpis.windowDeltaPct}%
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {kpis.windowDays} derniers jours · vs période précédente
            </p>
          </div>
        </div>
        <div className="h-[260px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyRevenue} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4} />
                  <stop offset="100%" stopColor="#3b82f6" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDayShort}
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={{ stroke: "#e2e8f0" }}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={30}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                axisLine={false}
                tickLine={false}
                tickFormatter={(v: number) => `${v} $`}
                width={50}
              />
              <Tooltip
                content={(props) => (
                  <ChartTooltip
                    {...props}
                    label={props.label ? formatDayShort(String(props.label)) : ""}
                    formatter={(v: number) => formatCurrency(v)}
                  />
                )}
              />
              <Area
                type="monotone"
                dataKey="total"
                name="Ventes"
                stroke="#2563eb"
                strokeWidth={2}
                fill="url(#colorRevenue)"
                activeDot={{ r: 5, fill: "#2563eb", stroke: "#fff", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Donuts : Total / Nouveaux vs récurrents / Moyens de paiement */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Donut Total des ventes — un seul anneau plein avec montant au centre */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3">Total des ventes</h2>
          <div className="relative h-[200px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[{ name: "En ligne", value: kpis.windowTotal || 1 }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={0}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                >
                  <Cell fill="#2563eb" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
              <p className="text-lg font-bold text-[#0F2D52]">{formatCurrency(kpis.windowTotal)}</p>
            </div>
          </div>
          <div className="flex items-center justify-between mt-3 text-xs">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block" />
              <span className="text-muted-foreground">En ligne</span>
            </div>
            <span className="font-semibold">100% · {formatCurrency(kpis.windowTotal)}</span>
          </div>
        </div>

        {/* Donut Nouveaux vs récurrents */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3">Nouveaux vs clients réguliers</h2>
          <div className="relative h-[200px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={totalClientsWindow > 0 ? clientMixData : [{ name: "Aucun", value: 1, color: "#e2e8f0" }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {(totalClientsWindow > 0 ? clientMixData : [{ color: "#e2e8f0" }]).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Clients</p>
              <p className="text-2xl font-bold text-[#0F2D52]">{totalClientsWindow}</p>
            </div>
          </div>
          <div className="space-y-1.5 mt-3 text-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: NEW_COLOR }} />
                <UserPlus className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Nouveaux</span>
              </div>
              <span className="font-semibold">{newPct}% · {kpis.newClientCount}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: RETURNING_COLOR }} />
                <Repeat className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">Réguliers</span>
              </div>
              <span className="font-semibold">{returningPct}% · {kpis.returningClientCount}</span>
            </div>
          </div>
        </div>

        {/* Donut Moyens de paiement */}
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold mb-3">Moyens de paiement</h2>
          <div className="relative h-[200px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={paymentMethodData.length > 0 ? paymentMethodData : [{ name: "Aucun", value: 1, color: "#e2e8f0" }]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={85}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {(paymentMethodData.length > 0 ? paymentMethodData : [{ color: "#e2e8f0" }]).map((entry, i) => (
                    <Cell key={i} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={(props) => (
                    <ChartTooltip {...props} formatter={(v: number) => formatCurrency(v)} />
                  )}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Modes</p>
              <p className="text-2xl font-bold text-[#0F2D52]">{paymentMethodData.length}</p>
            </div>
          </div>
          <div className="space-y-1 mt-3 text-xs max-h-[80px] overflow-y-auto">
            {paymentMethodData.length === 0 ? (
              <p className="text-muted-foreground italic text-center">Aucun paiement</p>
            ) : paymentMethodData.map((m) => (
              <div key={m.name} className="flex items-center justify-between">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="w-2.5 h-2.5 rounded-full inline-block shrink-0" style={{ backgroundColor: m.color }} />
                  <span className="text-muted-foreground truncate">{m.name}</span>
                </div>
                <span className="font-semibold shrink-0 ml-2">{formatCurrency(m.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Top villes (bar chart horizontal) + Carte juridictions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><MapPin className="h-4 w-4" />Ventes par ville</h2>
            <span className="text-[10px] text-muted-foreground">{topCities.length} villes</span>
          </div>
          {cityChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-12">Aucune ville enregistrée</p>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={cityChartData}
                  layout="vertical"
                  margin={{ top: 5, right: 30, bottom: 0, left: 0 }}
                >
                  <CartesianGrid stroke="#f1f5f9" horizontal={false} />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v} $`}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    width={90}
                  />
                  <Tooltip
                    content={(props) => (
                      <ChartTooltip {...props} formatter={(v: number) => formatCurrency(v)} />
                    )}
                  />
                  <Bar dataKey="total" name="Total" fill="#2563eb" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold flex items-center gap-2"><Globe className="h-4 w-4" />Répartition par juridiction</h2>
            {isInternational && <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">International</span>}
          </div>
          {byJurisdiction.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-12">Aucune transaction</p>
          ) : (
            <div className="space-y-2">
              {byJurisdiction.map((j) => {
                const totalAll = byJurisdiction.reduce((s, x) => s + x.total, 0);
                const pct = totalAll > 0 ? Math.round((j.total / totalAll) * 100) : 0;
                return (
                  <div key={j.country} className="p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3">
                      <span className="text-xl shrink-0">{COUNTRY_FLAGS[j.country] ?? "🌍"}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{COUNTRY_NAMES[j.country] || j.country}</p>
                        <p className="text-[10px] text-muted-foreground">{j.clientCount} client{j.clientCount > 1 ? "s" : ""} · {j.count} transaction{j.count > 1 ? "s" : ""}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-sm">{formatCurrency(j.total)}</p>
                        <p className="text-[10px] text-muted-foreground">{pct}%</p>
                      </div>
                    </div>
                    <div className="mt-1.5 h-1 bg-muted rounded-full overflow-hidden">
                      <div className="h-full bg-blue-600 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Devises (séparation par devise + équivalent CAD) + Top services */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><CreditCard className="h-4 w-4" />Encaissements par devise</h2>
          {byCurrency.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-12">Aucune devise enregistrée</p>
          ) : (
            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 px-2 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                <div className="col-span-2">Devise</div>
                <div className="col-span-3 text-right">Brut (devise)</div>
                <div className="col-span-3 text-right">≈ CAD</div>
                <div className="col-span-2 text-right">Clients</div>
                <div className="col-span-2 text-right">Tx</div>
              </div>
              {byCurrency.map((c) => (
                <div key={c.currency} className="grid grid-cols-12 gap-2 items-center p-2 rounded bg-muted/30 hover:bg-muted/50 transition-colors text-sm">
                  <div className="col-span-2 font-mono font-bold">{c.currency}</div>
                  <div className="col-span-3 text-right font-semibold">{c.total.toFixed(2)}</div>
                  <div className="col-span-3 text-right text-muted-foreground">{formatCurrency(c.totalCad)}</div>
                  <div className="col-span-2 text-right text-xs text-muted-foreground">{c.clientCount}</div>
                  <div className="col-span-2 text-right text-xs text-muted-foreground">{c.count}</div>
                </div>
              ))}
              <p className="text-[10px] text-muted-foreground italic mt-2 pt-2 border-t">
                Chaque paiement est conservé dans sa devise d&apos;origine. La conversion en CAD est figée au taux du jour de la transaction (Banque du Canada / ECB) pour conformité IFRS &amp; ARC.
              </p>
            </div>
          )}
        </div>

        <div className="rounded-xl border bg-card p-5">
          <h2 className="text-sm font-semibold flex items-center gap-2 mb-3"><Briefcase className="h-4 w-4" />Ventes par type de service</h2>
          {serviceChartData.length === 0 ? (
            <p className="text-sm text-muted-foreground italic text-center py-12">Aucun service enregistré</p>
          ) : (
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={serviceChartData} margin={{ top: 5, right: 10, bottom: 30, left: 0 }}>
                  <CartesianGrid stroke="#f1f5f9" vertical={false} />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 10, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "#64748b" }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v} $`}
                  />
                  <Tooltip
                    content={(props) => (
                      <ChartTooltip {...props} formatter={(v: number) => formatCurrency(v)} />
                    )}
                  />
                  <Bar dataKey="total" name="Total" fill="#0F2D52" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Évolution mensuelle (12 mois) — bar chart compact */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><TrendingUp className="h-4 w-4" />Revenus mensuels — 12 derniers mois</h2>
          <Link href="/admin/finance/payments" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            Détail <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {monthlyRevenue.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-12">Aucun revenu enregistré</p>
        ) : (
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyRevenue.slice(-12).map((m) => ({ name: formatMonth(m.month), total: m.ttc, count: m.count }))} margin={{ top: 5, right: 10, bottom: 0, left: 0 }}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#64748b" }} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${v} $`} />
                <Tooltip
                  content={(props) => (
                    <ChartTooltip {...props} formatter={(v: number) => formatCurrency(v)} />
                  )}
                />
                <Bar dataKey="total" name="Total" fill="#10B981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Top 10 clients (90 jours) avec ville */}
      <div className="rounded-xl border bg-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold flex items-center gap-2"><Users className="h-4 w-4" />Top 10 clients — 90 derniers jours</h2>
          <Link href="/admin/clients" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            Voir tous <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {topClients.length === 0 ? (
          <p className="text-sm text-muted-foreground italic text-center py-12">Aucun client encore</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
            {topClients.map((c, i) => (
              <Link
                key={c.id}
                href={`/admin/clients?openClient=${c.id}`}
                className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 text-sm"
              >
                <span className="w-6 text-muted-foreground font-mono text-xs">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{c.name}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {c.company ? `${c.company} · ` : ""}
                    {COUNTRY_FLAGS[c.country] ?? "🌍"} {c.city ?? COUNTRY_NAMES[c.country] ?? c.country}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-sm">{formatCurrency(c.total)}</p>
                  <p className="text-[10px] text-muted-foreground">{c.count} pmt{c.count > 1 ? "s" : ""}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* KPIs secondaires : remboursements, litiges, total facturé */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="rounded-lg border bg-card p-3 text-sm flex items-center gap-3">
          <RotateCcw className="h-5 w-5 text-red-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Remboursements</p>
            <p className="font-bold">{formatCurrency(kpis.totalRefunded)} <span className="text-xs text-muted-foreground font-normal">· {kpis.refundedCount}</span></p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-sm flex items-center gap-3">
          <AlertCircle className="h-5 w-5 text-rose-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Litiges en cours</p>
            <p className="font-bold">{formatCurrency(kpis.totalDisputed)} <span className="text-xs text-muted-foreground font-normal">· {kpis.disputedCount}</span></p>
          </div>
        </div>
        <div className="rounded-lg border bg-card p-3 text-sm flex items-center gap-3">
          <FileText className="h-5 w-5 text-blue-500 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Total facturé (vie)</p>
            <p className="font-bold">{formatCurrency(kpis.totalInvoiced)}</p>
          </div>
        </div>
      </div>

      {/* Note pédagogique */}
      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 space-y-1">
        <p className="font-semibold">Lecture du tableau de bord</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Les montants en CAD sont figés au taux du jour de la transaction (audit IFRS / ARC).</li>
          <li>La fenêtre principale est de {kpis.windowDays} jours, comparée à la période précédente de même durée.</li>
          <li>Un client est compté &quot;nouveau&quot; si son tout premier paiement est dans la fenêtre courante.</li>
          <li>La répartition par juridiction utilise le pays inscrit sur la fiche client (par défaut : Canada).</li>
        </ul>
      </div>
    </div>
  );
}

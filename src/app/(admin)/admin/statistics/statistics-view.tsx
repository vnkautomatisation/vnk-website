"use client";
// Vue Statistiques — KPIs + graphiques Recharts.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { useRouter } from "next/navigation";
import {
  BarChart3, TrendingUp, TrendingDown, DollarSign, FileText,
  Users, Briefcase, Receipt, AlertCircle, Crown,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Series = { month: string; revenue?: number; count: number }[];
type TopClient = { id: number; name: string; company: string | null; total: number };
type StatusRow = { status: string; count: number; total: number };
type ServiceRow = { service: string; count: number; total: number };

const STATUS_COLORS: Record<string, string> = {
  paid: "#26A269",
  unpaid: "#1A5FB4",
  partially_paid: "#E5A50A",
  overdue: "#C01C28",
  cancelled: "#6b7280",
  refunded: "#613583",
  draft: "#9ca3af",
};
const STATUS_KEYS: Record<string, string> = {
  paid: "payee",
  unpaid: "impayee",
  partially_paid: "partielle",
  overdue: "retard",
  cancelled: "annulee",
  refunded: "remboursee",
  draft: "brouillon",
};
const PIE_COLORS = ["#0F2D52", "#1A5FB4", "#26A269", "#E5A50A", "#613583", "#C01C28", "#6b7280", "#9333ea", "#0891b2", "#db2777"];

const RANGES = [
  { key: "30d", labelKey: "30_jours" },
  { key: "90d", labelKey: "90_jours" },
  { key: "6m", labelKey: "6_mois" },
  { key: "12m", labelKey: "12_mois" },
  { key: "ytd", labelKey: "annee" },
  { key: "all", labelKey: "tout" },
];

function fmtMoney(n: number, compact: boolean, tag: string): string {
  // La notation compacte vient d'Intl : "$20.0K" en anglais, "20,0 k$" en
  // francais. Les suffixes ecrits a la main sortaient en francais partout.
  return n.toLocaleString(tag, {
    style: "currency",
    currency: "CAD",
    ...(compact && n >= 1_000
      ? { notation: "compact" as const, maximumFractionDigits: 1 }
      : { minimumFractionDigits: 0, maximumFractionDigits: 0 }),
  });
}
function fmtMonth(iso: string, tag: string): string {
  const [year, month] = iso.split("-");
  const d = new Date(Number(year), Number(month) - 1, 1);
  return d.toLocaleDateString(tag, { month: "short", year: "2-digit" });
}

// Wrappers pour types Recharts qui acceptent ValueType | undefined

export function StatisticsView({
  range, kpis, seriesInvoices, seriesClients, topClients, statusBreakdown, serviceBreakdown,
}: {
  range: string;
  kpis: {
    revenue: number; outstanding: number;
    totalInvoices: number; paidInvoices: number; paymentRate: number;
    totalQuotes: number; acceptedQuotes: number; conversionRate: number;
    totalClients: number; activeMandates: number;
  };
  seriesInvoices: Series;
  seriesClients: Series;
  topClients: TopClient[];
  statusBreakdown: StatusRow[];
  serviceBreakdown: ServiceRow[];
}) {
  const t = useTranslations("admin.statistics");
  const router = useRouter();
  const dateTag = useDateLocale();
  // Enveloppes pour les types Recharts, qui n'acceptent qu'un argument.
  const moneyFormatter = (v: unknown): string => fmtMoney(Number(v ?? 0), false, dateTag);
  const moneyCompactFormatter = (v: unknown): string => fmtMoney(Number(v ?? 0), true, dateTag);
  const monthLabelFormatter = (label: unknown): string => fmtMonth(String(label ?? ""), dateTag);
  const monthTickFormatter = (v: unknown): string => fmtMonth(String(v ?? ""), dateTag);

  return (
    <div className="space-y-6">

      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-cyan-500 shrink-0">
            <BarChart3 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("statistiques")}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {t("performance_commerciale_financiere_temps_reel")}
            </p>
          </div>
        </div>
        <div className="flex gap-1 rounded-lg border bg-card p-1 overflow-x-auto">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => router.push(`/admin/statistics?range=${r.key}`)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md whitespace-nowrap transition-colors",
                range === r.key ? "bg-[#0F2D52] text-white" : "text-muted-foreground hover:bg-muted"
              )}
            >
              {t(r.labelKey)}
            </button>
          ))}
        </div>
      </div>


      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kpi icon={DollarSign} label={t("revenus_encaisses")} value={fmtMoney(kpis.revenue, false, dateTag)} accent="text-emerald-600" subline={t("statistics_view_p0_factures_payees", { p0: kpis.paidInvoices })} />
        <Kpi icon={AlertCircle} label={t("creances_clients")} value={fmtMoney(kpis.outstanding, false, dateTag)} accent="text-amber-600" subline={t("non_payees_retards")} />
        <Kpi icon={Receipt} label={t("taux_paiement")} value={`${kpis.paymentRate}%`} accent={kpis.paymentRate >= 80 ? "text-emerald-600" : kpis.paymentRate >= 50 ? "text-amber-600" : "text-red-600"} subline={t("n_sur_m_factures", { paid: kpis.paidInvoices, total: kpis.totalInvoices })} trend={kpis.paymentRate >= 70 ? "up" : "down"} />
        <Kpi icon={FileText} label={t("conversion_devis")} value={`${kpis.conversionRate}%`} accent={kpis.conversionRate >= 60 ? "text-emerald-600" : kpis.conversionRate >= 30 ? "text-amber-600" : "text-red-600"} subline={t("statistics_view_p0_p1_acceptes", { p0: kpis.acceptedQuotes, p1: kpis.totalQuotes })} trend={kpis.conversionRate >= 50 ? "up" : "down"} />
        <Kpi icon={Users} label={t("nouveaux_clients")} value={kpis.totalClients.toString()} accent="text-blue-600" subline={t("sur_periode")} />
        <Kpi icon={Briefcase} label={t("mandats_actifs")} value={kpis.activeMandates.toString()} accent="text-violet-600" subline={t("cours_execution")} />
        <Kpi icon={Receipt} label={t("factures_emises")} value={kpis.totalInvoices.toString()} accent="text-cyan-600" subline={t("sur_periode")} />
        <Kpi icon={FileText} label={t("devis_envoyes")} value={kpis.totalQuotes.toString()} accent="text-pink-600" subline={t("sur_periode")} />
      </div>


      <Card>
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h2 className="text-base font-semibold">{t("revenus_mensuels")}</h2>
              <p className="text-xs text-muted-foreground">{t("factures_payees_mois")}</p>
            </div>
            <Badge variant="outline" className="text-[10px]">{t("n_mois", { count: seriesInvoices.length })}</Badge>
          </div>
          {seriesInvoices.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={seriesInvoices} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#26A269" stopOpacity={0.4} />
                    <stop offset="100%" stopColor="#26A269" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthTickFormatter} fontSize={11} stroke="#6b7280" />
                <YAxis tickFormatter={moneyCompactFormatter} fontSize={11} stroke="#6b7280" />
                <Tooltip
                  formatter={moneyFormatter}
                  labelFormatter={monthLabelFormatter}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area type="monotone" dataKey="revenue" stroke="#26A269" strokeWidth={2} fill="url(#revenueGradient)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <EmptyChart label={t("aucune_facture_payee_periode")} />
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold mb-3">{t("nouveaux_clients")}</h2>
            {seriesClients.length > 0 ? (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={seriesClients} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                  <XAxis dataKey="month" tickFormatter={monthTickFormatter} fontSize={11} stroke="#6b7280" />
                  <YAxis allowDecimals={false} fontSize={11} stroke="#6b7280" />
                  <Tooltip
                    labelFormatter={monthLabelFormatter}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="count" fill="#1A5FB4" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("aucun_nouveau_client_periode")} />
            )}
          </CardContent>
        </Card>


        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold mb-3">{t("statuts_factures")}</h2>
            {statusBreakdown.length > 0 ? (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width={180} height={200}>
                  <PieChart>
                    <Pie
                      data={statusBreakdown}
                      dataKey="count"
                      nameKey="status"
                      cx="50%"
                      cy="50%"
                      outerRadius={70}
                      innerRadius={45}
                      paddingAngle={2}
                    >
                      {statusBreakdown.map((entry) => (
                        <Cell key={entry.status} fill={STATUS_COLORS[entry.status] ?? "#6b7280"} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: unknown, name: unknown) => [String(v), STATUS_KEYS[String(name)] ? t(STATUS_KEYS[String(name)]) : String(name)]}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1.5">
                  {statusBreakdown.map((s) => (
                    <div key={s.status} className="flex items-center gap-2 text-xs">
                      <div className="h-3 w-3 rounded-sm shrink-0" style={{ backgroundColor: STATUS_COLORS[s.status] ?? "#6b7280" }} />
                      <span className="flex-1">{STATUS_KEYS[s.status] ? t(STATUS_KEYS[s.status]) : s.status}</span>
                      <span className="font-semibold tabular-nums">{s.count}</span>
                      <span className="text-muted-foreground tabular-nums text-[10px]">{fmtMoney(s.total, true, dateTag)}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <EmptyChart label={t("aucune_facture_periode")} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        <Card>
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Crown className="h-4 w-4 text-amber-500" />
              <h2 className="text-base font-semibold">{t("top_clients_ca")}</h2>
            </div>
            {topClients.length > 0 ? (
              <div className="space-y-2">
                {topClients.map((c, idx) => {
                  const maxTotal = topClients[0]?.total || 1;
                  const pct = (c.total / maxTotal) * 100;
                  return (
                    <Link key={c.id} href={`/admin/clients?open=${c.id}`} className="block group">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-bold text-muted-foreground w-5">#{idx + 1}</span>
                        <span className="text-sm font-medium flex-1 truncate group-hover:underline">{c.name}</span>
                        {c.company && <span className="text-[10px] text-muted-foreground truncate max-w-[100px]">{c.company}</span>}
                        <span className="text-sm font-bold tabular-nums">{fmtMoney(c.total, false, dateTag)}</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-gradient-to-r from-[#0F2D52] to-[#1A5FB4]" style={{ width: `${pct}%` }} />
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <EmptyChart label={t("aucun_client_payeur_periode")} />
            )}
          </CardContent>
        </Card>


        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold mb-3">{t("revenus_type_service")}</h2>
            {serviceBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={serviceBreakdown} layout="vertical" margin={{ top: 5, right: 10, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" horizontal={false} />
                  <XAxis type="number" tickFormatter={moneyCompactFormatter} fontSize={11} stroke="#6b7280" />
                  <YAxis type="category" dataKey="service" fontSize={11} width={120} stroke="#6b7280" />
                  <Tooltip
                    formatter={moneyFormatter}
                    contentStyle={{ fontSize: 12, borderRadius: 8 }}
                  />
                  <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                    {serviceBreakdown.map((_, idx) => (
                      <Cell key={idx} fill={PIE_COLORS[idx % PIE_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <EmptyChart label={t("aucun_service_categorise_periode")} />
            )}
          </CardContent>
        </Card>
      </div>


      {seriesInvoices.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h2 className="text-base font-semibold mb-3">{t("volume_vs_revenus")}</h2>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={seriesInvoices} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                <XAxis dataKey="month" tickFormatter={monthTickFormatter} fontSize={11} stroke="#6b7280" />
                <YAxis yAxisId="left" tickFormatter={moneyCompactFormatter} fontSize={11} stroke="#26A269" />
                <YAxis yAxisId="right" orientation="right" allowDecimals={false} fontSize={11} stroke="#1A5FB4" />
                <Tooltip
                  formatter={(v: unknown, name: unknown) => name === "revenue" ? fmtMoney(Number(v ?? 0), false, dateTag) : String(v ?? "")}
                  labelFormatter={monthLabelFormatter}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: unknown) => String(v) === "revenue" ? t("revenus") : t("nombre")} />
                <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#26A269" strokeWidth={2} dot={{ r: 4 }} />
                <Line yAxisId="right" type="monotone" dataKey="count" stroke="#1A5FB4" strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function Kpi({
  icon: Icon, label, value, accent, subline, trend,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  accent: string;
  subline?: string;
  trend?: "up" | "down";
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <Icon className={cn("h-4 w-4", accent)} />
          {trend === "up" && <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />}
          {trend === "down" && <TrendingDown className="h-3.5 w-3.5 text-red-600" />}
        </div>
        <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{label}</p>
        <p className="text-xl font-bold mt-0.5">{value}</p>
        {subline && <p className="text-[10px] text-muted-foreground mt-0.5">{subline}</p>}
      </CardContent>
    </Card>
  );
}

function EmptyChart({ label }: { label: string }) {
  return (
    <div className="h-[240px] flex items-center justify-center text-sm text-muted-foreground bg-muted/20 rounded-md border border-dashed">
      {label}
    </div>
  );
}

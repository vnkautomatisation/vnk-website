"use client";
import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  BarChart3, ClipboardList, FileText, DollarSign, CheckCircle2, Calendar, LogIn,
} from "lucide-react";
import type { LoginEventRow, PersonalKpis } from "../profile-view";

const fmtCAD = (n: number, tag: string) => new Intl.NumberFormat(tag, { style: "currency", currency: "CAD" }).format(n);

export function TabStats({ kpis, loginEvents }: { kpis: PersonalKpis; loginEvents: LoginEventRow[] }) {
  const t = useTranslations("admin.profile.stats");
  const dateTag = useDateLocale();
  // ── Heatmap d'activite hebdomadaire (28 dernier jours)
  // Compte les login_success par jour, normalise sur max
  const heatmap = useMemo(() => {
    const days: { date: Date; count: number }[] = [];
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    for (let i = 27; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      days.push({ date: d, count: 0 });
    }
    loginEvents.forEach((e) => {
      if (e.type !== "success" && e.type !== "2fa_success") return;
      const evDate = new Date(e.createdAt);
      evDate.setHours(0, 0, 0, 0);
      const idx = days.findIndex((d) => d.date.getTime() === evDate.getTime());
      if (idx >= 0) days[idx].count++;
    });
    const max = Math.max(...days.map((d) => d.count), 1);
    return { days, max };
  }, [loginEvents]);

  const kpiCards = [
    { label: t("requests_handled"), value: kpis.requestsHandled, icon: ClipboardList, color: "text-blue-600 bg-blue-50" },
    { label: t("invoices_issued"), value: kpis.invoicesIssued, icon: FileText, color: "text-emerald-600 bg-emerald-50" },
    { label: t("revenue_generated"), value: fmtCAD(kpis.revenue30, dateTag), icon: DollarSign, color: "text-purple-600 bg-purple-50" },
    { label: t("payments_assigned"), value: kpis.paymentsAssigned, icon: CheckCircle2, color: "text-amber-600 bg-amber-50" },
  ];

  // ── Stats connexions ────────────────────────────
  const loginsLast30 = loginEvents.filter((e) => Date.now() - new Date(e.createdAt).getTime() < 30 * 24 * 60 * 60 * 1000);
  const successCount = loginsLast30.filter((e) => e.type === "success" || e.type === "2fa_success").length;
  const failedCount = loginsLast30.filter((e) => e.type === "failed" || e.type === "2fa_failed").length;
  const uniqueLocations = new Set(loginsLast30.map((e) => `${e.city ?? ""}-${e.country ?? ""}`).filter((s) => s !== "-")).size;
  const uniqueDevices = new Set(loginsLast30.map((e) => `${e.deviceType ?? ""}`).filter(Boolean)).size;

  return (
    <div className="space-y-4">
      {/* ── KPI 30 derniers jours ─── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BarChart3 className="h-4 w-4" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {kpiCards.map((k) => {
              const Icon = k.icon;
              return (
                <div key={k.label} className="rounded-lg border bg-card p-4">
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center ${k.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className="text-2xl font-bold mt-3">{k.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.label}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Heatmap activite ──── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            {t("heatmap_title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-1 overflow-x-auto pb-2">
            {heatmap.days.map((d, i) => {
              const intensity = d.count / heatmap.max;
              const bgClass = d.count === 0 ? "bg-muted" :
                intensity > 0.75 ? "bg-emerald-600" :
                intensity > 0.5 ? "bg-emerald-500" :
                intensity > 0.25 ? "bg-emerald-400" : "bg-emerald-200";
              return (
                <div
                  key={i}
                  className={`${bgClass} h-12 w-7 rounded flex-shrink-0 relative group cursor-default`}
                  title={`${d.date.toLocaleDateString(dateTag, { day: "numeric", month: "short" })} — ${d.count} connexion${d.count > 1 ? "s" : ""}`}
                  data-count={d.count}
                >
                  <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    {d.date.toLocaleDateString(dateTag, { day: "numeric", month: "short" })}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-end gap-2 mt-2 text-[10px] text-muted-foreground">
            <span>{t("heatmap_less")}</span>
            <div className="flex gap-0.5">
              <div className="h-3 w-3 rounded bg-muted" />
              <div className="h-3 w-3 rounded bg-emerald-200" />
              <div className="h-3 w-3 rounded bg-emerald-400" />
              <div className="h-3 w-3 rounded bg-emerald-500" />
              <div className="h-3 w-3 rounded bg-emerald-600" />
            </div>
            <span>{t("heatmap_more")}</span>
          </div>
        </CardContent>
      </Card>

      {/* ── Resume connexions ─── */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <LogIn className="h-4 w-4" />
            {t("logins_summary")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
            <div>
              <p className="text-2xl font-bold text-emerald-600">{successCount}</p>
              <p className="text-xs text-muted-foreground">{t("successful")}</p>
            </div>
            <div>
              <p className={`text-2xl font-bold ${failedCount > 5 ? "text-red-600" : "text-amber-600"}`}>{failedCount}</p>
              <p className="text-xs text-muted-foreground">{t("failed")}</p>
              {failedCount > 5 && <Badge variant="destructive" className="mt-1 text-[10px]">{t("to_watch")}</Badge>}
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueLocations}</p>
              <p className="text-xs text-muted-foreground">{t("locations")}</p>
            </div>
            <div>
              <p className="text-2xl font-bold">{uniqueDevices}</p>
              <p className="text-xs text-muted-foreground">{t("device_types")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

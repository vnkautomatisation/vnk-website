"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { toast } from "sonner";
import {
  Activity, Search, Download, RefreshCw, LogIn, ShoppingCart, FileSignature,
  ShieldCheck, Mail, FileText, GitBranch, Clock, Users, Globe,
  FileDown, AlertTriangle, AlertCircle, CheckCircle2, Info, X,
  Plane, Lock, Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { cn } from "@/lib/utils";

type Severity = "info" | "success" | "warning" | "error" | "critical";
type AnomalyFlag = "failed_login_burst" | "off_hours_admin" | "impossible_travel" | "bulk_export" | "new_geo";

type AuditEvent = {
  id: string;
  source: "login" | "order" | "signature" | "consent" | "email" | "audit" | "workflow";
  type: string;
  label: string;
  severity: Severity;
  result: "success" | "failed" | "neutral";
  anomalies: AnomalyFlag[];
  clientId: number | null;
  clientName?: string | null;
  adminId?: number | null;
  adminEmail?: string | null;
  email?: string | null;
  ipAddress: string | null;
  userAgent?: string | null;
  country?: string | null;
  city?: string | null;
  amount?: number | null;
  currency?: string | null;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
};

type Stats = {
  total: number;
  bySeverity: Record<Severity, number>;
  anomaliesCount: number;
  failedCount: number;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };

const SOURCE_OPTIONS = [
  { value: "login", labelKey: "connexions", icon: LogIn, color: "bg-blue-100 text-blue-700" },
  { value: "order", labelKey: "commandes_paiements", icon: ShoppingCart, color: "bg-emerald-100 text-emerald-700" },
  { value: "signature", labelKey: "signatures", icon: FileSignature, color: "bg-violet-100 text-violet-700" },
  { value: "consent", labelKey: "consentements", icon: ShieldCheck, color: "bg-cyan-100 text-cyan-700" },
  { value: "email", labelKey: "courriels", icon: Mail, color: "bg-amber-100 text-amber-700" },
  { value: "audit", labelKey: "actions_admin", icon: FileText, color: "bg-red-100 text-red-700" },
  { value: "workflow", labelKey: "workflow", icon: GitBranch, color: "bg-indigo-100 text-indigo-700" },
];

const SEVERITY_META: Record<Severity, { labelKey: string; icon: typeof Activity; color: string; bg: string; ring: string }> = {
  critical: { labelKey: "critique", icon: AlertTriangle, color: "text-red-700", bg: "bg-red-100", ring: "ring-red-300" },
  error: { labelKey: "erreur", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", ring: "ring-red-200" },
  warning: { labelKey: "avertissement", icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" },
  success: { labelKey: "succes", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  info: { labelKey: "info", icon: Info, color: "text-slate-600", bg: "bg-slate-50", ring: "ring-slate-200" },
};

const ANOMALY_META: Record<AnomalyFlag, { labelKey: string; icon: typeof Activity; descriptionKey: string }> = {
  failed_login_burst: { labelKey: "rafale_echecs", icon: Zap, descriptionKey: "plus_5_echecs_connexion_10" },
  impossible_travel: { labelKey: "trajet_impossible", icon: Plane, descriptionKey: "deux_connexions_reussies_depuis_pays" },
  off_hours_admin: { labelKey: "action_hors_heures", icon: Clock, descriptionKey: "action_admin_entre_22_h" },
  bulk_export: { labelKey: "export_massif", icon: FileDown, descriptionKey: "plus_3_exports_admin_5" },
  new_geo: { labelKey: "nouvelle_geo", icon: Globe, descriptionKey: "premiere_connexion_depuis_pays" },
};

function fmtRelative(iso: string, justNow: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return justNow;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Présets Loi 25 / forensique
type Preset = {
  key: string;
  labelKey: string;
  descriptionKey: string;
  icon: typeof Activity;
  color: string;
  apply: (opts: { now: Date }) => {
    sourceFilters?: string[];
    severityFilters?: string[];
    resultFilters?: string[];
    anomalyOnly?: boolean;
    from?: string;
    to?: string;
  };
};

const PRESETS: Preset[] = [
  {
    key: "failed_24h",
    labelKey: "echecs_24_h",
    descriptionKey: "actions_echouees_dernieres_24_heures",
    icon: AlertCircle,
    color: "bg-red-100 text-red-700 border-red-200",
    apply: ({ now }) => {
      const from = new Date(now); from.setDate(from.getDate() - 1);
      return { resultFilters: ["failed"], from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    },
  },
  {
    key: "admin_actions",
    labelKey: "actions_admin",
    descriptionKey: "actions_effectuees_administrateurs",
    icon: ShieldCheck,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    apply: () => ({ sourceFilters: ["audit"] }),
  },
  {
    key: "anomalies",
    labelKey: "anomalies_detectees",
    descriptionKey: "evenements_anomalie_automatique_burst_trajet",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-700 border-red-200",
    apply: () => ({ anomalyOnly: true }),
  },
  {
    key: "loi_25",
    labelKey: "registre_loi_25",
    descriptionKey: "incidents_confidentialite_echecs_login_consentements",
    icon: Lock,
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    apply: () => ({ sourceFilters: ["login", "consent", "audit", "signature"], resultFilters: ["failed", "neutral"] }),
  },
  {
    key: "off_hours",
    labelKey: "hors_heures",
    descriptionKey: "actions_admin_effectuees_entre_22",
    icon: Clock,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    apply: () => ({ sourceFilters: ["audit"], anomalyOnly: true }),
  },
];

type AdminOption = { id: number; fullName: string | null; email: string };

export function AuditTrailView({
  clients,
  admins = [],
  counts,
}: {
  clients: ClientOption[];
  admins?: AdminOption[];
  counts: Record<string, number>;
}) {
  const t = useTranslations("admin.audit");
  const dateTag = useDateLocale();
  const tc = useTranslations("common");
  const { open: openEntity } = useEntityPanels();
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, bySeverity: { critical: 0, error: 0, warning: 0, success: 0, info: 0 }, anomaliesCount: 0, failedCount: 0 });
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [sourceFilters, setSourceFilters] = useState<Set<string>>(new Set());
  const [severityFilters, setSeverityFilters] = useState<Set<Severity>>(new Set());
  const [resultFilters, setResultFilters] = useState<Set<"success" | "failed">>(new Set());
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [filterClient, setFilterClient] = useState<string>("");
  const [filterAdmin, setFilterAdmin] = useState<string>("");

  const [actorScope, setActorScope] = useState<"all" | "admin_only" | "client_only">("all");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [limit, setLimit] = useState(300);
  const [activePreset, setActivePreset] = useState<string | null>(null);


  const [detailEvent, setDetailEvent] = useState<AuditEvent | null>(null);


  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilters.size > 0) params.set("type", Array.from(sourceFilters).join(","));
      if (severityFilters.size > 0) params.set("severity", Array.from(severityFilters).join(","));
      if (resultFilters.size > 0) params.set("result", Array.from(resultFilters).join(","));
      if (anomalyOnly) params.set("anomaly", "1");
      if (filterClient) params.set("clientId", filterClient);
      if (filterAdmin) params.set("adminId", filterAdmin);
      if (actorScope !== "all") params.set("actorScope", actorScope);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      params.set("limit", String(limit));
      const res = await fetch(`/api/audit-trail?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
        setStats(data.stats ?? stats);
      } else {
        toast.error(t("erreur_chargement"));
      }
    } finally { setLoading(false); }

  }, [sourceFilters, severityFilters, resultFilters, anomalyOnly, filterClient, filterAdmin, actorScope, filterFrom, filterTo, limit]);

  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    if (!search) return events;
    const q = search.toLowerCase();
    return events.filter((e) =>
      e.label.toLowerCase().includes(q) ||
      e.type.toLowerCase().includes(q) ||
      (e.clientName ?? "").toLowerCase().includes(q) ||
      (e.email ?? "").toLowerCase().includes(q) ||
      (e.adminEmail ?? "").toLowerCase().includes(q) ||
      (e.ipAddress ?? "").toLowerCase().includes(q) ||
      (e.country ?? "").toLowerCase().includes(q)
    );
  }, [events, search]);

  const applyPreset = (p: Preset) => {
    const result = p.apply({ now: new Date() });
    setSourceFilters(new Set(result.sourceFilters ?? []));
    setSeverityFilters(new Set(result.severityFilters as Severity[] ?? []));
    setResultFilters(new Set(result.resultFilters as ("success" | "failed")[] ?? []));
    setAnomalyOnly(!!result.anomalyOnly);
    setFilterFrom(result.from ?? "");
    setFilterTo(result.to ?? "");
    setActivePreset(p.key);
  };

  const clearAllFilters = () => {
    setSourceFilters(new Set());
    setSeverityFilters(new Set());
    setResultFilters(new Set());
    setAnomalyOnly(false);
    setSearch("");
    setFilterClient("");
    setFilterAdmin("");
    setActorScope("all");
    setFilterFrom("");
    setFilterTo("");
    setActivePreset(null);
  };

  const hasActiveFilters = !!(search || sourceFilters.size > 0 || severityFilters.size > 0 || resultFilters.size > 0 || anomalyOnly || filterClient || filterAdmin || actorScope !== "all" || filterFrom || filterTo);


  useEffect(() => {
    setActivePreset(null);

  }, [search]);

  const exportCsv = () => {
    const rows = [
      [t("date"), t("source"), t("col_type"), t("severite"), t("resultat"), t("anomalies"), t("label"), t("client"), t("admin"), t("email"), "IP", t("pays"), t("user_agent"), t("metadonnees")],
      ...filtered.map((e) => [
        e.createdAt,
        e.source,
        e.type,
        e.severity,
        e.result,
        e.anomalies.join("|"),
        e.label,
        e.clientName ?? "",
        e.adminEmail ?? "",
        e.email ?? "",
        e.ipAddress ?? "",
        e.country ?? "",
        e.userAgent ?? "",
        JSON.stringify(e.metadata ?? {}),
      ]),
    ];
    const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `audit-trail_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`${filtered.length} événements exportés`);
  };


  const exportPdf = () => {
    const params = new URLSearchParams();
    if (sourceFilters.size > 0) params.set("type", Array.from(sourceFilters).join(","));
    if (severityFilters.size > 0) params.set("severity", Array.from(severityFilters).join(","));
    if (resultFilters.size > 0) params.set("result", Array.from(resultFilters).join(","));
    if (anomalyOnly) params.set("anomaly", "1");
    if (filterClient) params.set("clientId", filterClient);
    if (filterAdmin) params.set("adminId", filterAdmin);
    if (actorScope !== "all") params.set("actorScope", actorScope);
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    params.set("limit", String(limit));
    const url = `/api/audit-trail/export/pdf?${params.toString()}`;
    const a = document.createElement("a");
    a.href = url;
    a.rel = "noopener";
    a.click();
  };

  return (
    <div className="space-y-5">

      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold flex items-center gap-2">{t("journal_apos_audit")}</h1>
              <p className="text-white/70 text-xs mt-0.5">
                {t("timeline_immuable_evenements", { count: stats.total })}
                {stats.anomaliesCount > 0 && (
                  <span className="text-amber-200"> {t("anomalies_detectees_count", { count: stats.anomaliesCount })}</span>
                )} {t("conforme_loi_25_pipeda_soc")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <ActionTooltip label={t("rafraichir_timeline")}>
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={load} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                <span className="ml-1.5">{tc("refresh")}</span>
              </Button>
            </ActionTooltip>
            <ActionTooltip label={t("exporter_pdf_hash_integrite_sha")}>
              <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur" onClick={exportPdf}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                {t("exporter_pdf")}
              </Button>
            </ActionTooltip>
            <ActionTooltip label={t("exporter_csv_excel_siem")}>
              <Button size="sm" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1.5" />
                {t("exporter_csv")}
              </Button>
            </ActionTooltip>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        <button
          type="button"
          onClick={() => { const s = new Set<Severity>(severityFilters); if (s.has("critical")) s.delete("critical"); else s.add("critical"); setSeverityFilters(s); }}
          className={cn(
            "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
            severityFilters.has("critical") ? "bg-red-100 border-red-300 ring-2 ring-red-300" : "bg-card",
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("critique")}</span>
            <AlertTriangle className="h-3.5 w-3.5 text-red-600" />
          </div>
          <p className="text-2xl font-bold text-red-700 tabular-nums">{stats.bySeverity.critical}</p>
        </button>
        <button
          type="button"
          onClick={() => { const s = new Set<Severity>(severityFilters); if (s.has("error")) s.delete("error"); else s.add("error"); setSeverityFilters(s); }}
          className={cn(
            "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
            severityFilters.has("error") ? "bg-red-50 border-red-200 ring-2 ring-red-200" : "bg-card",
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("erreurs")}</span>
            <AlertCircle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <p className="text-2xl font-bold text-red-600 tabular-nums">{stats.bySeverity.error}</p>
        </button>
        <button
          type="button"
          onClick={() => { const s = new Set<Severity>(severityFilters); if (s.has("warning")) s.delete("warning"); else s.add("warning"); setSeverityFilters(s); }}
          className={cn(
            "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
            severityFilters.has("warning") ? "bg-amber-50 border-amber-200 ring-2 ring-amber-200" : "bg-card",
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("avertissements")}</span>
            <AlertCircle className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-600 tabular-nums">{stats.bySeverity.warning}</p>
        </button>
        <button
          type="button"
          onClick={() => setAnomalyOnly(!anomalyOnly)}
          className={cn(
            "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
            anomalyOnly ? "bg-amber-50 border-amber-300 ring-2 ring-amber-300" : "bg-card",
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("anomalies")}</span>
            <Zap className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-700 tabular-nums">{stats.anomaliesCount}</p>
          <p className="text-[9px] text-muted-foreground">{t("detectees")}</p>
        </button>
        <button
          type="button"
          onClick={() => { const s = new Set<Severity>(severityFilters); if (s.has("success")) s.delete("success"); else s.add("success"); setSeverityFilters(s); }}
          className={cn(
            "rounded-lg border p-3 text-left transition-all hover:shadow-sm",
            severityFilters.has("success") ? "bg-emerald-50 border-emerald-200 ring-2 ring-emerald-200" : "bg-card",
          )}
        >
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("succes")}</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.bySeverity.success}</p>
        </button>
      </div>


      <div className="grid grid-cols-3 sm:grid-cols-7 gap-2">
        {SOURCE_OPTIONS.map((s) => {
          const Icon = s.icon;
          const isOn = sourceFilters.has(s.value);
          return (
            <button
              key={s.value}
              type="button"
              onClick={() => { const set = new Set(sourceFilters); if (isOn) set.delete(s.value); else set.add(s.value); setSourceFilters(set); }}
              className={cn(
                "rounded-lg border p-2 text-left transition-all hover:shadow-sm",
                isOn ? "bg-[#0F2D52] text-white border-[#0F2D52]" : "bg-card text-foreground hover:border-[#0F2D52]",
              )}
            >
              <div className="flex items-center justify-between mb-0.5">
                <Icon className="h-3 w-3" />
                <span className="text-[9px] uppercase tracking-wider opacity-70">{t(s.labelKey)}</span>
              </div>
              <p className="text-base font-bold tabular-nums">{counts[s.value] ?? 0}</p>
            </button>
          );
        })}
      </div>


      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-[#0F2D52]" />
            {t("presets_rapides")}
          </h3>
          {hasActiveFilters && (
            <Button onClick={clearAllFilters} size="sm" variant="ghost" className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              {t("effacer_tous_filtres")}
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isActive = activePreset === p.key;
            return (
              <ActionTooltip key={p.key} label={t(p.descriptionKey)}>
                <button
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    isActive ? "bg-[#0F2D52] text-white border-[#0F2D52]" : p.color,
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {t(p.labelKey)}
                </button>
              </ActionTooltip>
            );
          })}
        </div>
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 bg-background/95 backdrop-blur -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Activity className="h-4 w-4" />
              {t("journal_apos_audit")}
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            {stats.bySeverity.critical > 0 && <span className="text-red-700">{t("critique")} <span className="font-semibold">{stats.bySeverity.critical}</span></span>}
            {stats.bySeverity.error > 0 && <span className="text-red-600">{t("erreurs")} <span className="font-semibold">{stats.bySeverity.error}</span></span>}
            {stats.anomaliesCount > 0 && <span className="text-amber-700">{t("anomalies")} <span className="font-semibold">{stats.anomaliesCount}</span></span>}
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
              {tc("refresh")}
            </Button>
          </div>
        </div>
      )}


      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Label className="text-[10px]">{t("recherche")}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t("label_client_admin_email_ip")} className="h-9 pl-8 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">{t("acteur")}</Label>
            <Select value={actorScope} onValueChange={(v) => setActorScope(v as typeof actorScope)}>
              <SelectTrigger className="h-9 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tout")}</SelectItem>
                <SelectItem value="admin_only">{t("utilisateurs_admins")}</SelectItem>
                <SelectItem value="client_only">{t("clients")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{t("utilisateur")}</Label>
            <Select value={filterAdmin || "all"} onValueChange={(v) => setFilterAdmin(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-[200px] text-xs"><SelectValue placeholder={t("tous_utilisateurs")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tous_utilisateurs")}</SelectItem>
                {admins.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.fullName || a.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{t("client")}</Label>
            <Select value={filterClient || "all"} onValueChange={(v) => setFilterClient(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-[200px] text-xs"><SelectValue placeholder={t("tous_clients")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tous_clients")}</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{t("resultat")}</Label>
            <Select
              value={resultFilters.size === 1 ? Array.from(resultFilters)[0] : resultFilters.size === 0 ? "all" : "mixed"}
              onValueChange={(v) => {
                if (v === "all") setResultFilters(new Set());
                else setResultFilters(new Set([v as "success" | "failed"]));
              }}
            >
              <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("all")}</SelectItem>
                <SelectItem value="success">{t("succes_uniquement")}</SelectItem>
                <SelectItem value="failed">{t("echecs_uniquement")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{t("du")}</Label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-9 w-[140px] text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">{t("au")}</Label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-9 w-[140px] text-xs" />
          </div>
        </div>
      </div>


      <Card className="overflow-hidden">
        <div className="divide-y">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">{tc("loading")}</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">{t("aucun_evenement")}</p>
              {hasActiveFilters && (
                <Button onClick={clearAllFilters} size="sm" variant="ghost" className="mt-2 text-xs">
                  {t("effacer_filtres")}
                </Button>
              )}
            </div>
          ) : (
            filtered.map((e) => {
              const src = SOURCE_OPTIONS.find((s) => s.value === e.source);
              const SourceIcon = src?.icon ?? Activity;
              const sevMeta = SEVERITY_META[e.severity];
              const SevIcon = sevMeta.icon;
              const isHighSev = e.severity === "critical" || e.severity === "error";
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setDetailEvent(e)}
                  className={cn(
                    "w-full px-4 py-3 hover:bg-muted/40 flex items-start gap-3 transition-colors text-left",
                    isHighSev && "bg-red-50/30",
                  )}
                >

                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", src?.color ?? "bg-gray-100 text-gray-700")}>
                    <SourceIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">

                        <ActionTooltip label={t(sevMeta.labelKey)}>
                          <span className={cn("inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0", sevMeta.bg)}>
                            <SevIcon className={cn("h-2.5 w-2.5", sevMeta.color)} />
                          </span>
                        </ActionTooltip>
                        <p className={cn("text-sm font-medium truncate", isHighSev && "text-red-700")}>{e.label}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{fmtRelative(e.createdAt, t("instant"))}</span>
                    </div>


                    {e.anomalies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {e.anomalies.map((a) => {
                          const meta = ANOMALY_META[a];
                          const AIcon = meta.icon;
                          return (
                            <ActionTooltip key={a} label={t(meta.descriptionKey)}>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-700 ring-1 ring-red-200">
                                <AIcon className="h-2.5 w-2.5" />
                                {t(meta.labelKey)}
                              </span>
                            </ActionTooltip>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center gap-x-3 gap-y-0.5 mt-1 text-[10px] text-muted-foreground flex-wrap">
                      {e.clientName && (
                        <span
                          onClick={(ev) => { ev.stopPropagation(); if (e.clientId) openEntity("client", e.clientId); }}
                          className="inline-flex items-center gap-1 hover:text-[#0F2D52] hover:underline cursor-pointer"
                        >
                          <Users className="h-2.5 w-2.5" />{e.clientName}
                        </span>
                      )}
                      {e.adminEmail && (
                        <span className="inline-flex items-center gap-1"><ShieldCheck className="h-2.5 w-2.5" />{e.adminEmail}</span>
                      )}
                      {e.ipAddress && (
                        <span className="inline-flex items-center gap-1 font-mono"><Globe className="h-2.5 w-2.5" />{e.ipAddress}</span>
                      )}
                      {e.country && (
                        <span className="inline-flex items-center gap-1"><Globe className="h-2.5 w-2.5" />{e.country}{e.city ? `, ${e.city}` : ""}</span>
                      )}
                      <span className="inline-flex items-center gap-1"><Clock className="h-2.5 w-2.5" />{new Date(e.createdAt).toLocaleString("fr-CA")}</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </Card>


      {filtered.length >= limit && (
        <div className="text-center">
          <Button onClick={() => setLimit((l) => l + 300)} variant="outline" size="sm" disabled={loading}>
            Charger les {Math.min(300, 1000 - limit)} suivants ({filtered.length} sur {limit} max)
          </Button>
        </div>
      )}

      <p className="text-[10px] text-center text-muted-foreground">
        {t("evenements_affiches_limite", { count: filtered.length, limit })}
        {" "}{t("affinez_filtres_utilisez_export_pdf")}
      </p>


      <Dialog open={!!detailEvent} onOpenChange={(o) => { if (!o) setDetailEvent(null); }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
          {detailEvent && (() => {
            const src = SOURCE_OPTIONS.find((s) => s.value === detailEvent.source);
            const SourceIcon = src?.icon ?? Activity;
            const sevMeta = SEVERITY_META[detailEvent.severity];
            const SevIcon = sevMeta.icon;
            return (
              <>

                <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" aria-hidden />
                  <div className="relative flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                      <SourceIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-white text-base font-bold truncate">{detailEvent.label}</DialogTitle>
                      <DialogDescription className="text-white/70 mt-0.5 text-xs">
                        {src ? t(src.labelKey) : detailEvent.source} · {new Date(detailEvent.createdAt).toLocaleString(dateTag, { dateStyle: "long", timeStyle: "medium" })}
                      </DialogDescription>
                    </div>
                  </div>
                </div>


                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">

                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1", sevMeta.bg, sevMeta.color, sevMeta.ring)}>
                      <SevIcon className="h-3.5 w-3.5" />
                      {t(sevMeta.labelKey)}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                      detailEvent.result === "success" ? "bg-emerald-100 text-emerald-700" :
                        detailEvent.result === "failed" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-700",
                    )}>
                      {detailEvent.result === "success" ? t("succes") : detailEvent.result === "failed" ? t("echec") : t("neutre")}
                    </span>
                    {detailEvent.anomalies.map((a) => {
                      const meta = ANOMALY_META[a];
                      const AIcon = meta.icon;
                      return (
                        <ActionTooltip key={a} label={t(meta.descriptionKey)}>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 ring-1 ring-red-200">
                            <AIcon className="h-3 w-3" />
                            {t(meta.labelKey)}
                          </span>
                        </ActionTooltip>
                      );
                    })}
                  </div>


                  <div className="rounded-lg border bg-card p-3 space-y-2 text-xs">
                    <DetailRow label={t("col_type")} value={detailEvent.type} mono />
                    {detailEvent.clientName && (
                      <DetailRow label={t("client")} value={
                        <button onClick={() => detailEvent.clientId && openEntity("client", detailEvent.clientId)} className="text-[#0F2D52] hover:underline">
                          {detailEvent.clientName}
                        </button>
                      } />
                    )}
                    {detailEvent.adminEmail && <DetailRow label={t("admin")} value={detailEvent.adminEmail} />}
                    {detailEvent.email && !detailEvent.adminEmail && <DetailRow label={t("courriel")} value={detailEvent.email} />}
                    {detailEvent.ipAddress && <DetailRow label={t("adresse_ip")} value={detailEvent.ipAddress} mono />}
                    {detailEvent.country && <DetailRow label={t("pays")} value={`${detailEvent.country}${detailEvent.city ? `, ${detailEvent.city}` : ""}`} />}
                    {detailEvent.amount != null && <DetailRow label={tc("amount")} value={`${detailEvent.amount.toFixed(2)} ${detailEvent.currency ?? "CAD"}`} />}
                    {detailEvent.userAgent && (
                      <DetailRow label={t("user_agent")} value={<span className="font-mono text-[10px] break-all">{detailEvent.userAgent}</span>} />
                    )}
                  </div>


                  {detailEvent.metadata && Object.keys(detailEvent.metadata).length > 0 && (
                    <div className="rounded-lg border bg-card overflow-hidden">
                      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          {t("metadonnees_brutes_json")}
                        </h4>
                        <ActionTooltip label={t("copier_json")}>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(detailEvent.metadata, null, 2));
                              toast.success(t("json_copie"));
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            {tc("copy")}
                          </button>
                        </ActionTooltip>
                      </div>
                      <pre className="px-3 py-2 text-[10px] font-mono overflow-x-auto bg-slate-50 max-h-64 overflow-y-auto">
                        {JSON.stringify(detailEvent.metadata, null, 2)}
                      </pre>
                    </div>
                  )}


                  <div className="rounded-lg border border-dashed bg-muted/30 p-2 text-[10px] text-muted-foreground">
                    <span className="font-semibold">{t("identifiant_immuable")}</span>{" "}
                    <span className="font-mono">{detailEvent.id}</span>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function DetailRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      <span className="text-muted-foreground text-[10px] uppercase tracking-wider font-semibold">{label}</span>
      <span className={cn("col-span-2 break-words", mono && "font-mono")}>{value}</span>
    </div>
  );
}

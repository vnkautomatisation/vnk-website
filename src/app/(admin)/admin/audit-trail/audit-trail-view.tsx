"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
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
  { value: "login", label: "Connexions", icon: LogIn, color: "bg-blue-100 text-blue-700" },
  { value: "order", label: "Commandes/Paiements", icon: ShoppingCart, color: "bg-emerald-100 text-emerald-700" },
  { value: "signature", label: "Signatures", icon: FileSignature, color: "bg-violet-100 text-violet-700" },
  { value: "consent", label: "Consentements", icon: ShieldCheck, color: "bg-cyan-100 text-cyan-700" },
  { value: "email", label: "Courriels", icon: Mail, color: "bg-amber-100 text-amber-700" },
  { value: "audit", label: "Actions admin", icon: FileText, color: "bg-red-100 text-red-700" },
  { value: "workflow", label: "Workflow", icon: GitBranch, color: "bg-indigo-100 text-indigo-700" },
];

const SEVERITY_META: Record<Severity, { label: string; icon: typeof Activity; color: string; bg: string; ring: string }> = {
  critical: { label: "Critique", icon: AlertTriangle, color: "text-red-700", bg: "bg-red-100", ring: "ring-red-300" },
  error: { label: "Erreur", icon: AlertCircle, color: "text-red-600", bg: "bg-red-50", ring: "ring-red-200" },
  warning: { label: "Avertissement", icon: AlertCircle, color: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200" },
  success: { label: "Succès", icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200" },
  info: { label: "Info", icon: Info, color: "text-slate-600", bg: "bg-slate-50", ring: "ring-slate-200" },
};

const ANOMALY_META: Record<AnomalyFlag, { label: string; icon: typeof Activity; description: string }> = {
  failed_login_burst: { label: "Rafale d'échecs", icon: Zap, description: "Plus de 5 échecs de connexion en 10 minutes pour le même compte/IP" },
  impossible_travel: { label: "Trajet impossible", icon: Plane, description: "Deux connexions réussies depuis des pays différents en moins de 1 h" },
  off_hours_admin: { label: "Action hors heures", icon: Clock, description: "Action admin entre 22 h et 6 h" },
  bulk_export: { label: "Export massif", icon: FileDown, description: "Plus de 3 exports admin en 5 minutes par le même utilisateur" },
  new_geo: { label: "Nouvelle géo", icon: Globe, description: "Première connexion depuis ce pays" },
};

function fmtRelative(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "À l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h`;
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// Présets Loi 25 / forensique
type Preset = {
  key: string;
  label: string;
  description: string;
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
    label: "Échecs (24 h)",
    description: "Toutes les actions échouées des dernières 24 heures",
    icon: AlertCircle,
    color: "bg-red-100 text-red-700 border-red-200",
    apply: ({ now }) => {
      const from = new Date(now); from.setDate(from.getDate() - 1);
      return { resultFilters: ["failed"], from: from.toISOString().slice(0, 10), to: now.toISOString().slice(0, 10) };
    },
  },
  {
    key: "admin_actions",
    label: "Actions admin",
    description: "Toutes les actions effectuées par les administrateurs",
    icon: ShieldCheck,
    color: "bg-amber-100 text-amber-700 border-amber-200",
    apply: () => ({ sourceFilters: ["audit"] }),
  },
  {
    key: "anomalies",
    label: "Anomalies détectées",
    description: "Événements avec anomalie automatique (burst, trajet impossible, hors heures, export massif)",
    icon: AlertTriangle,
    color: "bg-red-100 text-red-700 border-red-200",
    apply: () => ({ anomalyOnly: true }),
  },
  {
    key: "loi_25",
    label: "Registre Loi 25",
    description: "Incidents de confidentialité (échecs login + consentements + actions admin + signatures) — registre à fournir à la CAI sur demande",
    icon: Lock,
    color: "bg-indigo-100 text-indigo-700 border-indigo-200",
    apply: () => ({ sourceFilters: ["login", "consent", "audit", "signature"], resultFilters: ["failed", "neutral"] }),
  },
  {
    key: "off_hours",
    label: "Hors heures",
    description: "Actions admin effectuées entre 22 h et 6 h",
    icon: Clock,
    color: "bg-purple-100 text-purple-700 border-purple-200",
    apply: () => ({ sourceFilters: ["audit"], anomalyOnly: true }),
  },
];

export function AuditTrailView({
  clients,
  counts,
}: {
  clients: ClientOption[];
  counts: Record<string, number>;
}) {
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
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [limit, setLimit] = useState(300);
  const [activePreset, setActivePreset] = useState<string | null>(null);

  // Detail modal
  const [detailEvent, setDetailEvent] = useState<AuditEvent | null>(null);

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

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (sourceFilters.size > 0) params.set("type", Array.from(sourceFilters).join(","));
      if (severityFilters.size > 0) params.set("severity", Array.from(severityFilters).join(","));
      if (resultFilters.size > 0) params.set("result", Array.from(resultFilters).join(","));
      if (anomalyOnly) params.set("anomaly", "1");
      if (filterClient) params.set("clientId", filterClient);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);
      params.set("limit", String(limit));
      const res = await fetch(`/api/audit-trail?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setEvents(data.events ?? []);
        setStats(data.stats ?? stats);
      } else {
        toast.error("Erreur de chargement");
      }
    } finally { setLoading(false); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sourceFilters, severityFilters, resultFilters, anomalyOnly, filterClient, filterFrom, filterTo, limit]);

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
    setFilterFrom("");
    setFilterTo("");
    setActivePreset(null);
  };

  const hasActiveFilters = !!(search || sourceFilters.size > 0 || severityFilters.size > 0 || resultFilters.size > 0 || anomalyOnly || filterClient || filterFrom || filterTo);

  // Effacer le preset actif quand l'utilisateur modifie un filtre manuellement
  useEffect(() => {
    setActivePreset(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const exportCsv = () => {
    const rows = [
      ["Date", "Source", "Type", "Sévérité", "Résultat", "Anomalies", "Label", "Client", "Admin", "Email", "IP", "Pays", "User-Agent", "Métadonnées"],
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

  // Export PDF (utilise les filtres serveur — pas la recherche libre)
  const exportPdf = () => {
    const params = new URLSearchParams();
    if (sourceFilters.size > 0) params.set("type", Array.from(sourceFilters).join(","));
    if (severityFilters.size > 0) params.set("severity", Array.from(severityFilters).join(","));
    if (resultFilters.size > 0) params.set("result", Array.from(resultFilters).join(","));
    if (anomalyOnly) params.set("anomaly", "1");
    if (filterClient) params.set("clientId", filterClient);
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
      {/* Hero VNK */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold flex items-center gap-2">Journal d&apos;audit</h1>
              <p className="text-white/70 text-xs mt-0.5">
                Timeline immuable · {stats.total} événement{stats.total > 1 ? "s" : ""} chargé{stats.total > 1 ? "s" : ""} ·
                {stats.anomaliesCount > 0 && (
                  <span className="text-amber-200"> {stats.anomaliesCount} anomalie{stats.anomaliesCount > 1 ? "s" : ""} détectée{stats.anomaliesCount > 1 ? "s" : ""} ·</span>
                )} conforme Loi 25 / PIPEDA / SOC 2
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <ActionTooltip label="Rafraîchir la timeline">
              <Button variant="outline" size="sm" className="bg-white/10 border-white/30 text-white hover:bg-white/20" onClick={load} disabled={loading}>
                <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
                <span className="ml-1.5">Rafraîchir</span>
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Exporter en PDF avec hash d'intégrité SHA-256 (conformité Loi 25)">
              <Button size="sm" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur" onClick={exportPdf}>
                <FileDown className="h-3.5 w-3.5 mr-1.5" />
                Exporter PDF
              </Button>
            </ActionTooltip>
            <ActionTooltip label="Exporter en CSV pour Excel / SIEM">
              <Button size="sm" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold" onClick={exportCsv}>
                <Download className="h-4 w-4 mr-1.5" />
                Exporter CSV
              </Button>
            </ActionTooltip>
          </div>
        </div>
      </div>

      {/* Stats globales — toujours visibles */}
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Critique</span>
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Erreurs</span>
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Avertissements</span>
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Anomalies</span>
            <Zap className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-2xl font-bold text-amber-700 tabular-nums">{stats.anomaliesCount}</p>
          <p className="text-[9px] text-muted-foreground">détectées</p>
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
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Succès</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 tabular-nums">{stats.bySeverity.success}</p>
        </button>
      </div>

      {/* Stats sources (compactes) */}
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
                <span className="text-[9px] uppercase tracking-wider opacity-70">{s.label}</span>
              </div>
              <p className="text-base font-bold tabular-nums">{counts[s.value] ?? 0}</p>
            </button>
          );
        })}
      </div>

      {/* Presets rapides Loi 25 / forensique */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5">
            <Zap className="h-4 w-4 text-[#0F2D52]" />
            Présets rapides
          </h3>
          {hasActiveFilters && (
            <Button onClick={clearAllFilters} size="sm" variant="ghost" className="h-7 text-xs">
              <X className="h-3 w-3 mr-1" />
              Effacer tous les filtres
            </Button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {PRESETS.map((p) => {
            const Icon = p.icon;
            const isActive = activePreset === p.key;
            return (
              <ActionTooltip key={p.key} label={p.description}>
                <button
                  type="button"
                  onClick={() => applyPreset(p)}
                  className={cn(
                    "inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-colors",
                    isActive ? "bg-[#0F2D52] text-white border-[#0F2D52]" : p.color,
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {p.label}
                </button>
              </ActionTooltip>
            );
          })}
        </div>
      </div>

      {/* Sentinel + sticky bar */}
      <div ref={sentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 bg-background/95 backdrop-blur -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Activity className="h-4 w-4" />
              Journal d&apos;audit
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            {stats.bySeverity.critical > 0 && <span className="text-red-700">Critique <span className="font-semibold">{stats.bySeverity.critical}</span></span>}
            {stats.bySeverity.error > 0 && <span className="text-red-600">Erreurs <span className="font-semibold">{stats.bySeverity.error}</span></span>}
            {stats.anomaliesCount > 0 && <span className="text-amber-700">Anomalies <span className="font-semibold">{stats.anomaliesCount}</span></span>}
            <Button size="sm" variant="ghost" className="ml-auto h-7 px-2 text-xs" onClick={load} disabled={loading}>
              <RefreshCw className={cn("h-3 w-3 mr-1", loading && "animate-spin")} />
              Rafraîchir
            </Button>
          </div>
        </div>
      )}

      {/* Filtres détaillés */}
      <div className="rounded-lg border bg-card p-3">
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[220px] max-w-md">
            <Label className="text-[10px]">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Label, client, admin, email, IP, pays…" className="h-9 pl-8 text-xs" />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Client</Label>
            <Select value={filterClient || "all"} onValueChange={(v) => setFilterClient(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 w-[200px] text-xs"><SelectValue placeholder="Tous clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous clients</SelectItem>
                {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Résultat</Label>
            <Select
              value={resultFilters.size === 1 ? Array.from(resultFilters)[0] : resultFilters.size === 0 ? "all" : "mixed"}
              onValueChange={(v) => {
                if (v === "all") setResultFilters(new Set());
                else setResultFilters(new Set([v as "success" | "failed"]));
              }}
            >
              <SelectTrigger className="h-9 w-[140px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous</SelectItem>
                <SelectItem value="success">Succès uniquement</SelectItem>
                <SelectItem value="failed">Échecs uniquement</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Du</Label>
            <Input type="date" value={filterFrom} onChange={(e) => setFilterFrom(e.target.value)} className="h-9 w-[140px] text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Au</Label>
            <Input type="date" value={filterTo} onChange={(e) => setFilterTo(e.target.value)} className="h-9 w-[140px] text-xs" />
          </div>
        </div>
      </div>

      {/* Timeline */}
      <Card className="overflow-hidden">
        <div className="divide-y">
          {loading ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center">
              <Activity className="h-10 w-10 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm font-medium">Aucun événement</p>
              {hasActiveFilters && (
                <Button onClick={clearAllFilters} size="sm" variant="ghost" className="mt-2 text-xs">
                  Effacer les filtres
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
                  {/* Source icon coloré */}
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", src?.color ?? "bg-gray-100 text-gray-700")}>
                    <SourceIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <div className="flex items-center gap-2 min-w-0">
                        {/* Severity dot */}
                        <ActionTooltip label={sevMeta.label}>
                          <span className={cn("inline-flex items-center justify-center h-4 w-4 rounded-full shrink-0", sevMeta.bg)}>
                            <SevIcon className={cn("h-2.5 w-2.5", sevMeta.color)} />
                          </span>
                        </ActionTooltip>
                        <p className={cn("text-sm font-medium truncate", isHighSev && "text-red-700")}>{e.label}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">{fmtRelative(e.createdAt)}</span>
                    </div>

                    {/* Anomalies badges */}
                    {e.anomalies.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1">
                        {e.anomalies.map((a) => {
                          const meta = ANOMALY_META[a];
                          const AIcon = meta.icon;
                          return (
                            <ActionTooltip key={a} label={meta.description}>
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-100 text-red-700 ring-1 ring-red-200">
                                <AIcon className="h-2.5 w-2.5" />
                                {meta.label}
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

      {/* Pagination simple : charger plus */}
      {filtered.length >= limit && (
        <div className="text-center">
          <Button onClick={() => setLimit((l) => l + 300)} variant="outline" size="sm" disabled={loading}>
            Charger les {Math.min(300, 1000 - limit)} suivants ({filtered.length} sur {limit} max)
          </Button>
        </div>
      )}

      <p className="text-[10px] text-center text-muted-foreground">
        {filtered.length} événement{filtered.length > 1 ? "s" : ""} affiché{filtered.length > 1 ? "s" : ""} (limite {limit} — max 1 000).
        Affinez les filtres ou utilisez l&apos;export PDF pour des plages plus larges.
      </p>

      {/* Modal détail événement */}
      <Dialog open={!!detailEvent} onOpenChange={(o) => { if (!o) setDetailEvent(null); }}>
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
          {detailEvent && (() => {
            const src = SOURCE_OPTIONS.find((s) => s.value === detailEvent.source);
            const SourceIcon = src?.icon ?? Activity;
            const sevMeta = SEVERITY_META[detailEvent.severity];
            const SevIcon = sevMeta.icon;
            return (
              <>
                {/* Header navy gradient */}
                <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" aria-hidden />
                  <div className="relative flex items-center gap-4">
                    <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
                      <SourceIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0">
                      <DialogTitle className="text-white text-base font-bold truncate">{detailEvent.label}</DialogTitle>
                      <DialogDescription className="text-white/70 mt-0.5 text-xs">
                        {src?.label ?? detailEvent.source} · {new Date(detailEvent.createdAt).toLocaleString("fr-CA", { dateStyle: "long", timeStyle: "medium" })}
                      </DialogDescription>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
                  {/* Severity + anomalies */}
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={cn("inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ring-1", sevMeta.bg, sevMeta.color, sevMeta.ring)}>
                      <SevIcon className="h-3.5 w-3.5" />
                      {sevMeta.label}
                    </span>
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold",
                      detailEvent.result === "success" ? "bg-emerald-100 text-emerald-700" :
                        detailEvent.result === "failed" ? "bg-red-100 text-red-700" :
                          "bg-slate-100 text-slate-700",
                    )}>
                      {detailEvent.result === "success" ? "Succès" : detailEvent.result === "failed" ? "Échec" : "Neutre"}
                    </span>
                    {detailEvent.anomalies.map((a) => {
                      const meta = ANOMALY_META[a];
                      const AIcon = meta.icon;
                      return (
                        <ActionTooltip key={a} label={meta.description}>
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 ring-1 ring-red-200">
                            <AIcon className="h-3 w-3" />
                            {meta.label}
                          </span>
                        </ActionTooltip>
                      );
                    })}
                  </div>

                  {/* Détails */}
                  <div className="rounded-lg border bg-card p-3 space-y-2 text-xs">
                    <DetailRow label="Type" value={detailEvent.type} mono />
                    {detailEvent.clientName && (
                      <DetailRow label="Client" value={
                        <button onClick={() => detailEvent.clientId && openEntity("client", detailEvent.clientId)} className="text-[#0F2D52] hover:underline">
                          {detailEvent.clientName}
                        </button>
                      } />
                    )}
                    {detailEvent.adminEmail && <DetailRow label="Admin" value={detailEvent.adminEmail} />}
                    {detailEvent.email && !detailEvent.adminEmail && <DetailRow label="Courriel" value={detailEvent.email} />}
                    {detailEvent.ipAddress && <DetailRow label="Adresse IP" value={detailEvent.ipAddress} mono />}
                    {detailEvent.country && <DetailRow label="Pays" value={`${detailEvent.country}${detailEvent.city ? `, ${detailEvent.city}` : ""}`} />}
                    {detailEvent.amount != null && <DetailRow label="Montant" value={`${detailEvent.amount.toFixed(2)} ${detailEvent.currency ?? "CAD"}`} />}
                    {detailEvent.userAgent && (
                      <DetailRow label="User-Agent" value={<span className="font-mono text-[10px] break-all">{detailEvent.userAgent}</span>} />
                    )}
                  </div>

                  {/* Metadata raw JSON */}
                  {detailEvent.metadata && Object.keys(detailEvent.metadata).length > 0 && (
                    <div className="rounded-lg border bg-card overflow-hidden">
                      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between">
                        <h4 className="text-xs font-semibold flex items-center gap-1.5">
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                          Métadonnées brutes (JSON)
                        </h4>
                        <ActionTooltip label="Copier le JSON">
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(JSON.stringify(detailEvent.metadata, null, 2));
                              toast.success("JSON copié");
                            }}
                            className="text-[10px] text-muted-foreground hover:text-foreground"
                          >
                            Copier
                          </button>
                        </ActionTooltip>
                      </div>
                      <pre className="px-3 py-2 text-[10px] font-mono overflow-x-auto bg-slate-50 max-h-64 overflow-y-auto">
                        {JSON.stringify(detailEvent.metadata, null, 2)}
                      </pre>
                    </div>
                  )}

                  {/* ID immuable */}
                  <div className="rounded-lg border border-dashed bg-muted/30 p-2 text-[10px] text-muted-foreground">
                    <span className="font-semibold">Identifiant immuable :</span>{" "}
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

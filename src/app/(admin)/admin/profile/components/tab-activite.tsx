"use client";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ActivityTimeline } from "@/components/admin/activity-timeline";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  History, ShieldCheck, ShieldAlert, ShieldX, LogIn, LogOut, KeyRound, Lock, Smartphone,
  AlertTriangle, Check, Info, Search, MapPin, Filter,
} from "lucide-react";
import type { AuditEvent, SecurityEventRow, LoginEventRow } from "../profile-view";

// ── Severity styling ─────────────────────────────────
const SEVERITY_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  info:     { bg: "bg-blue-50",    text: "text-blue-700",    dot: "bg-blue-500" },
  success:  { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
  warning:  { bg: "bg-amber-50",   text: "text-amber-700",   dot: "bg-amber-500" },
  critical: { bg: "bg-red-50",     text: "text-red-700",     dot: "bg-red-500" },
};

const TYPE_ICONS: Record<string, typeof ShieldCheck> = {
  login_success: LogIn,
  login_failed: ShieldX,
  password_changed: KeyRound,
  password_breach_detected: ShieldAlert,
  two_factor_enabled: ShieldCheck,
  two_factor_disabled: ShieldX,
  backup_codes_regenerated: KeyRound,
  backup_code_used: KeyRound,
  session_revoked: LogOut,
  all_sessions_revoked: LogOut,
  trusted_device_added: Smartphone,
  trusted_device_removed: Smartphone,
  api_token_created: KeyRound,
  api_token_revoked: KeyRound,
  data_export_requested: ShieldCheck,
  data_export_ready: ShieldCheck,
  account_deletion_requested: AlertTriangle,
  suspicious_login: ShieldAlert,
  passkey_added: Lock,
  passkey_removed: Lock,
  profile_updated: Check,
  preferences_updated: Check,
  notification_prefs_updated: Check,
};

export function TabActivite({
  securityEvents, loginEvents, auditLogs,
}: {
  securityEvents: SecurityEventRow[];
  loginEvents: LoginEventRow[];
  auditLogs: AuditEvent[];
}) {
  const t = useTranslations("admin.profile.activity");
  const [view, setView] = useState<"security" | "logins" | "audit">("security");
  const [severityFilter, setSeverityFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const dateTag = useDateLocale();
  const PAGE_SIZE = 20;

  const filteredSecurity = useMemo(() => {
    let list = securityEvents;
    if (severityFilter !== "all") list = list.filter((e) => e.severity === severityFilter);
    if (search) {
      const q = search.toLowerCase();
      list = list.filter((e) => e.message.toLowerCase().includes(q) || e.type.toLowerCase().includes(q) || (e.city ?? "").toLowerCase().includes(q));
    }
    return list;
  }, [securityEvents, severityFilter, search]);

  const filteredLogins = useMemo(() => {
    if (!search) return loginEvents;
    const q = search.toLowerCase();
    return loginEvents.filter((e) => e.type.toLowerCase().includes(q) || (e.reason ?? "").toLowerCase().includes(q) || (e.city ?? "").toLowerCase().includes(q));
  }, [loginEvents, search]);

  const totalPages = Math.ceil((view === "security" ? filteredSecurity.length : view === "logins" ? filteredLogins.length : auditLogs.length) / PAGE_SIZE);
  const currentList = view === "security"
    ? filteredSecurity.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
    : view === "logins"
      ? filteredLogins.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
      : [];

  const counts = {
    info: securityEvents.filter((e) => e.severity === "info").length,
    success: securityEvents.filter((e) => e.severity === "success").length,
    warning: securityEvents.filter((e) => e.severity === "warning").length,
    critical: securityEvents.filter((e) => e.severity === "critical").length,
  };

  return (
    <div className="space-y-4">
      {/* ── KPI cards par sévérité ── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {([
          { sev: "critical", label: t("severity.criticals_kpi"), icon: ShieldAlert },
          { sev: "warning", label: t("severity.warnings_kpi"), icon: AlertTriangle },
          { sev: "success", label: t("severity.successes_kpi"), icon: Check },
          { sev: "info", label: t("severity.infos_kpi"), icon: Info },
        ] as const).map(({ sev, label, icon: Icon }) => {
          const style = SEVERITY_STYLES[sev];
          return (
            <button
              key={sev}
              onClick={() => { setView("security"); setSeverityFilter(severityFilter === sev ? "all" : sev); setPage(0); }}
              className={`${style.bg} rounded-lg p-3 flex items-center gap-2 transition hover:scale-[1.02] border-2 ${severityFilter === sev ? "border-current" : "border-transparent"}`}
            >
              <Icon className={`h-4 w-4 ${style.text}`} />
              <div className="text-left">
                <p className={`text-xs ${style.text} font-medium`}>{label}</p>
                <p className={`text-lg font-bold ${style.text}`}>{counts[sev as keyof typeof counts]}</p>
              </div>
            </button>
          );
        })}
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <CardTitle className="text-base flex items-center gap-2">
              <History className="h-4 w-4" />
              {t("title")}
            </CardTitle>
            <div className="flex flex-wrap gap-1">
              {([
                { v: "security", label: t("views.security"), count: securityEvents.length },
                { v: "logins", label: t("views.logins"), count: loginEvents.length },
                { v: "audit", label: t("views.audit"), count: auditLogs.length },
              ] as const).map(({ v, label, count }) => (
                <button
                  key={v}
                  onClick={() => { setView(v); setPage(0); }}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition ${view === v ? "bg-[#0F2D52] text-white" : "bg-muted hover:bg-muted/70"}`}
                >
                  {label} <span className={`ml-1 ${view === v ? "text-white/70" : "text-muted-foreground"}`}>({count})</span>
                </button>
              ))}
            </div>
          </div>

          {view !== "audit" && (
            <div className="flex flex-col sm:flex-row gap-2 mt-3">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} placeholder={t("search_placeholder")} className="pl-8 h-9" />
              </div>
              {view === "security" && (
                <Select value={severityFilter} onValueChange={(v) => { setSeverityFilter(v); setPage(0); }}>
                  <SelectTrigger className="h-9 w-full sm:w-44"><Filter className="h-3.5 w-3.5 mr-1.5" /><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">{t("severity.all")}</SelectItem>
                    <SelectItem value="critical">{t("severity.critical")}</SelectItem>
                    <SelectItem value="warning">{t("severity.warning")}</SelectItem>
                    <SelectItem value="success">{t("severity.success")}</SelectItem>
                    <SelectItem value="info">{t("severity.info")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent>
          {view === "security" && (
            currentList.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">{t("no_events")}</p>
            ) : (
              <ul className="divide-y">
                {(currentList as SecurityEventRow[]).map((e) => {
                  const style = SEVERITY_STYLES[e.severity] ?? SEVERITY_STYLES.info;
                  const Icon = TYPE_ICONS[e.type] ?? Info;
                  return (
                    <li key={e.id} className="py-2.5 flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${style.bg}`}>
                        <Icon className={`h-4 w-4 ${style.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">{e.message}</p>
                          <Badge className={`text-[10px] ${style.bg} ${style.text} border-0`}>{e.severity}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                          <span>{new Date(e.createdAt).toLocaleString(dateTag, { dateStyle: "medium", timeStyle: "short" })}</span>
                          {e.ipAddress && <span>IP {e.ipAddress}</span>}
                          {(e.city || e.country) && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {[e.city, e.country].filter(Boolean).join(", ")}</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {view === "logins" && (
            currentList.length === 0 ? (
              <p className="text-center py-8 text-sm text-muted-foreground">{t("no_logins")}</p>
            ) : (
              <ul className="divide-y">
                {(currentList as LoginEventRow[]).map((e) => {
                  const isSuccess = e.type === "success" || e.type === "2fa_success";
                  const isFailed = e.type === "failed" || e.type === "2fa_failed" || e.type === "locked";
                  const style = isSuccess ? SEVERITY_STYLES.success : isFailed ? SEVERITY_STYLES.critical : SEVERITY_STYLES.info;
                  const Icon = isSuccess ? LogIn : isFailed ? ShieldX : LogIn;
                  return (
                    <li key={e.id} className="py-2.5 flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center ${style.bg}`}>
                        <Icon className={`h-4 w-4 ${style.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-sm font-medium">
                            Connexion {e.type}
                            {e.reason && <span className="text-muted-foreground font-normal"> — {e.reason}</span>}
                          </p>
                          <Badge className={`text-[10px] ${style.bg} ${style.text} border-0`}>{isSuccess ? "OK" : isFailed ? t("echec") : t("info")}</Badge>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5 text-[11px] text-muted-foreground">
                          <span>{new Date(e.createdAt).toLocaleString(dateTag, { dateStyle: "medium", timeStyle: "short" })}</span>
                          {e.ipAddress && <span>IP {e.ipAddress}</span>}
                          {(e.city || e.country) && <span className="flex items-center gap-0.5"><MapPin className="h-2.5 w-2.5" /> {[e.city, e.country].filter(Boolean).join(", ")}</span>}
                          {e.deviceType && <span className="capitalize">{e.deviceType}</span>}
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          )}

          {view === "audit" && (
            <ActivityTimeline events={auditLogs} />
          )}

          {/* Pagination */}
          {view !== "audit" && totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-3 border-t text-xs">
              <span className="text-muted-foreground">{t("page", { current: page + 1, total: totalPages })}</span>
              <div className="flex gap-1">
                <button onClick={() => setPage(Math.max(0, page - 1))} disabled={page === 0} className="px-2 py-1 rounded border disabled:opacity-40">{t("previous")}</button>
                <button onClick={() => setPage(Math.min(totalPages - 1, page + 1))} disabled={page >= totalPages - 1} className="px-2 py-1 rounded border disabled:opacity-40">{t("next")}</button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

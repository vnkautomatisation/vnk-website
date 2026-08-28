"use client";
// Vue Activité équipe — feed temps réel des actions admins + filtres.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Users, ChevronLeft, Filter, X, Circle,
  Plus, Edit, Trash2, LogIn, LogOut, Download,
  Settings as SettingsIcon, KeyRound,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { entityLabelWithId, ACTION_VERBS } from "@/lib/audit-labels";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

type LogRow = {
  id: number;
  adminId: number | null;
  action: string;
  entityType: string;
  entityId: number | null;
  changes: Record<string, unknown> | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: string;
  admin: {
    id: number; email: string; fullName: string | null;
    avatarUrl: string | null;
    position: { color: string | null } | null;
  } | null;
};
type AdminRow = {
  id: number; email: string; fullName: string | null;
  avatarUrl: string | null; lastLogin: string | null;
  position: { name: string; color: string | null } | null;
  customRole: { name: string; color: string | null } | null;
};

const ACTION_META: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string; labelKey: string }> = {
  create: { icon: Plus, color: "text-emerald-600", labelKey: "act_create" },
  update: { icon: Edit, color: "text-blue-600", labelKey: "act_update" },
  delete: { icon: Trash2, color: "text-red-600", labelKey: "act_delete" },
  login: { icon: LogIn, color: "text-emerald-600", labelKey: "act_login" },
  logout: { icon: LogOut, color: "text-gray-500", labelKey: "act_logout" },
  export: { icon: Download, color: "text-purple-600", labelKey: "act_export" },
  view: { icon: Users, color: "text-gray-500", labelKey: "act_view" },
  settings_update: { icon: SettingsIcon, color: "text-amber-600", labelKey: "act_settings_update" },
  password_reset: { icon: KeyRound, color: "text-amber-700", labelKey: "act_password_reset" },
  role_change: { icon: Users, color: "text-purple-600", labelKey: "act_role_change" },
  impersonate: { icon: Users, color: "text-red-700", labelKey: "act_impersonate" },
};

function formatRelative(iso: string, t: (k: string, v?: Record<string, string | number | Date>) => string, locale: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return t("instant");
  if (min < 60) return t("il_y_a_min", { count: min });
  const hours = Math.floor(min / 60);
  if (hours < 24) return t("il_y_a_h", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("il_y_a_j", { count: days });
  return d.toLocaleDateString(locale, { day: "numeric", month: "short", year: "numeric" });
}

export function TeamActivityView({
  logs, admins, entityTypes, actions, totalLogs, currentFilters,
}: {
  logs: LogRow[];
  admins: AdminRow[];
  entityTypes: string[];
  actions: string[];
  totalLogs: number;
  currentFilters: { admin?: number; entity?: string; action?: string };
}) {
  const t = useTranslations("admin.team_activity");
  const ta = useTranslations("admin.audit");
  const dateTag = useDateLocale();
  const tc = useTranslations("common");
  const router = useRouter();
  const [filterAdmin, setFilterAdmin] = useState<string>(currentFilters.admin?.toString() ?? "all");
  const [filterEntity, setFilterEntity] = useState<string>(currentFilters.entity ?? "all");
  const [filterAction, setFilterAction] = useState<string>(currentFilters.action ?? "all");

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (filterAdmin !== "all") params.set("admin", filterAdmin);
    if (filterEntity !== "all") params.set("entity", filterEntity);
    if (filterAction !== "all") params.set("action", filterAction);
    router.push(`/admin/settings/activity${params.toString() ? "?" + params.toString() : ""}`);
  };
  const resetFilters = () => {
    setFilterAdmin("all"); setFilterEntity("all"); setFilterAction("all");
    router.push("/admin/settings/activity");
  };
  const hasFilters = filterAdmin !== "all" || filterEntity !== "all" || filterAction !== "all";

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-violet-500 shrink-0">
          <Users className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("activite_apos_equipe")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Journal des actions effectuées par les administrateurs · {totalLogs.toLocaleString(dateTag)} entrées au total
          </p>
        </div>
      </div>


      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Équipe active ({admins.length})
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
          {admins.map((a) => {
            const minSinceLogin = a.lastLogin ? Math.floor((Date.now() - new Date(a.lastLogin).getTime()) / 60_000) : null;
            const isOnline = minSinceLogin !== null && minSinceLogin < 15;
            const wasRecent = minSinceLogin !== null && minSinceLogin < 60;
            return (
              <Card key={a.id} className="vnk-card-hover">
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="relative shrink-0">
                      <div
                        className="h-9 w-9 rounded-full flex items-center justify-center text-white font-semibold text-xs"
                        style={{ backgroundColor: a.position?.color ?? a.customRole?.color ?? "#0F2D52" }}
                      >
                        {a.avatarUrl ? (

                          <img src={a.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                        ) : (
                          (a.fullName || a.email).charAt(0).toUpperCase()
                        )}
                      </div>
                      <Circle className={cn("absolute bottom-0 right-0 h-3 w-3 fill-current border-2 border-card rounded-full", isOnline ? "text-emerald-500" : wasRecent ? "text-amber-500" : "text-gray-400")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-xs truncate">{a.fullName || a.email}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {a.position?.name ?? a.customRole?.name ?? t("admin")}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => { setFilterAdmin(a.id.toString()); router.push(`/admin/settings/activity?admin=${a.id}`); }}
                    className="text-[10px] text-muted-foreground hover:text-foreground mt-2 w-full text-left"
                  >
                    {isOnline ? <span className="text-emerald-600">{t("ligne")}</span> : a.lastLogin ? t("vu_relative", { when: formatRelative(a.lastLogin, t, dateTag) }) : t("jamais_connecte")}
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>


      <Card>
        <CardContent className="p-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Select value={filterAdmin} onValueChange={setFilterAdmin}>
              <SelectTrigger className="h-8 w-auto min-w-[160px]"><SelectValue placeholder={t("admin")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tous_admins")}</SelectItem>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={a.id.toString()}>{a.fullName || a.email}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterEntity} onValueChange={setFilterEntity}>
              <SelectTrigger className="h-8 w-auto min-w-[160px]"><SelectValue placeholder={t("type")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toutes_entites")}</SelectItem>
                {entityTypes.map((e) => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAction} onValueChange={setFilterAction}>
              <SelectTrigger className="h-8 w-auto min-w-[140px]"><SelectValue placeholder={t("action")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toutes_actions")}</SelectItem>
                {actions.map((a) => (
                  <SelectItem key={a} value={a}>{ACTION_META[a] ? t(ACTION_META[a].labelKey) : a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={applyFilters} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 h-8">{t("appliquer")}</Button>
            {hasFilters && (
              <Button size="sm" variant="ghost" onClick={resetFilters} className="h-8">
                <X className="h-3.5 w-3.5 mr-1" />{ta("team_activity_view_reinitialiser")}</Button>
            )}
          </div>
        </CardContent>
      </Card>


      <Card>
        <div className="divide-y">
          {logs.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("aucune_action_trouvee_filtres_selectionnes")}
            </p>
          ) : (
            logs.map((log) => {
              const meta = ACTION_META[log.action] ?? { icon: Circle, color: "text-gray-500", labelKey: "" };
              const Icon = meta.icon;
              return (
                <div key={log.id} className="flex items-start gap-4 p-4 hover:bg-muted/30">
                  <div className={cn("h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0", meta.color)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap text-sm">
                      <span className="font-semibold">{log.admin?.fullName || log.admin?.email || t("systeme")}</span>
                      <span className="text-muted-foreground">{(ACTION_VERBS[log.action] ? ta(ACTION_VERBS[log.action]) : null) ?? (meta.labelKey ? t(meta.labelKey).toLowerCase() : log.action)}</span>
                      <span className="text-muted-foreground">
                        {entityLabelWithId(ta, log.entityType, log.entityId)}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[11px] text-muted-foreground">
                      <span>{formatRelative(log.createdAt, t, dateTag)}</span>
                      <span>{new Date(log.createdAt).toLocaleString(dateTag, { dateStyle: "short", timeStyle: "short" })}</span>
                      {log.ipAddress && <span className="font-mono">{log.ipAddress}</span>}
                    </div>
                    {log.changes && typeof log.changes === "object" && Object.keys(log.changes).length > 0 && (
                      <details className="mt-1.5">
                        <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">{t("voir_changements")}</summary>
                        <pre className="mt-1 text-[10px] bg-muted/40 rounded p-2 overflow-x-auto max-w-full font-mono">
                          {JSON.stringify(log.changes, null, 2).slice(0, 1000)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>

      {logs.length >= 100 && (
        <p className="text-center text-xs text-muted-foreground">
          {t("affichage_100_entrees_plus_recentes")}
        </p>
      )}
    </div>
  );
}

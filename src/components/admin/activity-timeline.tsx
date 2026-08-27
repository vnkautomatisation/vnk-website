"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import {
  LogIn,
  LogOut,
  Plus,
  Pencil,
  Trash2,
  Settings,
  Download,
  DollarSign,
  FileText,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type TimelineEvent = {
  id: number | string;
  action: string;
  entityType?: string;
  entityId?: number | null;
  description?: string;
  changes?: unknown;
  ipAddress?: string | null;
  createdAt: string;
};

const ACTION_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; labelKey: string }
> = {
  login: { icon: LogIn, color: "bg-blue-500", labelKey: "tl_login" },
  logout: { icon: LogOut, color: "bg-slate-500", labelKey: "tl_logout" },
  create: { icon: Plus, color: "bg-emerald-500", labelKey: "tl_create" },
  update: { icon: Pencil, color: "bg-amber-500", labelKey: "tl_update" },
  delete: { icon: Trash2, color: "bg-red-500", labelKey: "tl_delete" },
  settings_update: { icon: Settings, color: "bg-violet-500", labelKey: "tl_settings_update" },
  export: { icon: Download, color: "bg-sky-500", labelKey: "tl_export" },
  payment: { icon: DollarSign, color: "bg-emerald-600", labelKey: "tl_payment" },
};

const ENTITY_KEYS: Record<string, string> = {
  clients: "tl_ent_clients",
  invoices: "tl_ent_invoices",
  quotes: "tl_ent_quotes",
  contracts: "tl_ent_contracts",
  mandates: "tl_ent_mandates",
  documents: "tl_ent_documents",
  settings: "tl_ent_settings",
  admin: "tl_ent_admin",
  appointments: "tl_ent_appointments",
  messages: "tl_ent_messages",
};

function formatRelativeTime(iso: string, t: (k: string, v?: Record<string, string | number | Date>) => string, locale: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return t("instant");
  if (minutes < 60) return t("il_y_a_min", { count: minutes });
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return t("il_y_a_h", { count: hours });
  const days = Math.floor(hours / 24);
  if (days < 7) return t("il_y_a_j", { count: days });
  return new Date(iso).toLocaleDateString(locale, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EventItem({ event }: { event: TimelineEvent }) {
  const t = useTranslations("admin.ui");
  const dateTag = useDateLocale();
  const [expanded, setExpanded] = useState(false);
  const config = ACTION_CONFIG[event.action] ?? {
    icon: FileText,
    color: "bg-slate-400",
    label: event.action,
  };
  const Icon = config.icon;
  const entityLabel = event.entityType ? (ENTITY_KEYS[event.entityType] ? t(ENTITY_KEYS[event.entityType]) : event.entityType) : null;

  return (
    <div className="flex gap-3 group">

      <div className="flex flex-col items-center">
        <div
          className={cn(
            "h-8 w-8 rounded-full flex items-center justify-center text-white shrink-0",
            config.color
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="w-px flex-1 bg-border group-last:bg-transparent" />
      </div>


      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{t(config.labelKey)}</span>
          {entityLabel && (
            <span className="text-xs text-muted-foreground">
              {entityLabel}
              {event.entityId ? ` #${event.entityId}` : ""}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {formatRelativeTime(event.createdAt, t, dateTag)}
          </span>
        </div>
        {event.description && (
          <p className="text-xs text-muted-foreground mt-0.5">{event.description}</p>
        )}
        {event.changes != null && typeof event.changes === "object" ? (
          <>
            <button
              onClick={() => setExpanded(!expanded)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-1"
            >
              {expanded ? (
                <ChevronDown className="h-3 w-3" />
              ) : (
                <ChevronRight className="h-3 w-3" />
              )}
              Voir les details
            </button>
            {expanded && (
              <pre className="mt-2 text-[11px] bg-muted rounded-lg p-3 overflow-x-auto max-h-40">
                {JSON.stringify(event.changes, null, 2)}
              </pre>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
}

export function ActivityTimeline({
  events,
  loading = false,
  hasMore = false,
  onLoadMore,
  className,
}: {
  events: TimelineEvent[];
  loading?: boolean;
  hasMore?: boolean;
  onLoadMore?: () => void;
  className?: string;
}) {
  const t = useTranslations("admin.ui");
  const dateTag = useDateLocale();
  if (!events.length && !loading) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        {t("aucune_activite_recente")}
      </p>
    );
  }

  return (
    <div className={className}>
      {events.map((event) => (
        <EventItem key={event.id} event={event} />
      ))}
      {hasMore && onLoadMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={onLoadMore} disabled={loading}>
            {loading ? t("chargement") : t("charger_plus")}
          </Button>
        </div>
      )}
    </div>
  );
}

"use client";
import { useState } from "react";
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
  { icon: React.ComponentType<{ className?: string }>; color: string; label: string }
> = {
  login: { icon: LogIn, color: "bg-blue-500", label: "Connexion" },
  logout: { icon: LogOut, color: "bg-slate-500", label: "Deconnexion" },
  create: { icon: Plus, color: "bg-emerald-500", label: "Creation" },
  update: { icon: Pencil, color: "bg-amber-500", label: "Modification" },
  delete: { icon: Trash2, color: "bg-red-500", label: "Suppression" },
  settings_update: { icon: Settings, color: "bg-violet-500", label: "Parametres modifies" },
  export: { icon: Download, color: "bg-sky-500", label: "Export" },
  payment: { icon: DollarSign, color: "bg-emerald-600", label: "Paiement" },
};

const ENTITY_LABELS: Record<string, string> = {
  clients: "Client",
  invoices: "Facture",
  quotes: "Devis",
  contracts: "Contrat",
  mandates: "Mandat",
  documents: "Document",
  settings: "Parametres",
  admin: "Admin",
  appointments: "Rendez-vous",
  messages: "Message",
};

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "A l'instant";
  if (minutes < 60) return `Il y a ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Il y a ${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `Il y a ${days}j`;
  return new Date(iso).toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function EventItem({ event }: { event: TimelineEvent }) {
  const [expanded, setExpanded] = useState(false);
  const config = ACTION_CONFIG[event.action] ?? {
    icon: FileText,
    color: "bg-slate-400",
    label: event.action,
  };
  const Icon = config.icon;
  const entityLabel = event.entityType ? ENTITY_LABELS[event.entityType] ?? event.entityType : null;

  return (
    <div className="flex gap-3 group">
      {/* Dot */}
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

      {/* Content */}
      <div className="pb-5 min-w-0 flex-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="text-sm font-medium">{config.label}</span>
          {entityLabel && (
            <span className="text-xs text-muted-foreground">
              {entityLabel}
              {event.entityId ? ` #${event.entityId}` : ""}
            </span>
          )}
          <span className="text-xs text-muted-foreground ml-auto shrink-0">
            {formatRelativeTime(event.createdAt)}
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
  if (!events.length && !loading) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Aucune activite recente
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
            {loading ? "Chargement..." : "Charger plus"}
          </Button>
        </div>
      )}
    </div>
  );
}

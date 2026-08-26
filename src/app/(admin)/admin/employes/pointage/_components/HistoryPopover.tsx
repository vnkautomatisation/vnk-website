"use client";
import { History, CheckCircle2, XCircle, Pencil, RotateCcw, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { HistoryEvent } from "../_types";

// Label / icon / color per event type in an entry's timeline.
const HISTORY_EVENT_CONFIG: Record<string, { icon: typeof History; label: string; color: string }> = {
  approved: { icon: CheckCircle2, label: "Approuvé", color: "text-emerald-700" },
  unapproved: { icon: RotateCcw, label: "Annulé", color: "text-amber-700" },
  rejected: { icon: XCircle, label: "Rejeté", color: "text-red-700" },
  edited: { icon: Pencil, label: "Modifié", color: "text-blue-700" },
  force_closed: { icon: Lock, label: "Fermé (admin)", color: "text-orange-700" },
};

// Last 5 events of an entry.
// No ActionTooltip: its asChild trigger nested in PopoverTrigger eats the click.
export function HistoryPopover({ history }: { history: HistoryEvent[] | undefined }) {
  const events = (history ?? []).slice(0, 5);
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          size="icon"
          variant="ghost"
          className="h-6 w-6 text-muted-foreground hover:text-[#0F2D52]"
          aria-label="Historique des actions"
        >
          <History className="h-3.5 w-3.5" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-3" align="end">
        <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52] mb-2">
          Historique
        </p>
        {events.length === 0 ? (
          <p className="text-xs text-muted-foreground italic">Aucun événement enregistré.</p>
        ) : (
          <ul className="space-y-1.5">
            {events.map((ev) => {
              const date = new Date(ev.createdAt);
              const dateStr = date.toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
              const actorName = ev.actor?.fullName || ev.actor?.email || `Admin#${ev.actor?.id ?? "?"}`;
              const cfg = HISTORY_EVENT_CONFIG[ev.event] ?? { icon: History, label: ev.event, color: "text-muted-foreground" };
              const Icon = cfg.icon;
              return (
                <li key={ev.id} className="flex items-start gap-2 text-xs">
                  <Icon className={`h-3 w-3 mt-0.5 shrink-0 ${cfg.color}`} />
                  <div className="flex-1 min-w-0">
                    <p className="leading-tight">
                      <span className={`font-semibold ${cfg.color}`}>{cfg.label}</span>
                      <span className="text-muted-foreground"> par {actorName} le {dateStr}</span>
                    </p>
                    {ev.reason && (
                      <p className="text-[10px] text-muted-foreground italic break-words mt-0.5">
                        {ev.reason}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

import Link from "next/link";
import {
  DollarSign,
  FileText,
  Receipt,
  Briefcase,
  FileSignature,
  MessageSquare,
  Calendar,
  UserPlus,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type WorkflowEvent = {
  id: number;
  eventType: string;
  eventLabel: string | null;
  clientName: string;
  companyName: string | null;
  createdAt: string;
};

const EVENT_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; dotColor: string }> = {
  payment_received: { icon: DollarSign, dotColor: "bg-emerald-500" },
  invoice_created: { icon: Receipt, dotColor: "bg-amber-500" },
  invoice_paid: { icon: DollarSign, dotColor: "bg-emerald-500" },
  invoice_sent: { icon: Receipt, dotColor: "bg-amber-400" },
  quote_created: { icon: FileText, dotColor: "bg-blue-500" },
  quote_accepted: { icon: FileText, dotColor: "bg-blue-600" },
  quote_sent: { icon: FileText, dotColor: "bg-blue-400" },
  mandate_created: { icon: Briefcase, dotColor: "bg-violet-500" },
  mandate_started: { icon: Briefcase, dotColor: "bg-violet-600" },
  mandate_completed: { icon: Briefcase, dotColor: "bg-violet-400" },
  contract_created: { icon: FileSignature, dotColor: "bg-indigo-500" },
  contract_signed: { icon: FileSignature, dotColor: "bg-indigo-600" },
  contract_fully_signed: { icon: FileSignature, dotColor: "bg-indigo-700" },
  message_received: { icon: MessageSquare, dotColor: "bg-sky-500" },
  appointment_booked: { icon: Calendar, dotColor: "bg-teal-500" },
  client_created: { icon: UserPlus, dotColor: "bg-blue-500" },
};

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "A l'instant";
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}j`;
  return new Date(iso).toLocaleDateString("fr-CA", { day: "numeric", month: "short" });
}

export function RecentActivity({ events }: { events: WorkflowEvent[] }) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">Activite recente</h3>
          <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-semibold">
            {events.length}
          </span>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucune activite recente
          </p>
        ) : (
          <div className="space-y-0">
            {events.map((ev, i) => {
              const config = EVENT_CONFIG[ev.eventType] ?? {
                icon: FileText,
                dotColor: "bg-slate-400",
              };
              const Icon = config.icon;
              return (
                <div key={ev.id} className="flex gap-3 group">
                  {/* Ligne + point */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`h-7 w-7 rounded-full flex items-center justify-center text-white shrink-0 ${config.dotColor}`}
                    >
                      <Icon className="h-3 w-3" />
                    </div>
                    {i < events.length - 1 && (
                      <div className="w-px flex-1 bg-border" />
                    )}
                  </div>

                  {/* Contenu */}
                  <div className="pb-4 min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <p className="text-sm font-medium truncate">
                        {ev.eventLabel || ev.eventType}
                      </p>
                      <time className="text-[10px] text-muted-foreground shrink-0">
                        {formatRelative(ev.createdAt)}
                      </time>
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {ev.clientName}
                      {ev.companyName ? ` · ${ev.companyName}` : ""}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

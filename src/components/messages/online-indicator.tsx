"use client";
import { cn } from "@/lib/utils";

const ONLINE_THRESHOLD_MS = 5 * 60 * 1000; // < 5 min = en ligne
const RECENT_THRESHOLD_MS = 15 * 60 * 1000; // < 15 min = recent

export function OnlineIndicator({ lastSeenAt, className }: { lastSeenAt: string | null; className?: string }) {
  if (!lastSeenAt) return <span className={cn("inline-block h-2 w-2 rounded-full bg-muted", className)} title="Jamais connecté" />;
  const diff = Date.now() - new Date(lastSeenAt).getTime();
  if (diff < ONLINE_THRESHOLD_MS) {
    return <span className={cn("inline-block h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-emerald-500/30", className)} title="En ligne" />;
  }
  if (diff < RECENT_THRESHOLD_MS) {
    return <span className={cn("inline-block h-2 w-2 rounded-full bg-amber-400", className)} title="Récent" />;
  }
  return <span className={cn("inline-block h-2 w-2 rounded-full bg-muted-foreground/40", className)} title={`Vu ${formatLastSeen(lastSeenAt)}`} />;
}

function formatLastSeen(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 60) return `il y a ${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `il y a ${h}h`;
  const days = Math.floor(h / 24);
  if (days < 30) return `il y a ${days}j`;
  return d.toLocaleDateString("fr-CA");
}

"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  CheckCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";

type Notification = {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  icon: string | null;
  isRead: boolean;
  createdAt: string;
};

const TYPE_CONFIG: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; borderColor: string }
> = {
  success: { icon: CheckCircle2, color: "text-emerald-500", borderColor: "border-l-emerald-500" },
  warning: { icon: AlertTriangle, color: "text-amber-500", borderColor: "border-l-amber-500" },
  error: { icon: AlertCircle, color: "text-red-500", borderColor: "border-l-red-500" },
  info: { icon: Info, color: "text-blue-500", borderColor: "border-l-blue-500" },
};

type Filter = "all" | "unread";

function formatTime(iso: string, justNow: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return justNow;
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  return `${d}j`;
}

export function NotificationCenter({
  notifications,
  unreadCount,
  onMarkAllRead,
  onMarkOneRead,
  onClose,
}: {
  notifications: Notification[];
  unreadCount: number;
  onMarkAllRead: () => void;
  onMarkOneRead: (id: number) => void;
  onClose: () => void;
}) {
  const t = useTranslations("admin.ui");
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");

  const filtered =
    filter === "unread"
      ? notifications.filter((n) => !n.isRead)
      : notifications;

  return (
    <div className="absolute right-0 top-full mt-2 w-[380px] max-w-[calc(100vw-2rem)] bg-background border rounded-xl shadow-lg z-50 overflow-hidden animate-in fade-in-0 slide-in-from-top-2 duration-200">

      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">{t("notifications")}</h3>
          {unreadCount > 0 && (
            <span className="h-5 min-w-5 px-1.5 rounded-full bg-red-500 text-[10px] font-bold text-white flex items-center justify-center">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onMarkAllRead}
            className="text-xs h-7"
          >
            <CheckCheck className="h-3.5 w-3.5 mr-1" />
            {t("tout_marquer_lu")}
          </Button>
        )}
      </div>


      <div className="flex gap-1 px-4 py-2 border-b">
        {(["all", "unread"] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={cn(
              "text-xs font-medium px-2.5 py-1 rounded-md transition-colors",
              filter === f
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:bg-muted"
            )}
          >
            {f === "all" ? t("toutes") : t("non_lues")}
          </button>
        ))}
      </div>


      <div className="max-h-[400px] overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            {t("aucune_notification")}
          </div>
        ) : (
          filtered.map((n) => {
            const config = TYPE_CONFIG[n.type] ?? TYPE_CONFIG.info;
            const Icon = config.icon;
            return (
              <button
                key={n.id}
                onClick={() => {
                  if (!n.isRead) onMarkOneRead(n.id);
                  if (n.link) {
                    router.push(n.link);
                    onClose();
                  }
                }}
                className={cn(
                  "w-full text-left px-4 py-3 border-b last:border-b-0 border-l-3 transition-colors hover:bg-muted/50",
                  !n.isRead ? config.borderColor : "border-l-transparent",
                  !n.isRead && "bg-muted/30"
                )}
              >
                <div className="flex gap-3">
                  <Icon className={cn("h-4 w-4 shrink-0 mt-0.5", config.color)} />
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        "text-sm leading-snug truncate",
                        !n.isRead ? "font-semibold" : "font-medium"
                      )}
                    >
                      {n.title}
                    </p>
                    {n.body && (
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {n.body}
                      </p>
                    )}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {formatTime(n.createdAt, t("instant"))}
                    </p>
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

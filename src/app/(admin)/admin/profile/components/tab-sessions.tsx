"use client";
import { useTransition } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Monitor, Smartphone, Globe, Trash2, ShieldAlert } from "lucide-react";
import { revokeSessionAction, revokeAllOtherSessionsAction } from "@/app/actions/profile";

type SessionRow = {
  id: string;
  userAgent: string | null;
  ipAddress: string | null;
  createdAt: string;
  expiresAt: string;
};

function parseDevice(ua: string | null): { icon: React.ComponentType<{ className?: string }>; label: string } {
  if (!ua) return { icon: Globe, label: "Inconnu" };
  const lower = ua.toLowerCase();
  if (lower.includes("mobile") || lower.includes("android") || lower.includes("iphone")) {
    return { icon: Smartphone, label: "Mobile" };
  }
  if (lower.includes("chrome")) return { icon: Monitor, label: "Chrome" };
  if (lower.includes("firefox")) return { icon: Monitor, label: "Firefox" };
  if (lower.includes("safari")) return { icon: Monitor, label: "Safari" };
  if (lower.includes("edge")) return { icon: Monitor, label: "Edge" };
  return { icon: Monitor, label: "Navigateur" };
}

export function TabSessions({
  sessions,
}: {
  sessions: SessionRow[];
}) {
  const [pending, startTransition] = useTransition();

  const handleRevoke = (sessionId: string) => {
    startTransition(async () => {
      const result = await revokeSessionAction(sessionId);
      if (result.success) {
        toast.success("Session revoquee");
      } else {
        toast.error(result.error);
      }
    });
  };

  const handleRevokeAll = () => {
    startTransition(async () => {
      const result = await revokeAllOtherSessionsAction();
      if (result.success) {
        toast.success("Toutes les sessions ont ete revoquees");
      } else {
        toast.error(result.error);
      }
    });
  };

  if (sessions.length === 0) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center py-8">
            <ShieldAlert className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm font-medium">Aucune session enregistree</p>
            <p className="text-xs text-muted-foreground mt-1">
              Le suivi des sessions sera disponible lors de votre prochaine connexion.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            Sessions actives
          </CardTitle>
          {sessions.length > 1 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRevokeAll}
              disabled={pending}
              className="text-xs border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              Revoquer toutes les autres
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sessions.map((s, idx) => {
            const device = parseDevice(s.userAgent);
            const DeviceIcon = device.icon;
            const isFirst = idx === 0;
            const createdDate = new Date(s.createdAt).toLocaleDateString("fr-CA", {
              day: "numeric",
              month: "short",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });

            return (
              <div
                key={s.id}
                className="flex items-center gap-3 p-3 rounded-lg border bg-card"
              >
                <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0">
                  <DeviceIcon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{device.label}</span>
                    {isFirst && (
                      <Badge variant="secondary" className="text-[10px] py-0">
                        Actuelle
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {s.ipAddress ?? "IP inconnue"} · {createdDate}
                  </p>
                </div>
                {!isFirst && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRevoke(s.id)}
                    disabled={pending}
                    className="text-destructive hover:text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

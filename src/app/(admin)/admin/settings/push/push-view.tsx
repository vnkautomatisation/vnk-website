"use client";
// Vue Notifications Push — abonnement navigateur + liste des appareils.
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Bell, ChevronLeft, Plus, Trash2, BellOff, Smartphone, Monitor,
  AlertCircle, CheckCircle2,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type SubscriptionRow = {
  id: number; endpoint: string; label: string | null;
  userAgent: string | null; lastUsedAt: string | null;
  createdAt: string;
};

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
}

function detectDevice(ua: string | null): { icon: typeof Smartphone; label: string } {
  if (!ua) return { icon: Monitor, label: "Inconnu" };
  if (/mobile|iphone|android/i.test(ua)) return { icon: Smartphone, label: "Mobile" };
  return { icon: Monitor, label: "Ordinateur" };
}

export function PushView({
  subscriptions, vapidConfigured,
}: {
  subscriptions: SubscriptionRow[];
  vapidConfigured: boolean;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribing, setSubscribing] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window) || !("serviceWorker" in navigator) || !("PushManager" in window)) {
      setPermission("unsupported");
      return;
    }
    setPermission(Notification.permission);
    fetch("/api/admin/push", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { vapidPublicKey: string; enabled: boolean }) => {
        if (d.vapidPublicKey) setVapidKey(d.vapidPublicKey);
      })
      .catch(() => {});
  }, []);

  const subscribe = async () => {
    if (!vapidKey) {
      toast.error("Clé VAPID non configurée côté serveur");
      return;
    }
    setSubscribing(true);
    try {
      // Demander permission
      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.warning("Permission refusée");
        return;
      }

      // Enregistrer le service worker
      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;

      // Souscrire au push (cast pour compat TS strict)
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });

      // Détection du label
      const ua = navigator.userAgent;
      let label = "Cet appareil";
      if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) label = "Chrome";
      else if (/Firefox/i.test(ua)) label = "Firefox";
      else if (/Safari/i.test(ua)) label = "Safari";
      else if (/Edge/i.test(ua)) label = "Edge";
      if (/Mobile|Android|iPhone/i.test(ua)) label += " mobile";

      const subJSON = sub.toJSON();
      const res = await fetch("/api/admin/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          endpoint: subJSON.endpoint,
          keys: subJSON.keys,
          label,
        }),
      });
      if (res.ok) {
        toast.success("Notifications activées sur cet appareil");
        router.refresh();
      } else {
        toast.error("Erreur d'enregistrement");
      }
    } catch (e) {
      toast.error("Erreur : " + (e instanceof Error ? e.message : "inconnu"));
    } finally {
      setSubscribing(false);
    }
  };

  const unsubscribe = async (endpoint: string) => {
    try {
      // Localement
      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub?.endpoint === endpoint) await sub.unsubscribe();
      }
      // Serveur
      await fetch(`/api/admin/push?endpoint=${encodeURIComponent(endpoint)}`, { method: "DELETE" });
      toast.success("Désabonné");
      router.refresh();
    } catch {
      toast.error("Erreur");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-yellow-500 shrink-0">
          <Bell className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Notifications push</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Recevoir des alertes en temps réel sur vos appareils
          </p>
        </div>
      </div>

      {!vapidConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-900 mb-1">Configuration serveur requise</p>
              <p className="text-amber-800">
                Définissez <code className="bg-white px-1 rounded font-mono">VAPID_PUBLIC_KEY</code> et <code className="bg-white px-1 rounded font-mono">VAPID_PRIVATE_KEY</code> dans les variables d&apos;environnement. Générez-les avec <code className="bg-white px-1 rounded font-mono">npx web-push generate-vapid-keys</code>.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {permission === "unsupported" && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
            <p className="text-xs text-red-800">
              Ce navigateur ne supporte pas les notifications push (Web Push API + Service Workers requis).
            </p>
          </CardContent>
        </Card>
      )}

      {/* Bouton d'abonnement */}
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${permission === "granted" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {permission === "granted" ? <CheckCircle2 className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">
                {permission === "granted" ? "Notifications autorisées" : "Activer les notifications"}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {permission === "granted"
                  ? "Vous recevrez les alertes importantes sur cet appareil."
                  : permission === "denied"
                  ? "Les notifications sont bloquées. Modifiez les permissions du site dans votre navigateur."
                  : "Activez les notifications pour recevoir les alertes en temps réel."}
              </p>
              {permission !== "denied" && permission !== "unsupported" && (
                <Button
                  onClick={subscribe}
                  disabled={subscribing || !vapidConfigured}
                  className="mt-3 bg-[#0F2D52] hover:bg-[#0F2D52]/90"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {subscribing ? "Activation..." : "Activer sur cet appareil"}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Liste appareils abonnés */}
      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Appareils abonnés ({subscriptions.length})
        </p>
        <Card>
          <div className="divide-y">
            {subscriptions.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Aucun appareil abonné. Activez les notifications sur les appareils que vous utilisez.
              </p>
            ) : (
              subscriptions.map((s) => {
                const dev = detectDevice(s.userAgent);
                const Icon = dev.icon;
                return (
                  <div key={s.id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                    <div className="h-9 w-9 rounded-lg bg-yellow-500 text-white flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-sm">{s.label ?? "Appareil"}</p>
                        <Badge variant="outline" className="text-[10px]">{dev.label}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Abonné {new Date(s.createdAt).toLocaleDateString("fr-CA", { dateStyle: "medium" })}
                        {s.lastUsedAt && ` · Dernière notif ${new Date(s.lastUsedAt).toLocaleDateString("fr-CA")}`}
                      </p>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => unsubscribe(s.endpoint)} className="text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

"use client";
// Vue Notifications Push — abonnement navigateur + liste des appareils.
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
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

function detectDevice(ua: string | null): { icon: typeof Smartphone; labelKey: string } {
  if (!ua) return { icon: Monitor, labelKey: "inconnu" };
  if (/mobile|iphone|android/i.test(ua)) return { icon: Smartphone, labelKey: "mobile" };
  return { icon: Monitor, labelKey: "ordinateur" };
}

export function PushView({
  subscriptions, vapidConfigured,
}: {
  subscriptions: SubscriptionRow[];
  vapidConfigured: boolean;
}) {
  const t = useTranslations("admin.push");
  const tc = useTranslations("common");
  const router = useRouter();
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribing, setSubscribing] = useState(false);
  const [vapidKey, setVapidKey] = useState<string | null>(null);
  const dateTag = useDateLocale();

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!(t("notification") in window) || !("serviceWorker" in navigator) || !(t("pushmanager") in window)) {
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
      toast.error(t("cle_vapid_non_configuree_cote"));
      return;
    }
    setSubscribing(true);
    try {

      const perm = await Notification.requestPermission();
      setPermission(perm);
      if (perm !== "granted") {
        toast.warning(t("permission_refusee"));
        return;
      }


      const reg = await navigator.serviceWorker.register("/push-sw.js");
      await navigator.serviceWorker.ready;


      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource,
      });


      const ua = navigator.userAgent;
      let label = t("cet_appareil");
      if (/Chrome/i.test(ua) && !/Edge/i.test(ua)) label = t("chrome");
      else if (/Firefox/i.test(ua)) label = t("firefox");
      else if (/Safari/i.test(ua)) label = t("safari");
      else if (/Edge/i.test(ua)) label = t("edge");
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
        toast.success(t("notifications_activees_cet_appareil"));
        router.refresh();
      } else {
        toast.error(t("erreur_enregistrement"));
      }
    } catch (e) {
      toast.error(t("erreur") + (e instanceof Error ? e.message : "inconnu"));
    } finally {
      setSubscribing(false);
    }
  };

  const unsubscribe = async (endpoint: string) => {
    try {

      const reg = await navigator.serviceWorker.getRegistration("/push-sw.js");
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub?.endpoint === endpoint) await sub.unsubscribe();
      }

      await fetch(`/api/admin/push?endpoint=${encodeURIComponent(endpoint)}`, { method: "DELETE" });
      toast.success(t("desabonne"));
      router.refresh();
    } catch {
      toast.error(t("erreur_2"));
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
          <h1 className="text-2xl font-bold tracking-tight">{t("notifications_push")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("recevoir_alertes_temps_reel_appareils")}
          </p>
        </div>
      </div>

      {!vapidConfigured && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs">
              <p className="font-semibold text-amber-900 mb-1">{t("configuration_serveur_requise")}</p>
              <p className="text-amber-800">{t("push_view_definissez")}<code className="bg-white px-1 rounded font-mono">VAPID_PUBLIC_KEY</code> et <code className="bg-white px-1 rounded font-mono">VAPID_PRIVATE_KEY</code> {t("variables_apos_environnement_generez")} <code className="bg-white px-1 rounded font-mono">npx web-push generate-vapid-keys</code>.
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
              {t("navigateur_ne_supporte_pas_notifications")}
            </p>
          </CardContent>
        </Card>
      )}


      <Card>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className={`h-12 w-12 rounded-lg flex items-center justify-center shrink-0 ${permission === "granted" ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"}`}>
              {permission === "granted" ? <CheckCircle2 className="h-6 w-6" /> : <BellOff className="h-6 w-6" />}
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold">
                {permission === "granted" ? t("notifications_autorisees") : t("activer_notifications")}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {permission === "granted"
                  ? t("vous_recevrez_alertes_importantes_cet")
                  : permission === "denied"
                  ? t("notifications_bloquees_modifiez_permissions_site")
                  : t("activez_notifications_recevoir_alertes_temps")}
              </p>
              {permission !== "denied" && permission !== "unsupported" && (
                <Button
                  onClick={subscribe}
                  disabled={subscribing || !vapidConfigured}
                  className="mt-3 bg-[#0F2D52] hover:bg-[#0F2D52]/90"
                >
                  <Plus className="h-4 w-4 mr-1.5" />
                  {subscribing ? t("activation") : t("activer_cet_appareil")}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>


      <div>
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
          Appareils abonnés ({subscriptions.length})
        </p>
        <Card>
          <div className="divide-y">
            {subscriptions.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {t("aucun_appareil_abonne_activez_notifications")}
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
                        <p className="font-medium text-sm">{s.label ?? t("appareil")}</p>
                        <Badge variant="outline" className="text-[10px]">{t(dev.labelKey)}</Badge>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Abonné {new Date(s.createdAt).toLocaleDateString(dateTag, { dateStyle: "medium" })}
                        {s.lastUsedAt && t("push_view_derniere_notif_p0", { p0: new Date(s.lastUsedAt).toLocaleDateString(dateTag) })}
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

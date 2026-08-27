"use client";
// Toggle desktop notifications + sound preferences (localStorage)
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const KEY_DESKTOP = "vnk_msg_desktop_notif";
const KEY_SOUND = "vnk_msg_sound_notif";

export function getNotifPrefs() {
  if (typeof window === "undefined") return { desktop: false, sound: true };
  return {
    desktop: localStorage.getItem(KEY_DESKTOP) === "1",
    sound: localStorage.getItem(KEY_SOUND) !== "0", // default true
  };
}

export function NotificationToggle() {
  const t = useTranslations("admin.messages");
  const [desktop, setDesktop] = useState(false);
  const [sound, setSound] = useState(true);
  const [permission, setPermission] = useState<NotificationPermission>("default");

  useEffect(() => {
    const p = getNotifPrefs();
    setDesktop(p.desktop);
    setSound(p.sound);
    if ("Notification" in window) setPermission(Notification.permission);
  }, []);

  const toggleDesktop = async () => {
    if (!("Notification" in window)) { toast.error(t("notifications_non_supportees")); return; }
    if (!desktop) {
      if (Notification.permission === "default") {
        const result = await Notification.requestPermission();
        setPermission(result);
        if (result !== "granted") { toast.error(t("permission_refusee")); return; }
      } else if (Notification.permission === "denied") {
        toast.error(t("permission_refusee_autorise_parametres_navigateur"));
        return;
      }
      localStorage.setItem(KEY_DESKTOP, "1");
      setDesktop(true);
      toast.success(t("notifications_desktop_activees"));
    } else {
      localStorage.setItem(KEY_DESKTOP, "0");
      setDesktop(false);
      toast.success(t("notifications_desktop_desactivees"));
    }
  };

  const toggleSound = () => {
    const next = !sound;
    localStorage.setItem(KEY_SOUND, next ? "1" : "0");
    setSound(next);
    if (next) playMessageSound();
  };

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={toggleDesktop}
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
          desktop ? "bg-[#0F2D52] text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        title={desktop ? t("notifications_desktop_activees") : t("activer_notifications_desktop")}
      >
        {desktop ? <Bell className="h-3.5 w-3.5" /> : <BellOff className="h-3.5 w-3.5" />}
      </button>
      <button
        type="button"
        onClick={toggleSound}
        className={cn(
          "h-8 w-8 flex items-center justify-center rounded-md transition-colors",
          sound ? "bg-[#0F2D52] text-white" : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
        title={sound ? t("active") : t("desactive")}
      >
        {sound ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
      </button>
      {permission === "denied" && (
        <span className="text-[9px] text-destructive">{t("bloque_navigateur")}</span>
      )}
    </div>
  );
}

let audioCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
    return audioCtx;
  } catch { return null; }
}

export function playMessageSound() {
  const prefs = getNotifPrefs();
  if (!prefs.sound) return;
  const ctx = getCtx();
  if (!ctx) return;
  try {
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.setValueAtTime(1175, t + 0.08);
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(0.18, t + 0.01);
    gain.gain.linearRampToValueAtTime(0, t + 0.18);
    osc.start(t);
    osc.stop(t + 0.2);
  } catch { /* ignore */ }
}

export function showDesktopNotification(title: string, body: string, onClick?: () => void) {
  const prefs = getNotifPrefs();
  if (!prefs.desktop || typeof window === "undefined") return;
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  if (document.hasFocus()) return; // pas de notif si l'app est focus
  try {
    const n = new Notification(title, { body, icon: "/favicon.ico", tag: "vnk-msg" });
    if (onClick) n.onclick = () => { onClick(); n.close(); window.focus(); };
  } catch { /* ignore */ }
}

"use client";
// Hook discret : envoie un POST /api/portal/heartbeat toutes les 60s
// pour mettre a jour Client.lastSeenAt (online indicator admin)
import { useEffect } from "react";

export function PortalHeartbeat() {
  useEffect(() => {
    const beat = () => {
      fetch("/api/portal/heartbeat", { method: "POST" }).catch(() => {});
    };
    beat();
    const interval = setInterval(beat, 60_000);
    const onVisible = () => { if (!document.hidden) beat(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
  return null;
}

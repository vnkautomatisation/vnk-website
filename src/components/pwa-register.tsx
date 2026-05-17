"use client";
// Enregistre le Service Worker PWA (offline-aware shell).
// Scope distinct du push-sw.js (qui gère les notifications push).
import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    if (process.env.NODE_ENV !== "production") return; // dev = pas de SW

    const register = async () => {
      try {
        await navigator.serviceWorker.register("/sw.js", { scope: "/" });
      } catch (err) {
        console.warn("[pwa] SW registration failed", err);
      }
    };
    // Attendre que la page soit complètement chargée pour ne pas voler de bande passante
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);

  return null;
}

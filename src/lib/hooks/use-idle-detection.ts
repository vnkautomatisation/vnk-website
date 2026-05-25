"use client";
// Hook qui detecte l'inactivite du user apres `thresholdMs`.
// Renvoie true si aucun event d'interaction depuis le seuil.
// Reset automatique a chaque mousemove/keydown/scroll/touch/click.
import { useEffect, useRef, useState } from "react";

export function useIdleDetection(thresholdMs: number, enabled: boolean) {
  const [idle, setIdle] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      return;
    }
    const reset = () => {
      setIdle(false);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setIdle(true), thresholdMs);
    };
    const events: Array<keyof WindowEventMap> = ["mousemove", "keydown", "scroll", "touchstart", "click"];
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach((e) => window.removeEventListener(e, reset));
      if (timer.current) clearTimeout(timer.current);
    };
  }, [thresholdMs, enabled]);

  return idle;
}

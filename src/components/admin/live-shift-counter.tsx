"use client";
// Compteur HH:MM:SS du shift en cours, tick chaque seconde.
// Composant isole pour eviter de re-render le parent toutes les secondes.
// SSR-safe : 1er render = heure de demarrage statique, puis useEffect cote
// client kick le compteur live. Pas de hydration mismatch.
import { useState, useEffect, useMemo } from "react";

export type LiveShiftCounterVariant = "dark" | "light";

const VARIANTS: Record<LiveShiftCounterVariant, { container: string; dot: string; text: string }> = {
  // Dark : sur fond fonce (navy hero). Bulle translucide, texte clair.
  dark: {
    container: "bg-emerald-500/20 border-emerald-300/30",
    dot: "bg-emerald-300",
    text: "text-white",
  },
  // Light : sur fond clair (page admin). Bulle pastel, texte sombre.
  light: {
    container: "bg-emerald-50 border-emerald-200",
    dot: "bg-emerald-500",
    text: "text-emerald-900",
  },
};

export function LiveShiftCounter({
  clockIn,
  pausedAt = null,
  totalBreakMin = 0,
  variant = "light",
}: {
  clockIn: string | Date;
  pausedAt?: string | Date | null;
  totalBreakMin?: number;
  variant?: LiveShiftCounterVariant;
}) {
  const startMs = useMemo(() => new Date(clockIn).getTime(), [clockIn]);
  const pausedMs = useMemo(() => (pausedAt ? new Date(pausedAt).getTime() : null), [pausedAt]);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    // Si en pause, on n'a pas besoin de tick chaque seconde — temps fige
    if (pausedMs !== null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startMs, pausedMs]);

  const styles = VARIANTS[variant];
  const startLabel = new Date(clockIn).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" });

  // 1er render (SSR + premier render client) : heure de demarrage statique
  if (now === null) {
    return (
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${styles.container}`}>
        <span className={`h-2 w-2 rounded-full animate-pulse ${styles.dot}`} />
        <span className={`text-xs font-mono tabular-nums ${styles.text}`}>Depuis {startLabel}</span>
      </div>
    );
  }

  // Temps de reference pour le calcul : si en pause, on fige au moment de la pause
  const refMs = pausedMs ?? now;
  const totalBreakMs = totalBreakMin * 60_000;
  const elapsedMs = Math.max(0, refMs - startMs - totalBreakMs);
  const totalSec = Math.floor(elapsedMs / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");

  return (
    <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md border ${styles.container}`}>
      <span className={`h-2 w-2 rounded-full animate-pulse ${styles.dot}`} />
      <span className={`text-xs font-mono tabular-nums ${styles.text}`} title={`Depuis ${startLabel}`}>
        {pad(h)}:{pad(m)}:{pad(s)}
      </span>
    </div>
  );
}

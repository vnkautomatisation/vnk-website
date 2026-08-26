"use client";
// /kiosque — shared-tablet punch kiosk (feature-flagged via settings
// hr_pointage.kiosk_enabled). No personal session: the employee types a
// 4-6 digit PIN, sees their name and punches in/out. Auto-resets after a
// few seconds so the next employee can punch.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Clock, Delete, LogIn, LogOut, Loader2, CheckCircle2, AlertCircle,
  Coffee, Play, Maximize,
} from "lucide-react";

type JobCode = { id: number; code: string; label: string };
type OpenShift = {
  clockIn: string;
  pausedAt: string | null;
  pausedKind: string | null;
  totalBreakMin: number;
};
type Status = {
  fullName: string;
  open: OpenShift | null;
  jobCodes: JobCode[];
  todayMin: number;
  onSite: Array<{ name: string; since: string; paused: boolean }>;
};

type Screen =
  | { step: "pin" }
  | { step: "loading" }
  | { step: "punch"; status: Status; pin: string }
  | { step: "done"; title: string; detail: string; todayMin: number };

const RESET_MS = 6000;

function fmtMin(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h} h ${String(m).padStart(2, "0")}`;
}

export default function KioskPage() {
  const [screen, setScreen] = useState<Screen>({ step: "pin" });
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [jobCodeId, setJobCodeId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  // Null until mount: rendering the time on the server breaks hydration.
  const [clock, setClock] = useState<Date | null>(null);
  const resetTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Live clock in the header
  useEffect(() => {
    setClock(new Date());
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const reset = useCallback(() => {
    if (resetTimer.current) clearTimeout(resetTimer.current);
    setScreen({ step: "pin" });
    setPin("");
    setError(null);
    setJobCodeId(null);
    setBusy(false);
  }, []);

  // Auto-reset after a completed punch
  useEffect(() => {
    if (screen.step === "done") {
      resetTimer.current = setTimeout(reset, RESET_MS);
      return () => {
        if (resetTimer.current) clearTimeout(resetTimer.current);
      };
    }
  }, [screen.step, reset]);

  const call = async (body: Record<string, unknown>) => {
    const res = await fetch("/api/kiosk/punch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Erreur ${res.status}`);
    return data;
  };

  const submitPin = async (value: string) => {
    setError(null);
    setScreen({ step: "loading" });
    try {
      const status: Status = await call({ pin: value, action: "status" });
      setScreen({ step: "punch", status, pin: value });
      if (status.jobCodes.length === 1) setJobCodeId(status.jobCodes[0].id);
    } catch (e) {
      setError((e as Error).message);
      setScreen({ step: "pin" });
      setPin("");
    }
  };

  const pressDigit = (d: string) => {
    if (busy || screen.step === "loading") return;
    setError(null);
    const next = (pin + d).slice(0, 6);
    setPin(next);
  };
  const pressErase = () => setPin((p) => p.slice(0, -1));

  // Keyboard-first (enterprise UX): physical keyboard works on the PIN pad —
  // digits type, Backspace erases, Enter validates, Escape resets.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (screen.step === "pin") {
        if (/^[0-9]$/.test(ev.key)) {
          ev.preventDefault();
          pressDigit(ev.key);
        } else if (ev.key === "Backspace") {
          ev.preventDefault();
          pressErase();
        } else if (ev.key === "Enter" && pin.length >= 4) {
          ev.preventDefault();
          submitPin(pin);
        }
      } else if (ev.key === "Escape") {
        reset();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen.step, pin, busy]);

  const doPunch = async (action: "in" | "out") => {
    if (screen.step !== "punch") return;
    setBusy(true);
    setError(null);
    try {
      const data = await call({ pin: screen.pin, action, jobCodeId: jobCodeId ?? undefined });
      setScreen({
        step: "done",
        title: action === "in" ? `Bonne journée, ${data.fullName} !` : `Merci, ${data.fullName} !`,
        detail: action === "in"
          ? "Votre pointage est démarré."
          : `Journée fermée — ${fmtMin(data.durationMin ?? 0)} sur ce quart.`,
        todayMin: data.todayMin ?? 0,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  // Meal break (deducted) / short break (paid) / resume, from the kiosk.
  const doBreak = async (action: "pause" | "resume", kind?: "meal" | "paid") => {
    if (screen.step !== "punch") return;
    setBusy(true);
    setError(null);
    try {
      const data = await call({ pin: screen.pin, action, kind });
      setScreen({
        step: "done",
        title: action === "pause"
          ? (kind === "paid" ? "Pause courte" : "Pause repas")
          : `Bon retour, ${data.fullName} !`,
        detail: action === "pause"
          ? (kind === "paid"
            ? "Pause payée en cours — repointez pour reprendre."
            : "Pause repas en cours — repointez pour reprendre.")
          : `Pause de ${data.breakMin ?? 0} min enregistrée.`,
        todayMin: 0,
      });
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  // Running shift counter, frozen while on break.
  const openShift = screen.step === "punch" ? screen.status.open : null;
  const elapsedMin = openShift
    ? Math.max(
        0,
        Math.floor(
          ((openShift.pausedAt ? new Date(openShift.pausedAt).getTime() : (clock?.getTime() ?? Date.now()))
            - new Date(openShift.clockIn).getTime()) / 60000,
        ) - openShift.totalBreakMin,
      )
    : 0;

  const hour = clock?.getHours() ?? 12;
  const greeting = hour < 12 ? "Bonjour" : hour < 18 ? "Bon après-midi" : "Bonsoir";

  const toggleFullscreen = () => {
    if (typeof document === "undefined") return;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };

  // "19:35:16" (fr-CA would render "19 h 35 min 16 s"); capitalize first word only.
  const pad2 = (n: number) => String(n).padStart(2, "0");
  const timeStr = clock
    ? `${pad2(clock.getHours())}:${pad2(clock.getMinutes())}:${pad2(clock.getSeconds())}`
    : "--:--:--";
  const rawDate = clock
    ? clock.toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" })
    : "";
  const dateStr = rawDate ? rawDate.charAt(0).toUpperCase() + rawDate.slice(1) : " ";

  return (
    // h-[100dvh] + overflow-hidden: a kiosk never scrolls, everything must fit.
    <div className="h-[100dvh] bg-[#0B2444] text-white select-none relative overflow-hidden flex flex-col">
      {/* Decorative glows */}
      <div className="pointer-events-none absolute -top-1/3 -left-1/4 w-[70vw] h-[70vw] rounded-full bg-[#1d5891]/40 blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-1/3 -right-1/4 w-[60vw] h-[60vw] rounded-full bg-[#0F2D52]/60 blur-3xl" aria-hidden />

      {/* Brand bar, pinned to the top */}
      <header className="relative z-10 shrink-0 w-full max-w-[1600px] mx-auto flex items-center justify-between gap-3 px-4 sm:px-6 lg:px-16 py-3 sm:py-4">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl bg-white/10 border border-white/25 backdrop-blur flex items-center justify-center shrink-0">
            <span className="font-bold text-white text-sm sm:text-base tracking-wider">VNK</span>
          </div>
          {/* No tagline: unreadable at kiosk distance */}
          <p className="text-white font-bold leading-tight text-base sm:text-xl truncate min-w-0">
            Automatisation Inc.
          </p>
        </div>
        <button
          type="button"
          onClick={toggleFullscreen}
          className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-white/10 hover:bg-white/20 text-white/70 hover:text-white flex items-center justify-center transition shrink-0"
          aria-label="Plein écran"
        >
          <Maximize className="h-5 w-5" />
        </button>
      </header>

      {/* Two columns only when there is room for both: wide enough, tall enough
          and landscape. A phone in landscape is wide but too short, and the
          parent is overflow-hidden, so the keypad would be clipped. */}
      <div className="relative z-10 flex-1 min-h-0 w-full max-w-[1600px] mx-auto flex flex-col items-center justify-center gap-4 sm:gap-8 px-4 pb-2 [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:flex-row [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:justify-center [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:gap-24 [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:px-16">
        {/* Clock */}
        <div className="shrink-0 min-w-0 text-center [@media(max-height:520px)_and_(orientation:landscape)]:hidden [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:text-left [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:max-w-[46rem]">
          <div className="inline-flex items-center gap-2 text-white/60 text-[10px] sm:text-xs uppercase tracking-[0.25em] mb-1 sm:mb-2">
            <Clock className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
            Borne de pointage
          </div>
          <div className="font-mono font-bold tabular-nums leading-none text-white text-[clamp(3rem,15vw,8rem)] [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:text-[clamp(3rem,8vw,9rem)]">
            {timeStr}
          </div>
          <div className="text-white/70 text-sm sm:text-lg mt-2 sm:mt-3">{dateStr}</div>
          <p className="hidden [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:block text-white/45 text-sm leading-relaxed mt-8 pt-6 border-t border-white/10 max-w-md">
            Entrez votre NIP personnel pour commencer ou terminer votre journée.
            Vos heures sont enregistrées automatiquement.
          </p>
        </div>

        {/* Interaction panel */}
        <div className="w-full max-w-[min(30rem,92vw)] shrink min-h-0 flex items-center justify-center [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:w-[460px] [@media(min-width:768px)_and_(min-height:560px)_and_(orientation:landscape)]:shrink-0">
          <div className="w-full max-h-full overflow-y-auto bg-white text-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl ring-1 ring-black/5">
        {screen.step === "loading" && (
          <div className="p-12 flex flex-col items-center gap-3">
            <Loader2 className="h-8 w-8 animate-spin text-[#0F2D52]" />
            <p className="text-sm text-slate-600">Identification…</p>
          </div>
        )}

        {screen.step === "pin" && (
          <div className="p-4 sm:p-6 lg:p-7 space-y-3 sm:space-y-5 [@media(max-height:520px)_and_(orientation:landscape)]:p-3 [@media(max-height:520px)_and_(orientation:landscape)]:space-y-2">
            <div className="text-center">
              <p className="text-base sm:text-lg font-bold text-[#0F2D52]">{greeting}</p>
              <p className="text-xs sm:text-sm text-slate-500 mt-0.5 [@media(max-height:520px)_and_(orientation:landscape)]:hidden">Entrez votre NIP pour poinçonner</p>
            </div>
            {/* PIN dots */}
            <div className="flex justify-center gap-2.5 h-5">
              {Array.from({ length: Math.max(4, pin.length) }, (_, i) => (
                <span
                  key={i}
                  className={`w-4 h-4 rounded-full transition ${i < pin.length ? "bg-[#0F2D52] scale-110" : "bg-slate-200"}`}
                />
              ))}
            </div>
            {error && (
              <div className="flex items-center gap-2 justify-center text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />{error}
              </div>
            )}
            {/* Keypad */}
            <div className="grid grid-cols-3 gap-2.5 sm:gap-3 [@media(max-height:520px)_and_(orientation:landscape)]:gap-1.5">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => pressDigit(d)}
                  className="h-14 sm:h-[70px] lg:h-20 [@media(max-height:520px)_and_(orientation:landscape)]:h-11 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/70 text-2xl sm:text-3xl font-semibold text-[#0F2D52] transition active:scale-95"
                >
                  {d}
                </button>
              ))}
              <button
                type="button"
                onClick={pressErase}
                className="h-14 sm:h-[70px] lg:h-20 [@media(max-height:520px)_and_(orientation:landscape)]:h-11 rounded-xl sm:rounded-2xl bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200/70 flex items-center justify-center text-slate-500 transition active:scale-95"
                aria-label="Effacer"
              >
                <Delete className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
              <button
                type="button"
                onClick={() => pressDigit("0")}
                className="h-16 rounded-xl bg-slate-100 hover:bg-slate-200 active:bg-slate-300 text-2xl font-semibold text-[#0F2D52] transition"
              >
                0
              </button>
              <button
                type="button"
                disabled={pin.length < 4}
                onClick={() => submitPin(pin)}
                className="h-14 sm:h-[70px] lg:h-20 [@media(max-height:520px)_and_(orientation:landscape)]:h-11 rounded-xl sm:rounded-2xl bg-[#0F2D52] hover:bg-[#1a3a66] disabled:opacity-25 flex items-center justify-center text-white transition active:scale-95 shadow-md shadow-[#0F2D52]/20"
                aria-label="Valider"
              >
                <LogIn className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
            </div>
          </div>
        )}

        {screen.step === "punch" && (
          <div className="p-6 space-y-4">
            <div className="text-center">
              <p className="text-lg font-bold text-[#0F2D52]">{screen.status.fullName}</p>
              {screen.status.open ? (
                <>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Depuis{" "}
                    {(() => {
                      const d = new Date(screen.status.open.clockIn);
                      return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
                    })()}
                    {screen.status.open.totalBreakMin > 0
                      ? ` · ${screen.status.open.totalBreakMin} min de pause`
                      : ""}
                  </p>
                  {/* Running shift counter, frozen while on break */}
                  <p className="font-mono text-3xl font-bold text-[#0F2D52] tabular-nums mt-1">
                    {fmtMin(elapsedMin)}
                  </p>
                  {screen.status.open.pausedAt && (
                    <span className="inline-flex items-center gap-1.5 mt-1 px-2.5 py-1 rounded-full bg-amber-100 text-amber-800 text-[11px] font-semibold">
                      <Coffee className="h-3 w-3" />
                      {screen.status.open.pausedKind === "paid" ? "Pause courte en cours" : "Pause repas en cours"}
                    </span>
                  )}
                </>
              ) : (
                <p className="text-xs text-slate-500 mt-0.5">
                  {screen.status.todayMin > 0
                    ? `Déjà ${fmtMin(screen.status.todayMin)} aujourd'hui`
                    : "Aucun pointage ouvert"}
                </p>
              )}
            </div>

            {error && (
              <div className="flex items-center gap-2 justify-center text-sm text-red-600">
                <AlertCircle className="h-4 w-4" />{error}
              </div>
            )}

            {!screen.status.open && screen.status.jobCodes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-wider font-semibold text-slate-500 text-center">
                  Code de tâche
                </p>
                <div className="grid grid-cols-1 gap-1.5 max-h-48 overflow-y-auto">
                  {screen.status.jobCodes.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setJobCodeId(c.id)}
                      className={`px-3 py-2.5 rounded-lg border text-left text-sm transition ${
                        jobCodeId === c.id
                          ? "border-[#0F2D52] bg-[#0F2D52]/5 font-semibold text-[#0F2D52]"
                          : "border-slate-200 hover:bg-slate-50 text-slate-700"
                      }`}
                    >
                      <span className="font-mono text-xs mr-2 text-slate-400">{c.code}</span>
                      {c.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {screen.status.open ? (
              <div className="space-y-2">
                {/* Breaks, same rules as the web */}
                {screen.status.open.pausedAt ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => doBreak("resume")}
                    className="w-full h-14 rounded-xl bg-[#0F2D52] hover:bg-[#1a3a66] disabled:opacity-50 text-white font-bold flex items-center justify-center gap-2 transition"
                  >
                    {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Play className="h-5 w-5" />}
                    Reprendre le travail
                  </button>
                ) : (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => doBreak("pause", "meal")}
                      className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-sm flex flex-col items-center justify-center transition"
                    >
                      <span className="flex items-center gap-1.5"><Coffee className="h-4 w-4" />Repas</span>
                      <span className="text-[10px] text-slate-500 font-normal">non payée</span>
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => doBreak("pause", "paid")}
                      className="h-14 rounded-xl bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-700 font-semibold text-sm flex flex-col items-center justify-center transition"
                    >
                      <span className="flex items-center gap-1.5"><Coffee className="h-4 w-4" />Pause courte</span>
                      <span className="text-[10px] text-slate-500 font-normal">payée</span>
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => doPunch("out")}
                  className="w-full h-16 rounded-xl bg-red-500 hover:bg-red-600 disabled:opacity-50 text-white text-lg font-bold flex items-center justify-center gap-2 transition"
                >
                  {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogOut className="h-5 w-5" />}
                  Terminer ma journée
                </button>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy || (screen.status.jobCodes.length > 0 && !jobCodeId)}
                onClick={() => doPunch("in")}
                className="w-full h-16 rounded-xl bg-emerald-500 hover:bg-emerald-600 disabled:opacity-40 text-white text-lg font-bold flex items-center justify-center gap-2 transition"
              >
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <LogIn className="h-5 w-5" />}
                Commencer ma journée
              </button>
            )}

            {/* On-site colleagues, only after identification */}
            {screen.status.onSite.length > 0 && (
              <div className="border-t pt-3">
                <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-400 mb-1.5">
                  Sur place ({screen.status.onSite.length})
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {screen.status.onSite.map((p, i) => (
                    <span
                      key={i}
                      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] ${
                        p.paused ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-800"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${p.paused ? "bg-amber-500" : "bg-emerald-500"}`} />
                      {p.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={reset}
              className="w-full text-center text-xs text-slate-400 hover:text-slate-600 py-1"
            >
              Annuler
            </button>
          </div>
        )}

        {screen.step === "done" && (
          <div className="p-10 flex flex-col items-center gap-2 text-center">
            <CheckCircle2 className="h-14 w-14 text-emerald-500" />
            <p className="text-lg font-bold text-[#0F2D52]">{screen.title}</p>
            <p className="text-sm text-slate-600">{screen.detail}</p>
            {screen.todayMin > 0 && (
              <div className="mt-2 px-4 py-2 rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/15">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52]">Total aujourd&apos;hui</p>
                <p className="font-mono text-2xl font-bold text-[#0F2D52] tabular-nums">{fmtMin(screen.todayMin)}</p>
              </div>
            )}
            <p className="text-[11px] text-slate-400 mt-2">Retour à l&apos;accueil dans quelques secondes…</p>
          </div>
        )}
          </div>
        </div>
      </div>

    </div>
  );
}

"use client";
// Manual time entry dialog. `targetAdmin` fills in for another employee.
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  AlertCircle, AlertTriangle, History, ChevronLeft, ChevronRight, ChevronDown,
  Calendar as CalendarIcon, Clock as ClockIcon, Minus, Plus, FileText,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FormSection } from "@/components/admin/form-section";
import { manualTimeEntryAction } from "@/app/actions/hr-timeclock";
import type { ManualEntry } from "../_types";
import { formatShiftDuration } from "../_types";

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseISO(s: string): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function defaultManualEntry(presetDate?: string | null): ManualEntry {
  const now = new Date();
  // Defaults to presetDate, otherwise today.
  const target = presetDate ? new Date(presetDate + "T12:00:00") : now;
  const isToday = sameDay(target, now);

  // Defaults must be VALID on open (no premature error): for today, clamp the
  // end time to "now" (floored to 5 min) when 17:00 is still in the future,
  // and pull the start back if needed.
  let startTime = "09:00";
  let endTime = "17:00";
  if (isToday) {
    const nowMin = now.getHours() * 60 + now.getMinutes();
    if (nowMin < 17 * 60) {
      const endMin = Math.max(5, Math.floor(nowMin / 5) * 5);
      endTime = `${pad(Math.floor(endMin / 60))}:${pad(endMin % 60)}`;
      const startMin = Math.max(0, Math.min(9 * 60, endMin - 60));
      startTime = `${pad(Math.floor(startMin / 60))}:${pad(startMin % 60)}`;
    }
  }
  return {
    date: toISO(target),
    startTime,
    endTime,
    category: "work",
    notes: "",
  };
}

export function ManualEntryDialog({
  open, onClose, onSaved, presetDate, targetAdmin,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  presetDate: string | null;
  /** When set, the entry is created for that admin instead of the caller. */
  targetAdmin?: { id: number; name: string } | null;
}) {
  const tc = useTranslations("common");
  const [entry, setEntry] = useState<ManualEntry>(() => defaultManualEntry(presetDate));
  const [pending, setPending] = useState(false);
  // Progressive disclosure: calendar collapsed by default (the day is almost
  // always today or yesterday), so the dialog fits without scrolling.
  const [calOpen, setCalOpen] = useState(false);

  useEffect(() => {
    if (open) {
      setEntry(defaultManualEntry(presetDate));
      setCalOpen(false);
    }
  }, [open, presetDate]);

  const ciDate = useMemo(() => {
    try { return new Date(`${entry.date}T${entry.startTime}:00`); } catch { return null; }
  }, [entry.date, entry.startTime]);
  const coDate = useMemo(() => {
    try { return new Date(`${entry.date}T${entry.endTime}:00`); } catch { return null; }
  }, [entry.date, entry.endTime]);

  const validation = useMemo(() => {
    if (!ciDate || isNaN(ciDate.getTime()) || !coDate || isNaN(coDate.getTime())) {
      return { ok: false, error: "Date ou heure invalide" };
    }
    const now = new Date();
    if (ciDate > now) return { ok: false, error: "La date est dans le futur" };
    if (coDate > now) return { ok: false, error: "L'heure de fin est dans le futur" };
    if (coDate <= ciDate) return { ok: false, error: "L'heure de fin doit être après le début" };
    if (coDate.getTime() - ciDate.getTime() > 16 * 60 * 60 * 1000) {
      return { ok: false, error: "Période > 16h — saisissez plusieurs entrées" };
    }
    return { ok: true as const };
  }, [ciDate, coDate]);

  const [overlap, setOverlap] = useState<{ overlap: boolean; with?: { clockIn: string } } | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!ciDate || !coDate || !validation.ok) { setOverlap(null); return; }
    timer.current = setTimeout(async () => {
      try {
        // Without the target, HR is checked against their own punches.
        const overlapUrl =
          `/api/admin/timeclock/check-overlap?from=${encodeURIComponent(ciDate.toISOString())}`
          + `&to=${encodeURIComponent(coDate.toISOString())}`
          + (targetAdmin ? `&adminId=${targetAdmin.id}` : "");
        const r = await fetch(overlapUrl);
        if (!r.ok) { setOverlap(null); return; }
        const d = await r.json();
        setOverlap(d);
      } catch { setOverlap(null); }
    }, 400);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [ciDate, coDate, validation.ok, targetAdmin]);

  const duration = useMemo(() => {
    if (!ciDate || !coDate || !validation.ok) return null;
    return formatShiftDuration(ciDate.toISOString(), coDate.toISOString());
  }, [ciDate, coDate, validation.ok]);

  const applyTimePreset = (start: string, end: string) => {
    setEntry((e) => ({ ...e, startTime: start, endTime: end }));
  };

  // Date shortcuts; red is reserved for actual field errors.
  const todayISO = toISO(new Date());
  const yesterdayISO = useMemo(() => {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return toISO(y);
  }, []);
  const startInvalid = !!(ciDate && !isNaN(ciDate.getTime()) && ciDate > new Date());
  const endInvalid = !!(
    ciDate && coDate && !isNaN(ciDate.getTime()) && !isNaN(coDate.getTime())
    && (coDate <= ciDate || coDate > new Date())
  );

  const submit = async () => {
    if (!validation.ok || !ciDate || !coDate) return;
    setPending(true);
    const r = await manualTimeEntryAction({
      clockIn: ciDate.toISOString(),
      clockOut: coDate.toISOString(),
      category: "work",
      notes: entry.notes || null,
      targetAdminId: targetAdmin?.id,
    });
    setPending(false);
    if (r.success) {
      toast.success(targetAdmin
        ? `Entrée ajoutée pour ${targetAdmin.name} — il devra soumettre sa semaine`
        : "Entrée ajoutée — pensez à cliquer « Soumettre la semaine » pour validation");
      onSaved();
      onClose();
    } else {
      toast.error(r.error || "Échec");
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl p-0 overflow-hidden max-h-[92vh] flex flex-col w-screen h-[100dvh] sm:w-[95vw] sm:max-w-xl sm:max-h-[92vh] sm:h-auto rounded-none sm:rounded-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <History className="h-4 w-4" />
              {targetAdmin ? `Saisir pour ${targetAdmin.name}` : "Saisie manuelle"}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {targetAdmin
                ? "Saisie effectuée pour l'employé — il devra encore soumettre sa semaine."
                : "L'entrée sera créée en brouillon. Soumettez la semaine entière pour validation."}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="px-4 sm:px-5 py-4 space-y-4 overflow-y-auto flex-1">
          <FormSection icon={CalendarIcon} title="1. Date">
            <div className="flex items-center gap-1.5 flex-wrap">
              <Button
                size="sm"
                variant={entry.date === todayISO ? "default" : "outline"}
                className={`h-7 text-xs ${entry.date === todayISO ? "bg-[#0F2D52] hover:bg-[#1a3a66] text-white" : ""}`}
                onClick={() => { setEntry((s) => ({ ...s, date: todayISO })); setCalOpen(false); }}
              >
                Aujourd&apos;hui
              </Button>
              <Button
                size="sm"
                variant={entry.date === yesterdayISO ? "default" : "outline"}
                className={`h-7 text-xs ${entry.date === yesterdayISO ? "bg-[#0F2D52] hover:bg-[#1a3a66] text-white" : ""}`}
                onClick={() => { setEntry((s) => ({ ...s, date: yesterdayISO })); setCalOpen(false); }}
              >
                Hier
              </Button>
              <Button
                size="sm"
                variant={entry.date !== todayISO && entry.date !== yesterdayISO ? "default" : "outline"}
                className={`h-7 text-xs ml-auto ${entry.date !== todayISO && entry.date !== yesterdayISO ? "bg-[#0F2D52] hover:bg-[#1a3a66] text-white" : ""}`}
                onClick={() => setCalOpen((v) => !v)}
                aria-expanded={calOpen}
              >
                <CalendarIcon className="h-3 w-3 mr-1.5" />
                <span className="tabular-nums">
                  {parseISO(entry.date).toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "long", year: "numeric" })}
                </span>
                <ChevronDown className={`h-3 w-3 ml-1.5 transition-transform ${calOpen ? "rotate-180" : ""}`} />
              </Button>
            </div>
            {calOpen && (
              <InlineCalendar
                value={entry.date}
                onChange={(v) => { setEntry((s) => ({ ...s, date: v })); setCalOpen(false); }}
                max={todayISO}
              />
            )}
          </FormSection>

          <FormSection
            icon={ClockIcon}
            title="2. Heures"
            action={duration ? (
              <span className="font-mono text-sm font-bold text-[#0F2D52] tabular-nums">{duration}</span>
            ) : undefined}
          >
            <div className="flex flex-wrap gap-1.5">
              {[
                { label: "9h–12h", start: "09:00", end: "12:00" },
                { label: "13h–17h", start: "13:00", end: "17:00" },
                { label: "9h–17h", start: "09:00", end: "17:00" },
                { label: "8h–16h", start: "08:00", end: "16:00" },
                { label: "8h–17h", start: "08:00", end: "17:00" },
              ].map((p) => {
                const active = entry.startTime === p.start && entry.endTime === p.end;
                return (
                  <Button
                    key={p.label}
                    size="sm"
                    variant={active ? "default" : "outline"}
                    className={`h-7 text-xs ${active ? "bg-[#0F2D52] hover:bg-[#1a3a66] text-white" : ""}`}
                    onClick={() => applyTimePreset(p.start, p.end)}
                  >
                    {p.label}
                  </Button>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <TimeStepper
                label="Début"
                value={entry.startTime}
                onChange={(v) => setEntry((s) => ({ ...s, startTime: v }))}
                accent="emerald"
                invalid={startInvalid}
              />
              <TimeStepper
                label="Fin"
                value={entry.endTime}
                onChange={(v) => setEntry((s) => ({ ...s, endTime: v }))}
                accent="navy"
                invalid={endInvalid}
              />
            </div>
          </FormSection>

          <FormSection icon={FileText} title="3. Notes (optionnel)">
            <Input
              value={entry.notes}
              onChange={(e) => setEntry((s) => ({ ...s, notes: e.target.value }))}
              placeholder="Détail de la tâche…"
            />
          </FormSection>

          {!validation.ok && (
            <div className="flex items-start gap-2 p-2 rounded bg-red-50 border border-red-200 text-xs text-red-900">
              <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>{validation.error}</span>
            </div>
          )}
          {validation.ok && overlap?.overlap && (
            <div className="flex items-start gap-2 p-2 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
              <span>
                Chevauche un pointage du{" "}
                {overlap.with
                  ? `${new Date(overlap.with.clockIn).toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })} à ${pad(new Date(overlap.with.clockIn).getHours())}:${pad(new Date(overlap.with.clockIn).getMinutes())}`
                  : ""}
              </span>
            </div>
          )}

          {duration && (
            <div className="flex items-center justify-center py-3 rounded-lg border-2 border-[#0F2D52] bg-gradient-to-br from-[#0F2D52]/5 to-[#0F2D52]/10">
              <div className="text-center">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52]">Durée totale</p>
                <p className="font-mono text-3xl font-bold text-[#0F2D52] tabular-nums">{duration}</p>
              </div>
            </div>
          )}

          <p className="text-[10px] text-muted-foreground italic text-center">
            Brouillon · Modifiable jusqu&apos;à soumission de la semaine
          </p>
        </div>
        <DialogFooter className="px-4 sm:px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button
            onClick={submit}
            disabled={pending || !validation.ok || !!overlap?.overlap}
            className="bg-[#0F2D52] hover:bg-[#15406d]"
          >
            {pending ? "Ajout en cours…" : "Ajouter"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Inline mini calendar with three modes: days, months, years.
const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTHS_FR_SHORT = [
  "Janv", "Févr", "Mars", "Avril", "Mai", "Juin",
  "Juil", "Août", "Sept", "Oct", "Nov", "Déc",
];
const DAYS_FR_SHORT = ["D", "L", "M", "M", "J", "V", "S"]; // dimanche-first (convention projet)

type InlineMode = "days" | "months" | "years";

function InlineCalendar({
  value, onChange, max,
}: {
  value: string;
  onChange: (v: string) => void;
  max?: string;
}) {
  const selectedDate = parseISO(value);
  const [viewDate, setViewDate] = useState<Date>(() => new Date(selectedDate));
  const [mode, setMode] = useState<InlineMode>("days");
  const today = new Date();
  const maxDate = max ? parseISO(max) : null;

  // Re-center when the value changes from outside (preset click).
  useEffect(() => {
    setViewDate(parseISO(value));
  }, [value]);

  const firstOfMonth = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
  const startWeekday = firstOfMonth.getDay(); // 0=dim
  const leadingBlanks = startWeekday; // Sunday-first: no blank when the month starts on a Sunday
  const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();

  const cells: Array<{ d: Date | null }> = [];
  for (let i = 0; i < leadingBlanks; i++) cells.push({ d: null });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ d: new Date(viewDate.getFullYear(), viewDate.getMonth(), i) });
  while (cells.length % 7 !== 0) cells.push({ d: null });

  // Year grid: 12 per decade.
  const yearGrid = useMemo(() => {
    const baseYear = Math.floor(viewDate.getFullYear() / 12) * 12;
    return Array.from({ length: 12 }, (_, i) => baseYear + i);
  }, [viewDate]);

  const isYearOver = (y: number) => maxDate ? y > maxDate.getFullYear() : false;
  const isMonthOver = (y: number, m: number) => {
    if (!maxDate) return false;
    return new Date(y, m, 1) > new Date(maxDate.getFullYear(), maxDate.getMonth(), 1);
  };

  return (
    <div className="rounded-md border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-2 py-1.5 border-b">
        <ActionTooltip label={mode === "days" ? "Mois précédent" : mode === "months" ? "Année précédente" : "Décennie précédente"} side="bottom">
          <Button
            size="sm" variant="ghost" className="h-7 w-7 p-0"
            onClick={() => {
              if (mode === "days") setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
              else if (mode === "months") setViewDate(new Date(viewDate.getFullYear() - 1, viewDate.getMonth(), 1));
              else setViewDate(new Date(viewDate.getFullYear() - 12, viewDate.getMonth(), 1));
            }}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </ActionTooltip>
        <ActionTooltip label="Cliquer pour changer de vue" side="bottom">
          <button
            type="button"
            onClick={() => {
              if (mode === "days") setMode("months");
              else if (mode === "months") setMode("years");
              else setMode("days");
            }}
            className="text-sm font-semibold text-[#0F2D52] tabular-nums hover:bg-[#0F2D52]/5 rounded px-2 py-1 transition"
          >
            {mode === "days" && `${MONTHS_FR[viewDate.getMonth()]} ${viewDate.getFullYear()}`}
            {mode === "months" && `${viewDate.getFullYear()}`}
            {mode === "years" && `${yearGrid[0]} – ${yearGrid[yearGrid.length - 1]}`}
          </button>
        </ActionTooltip>
        <ActionTooltip label={mode === "days" ? "Mois suivant" : mode === "months" ? "Année suivante" : "Décennie suivante"} side="bottom">
          <Button
            size="sm" variant="ghost" className="h-7 w-7 p-0"
            onClick={() => {
              if (mode === "days") setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
              else if (mode === "months") setViewDate(new Date(viewDate.getFullYear() + 1, viewDate.getMonth(), 1));
              else setViewDate(new Date(viewDate.getFullYear() + 12, viewDate.getMonth(), 1));
            }}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </ActionTooltip>
      </div>

      {mode === "days" && (
        <>
          <div className="grid grid-cols-7 px-2 pt-1.5 pb-0.5">
            {DAYS_FR_SHORT.map((d, i) => (
              <div key={i} className="text-center text-[9px] uppercase tracking-wider font-bold text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5 px-2 pb-2">
            {cells.map((c, i) => {
              if (!c.d) return <div key={i} className="h-7" />;
              const isSelected = sameDay(c.d, selectedDate);
              const isToday = sameDay(c.d, today);
              const isFuture = maxDate ? c.d > maxDate : false;
              const isWeekend = c.d.getDay() === 0 || c.d.getDay() === 6;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={isFuture}
                  onClick={() => onChange(toISO(c.d!))}
                  className={`h-7 rounded text-xs font-medium tabular-nums transition
                    ${isSelected ? "bg-[#0F2D52] text-white hover:bg-[#1a3a66]"
                      : isToday ? "bg-[#0F2D52]/10 text-[#0F2D52] ring-1 ring-[#0F2D52]/30 hover:bg-[#0F2D52]/15"
                      : isFuture ? "text-muted-foreground/40 cursor-not-allowed"
                      : isWeekend ? "text-muted-foreground hover:bg-muted"
                      : "text-foreground hover:bg-muted"
                    }`}
                >
                  {c.d.getDate()}
                </button>
              );
            })}
          </div>
        </>
      )}

      {mode === "months" && (
        <div className="p-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {MONTHS_FR_SHORT.map((m, i) => {
              const isCurrent = selectedDate.getFullYear() === viewDate.getFullYear() && selectedDate.getMonth() === i;
              const isThisMonth = today.getFullYear() === viewDate.getFullYear() && today.getMonth() === i;
              const monthDisabled = isMonthOver(viewDate.getFullYear(), i);
              return (
                <button
                  key={i}
                  type="button"
                  disabled={monthDisabled}
                  onClick={() => {
                    setViewDate(new Date(viewDate.getFullYear(), i, 1));
                    setMode("days");
                  }}
                  className={`h-10 rounded text-xs font-semibold transition
                    ${monthDisabled ? "text-muted-foreground/40 cursor-not-allowed"
                      : isCurrent ? "bg-[#0F2D52] text-white"
                      : isThisMonth ? "bg-[#0F2D52]/10 text-[#0F2D52] ring-1 ring-[#0F2D52]/30"
                      : "hover:bg-muted text-foreground"
                    }`}
                >
                  {m}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {mode === "years" && (
        <div className="p-2.5">
          <div className="grid grid-cols-3 gap-1.5">
            {yearGrid.map((y) => {
              const isCurrent = selectedDate.getFullYear() === y;
              const isThisYear = today.getFullYear() === y;
              const yearDisabled = isYearOver(y);
              return (
                <button
                  key={y}
                  type="button"
                  disabled={yearDisabled}
                  onClick={() => {
                    setViewDate(new Date(y, viewDate.getMonth(), 1));
                    setMode("months");
                  }}
                  className={`h-10 rounded text-xs font-semibold tabular-nums transition
                    ${yearDisabled ? "text-muted-foreground/40 cursor-not-allowed"
                      : isCurrent ? "bg-[#0F2D52] text-white"
                      : isThisYear ? "bg-[#0F2D52]/10 text-[#0F2D52] ring-1 ring-[#0F2D52]/30"
                      : "hover:bg-muted text-foreground"
                    }`}
                >
                  {y}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// Time stepper: large time display with +/- buttons.─────
function TimeStepper({
  label, value, onChange, accent, invalid = false,
}: {
  label: string;
  value: string; // "HH:MM"
  onChange: (v: string) => void;
  accent: "emerald" | "navy";
  /** Red is reserved for real errors (end <= start, future). */
  invalid?: boolean;
}) {
  const [h, m] = value.split(":").map(Number);
  const accentCls = invalid
    ? "text-red-700"
    : accent === "emerald" ? "text-emerald-700" : "text-[#0F2D52]";
  const borderCls = invalid
    ? "border-red-300"
    : accent === "emerald" ? "border-emerald-200" : "border-[#0F2D52]/25";

  const adjust = (deltaMin: number) => {
    let total = h * 60 + m + deltaMin;
    if (total < 0) total = 0;
    if (total >= 24 * 60) total = 24 * 60 - 1;
    const nh = Math.floor(total / 60);
    const nm = total % 60;
    onChange(`${pad(nh)}:${pad(nm)}`);
  };

  const setHour = (newH: number) => {
    if (newH < 0 || newH > 23) return;
    onChange(`${pad(newH)}:${pad(m)}`);
  };
  const setMinute = (newM: number) => {
    if (newM < 0 || newM > 59) return;
    onChange(`${pad(h)}:${pad(newM)}`);
  };

  return (
    <div className={`rounded-lg border-2 ${borderCls} p-2 bg-card`}>
      <div className="flex items-center justify-between mb-1">
        <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</Label>
        <div className="flex items-center gap-0.5">
          <ActionTooltip label="-15 minutes">
            <button type="button" onClick={() => adjust(-15)} className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center">
              <Minus className="h-3 w-3" />
            </button>
          </ActionTooltip>
          <span className="text-[9px] text-muted-foreground px-0.5">15m</span>
          <ActionTooltip label="+15 minutes">
            <button type="button" onClick={() => adjust(15)} className="h-5 w-5 rounded hover:bg-muted flex items-center justify-center">
              <Plus className="h-3 w-3" />
            </button>
          </ActionTooltip>
        </div>
      </div>
      <div className="flex items-center justify-center gap-1">
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => setHour(h + 1)} className="h-5 w-7 rounded hover:bg-muted flex items-center justify-center">
            <ChevronLeft className="h-3 w-3 rotate-90" />
          </button>
          <input
            type="number"
            min={0}
            max={23}
            value={pad(h)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) setHour(v);
            }}
            className={`w-12 text-center font-mono text-2xl font-bold tabular-nums ${accentCls} bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          />
          <button type="button" onClick={() => setHour(h - 1)} className="h-5 w-7 rounded hover:bg-muted flex items-center justify-center">
            <ChevronLeft className="h-3 w-3 -rotate-90" />
          </button>
        </div>
        <span className={`text-2xl font-bold ${accentCls}`}>:</span>
        <div className="flex flex-col items-center">
          <button type="button" onClick={() => setMinute(Math.min(59, m + 5))} className="h-5 w-7 rounded hover:bg-muted flex items-center justify-center">
            <ChevronLeft className="h-3 w-3 rotate-90" />
          </button>
          <input
            type="number"
            min={0}
            max={59}
            step={5}
            value={pad(m)}
            onChange={(e) => {
              const v = parseInt(e.target.value, 10);
              if (!isNaN(v)) setMinute(v);
            }}
            className={`w-12 text-center font-mono text-2xl font-bold tabular-nums ${accentCls} bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30 rounded [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          />
          <button type="button" onClick={() => setMinute(Math.max(0, m - 5))} className="h-5 w-7 rounded hover:bg-muted flex items-center justify-center">
            <ChevronLeft className="h-3 w-3 -rotate-90" />
          </button>
        </div>
      </div>
    </div>
  );
}

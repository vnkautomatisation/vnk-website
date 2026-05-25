"use client";
// Mini calendrier custom (pas de dependance externe) avec theme VNK.
// 3 modes de navigation : jours (defaut) → mois (clic titre) → années (clic année).
// Pattern Material UI / shadcn Calendar : navigation rapide sans cliquer 100 fois sur les chevrons.
//
// Format de valeur : "YYYY-MM-DD".
// Props min/max : bornes inclusives (meme format YYYY-MM-DD).
import { useMemo, useState, useEffect } from "react";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function pad(n: number) { return n.toString().padStart(2, "0"); }

function parseISO(s: string): Date {
  if (!s || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return new Date();
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

const MONTHS_FR = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];
const MONTHS_FR_SHORT = [
  "Janv", "Févr", "Mars", "Avril", "Mai", "Juin",
  "Juil", "Août", "Sept", "Oct", "Nov", "Déc",
];
const DAYS_FR_SHORT = ["L", "M", "M", "J", "V", "S", "D"]; // lundi-first

type ViewMode = "days" | "months" | "years";

export function DatePopover({
  value, onChange, min, max, disabled = false, placeholder = "Choisir",
  className = "",
}: {
  value: string;            // "YYYY-MM-DD" ou ""
  onChange: (v: string) => void;
  min?: string;             // "YYYY-MM-DD"
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const selected = value ? parseISO(value) : null;
  const minDate = min ? parseISO(min) : null;
  const maxDate = max ? parseISO(max) : null;

  const [visibleMonth, setVisibleMonth] = useState<Date>(() => selected ?? new Date());
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<ViewMode>("days");

  // Reset au mode jours quand on rouvre
  useEffect(() => {
    if (open) setMode("days");
  }, [open]);

  // Re-center quand value change de l'extérieur
  useEffect(() => {
    if (value) setVisibleMonth(parseISO(value));
  }, [value]);

  // Construit la grille 6 semaines (lundi-first)
  const grid = useMemo(() => {
    const first = startOfMonth(visibleMonth);
    const firstDayIdx = (first.getDay() + 6) % 7; // 0 = lundi
    const start = new Date(first);
    start.setDate(start.getDate() - firstDayIdx);
    const days: Date[] = [];
    for (let i = 0; i < 42; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      days.push(d);
    }
    return days;
  }, [visibleMonth]);

  const isDayDisabled = (d: Date) => {
    if (minDate && d < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && d > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const isMonthDisabled = (year: number, month: number) => {
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0);
    if (minDate && monthEnd < new Date(minDate.getFullYear(), minDate.getMonth(), minDate.getDate())) return true;
    if (maxDate && monthStart > new Date(maxDate.getFullYear(), maxDate.getMonth(), maxDate.getDate())) return true;
    return false;
  };

  const isYearDisabled = (year: number) => {
    if (minDate && year < minDate.getFullYear()) return true;
    if (maxDate && year > maxDate.getFullYear()) return true;
    return false;
  };

  const today = new Date();

  // Label trigger compact : "30 avr 2026" au lieu de "jeu. 30 avril 2026"
  const label = selected
    ? `${selected.getDate()} ${MONTHS_FR_SHORT[selected.getMonth()]} ${selected.getFullYear()}`
    : placeholder;

  const goPrev = () => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1));
  const goNext = () => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1));
  const goPrevYear = () => setVisibleMonth((m) => new Date(m.getFullYear() - 1, m.getMonth(), 1));
  const goNextYear = () => setVisibleMonth((m) => new Date(m.getFullYear() + 1, m.getMonth(), 1));
  const goPrevDecade = () => setVisibleMonth((m) => new Date(m.getFullYear() - 12, m.getMonth(), 1));
  const goNextDecade = () => setVisibleMonth((m) => new Date(m.getFullYear() + 12, m.getMonth(), 1));
  const goToday = () => {
    setVisibleMonth(new Date());
    onChange(toISO(new Date()));
    setOpen(false);
  };

  // Grille années : 12 années visibles centrées sur la décade courante
  const yearGrid = useMemo(() => {
    const baseYear = Math.floor(visibleMonth.getFullYear() / 12) * 12;
    return Array.from({ length: 12 }, (_, i) => baseYear + i);
  }, [visibleMonth]);

  const decadeLabel = (() => {
    const start = yearGrid[0];
    const end = yearGrid[yearGrid.length - 1];
    return `${start} – ${end}`;
  })();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={`inline-flex items-center gap-1.5 h-9 px-2.5 rounded-md border border-input bg-background text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-50 disabled:cursor-not-allowed truncate ${className}`}
      >
        <CalendarIcon className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
        <span className="tabular-nums truncate">{label}</span>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0 overflow-hidden" align="start">
        {/* Header navy VNK — chevrons adaptés au mode */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-2 py-2 flex items-center justify-between gap-1">
          <button
            type="button"
            onClick={mode === "days" ? goPrev : mode === "months" ? goPrevYear : goPrevDecade}
            className="h-7 w-7 rounded-md hover:bg-white/15 flex items-center justify-center transition"
            aria-label={mode === "days" ? "Mois précédent" : mode === "months" ? "Année précédente" : "Décennie précédente"}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          {/* Titre cliquable : ouvre mode supérieur */}
          <button
            type="button"
            onClick={() => {
              if (mode === "days") setMode("months");
              else if (mode === "months") setMode("years");
              else setMode("days"); // reset
            }}
            className="flex-1 text-sm font-semibold tabular-nums hover:bg-white/10 rounded-md px-2 py-1 transition"
            aria-label="Changer de vue (jours / mois / années)"
          >
            {mode === "days" && `${MONTHS_FR[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`}
            {mode === "months" && `${visibleMonth.getFullYear()}`}
            {mode === "years" && decadeLabel}
          </button>
          <button
            type="button"
            onClick={mode === "days" ? goNext : mode === "months" ? goNextYear : goNextDecade}
            className="h-7 w-7 rounded-md hover:bg-white/15 flex items-center justify-center transition"
            aria-label={mode === "days" ? "Mois suivant" : mode === "months" ? "Année suivante" : "Décennie suivante"}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        {/* Mode JOURS (défaut) */}
        {mode === "days" && (
          <div className="p-2">
            <div className="grid grid-cols-7 gap-0.5 mb-1">
              {DAYS_FR_SHORT.map((d, i) => (
                <div key={i} className="text-[10px] uppercase tracking-wider text-muted-foreground text-center font-semibold py-1">
                  {d}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-0.5">
              {grid.map((d, i) => {
                const inMonth = d.getMonth() === visibleMonth.getMonth();
                const isSelected = selected && sameDay(d, selected);
                const isToday = sameDay(d, today);
                const dayDisabled = isDayDisabled(d);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (dayDisabled) return;
                      onChange(toISO(d));
                      setOpen(false);
                    }}
                    disabled={dayDisabled}
                    className={[
                      "h-8 w-8 rounded-md text-xs font-medium tabular-nums transition",
                      dayDisabled
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : isSelected
                          ? "bg-[#0F2D52] text-white shadow-sm"
                          : isToday
                            ? "bg-[#0F2D52]/10 text-[#0F2D52] font-bold ring-1 ring-[#0F2D52]/30"
                            : inMonth
                              ? "hover:bg-muted text-foreground"
                              : "text-muted-foreground/60 hover:bg-muted/50",
                    ].join(" ")}
                  >
                    {d.getDate()}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode MOIS : grille 3×4 des 12 mois */}
        {mode === "months" && (
          <div className="p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {MONTHS_FR_SHORT.map((m, i) => {
                const isCurrent = selected && selected.getFullYear() === visibleMonth.getFullYear() && selected.getMonth() === i;
                const isThisMonth = today.getFullYear() === visibleMonth.getFullYear() && today.getMonth() === i;
                const monthDisabled = isMonthDisabled(visibleMonth.getFullYear(), i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => {
                      if (monthDisabled) return;
                      setVisibleMonth(new Date(visibleMonth.getFullYear(), i, 1));
                      setMode("days");
                    }}
                    disabled={monthDisabled}
                    className={[
                      "h-12 rounded-md text-xs font-semibold transition",
                      monthDisabled
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : isCurrent
                          ? "bg-[#0F2D52] text-white shadow-sm"
                          : isThisMonth
                            ? "bg-[#0F2D52]/10 text-[#0F2D52] ring-1 ring-[#0F2D52]/30"
                            : "hover:bg-muted text-foreground",
                    ].join(" ")}
                  >
                    {m}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Mode ANNÉES : grille 3×4 des 12 années */}
        {mode === "years" && (
          <div className="p-3">
            <div className="grid grid-cols-3 gap-1.5">
              {yearGrid.map((y) => {
                const isCurrent = selected && selected.getFullYear() === y;
                const isThisYear = today.getFullYear() === y;
                const yearDisabled = isYearDisabled(y);
                return (
                  <button
                    key={y}
                    type="button"
                    onClick={() => {
                      if (yearDisabled) return;
                      setVisibleMonth(new Date(y, visibleMonth.getMonth(), 1));
                      setMode("months");
                    }}
                    disabled={yearDisabled}
                    className={[
                      "h-12 rounded-md text-xs font-semibold tabular-nums transition",
                      yearDisabled
                        ? "text-muted-foreground/40 cursor-not-allowed"
                        : isCurrent
                          ? "bg-[#0F2D52] text-white shadow-sm"
                          : isThisYear
                            ? "bg-[#0F2D52]/10 text-[#0F2D52] ring-1 ring-[#0F2D52]/30"
                            : "hover:bg-muted text-foreground",
                    ].join(" ")}
                  >
                    {y}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-2 py-1.5 border-t bg-muted/20">
          <button
            type="button"
            onClick={() => { onChange(""); setOpen(false); }}
            className="text-[11px] uppercase tracking-wider text-muted-foreground hover:text-foreground px-2 py-1"
          >
            Effacer
          </button>
          <button
            type="button"
            onClick={goToday}
            className="text-[11px] uppercase tracking-wider font-semibold text-[#0F2D52] hover:underline px-2 py-1"
          >
            Aujourd&apos;hui
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

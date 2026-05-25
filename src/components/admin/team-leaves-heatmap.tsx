"use client";
// Heatmap permanente Mon espace : montre les absences des collègues sur 4 semaines.
// Inclut approved + pending (différenciés visuellement : couleur pleine vs hachurée).
// Réutilise endpoint /api/admin/leaves/calendar?from=...&to=...
// Toggle "Approuvé seul / Approuvé + En attente".
//
// Style cohérent avec ColleaguesMonthTable de vacation-window-banner.tsx.

import { useEffect, useMemo, useState } from "react";
import { CalendarRange, Loader2, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ActionTooltip } from "@/components/ui/action-tooltip";

type CalendarAbsence = {
  id: number;
  adminId: number;
  fullName: string;
  type: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  halfDay: "AM" | "PM" | null;
  status: string; // approved | pending
  isMine: boolean;
};

type HolidayInfo = {
  date: string; // YYYY-MM-DD
  name: string;
  isPaid: boolean;
  type?: string;
};

// Couleurs par type — cohérent avec vacation-window-banner.tsx
const ABS_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  vacation: { bg: "bg-cyan-200", text: "text-cyan-900", border: "border-cyan-400" },
  sick: { bg: "bg-red-200", text: "text-red-900", border: "border-red-400" },
  parental: { bg: "bg-pink-200", text: "text-pink-900", border: "border-pink-400" },
  unpaid: { bg: "bg-slate-200", text: "text-slate-900", border: "border-slate-400" },
  bereavement: { bg: "bg-gray-200", text: "text-gray-900", border: "border-gray-400" },
  other: { bg: "bg-amber-200", text: "text-amber-900", border: "border-amber-400" },
};
const ABS_TYPE_LABELS: Record<string, string> = {
  vacation: "Vacances",
  sick: "Maladie",
  parental: "Parental",
  unpaid: "Sans solde",
  bereavement: "Décès",
  other: "Autre congé",
};

function isoLocal(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function TeamLeavesHeatmap({ teamScopeCount }: { teamScopeCount?: number }) {
  const [absences, setAbsences] = useState<CalendarAbsence[]>([]);
  const [holidays, setHolidays] = useState<HolidayInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPending, setShowPending] = useState(true);

  // Plage : aujourd'hui → +28j
  const range = useMemo(() => {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 28);
    return { start, end };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/leaves/calendar?from=${isoLocal(range.start)}&to=${isoLocal(range.end)}`)
      .then((r) => (r.ok ? r.json() : { absences: [], holidays: [] }))
      .catch(() => ({ absences: [], holidays: [] }))
      .then((data) => {
        if (cancelled) return;
        setAbsences((data?.absences ?? []) as CalendarAbsence[]);
        setHolidays((data?.holidays ?? []) as HolidayInfo[]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [range.start, range.end]);

  const days = useMemo(() => {
    const out: { date: Date; iso: string }[] = [];
    const cur = new Date(range.start);
    while (cur <= range.end) {
      out.push({ date: new Date(cur), iso: isoLocal(cur) });
      cur.setDate(cur.getDate() + 1);
    }
    return out;
  }, [range.start, range.end]);

  const holidayByDate = useMemo(() => {
    const m = new Map<string, HolidayInfo>();
    for (const h of holidays) m.set(h.date, h);
    return m;
  }, [holidays]);

  // Filtre selon toggle
  const visibleAbsences = useMemo(() => {
    return absences.filter((a) => {
      if (a.status === "approved") return true;
      if (a.status === "pending" && (showPending || a.isMine)) return true;
      return false;
    });
  }, [absences, showPending]);

  // Index absences par date
  const absByDate = useMemo(() => {
    const map = new Map<string, CalendarAbsence[]>();
    for (const a of visibleAbsences) {
      const s = new Date(a.startDate.slice(0, 10) + "T00:00:00");
      const e = new Date(a.endDate.slice(0, 10) + "T00:00:00");
      const cur = new Date(s);
      while (cur <= e) {
        const key = isoLocal(cur);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [visibleAbsences]);

  // Employés présents
  const employees = useMemo(() => {
    const map = new Map<number, { id: number; fullName: string; isMine: boolean }>();
    for (const a of visibleAbsences) {
      if (!map.has(a.adminId)) {
        map.set(a.adminId, { id: a.adminId, fullName: a.fullName, isMine: a.isMine });
      }
    }
    return Array.from(map.values()).sort((x, y) => {
      if (x.isMine && !y.isMine) return -1;
      if (!x.isMine && y.isMine) return 1;
      return x.fullName.localeCompare(y.fullName, "fr");
    });
  }, [visibleAbsences]);

  const todayISO = isoLocal(range.start);
  const dayColWidth = 26;
  const minWidth = 160 + days.length * dayColWidth;

  return (
    <Card className="p-3 sm:p-4 space-y-3">
      <div className="flex items-start justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center">
            <CalendarRange className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#0F2D52]">Absences à venir — 4 semaines</p>
            <p className="text-[11px] text-muted-foreground">
              {typeof teamScopeCount === "number"
                ? `${teamScopeCount} collègue${teamScopeCount > 1 ? "s" : ""} dans votre périmètre`
                : "Vos collègues directs"}
            </p>
          </div>
        </div>
        <ActionTooltip
          label={
            showPending
              ? "Masquer les demandes en attente d'approbation"
              : "Inclure les demandes en attente d'approbation"
          }
        >
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPending((v) => !v)}
            className="h-8 text-xs"
          >
            {showPending ? "Approuvé + En attente" : "Approuvé seulement"}
          </Button>
        </ActionTooltip>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground flex-wrap">
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-cyan-200 border border-cyan-400" />
          Approuvé
        </span>
        <span className="inline-flex items-center gap-1">
          <span
            className="inline-block w-3 h-3 rounded-sm border border-amber-400"
            style={{
              backgroundImage:
                "repeating-linear-gradient(45deg, rgb(254 215 170) 0 3px, transparent 3px 6px)",
            }}
          />
          En attente
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-purple-100 border border-purple-300" />
          Férié
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" />
          Weekend
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="inline-block w-3 h-3 rounded-sm ring-2 ring-[#0F2D52] bg-white" />
          Aujourd&apos;hui
        </span>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Chargement...
        </div>
      ) : employees.length === 0 ? (
        <div className="rounded-md border bg-muted/10 p-6 text-center">
          <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
          <p className="text-sm font-medium">Aucune absence chez vos collègues sur 4 semaines</p>
          <p className="text-xs text-muted-foreground mt-1">
            Tout le monde est présent — bonne période pour planifier des projets en équipe.
          </p>
        </div>
      ) : (
        <div className="rounded-md border overflow-hidden bg-background">
          <div className="overflow-x-auto">
            <div
              className="grid"
              style={{
                gridTemplateColumns: `160px repeat(${days.length}, minmax(${dayColWidth}px, 1fr))`,
                minWidth,
              }}
            >
              {/* En-tête */}
              <div className="sticky left-0 z-20 bg-muted/40 border-r border-b px-2 py-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
                Employé
              </div>
              {days.map(({ date, iso }, i) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const isToday = iso === todayISO;
                const holiday = holidayByDate.get(iso);
                const dayLetter = ["D", "L", "M", "M", "J", "V", "S"][date.getDay()];
                let headerBg = "bg-muted/30";
                if (holiday) headerBg = "bg-purple-100 text-purple-900";
                else if (isWeekend) headerBg = "bg-slate-100 text-slate-500";
                const tooltipLabel = `${date.toLocaleDateString("fr-CA", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}${holiday ? ` — Férié : ${holiday.name}` : ""}`;
                return (
                  <ActionTooltip key={i} label={tooltipLabel}>
                    <div
                      className={`border-r border-b px-0.5 py-1 text-center text-[9px] font-semibold ${headerBg} ${
                        isToday ? "ring-1 ring-[#0F2D52] ring-inset" : ""
                      }`}
                    >
                      <div className="tabular-nums">{date.getDate()}</div>
                      <div className="text-[8px] uppercase tracking-wider opacity-70">{dayLetter}</div>
                    </div>
                  </ActionTooltip>
                );
              })}

              {/* Lignes employés */}
              {employees.map((emp) => (
                <EmployeeHeatmapRow
                  key={emp.id}
                  emp={emp}
                  days={days}
                  todayISO={todayISO}
                  holidayByDate={holidayByDate}
                  absByDate={absByDate}
                />
              ))}
            </div>
          </div>
          <div className="px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/10 border-t">
            Survolez une cellule pour voir le détail.
          </div>
        </div>
      )}
    </Card>
  );
}

function EmployeeHeatmapRow({
  emp,
  days,
  todayISO,
  holidayByDate,
  absByDate,
}: {
  emp: { id: number; fullName: string; isMine: boolean };
  days: { date: Date; iso: string }[];
  todayISO: string;
  holidayByDate: Map<string, HolidayInfo>;
  absByDate: Map<string, CalendarAbsence[]>;
}) {
  return (
    <>
      <ActionTooltip label={emp.fullName} side="right">
        <div
          className={`sticky left-0 z-10 border-r border-b px-2 py-1.5 text-[11px] truncate flex items-center gap-1.5 ${
            emp.isMine ? "bg-[#0F2D52]/5 font-bold text-[#0F2D52]" : "bg-background"
          }`}
        >
          {emp.isMine && (
            <span className="text-[8px] uppercase tracking-wider font-bold text-[#0F2D52] bg-[#0F2D52]/10 px-1 rounded shrink-0">
              Moi
            </span>
          )}
          <span className="truncate">{emp.fullName}</span>
        </div>
      </ActionTooltip>
      {days.map(({ date, iso }, i) => {
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isToday = iso === todayISO;
        const holiday = holidayByDate.get(iso);
        const abs = (absByDate.get(iso) ?? []).find((a) => a.adminId === emp.id);

        let bg = "";
        let border = "";
        let label = "";
        let isPending = false;
        if (holiday) bg = "bg-purple-50";
        else if (isWeekend) bg = "bg-slate-50";

        let style: React.CSSProperties | undefined;
        if (abs) {
          const c = ABS_TYPE_COLORS[abs.type] ?? ABS_TYPE_COLORS.other;
          label = ABS_TYPE_LABELS[abs.type] ?? abs.type;
          border = c.border;
          isPending = abs.status === "pending";
          if (isPending) {
            // Pattern hachuré pour "en attente"
            bg = "";
            style = {
              backgroundImage: `repeating-linear-gradient(45deg, var(--vnk-pending-a, rgba(245, 158, 11, 0.35)) 0 4px, transparent 4px 8px)`,
              backgroundColor: "rgb(255 251 235)",
            };
          } else {
            bg = c.bg;
          }
        }

        const tooltip = abs
          ? `${emp.fullName} — ${label}${abs.halfDay ? ` (½ ${abs.halfDay})` : ""}${
              isPending ? " (en attente)" : ""
            } · ${date.toLocaleDateString("fr-CA", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}`
          : holiday
            ? `${date.toLocaleDateString("fr-CA", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })} — Férié : ${holiday.name}`
            : date.toLocaleDateString("fr-CA", {
                weekday: "long",
                day: "numeric",
                month: "long",
              });

        // Contraste : aujourd'hui + congé → ring amber visible sur fond cyan/red/etc.
        const todayRing = isToday
          ? abs
            ? "ring-2 ring-amber-400 ring-inset"
            : "ring-1 ring-[#0F2D52] ring-inset"
          : "";

        return (
          <ActionTooltip key={i} label={tooltip}>
            <div
              className={`border-r border-b min-h-[28px] ${bg} ${
                border ? `border-l-2 ${border}` : ""
              } ${todayRing}`}
              style={style}
            />
          </ActionTooltip>
        );
      })}
    </>
  );
}

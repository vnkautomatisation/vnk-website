"use client";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Sun, Bandage, Baby, Home as HomeIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionTooltip } from "@/components/ui/action-tooltip";

type Leave = {
  id: number; type: string; startDate: string; endDate: string; daysCount: number;
  admin: { id: number; fullName: string | null; email: string; avatarUrl: string | null };
};
type Holiday = { id: number; date: string; name: string; isPaid: boolean };

const MONTHS_FR = ["Janvier", "Février", "Mars", "Avril", "Mai", "Juin", "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre"];
const DAYS_FR = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"]; // dimanche-first (convention projet)

const TYPE_META: Record<string, { label: string; color: string; icon: typeof Sun }> = {
  vacation: { label: "Vacances", color: "bg-cyan-500", icon: Sun },
  sick: { label: "Maladie", color: "bg-red-500", icon: Bandage },
  parental: { label: "Parental", color: "bg-violet-500", icon: Baby },
  unpaid: { label: "Sans solde", color: "bg-slate-500", icon: HomeIcon },
  bereavement: { label: "Décès", color: "bg-gray-500", icon: HomeIcon },
  other: { label: "Autre", color: "bg-amber-500", icon: CalendarDays },
};

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function inRange(date: Date, start: string, end: string): boolean {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const s = new Date(new Date(start).getFullYear(), new Date(start).getMonth(), new Date(start).getDate()).getTime();
  const e = new Date(new Date(end).getFullYear(), new Date(end).getMonth(), new Date(end).getDate()).getTime();
  return d >= s && d <= e;
}

export function CalendarMonthView({
  year, month, gridStart, gridEnd, leaves, holidays,
}: {
  year: number; month: number;
  gridStart: string; gridEnd: string;
  leaves: Leave[]; holidays: Holiday[];
}) {
  // Construire la grille de jours
  const days: Date[] = [];
  const start = new Date(gridStart);
  const end = new Date(gridEnd);
  const cursor = new Date(start);
  while (cursor <= end) {
    days.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  // Nav précédent/suivant
  const prev = new Date(year, month - 1, 1);
  const next = new Date(year, month + 1, 1);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#0F2D52]" />Calendrier RH
          </h1>
          <p className="text-sm text-muted-foreground">{MONTHS_FR[month]} {year} · congés approuvés + jours fériés.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" aria-label="Mois précédent" asChild>
            <Link href={`/admin/employes/calendrier?year=${prev.getFullYear()}&month=${prev.getMonth()}`}>
              <ChevronLeft className="h-4 w-4" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" asChild>
            <Link href={`/admin/employes/calendrier?year=${today.getFullYear()}&month=${today.getMonth()}`}>
              Aujourd&apos;hui
            </Link>
          </Button>
          <Button variant="outline" size="icon" aria-label="Mois suivant" asChild>
            <Link href={`/admin/employes/calendrier?year=${next.getFullYear()}&month=${next.getMonth()}`}>
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        </div>
      </div>

      {/* Légende */}
      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_META).map(([k, m]) => (
          <span key={k} className="inline-flex items-center gap-1.5 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${m.color}`} />
            {m.label}
          </span>
        ))}
        <span className="inline-flex items-center gap-1.5 text-xs">
          <span className="h-2.5 w-2.5 rounded-full bg-amber-300" />
          Férié
        </span>
      </div>

      {/* Grille calendrier */}
      <Card className="overflow-hidden">
        <div className="grid grid-cols-7 border-b bg-muted/30">
          {DAYS_FR.map((d) => (
            <div key={d} className="px-2 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground text-center">
              {d}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d, idx) => {
            const isCurrentMonth = d.getMonth() === month;
            const isToday = isSameDay(d, today);
            const dayHolidays = holidays.filter((h) => isSameDay(new Date(h.date), d));
            const dayLeaves = leaves.filter((l) => inRange(d, l.startDate, l.endDate));
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            return (
              <div
                key={idx}
                className={`min-h-[88px] sm:min-h-[110px] p-1.5 border-r border-b last:border-r-0 ${idx >= days.length - 7 ? "border-b-0" : ""} ${isCurrentMonth ? "" : "bg-muted/20"} ${isWeekend && isCurrentMonth ? "bg-slate-50/50" : ""}`}
              >
                <div className="flex items-start justify-between">
                  <span className={`text-xs font-medium ${isCurrentMonth ? "text-foreground" : "text-muted-foreground/60"} ${isToday ? "bg-[#0F2D52] text-white rounded-full h-5 w-5 inline-flex items-center justify-center" : ""}`}>
                    {d.getDate()}
                  </span>
                  {dayHolidays.length > 0 && <span className="h-1.5 w-1.5 rounded-full bg-amber-400" aria-label="Jour férié" />}
                </div>
                {dayHolidays.map((h) => (
                  <ActionTooltip key={h.id} label={h.name}>
                    <div className="mt-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-100 text-amber-900 truncate cursor-default">
                      {h.name}
                    </div>
                  </ActionTooltip>
                ))}
                {dayLeaves.slice(0, 3).map((l) => {
                  const meta = TYPE_META[l.type] ?? TYPE_META.other;
                  return (
                    <ActionTooltip key={l.id} label={`${l.admin.fullName || l.admin.email} · ${meta.label}`}>
                      <div
                        className={`mt-1 px-1.5 py-0.5 rounded text-[9px] text-white truncate cursor-default ${meta.color}`}
                      >
                        {(l.admin.fullName || l.admin.email).split(" ")[0]}
                      </div>
                    </ActionTooltip>
                  );
                })}
                {dayLeaves.length > 3 && (
                  <div className="mt-0.5 text-[9px] text-muted-foreground">+{dayLeaves.length - 3} autre{dayLeaves.length > 4 ? "s" : ""}</div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      {/* Liste détaillée du mois */}
      <section>
        <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider text-muted-foreground">
          Détails du mois ({leaves.length} congé{leaves.length !== 1 ? "s" : ""})
        </h2>
        {leaves.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">Aucun congé approuvé sur ce mois.</Card>
        ) : (
          <Card>
            <div className="divide-y">
              {leaves.map((l) => {
                const meta = TYPE_META[l.type] ?? TYPE_META.other;
                const Icon = meta.icon;
                return (
                  <div key={l.id} className="p-3 flex items-center gap-3 text-sm">
                    <div
                      className="h-8 w-8 rounded-full bg-gradient-to-br from-[#0F2D52] to-[#15406d] flex items-center justify-center text-white text-[11px] font-bold shrink-0"
                      style={l.admin.avatarUrl ? { backgroundImage: `url(${l.admin.avatarUrl})`, backgroundSize: "cover" } : undefined}
                    >
                      {!l.admin.avatarUrl && (l.admin.fullName || l.admin.email).split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{l.admin.fullName || l.admin.email}</p>
                      <p className="text-xs text-muted-foreground inline-flex items-center gap-1">
                        <Icon className="h-3 w-3" />{meta.label}
                        <span>·</span>
                        <span>{new Date(l.startDate).toLocaleDateString("fr-CA")} → {new Date(l.endDate).toLocaleDateString("fr-CA")}</span>
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">{Number(l.daysCount)} j</Badge>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}

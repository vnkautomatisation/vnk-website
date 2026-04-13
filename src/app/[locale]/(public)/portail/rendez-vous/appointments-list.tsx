"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  Calendar,
  CalendarCheck,
  Video,
  Phone,
  MapPin,
  XCircle,
  ExternalLink,
  Clock,
  Link2,
  FileText,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn, formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";

type Appointment = {
  id: number;
  subject: string | null;
  appointmentDate: string;
  startTime: string;
  endTime: string;
  meetingType: string;
  meetingLink: string | null;
  meetingId: string | null;
  meetingPassword: string | null;
  status: string;
  isUpcoming: boolean;
  notesClient: string | null;
  notesAdmin: string | null;
  durationMin: number | null;
};

const TYPE_ICON = { video: Video, phone: Phone, onsite: MapPin } as Record<string, typeof Video>;
const TYPE_LABEL: Record<string, string> = { video: "Video", phone: "Telephone", onsite: "Sur place" };
const DAY_NAMES = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

// ── Helpers dates ──
function toDateKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function todayKey(): string {
  return new Date().toLocaleDateString("sv-SE");
}

function getMonthWeeks(year: number, month: number): Date[][] {
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  const startOffset = first.getDay(); // dimanche = 0
  const start = new Date(year, month, 1 - startOffset);
  const weeks: Date[][] = [];
  const cur = new Date(start);
  while (cur <= last || weeks.length < 5) {
    const week: Date[] = [];
    for (let i = 0; i < 7; i++) {
      week.push(new Date(cur));
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(week);
    if (cur > last && cur.getDay() === 1) break;
  }
  return weeks;
}

function formatMonthYear(d: Date): string {
  return new Intl.DateTimeFormat("fr-CA", { month: "long", year: "numeric" }).format(d);
}

function formatDayFull(key: string): string {
  const d = new Date(key + "T12:00:00");
  return new Intl.DateTimeFormat("fr-CA", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(d);
}

function dotColor(status: string): string {
  if (status === "confirmed" || status === "pending") return "bg-emerald-500";
  if (status === "completed") return "bg-gray-400";
  if (status === "cancelled" || status === "no_show") return "bg-red-400";
  return "bg-[#0F2D52]";
}

function timelineColor(status: string): string {
  if (status === "confirmed") return "bg-emerald-500";
  if (status === "pending") return "bg-amber-400";
  if (status === "completed") return "bg-gray-300";
  if (status === "cancelled" || status === "no_show") return "bg-red-300";
  return "bg-[#0F2D52]";
}

// ── Composant principal ──
export function AppointmentsList({ appointments }: { appointments: Appointment[] }) {
  const router = useRouter();
  const [currentMonth, setCurrentMonth] = useState(() => {
    // Centrer le mois sur le prochain RDV a venir
    const upcoming = appointments
      .filter((a) => a.isUpcoming && a.status !== "cancelled")
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());
    if (upcoming.length > 0) {
      const d = new Date(upcoming[0].appointmentDate);
      return new Date(d.getFullYear(), d.getMonth(), 1);
    }
    return new Date();
  });
  const [selectedDate, setSelectedDate] = useState<string | null>(() => {
    const today = todayKey();
    const byDateInit = new Map<string, boolean>();
    for (const a of appointments) byDateInit.set(toDateKey(a.appointmentDate), true);
    if (byDateInit.has(today)) return today;
    const upcoming = appointments
      .filter((a) => a.isUpcoming && a.status !== "cancelled")
      .sort((a, b) => new Date(a.appointmentDate).getTime() - new Date(b.appointmentDate).getTime());
    if (upcoming.length > 0) return toDateKey(upcoming[0].appointmentDate);
    return today;
  });
  const [detail, setDetail] = useState<Appointment | null>(null);
  const [cancelId, setCancelId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  // Grouper par date
  const byDate = useMemo(() => {
    const map = new Map<string, Appointment[]>();
    for (const a of appointments) {
      const key = toDateKey(a.appointmentDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    }
    for (const [, list] of map) list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    return map;
  }, [appointments]);

  // KPIs
  const kpis = useMemo(() => ({
    total: appointments.length,
    upcoming: appointments.filter((a) => a.isUpcoming && a.status !== "cancelled").length,
    past: appointments.filter((a) => !a.isUpcoming).length,
    withLink: appointments.filter((a) => !!a.meetingLink).length,
  }), [appointments]);

  // Semaines du mois
  const weeks = useMemo(
    () => getMonthWeeks(currentMonth.getFullYear(), currentMonth.getMonth()),
    [currentMonth]
  );

  // useEffect removed — auto-select done in useState initializer

  const prevMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1));
  const nextMonth = () => setCurrentMonth((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1));
  const goToday = () => {
    const now = new Date();
    setCurrentMonth(new Date(now.getFullYear(), now.getMonth(), 1));
    setSelectedDate(todayKey());
  };

  const selectedAppts = selectedDate ? byDate.get(selectedDate) ?? [] : [];
  const today = todayKey();

  async function handleCancel() {
    if (!cancelId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/appointments/${cancelId}/cancel`, { method: "POST" });
      if (res.ok) { setCancelId(null); router.refresh(); }
    } finally { setLoading(false); }
  }

  return (
    <div className="space-y-4">
      {/* ── Header + KPIs ── */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg shrink-0">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Rendez-vous</h1>
            <p className="text-sm text-muted-foreground hidden sm:block">Planifiez et gerez vos rendez-vous</p>
          </div>
        </div>
        <Button asChild size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66] shadow-sm">
          <Link href="/portail/reserver">
            <CalendarCheck className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Reserver</span>
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-[#0F2D52]/5 p-3">
          <p className="text-2xl font-bold">{kpis.total}</p>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total</p>
        </div>
        <div className="rounded-xl border bg-emerald-50/60 p-3">
          <p className="text-2xl font-bold">{kpis.upcoming}</p>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600">A venir</p>
        </div>
        <div className="rounded-xl border bg-[#0F2D52]/5 p-3">
          <p className="text-2xl font-bold">{kpis.past}</p>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Passes</p>
        </div>
        <div className="rounded-xl border bg-[#0F2D52]/5 p-3">
          <p className="text-2xl font-bold">{kpis.withLink}</p>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Avec lien</p>
        </div>
      </div>

      {/* ── Calendrier + Agenda ── */}
      <div className="grid md:grid-cols-[300px_1fr] lg:grid-cols-[340px_1fr] gap-4 items-start">
        {/* Calendrier mensuel */}
        <Card className="p-4">
          {/* Nav mois */}
          <div className="flex items-center justify-between mb-4">
            <button onClick={prevMonth} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold capitalize">{formatMonthYear(currentMonth)}</span>
              <button onClick={goToday} className="text-[10px] font-medium text-[#0F2D52] hover:underline">
                Aujourd&apos;hui
              </button>
            </div>
            <button onClick={nextMonth} className="h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          {/* Jours de la semaine */}
          <div className="grid grid-cols-7 mb-1">
            {DAY_NAMES.map((d) => (
              <div key={d} className="text-center text-[10px] font-semibold text-muted-foreground uppercase tracking-wider py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grille jours */}
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7">
              {week.map((day) => {
                const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, "0")}-${String(day.getDate()).padStart(2, "0")}`;
                const isCurrentMonth = day.getMonth() === currentMonth.getMonth();
                const isToday = key === today;
                const isSelected = key === selectedDate;
                const dayAppts = byDate.get(key);
                const hasAppts = !!dayAppts && dayAppts.length > 0;
                // Meilleur statut pour le point
                const bestStatus = dayAppts
                  ? dayAppts.find((a) => a.status === "confirmed")?.status
                    ?? dayAppts.find((a) => a.status === "pending")?.status
                    ?? dayAppts.find((a) => a.status === "completed")?.status
                    ?? dayAppts[0]?.status
                  : undefined;

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    className={cn(
                      "relative flex flex-col items-center justify-center py-2 rounded-lg text-sm transition-colors min-h-[44px]",
                      isSelected
                        ? "bg-[#0F2D52] text-white font-semibold"
                        : isToday
                          ? "bg-[#0F2D52]/10 font-semibold text-[#0F2D52]"
                          : isCurrentMonth
                            ? "hover:bg-muted text-foreground"
                            : "text-muted-foreground/30 hover:bg-muted/50"
                    )}
                  >
                    <span>{day.getDate()}</span>
                    {/* Point indicateur */}
                    {hasAppts && (
                      <span
                        className={cn(
                          "h-1.5 w-1.5 rounded-full mt-0.5",
                          isSelected ? "bg-white/70" : dotColor(bestStatus!)
                        )}
                      />
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </Card>

        {/* Agenda du jour */}
        <Card className="p-0 overflow-hidden min-h-[300px]">
          {selectedDate ? (
            <>
              {/* Header jour */}
              <div className="px-5 py-3 border-b bg-muted/30">
                <p className="text-sm font-semibold capitalize">{formatDayFull(selectedDate)}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedAppts.length} rendez-vous
                </p>
              </div>

              {selectedAppts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <Calendar className="h-10 w-10 text-muted-foreground/30 mb-3" />
                  <p className="text-sm font-medium text-muted-foreground">Aucun rendez-vous ce jour</p>
                </div>
              ) : (
                <div className="divide-y">
                  {selectedAppts.map((a) => {
                    const Icon = TYPE_ICON[a.meetingType] ?? Video;
                    const isCancelled = a.status === "cancelled";
                    return (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => setDetail(a)}
                        className={cn(
                          "w-full text-left px-5 py-4 flex gap-4 hover:bg-muted/50 transition-colors",
                          isCancelled && "opacity-50"
                        )}
                      >
                        {/* Timeline gauche */}
                        <div className="flex flex-col items-center shrink-0 w-[52px]">
                          <span className="text-xs font-bold text-[#0F2D52]">{formatTime(a.startTime)}</span>
                          <div className={cn("w-0.5 flex-1 my-1 rounded-full", timelineColor(a.status))} />
                          <span className="text-[10px] text-muted-foreground">{formatTime(a.endTime)}</span>
                        </div>

                        {/* Contenu */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start gap-3">
                            <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                              <Icon className="h-4 w-4 text-[#0F2D52]" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm truncate">{a.subject ?? "Rendez-vous"}</p>
                                <StatusBadge status={a.status} />
                              </div>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {TYPE_LABEL[a.meetingType] ?? a.meetingType}
                                {a.durationMin ? ` · ${a.durationMin} min` : ""}
                              </p>
                              {/* Indicateurs */}
                              <div className="flex items-center gap-2 mt-1.5">
                                {a.meetingLink && !isCancelled && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">
                                    <Link2 className="h-3 w-3" />
                                    Lien disponible
                                  </span>
                                )}
                                {!a.meetingLink && a.isUpcoming && !isCancelled && (
                                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">
                                    <Clock className="h-3 w-3" />
                                    En attente du lien
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Actions rapides */}
                          {a.isUpcoming && !isCancelled && (
                            <div className="flex gap-2 mt-2 ml-12" onClick={(e) => e.stopPropagation()}>
                              {a.meetingLink && (
                                <Button size="sm" className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66]" asChild>
                                  <a href={a.meetingLink} target="_blank" rel="noreferrer">
                                    <ExternalLink className="h-3 w-3 mr-1" />
                                    Rejoindre
                                  </a>
                                </Button>
                              )}
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs text-destructive"
                                onClick={() => setCancelId(a.id)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />
                                Annuler
                              </Button>
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <CalendarCheck className="h-10 w-10 text-muted-foreground/30 mb-3" />
              <p className="text-sm font-medium text-muted-foreground">Selectionnez un jour pour voir vos rendez-vous</p>
            </div>
          )}
        </Card>
      </div>

      {/* ── Detail modal ── */}
      {detail && (
        <Dialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }}>
          <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
            <DialogTitle className="sr-only">{detail.subject ?? "Rendez-vous"}</DialogTitle>
            <div className="bg-[#0F2D52] px-6 py-5 text-white relative">
              <button onClick={() => setDetail(null)} className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
                <X className="h-4 w-4 text-white/70" />
              </button>
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
                  {(() => { const I = TYPE_ICON[detail.meetingType] ?? Video; return <I className="h-6 w-6 text-white" />; })()}
                </div>
                <div>
                  <h2 className="text-lg font-bold">{detail.subject ?? "Rendez-vous"}</h2>
                  <p className="text-white/60 text-sm">{TYPE_LABEL[detail.meetingType] ?? detail.meetingType}</p>
                </div>
              </div>
            </div>

            <div className="px-6 py-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Date</p>
                    <p className="text-sm font-medium">{formatDate(detail.appointmentDate)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-xs text-muted-foreground">Heure</p>
                    <p className="text-sm font-medium">{formatTime(detail.startTime)} - {formatTime(detail.endTime)}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Statut</span>
                  <StatusBadge status={detail.status} />
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Type</span>
                  <span className="font-medium">{TYPE_LABEL[detail.meetingType] ?? detail.meetingType}</span>
                </div>
                {detail.durationMin && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Duree</span>
                    <span className="font-medium">{detail.durationMin} min</span>
                  </div>
                )}
                {detail.subject && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Sujet / Service</span>
                    <span className="font-medium text-right max-w-[200px]">{detail.subject}</span>
                  </div>
                )}
              </div>

              {detail.meetingLink && detail.status !== "cancelled" ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <Link2 className="h-4 w-4 text-emerald-600" />
                    <span className="text-sm font-semibold text-emerald-700">Reunion programmee</span>
                  </div>
                  {(detail.meetingId || detail.meetingPassword) && (
                    <div className="space-y-1 text-sm">
                      {detail.meetingId && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">ID</span>
                          <span className="font-mono font-medium">{detail.meetingId}</span>
                        </div>
                      )}
                      {detail.meetingPassword && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Code</span>
                          <span className="font-mono font-medium">{detail.meetingPassword}</span>
                        </div>
                      )}
                    </div>
                  )}
                  <Button className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" asChild>
                    <a href={detail.meetingLink} target="_blank" rel="noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Rejoindre la reunion
                    </a>
                  </Button>
                </div>
              ) : detail.status !== "cancelled" && detail.isUpcoming ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    <span className="text-sm font-medium text-amber-700">En attente — le lien de reunion sera disponible prochainement</span>
                  </div>
                </div>
              ) : null}

              {detail.notesAdmin && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-[#0F2D52]" />
                    <span className="text-xs font-semibold text-[#0F2D52] uppercase tracking-wider">Notes VNK</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{detail.notesAdmin}</p>
                </div>
              )}

              {detail.notesClient && (
                <div className="rounded-lg border p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Vos notes</span>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{detail.notesClient}</p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              {detail.isUpcoming && detail.status !== "cancelled" && (
                <Button size="sm" variant="outline" className="text-destructive" onClick={() => { setDetail(null); setCancelId(detail.id); }}>
                  <XCircle className="h-3.5 w-3.5 mr-1" />
                  Annuler
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={() => setDetail(null)}>Fermer</Button>
            </div>
          </DialogContent>
        </Dialog>
      )}

      <ConfirmDialog
        open={cancelId !== null}
        onOpenChange={(open) => { if (!open) setCancelId(null); }}
        title="Annuler le rendez-vous"
        description="Etes-vous sur de vouloir annuler ce rendez-vous ?"
        confirmLabel="Oui, annuler"
        cancelLabel="Non, garder"
        variant="destructive"
        loading={loading}
        onConfirm={handleCancel}
      />
    </div>
  );
}

"use client";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatTime } from "@/lib/utils";
import { Video, Phone, MapPin, CalendarCheck, Clock, ChevronLeft, ChevronRight } from "lucide-react";

type Slot = {
  id: number;
  slotDate: string;
  startTime: string;
  endTime: string;
  durationMin: number;
};

const MEETING_TYPES = [
  { key: "video" as const, label: "Video", icon: Video },
  { key: "phone" as const, label: "Telephone", icon: Phone },
  { key: "onsite" as const, label: "Sur place", icon: MapPin },
];

const SERVICES = [
  { value: "plc-support", label: "Support PLC" },
  { value: "plc-programming", label: "Programmation PLC" },
  { value: "scada", label: "SCADA / HMI" },
  { value: "audit", label: "Audit technique" },
  { value: "documentation", label: "Documentation" },
  { value: "consultation", label: "Consultation" },
  { value: "other", label: "Autre" },
];

export function BookingView({ slots }: { slots: Slot[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [meetingType, setMeetingType] = useState<"video" | "phone" | "onsite">("video");
  const [service, setService] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);

  // Group slots by date
  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = new Date(s.slotDate).toISOString().slice(0, 10);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [slots]);

  const dates = Array.from(slotsByDate.keys()).sort();

  // Calendar grid: show current week/month of available dates
  const calendarWeeks = useMemo(() => {
    if (dates.length === 0) return [];
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);
    // Start from Sunday of first week
    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());
    // End at Saturday of last week
    const end = new Date(last);
    end.setDate(end.getDate() + (6 - end.getDay()));

    const weeks: Date[][] = [];
    let current = new Date(start);
    while (current <= end) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }
      weeks.push(week);
    }
    return weeks;
  }, [dates]);

  const availableSet = new Set(dates);

  const handleBook = async () => {
    if (!selectedSlot) return;
    setSending(true);
    try {
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          subject: subject || (service ? SERVICES.find((s) => s.value === service)?.label : undefined),
          notesClient: notes || undefined,
          meetingType,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Rendez-vous confirme !");
      setSelectedSlot(null);
      setSelectedDate(null);
    } catch {
      toast.error("Erreur lors de la reservation");
    } finally {
      setSending(false);
    }
  };

  const dayNames = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const today = new Date().toISOString().slice(0, 10);

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6">
      {/* Left: Calendar */}
      <Card className="border-0 shadow-sm ring-1 ring-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-lg">Choisissez une date</h2>
            <span className="text-xs text-muted-foreground">
              {dates.length} jour{dates.length !== 1 ? "s" : ""} disponible{dates.length !== 1 ? "s" : ""}
            </span>
          </div>

          {dates.length === 0 ? (
            <div className="text-center py-12">
              <CalendarCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Aucun creneau disponible</p>
              <p className="text-xs text-muted-foreground/60 mt-1">Revenez plus tard ou contactez-nous</p>
            </div>
          ) : (
            <>
              {/* Calendar grid */}
              <div className="border rounded-xl overflow-hidden">
                {/* Day headers */}
                <div className="grid grid-cols-7 bg-muted/50 border-b">
                  {dayNames.map((d) => (
                    <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2">
                      {d}
                    </div>
                  ))}
                </div>

                {/* Weeks */}
                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
                    {week.map((day) => {
                      const key = day.toISOString().slice(0, 10);
                      const isAvailable = availableSet.has(key);
                      const isSelected = selectedDate === key;
                      const isToday = key === today;
                      const slotCount = slotsByDate.get(key)?.length ?? 0;
                      const isPast = key < today;

                      return (
                        <button
                          key={key}
                          disabled={!isAvailable}
                          onClick={() => { setSelectedDate(key); setSelectedSlot(null); }}
                          className={cn(
                            "relative p-2 sm:p-3 text-center transition-all min-h-[60px] flex flex-col items-center justify-center gap-0.5",
                            isSelected
                              ? "bg-[#0F2D52] text-white"
                              : isAvailable
                                ? "hover:bg-[#0F2D52]/5 cursor-pointer"
                                : isPast
                                  ? "text-muted-foreground/30"
                                  : "text-muted-foreground/40",
                          )}
                        >
                          <span className={cn(
                            "text-sm font-semibold",
                            isToday && !isSelected && "underline underline-offset-2"
                          )}>
                            {day.getDate()}
                          </span>
                          {isAvailable && (
                            <span className={cn(
                              "text-[9px] font-medium",
                              isSelected ? "text-white/70" : "text-emerald-600"
                            )}>
                              {slotCount} creneau{slotCount > 1 ? "x" : ""}
                            </span>
                          )}
                          {isToday && (
                            <span className={cn(
                              "absolute top-1 right-1 h-1.5 w-1.5 rounded-full",
                              isSelected ? "bg-white" : "bg-[#0F2D52]"
                            )} />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))}
              </div>

              {/* Time slots for selected date */}
              {selectedDate && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-[#0F2D52]" />
                    <h3 className="font-semibold text-sm">
                      Heures disponibles — {new Date(selectedDate).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" })}
                    </h3>
                  </div>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {slotsByDate.get(selectedDate)!.map((s) => (
                      <button
                        key={s.id}
                        onClick={() => setSelectedSlot(s)}
                        className={cn(
                          "p-2.5 rounded-lg border text-sm font-medium transition-all",
                          selectedSlot?.id === s.id
                            ? "bg-[#0F2D52] text-white border-[#0F2D52] shadow-sm"
                            : "hover:bg-[#0F2D52]/5 hover:border-[#0F2D52]/30"
                        )}
                      >
                        {formatTime(s.startTime)}
                        <span className={cn("block text-[10px] mt-0.5", selectedSlot?.id === s.id ? "text-white/60" : "text-muted-foreground")}>
                          {s.durationMin} min
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Right: Booking details */}
      <Card className={cn("border-0 shadow-sm ring-1 ring-border/50 h-fit sticky top-20", !selectedSlot && "opacity-60")}>
        <CardContent className="p-6 space-y-5">
          <h2 className="font-semibold text-lg">Details du rendez-vous</h2>

          {/* Selected slot summary */}
          {selectedSlot ? (
            <div className="rounded-xl bg-[#0F2D52]/5 p-4 border border-[#0F2D52]/10">
              <div className="flex items-center gap-2 mb-1">
                <CalendarCheck className="h-4 w-4 text-[#0F2D52]" />
                <span className="font-semibold text-sm">
                  {new Date(selectedSlot.slotDate).toLocaleDateString("fr-CA", {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground ml-6">
                <Clock className="h-3.5 w-3.5" />
                {formatTime(selectedSlot.startTime)} - {formatTime(selectedSlot.endTime)} ({selectedSlot.durationMin} min)
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-muted/30 p-4 border border-dashed text-center">
              <p className="text-sm text-muted-foreground">Selectionnez une date et un creneau</p>
            </div>
          )}

          {/* Meeting type */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Type de reunion</label>
            <div className="grid grid-cols-3 gap-2">
              {MEETING_TYPES.map((type) => {
                const Icon = type.icon;
                return (
                  <button
                    key={type.key}
                    onClick={() => setMeetingType(type.key)}
                    className={cn(
                      "p-3 rounded-xl border text-center transition-all",
                      meetingType === type.key
                        ? "bg-[#0F2D52] text-white border-[#0F2D52] shadow-sm"
                        : "hover:bg-[#0F2D52]/5 hover:border-[#0F2D52]/30"
                    )}
                  >
                    <Icon className={cn("h-5 w-5 mx-auto mb-1", meetingType === type.key ? "text-white" : "text-[#0F2D52]")} />
                    <span className="text-xs font-medium">{type.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Service */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Service concerne</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none transition-all"
            >
              <option value="">Selectionnez un service</option>
              {SERVICES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>

          {/* Subject */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Sujet</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex. Discussion projet PLC"
              className="w-full h-11 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none transition-all"
            />
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label className="text-sm font-semibold">Notes <span className="text-muted-foreground font-normal">(optionnel)</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Decrivez brievement votre besoin ou les points a discuter..."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none transition-all resize-none"
            />
          </div>

          {/* Book button */}
          <Button
            className="w-full h-11 bg-[#0F2D52] hover:bg-[#1a3a66] shadow-sm"
            disabled={!selectedSlot || sending}
            onClick={handleBook}
          >
            <CalendarCheck className="h-4 w-4 mr-2" />
            {sending ? "Reservation..." : "Confirmer le rendez-vous"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

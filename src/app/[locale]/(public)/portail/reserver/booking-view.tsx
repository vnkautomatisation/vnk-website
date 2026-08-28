"use client";
import { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
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
  { key: "video" as const, labelKey: "type_video", icon: Video },
  { key: "phone" as const, labelKey: "type_telephone", icon: Phone },
  { key: "onsite" as const, labelKey: "type_sur_place", icon: MapPin },
];

// `label` reste la forme canonique : elle compose le sujet enregistre, que le
// back-office VNK relit. Seul l'affichage suit la langue du client.
const SERVICES = [
  { value: "plc-support", label: "Support PLC", labelKey: "svc_plc_support" },
  { value: "plc-programming", label: "Programmation PLC", labelKey: "svc_plc_programming" },
  { value: "scada", label: "SCADA / HMI", labelKey: "svc_scada" },
  { value: "audit", label: "Audit technique", labelKey: "svc_audit" },
  { value: "documentation", label: "Documentation", labelKey: "svc_documentation" },
  { value: "consultation", label: "Consultation", labelKey: "svc_consultation" },
  { value: "other", label: "Autre", labelKey: "svc_other" },
];

type Mandate = { id: number; title: string };

export function BookingView({ slots, mandates = [] }: { slots: Slot[]; mandates?: Mandate[] }) {
  const t = useTranslations("portal");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [meetingType, setMeetingType] = useState<"video" | "phone" | "onsite">("video");
  const [mandateId, setMandateId] = useState("");
  const [service, setService] = useState("");
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const dateTag = useDateLocale();


  const toLocalDate = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  };


  const slotsByDate = useMemo(() => {
    const map = new Map<string, Slot[]>();
    for (const s of slots) {
      const key = toLocalDate(s.slotDate);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(s);
    }
    return map;
  }, [slots]);

  const dates = Array.from(slotsByDate.keys()).sort();


  const calendarWeeks = useMemo(() => {
    if (dates.length === 0) return [];
    const first = new Date(dates[0]);
    const last = new Date(dates[dates.length - 1]);

    const start = new Date(first);
    start.setDate(start.getDate() - start.getDay());

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

  const selectedMandate = mandates.find((m) => String(m.id) === mandateId);
  const selectedService = SERVICES.find((s) => s.value === service);

  const buildSubject = () => {
    const parts: string[] = [];
    if (selectedService) parts.push(selectedService.label);
    if (selectedMandate) parts.push(`Mandat: ${selectedMandate.title}`);
    if (subject) parts.push(subject);
    return parts.join(" — ") || t("rendez_vous");
  };

  const buildNotes = () => {
    const parts: string[] = [];
    if (selectedService) parts.push(`Service: ${selectedService.label}`);
    if (selectedMandate) parts.push(`Mandat: ${selectedMandate.title}`);
    if (notes) parts.push(notes);
    return parts.join("\n") || undefined;
  };

  const handleBook = async () => {
    if (!selectedSlot) return;
    setSending(true);
    try {
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          subject: buildSubject(),
          notesClient: buildNotes(),
          meetingType,
        }),
      });
      if (!res.ok) throw new Error(t("erreur"));
      toast.success(t("rendez_vous_confirme"));
      setSelectedSlot(null);
      setSelectedDate(null);
    } catch {
      toast.error(t("erreur_lors_reservation"));
    } finally {
      setSending(false);
    }
  };

  const dayNames = [t("dim"), t("lun"), t("mar"), t("mer"), t("jeu"), t("ven"), t("sam")];
  const today = new Date().toLocaleDateString("sv-SE");

  return (
    <div className="grid md:grid-cols-[1fr_340px] lg:grid-cols-[1fr_380px] gap-4 lg:gap-6">

      <Card className="border-0 shadow-sm ring-1 ring-border/50">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-lg">{t("choisissez_date")}</h2>
            <span className="text-xs text-muted-foreground">
              {t("jours_disponibles", { count: dates.length })}
            </span>
          </div>

          {dates.length === 0 ? (
            <div className="text-center py-12">
              <CalendarCheck className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">{t("aucun_creneau_disponible")}</p>
              <p className="text-xs text-muted-foreground/60 mt-1">{t("revenez_plus_tard_contactez_nous")}</p>
            </div>
          ) : (
            <>

              <div className="border rounded-xl overflow-hidden">

                <div className="grid grid-cols-7 bg-muted/50 border-b">
                  {dayNames.map((d) => (
                    <div key={d} className="text-center text-[11px] font-semibold uppercase tracking-wider text-muted-foreground py-2">
                      {d}
                    </div>
                  ))}
                </div>


                {calendarWeeks.map((week, wi) => (
                  <div key={wi} className="grid grid-cols-7 border-b last:border-b-0">
                    {week.map((day) => {
                      const key = day.toLocaleDateString("sv-SE");
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


              {selectedDate && (
                <div className="mt-6">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="h-4 w-4 text-[#0F2D52]" />
                    <h3 className="font-semibold text-sm">
                      {t("heures_disponibles", { date: new Date(selectedDate).toLocaleDateString(dateTag, { weekday: "long", day: "numeric", month: "long" }) })}
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


      <Card className={cn("border-0 shadow-sm ring-1 ring-border/50 h-fit sticky top-20", !selectedSlot && "opacity-60")}>
        <CardContent className="p-6 space-y-5">
          <h2 className="font-semibold text-lg">{t("details_rendez_vous")}</h2>


          {selectedSlot ? (
            <div className="rounded-xl bg-[#0F2D52]/5 p-4 border border-[#0F2D52]/10">
              <div className="flex items-center gap-2 mb-1">
                <CalendarCheck className="h-4 w-4 text-[#0F2D52]" />
                <span className="font-semibold text-sm">
                  {new Date(selectedSlot.slotDate).toLocaleDateString(dateTag, {
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
              <p className="text-sm text-muted-foreground">{t("selectionnez_date_creneau")}</p>
            </div>
          )}


          <div className="space-y-2">
            <label className="text-sm font-semibold">{t("type_reunion")}</label>
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
                    <span className="text-xs font-medium">{t(type.labelKey)}</span>
                  </button>
                );
              })}
            </div>
          </div>


          {mandates.length > 0 && (
            <div className="space-y-2">
              <label className="text-sm font-semibold">{t("mandat_lie")} <span className="text-muted-foreground font-normal">{t("optionnel")}</span></label>
              <select
                value={mandateId}
                onChange={(e) => setMandateId(e.target.value)}
                className="w-full h-11 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none transition-all"
              >
                <option value="">{t("aucun_mandat")}</option>
                {mandates.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}</option>
                ))}
              </select>
            </div>
          )}


          <div className="space-y-2">
            <label className="text-sm font-semibold">{t("service_concerne")}</label>
            <select
              value={service}
              onChange={(e) => setService(e.target.value)}
              className="w-full h-11 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none transition-all"
            >
              <option value="">{t("selectionnez_service")}</option>
              {SERVICES.map((s) => (
                <option key={s.value} value={s.value}>{t(s.labelKey)}</option>
              ))}
            </select>
          </div>


          <div className="space-y-2">
            <label className="text-sm font-semibold">{t("sujet")}</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={t("ex_discussion_projet_plc")}
              className="w-full h-11 px-3 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none transition-all"
            />
          </div>


          <div className="space-y-2">
            <label className="text-sm font-semibold">{t("notes")} <span className="text-muted-foreground font-normal">{t("optionnel")}</span></label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t("decrivez_brievement_besoin_points_discuter")}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border bg-background text-sm focus:ring-2 focus:ring-[#0F2D52]/30 focus:border-[#0F2D52] outline-none transition-all resize-none"
            />
          </div>


          <Button
            className="w-full h-11 bg-[#0F2D52] hover:bg-[#1a3a66] shadow-sm"
            disabled={!selectedSlot || sending}
            onClick={handleBook}
          >
            <CalendarCheck className="h-4 w-4 mr-2" />
            {sending ? t("reservation") : t("confirmer_rendez_vous")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

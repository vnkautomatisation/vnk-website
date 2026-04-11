"use client";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Slot = {
  id: number;
  slotDate: Date;
  startTime: string;
  endTime: string;
  durationMin: number;
};

export function BookingView({ slots }: { slots: Slot[] }) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [meetingType, setMeetingType] = useState<"video" | "phone" | "onsite">("video");
  const [subject, setSubject] = useState("");
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

  const handleBook = async () => {
    if (!selectedSlot) return;
    setSending(true);
    try {
      const res = await fetch("/api/calendar/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slotId: selectedSlot.id,
          subject,
          meetingType,
        }),
      });
      if (!res.ok) throw new Error("Erreur");
      toast.success("Rendez-vous confirmé !");
      setSelectedSlot(null);
      setSelectedDate(null);
    } catch {
      toast.error("Erreur lors de la réservation");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="grid lg:grid-cols-[1fr_360px] gap-6">
      <Card>
        <CardContent className="p-6">
          <h2 className="font-semibold mb-4">Dates disponibles</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
            {dates.map((date) => {
              const count = slotsByDate.get(date)!.length;
              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(date)}
                  className={cn(
                    "p-3 rounded-lg border text-left transition-colors",
                    selectedDate === date
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent"
                  )}
                >
                  <div className="text-xs uppercase opacity-70">
                    {new Date(date).toLocaleDateString("fr-CA", { weekday: "short" })}
                  </div>
                  <div className="text-lg font-bold">
                    {new Date(date).toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}
                  </div>
                  <div className="text-[10px] opacity-70 mt-1">
                    {count} créneau{count > 1 ? "x" : ""}
                  </div>
                </button>
              );
            })}
          </div>

          {selectedDate && (
            <div className="mt-6">
              <h3 className="font-semibold mb-3">Heures disponibles</h3>
              <div className="grid grid-cols-3 gap-2">
                {slotsByDate.get(selectedDate)!.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSlot(s)}
                    className={cn(
                      "p-2 rounded border text-sm",
                      selectedSlot?.id === s.id
                        ? "bg-primary text-primary-foreground border-primary"
                        : "hover:bg-accent"
                    )}
                  >
                    {s.startTime}
                  </button>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Panneau droite : détails */}
      <Card className={selectedSlot ? "" : "opacity-50"}>
        <CardContent className="p-6 space-y-4">
          <h2 className="font-semibold">Détails du rendez-vous</h2>

          {selectedSlot && (
            <div className="p-3 rounded bg-primary/10 text-sm">
              <div className="font-medium">
                {new Date(selectedSlot.slotDate).toLocaleDateString("fr-CA", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                })}
              </div>
              <div className="text-muted-foreground">
                {selectedSlot.startTime} - {selectedSlot.endTime} ({selectedSlot.durationMin} min)
              </div>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-sm font-medium">Type de réunion</label>
            <div className="grid grid-cols-3 gap-2">
              {(["video", "phone", "onsite"] as const).map((type) => (
                <button
                  key={type}
                  onClick={() => setMeetingType(type)}
                  className={cn(
                    "p-2 rounded border text-xs capitalize",
                    meetingType === type
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-accent"
                  )}
                >
                  {type === "video" ? "Vidéo" : type === "phone" ? "Téléphone" : "Sur place"}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Sujet</label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Ex. Discussion projet PLC"
              className="w-full h-11 px-3 rounded-md border"
            />
          </div>

          <Button
            className="w-full"
            disabled={!selectedSlot || sending}
            onClick={handleBook}
          >
            {sending ? "Réservation…" : "Confirmer le rendez-vous"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

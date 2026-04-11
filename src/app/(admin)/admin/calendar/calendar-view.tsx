"use client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";

type Slot = {
  id: number;
  slotDate: Date;
  startTime: string;
  endTime: string;
  status: string;
};

type Appt = {
  id: number;
  appointmentDate: Date;
  startTime: string;
  endTime: string;
  clientName: string;
  subject: string | null;
  status: string;
  meetingType: string;
};

export function CalendarView({
  slots,
  appointments,
}: {
  slots: Slot[];
  appointments: Appt[];
}) {
  const daysOfWeek = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - weekStart.getDay());

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(weekStart.getDate() + i);
    return d;
  });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
      {/* Mini stats */}
      <Card className="lg:col-span-1">
        <CardContent className="p-5 space-y-3">
          <div>
            <p className="text-xs text-muted-foreground uppercase">Disponibles</p>
            <p className="text-2xl font-bold">{slots.filter((s) => s.status === "available").length}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Réservés</p>
            <p className="text-2xl font-bold text-primary">
              {slots.filter((s) => s.status === "booked").length}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground uppercase">Rendez-vous à venir</p>
            <p className="text-2xl font-bold text-emerald-600">{appointments.length}</p>
          </div>
        </CardContent>
      </Card>

      {/* Week grid */}
      <Card className="lg:col-span-3 overflow-hidden">
        <div className="grid grid-cols-7 border-b">
          {days.map((d, i) => (
            <div key={i} className="p-3 text-center border-r last:border-0">
              <div className="text-[10px] uppercase text-muted-foreground">{daysOfWeek[i]}</div>
              <div className="text-lg font-bold">{d.getDate()}</div>
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 min-h-[400px]">
          {days.map((d, i) => {
            const dayAppts = appointments.filter(
              (a) => new Date(a.appointmentDate).toDateString() === d.toDateString()
            );
            return (
              <div key={i} className="border-r last:border-0 p-2 space-y-1">
                {dayAppts.map((a) => (
                  <div
                    key={a.id}
                    className="rounded bg-primary/10 border-l-2 border-primary p-1.5 text-[10px]"
                  >
                    <div className="font-semibold">{a.startTime}</div>
                    <div className="truncate">{a.clientName}</div>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}

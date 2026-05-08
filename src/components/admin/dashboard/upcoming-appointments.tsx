import Link from "next/link";
import { Calendar, Video, Phone, MapPin, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

type UpcomingAppointment = {
  id: number;
  clientName: string;
  subject: string | null;
  appointmentDate: string;
  startTime: string;
  meetingType: string;
};

const MEETING_ICONS: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  video: { icon: Video, color: "text-blue-500 bg-blue-50" },
  phone: { icon: Phone, color: "text-emerald-500 bg-emerald-50" },
  onsite: { icon: MapPin, color: "text-violet-500 bg-violet-50" },
};

export function UpcomingAppointments({
  appointments,
}: {
  appointments: UpcomingAppointment[];
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            Rendez-vous a venir
          </h3>
          <Link
            href="/admin/calendar"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Voir calendrier
          </Link>
        </div>

        {appointments.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Aucun rendez-vous a venir
          </p>
        ) : (
          <div className="space-y-2">
            {appointments.map((apt) => {
              const meeting = MEETING_ICONS[apt.meetingType] ?? MEETING_ICONS.video;
              const MeetIcon = meeting.icon;
              const dateStr = new Date(apt.appointmentDate).toLocaleDateString(
                "fr-CA",
                { weekday: "short", day: "numeric", month: "short" }
              );
              return (
                <Link
                  key={apt.id}
                  href="/admin/calendar"
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                >
                  <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${meeting.color}`}>
                    <MeetIcon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {apt.clientName}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {apt.subject || apt.meetingType === "video" ? "Reunion video" : apt.meetingType === "phone" ? "Appel" : "Presentiel"}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs font-medium">{apt.startTime}</p>
                    <p className="text-[10px] text-muted-foreground">{dateStr}</p>
                  </div>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                </Link>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

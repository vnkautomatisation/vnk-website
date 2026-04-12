import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Video,
  Phone,
  MapPin,
  XCircle,
  CalendarCheck,
  CalendarClock,
  Clock,
  Hash,
} from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate, formatTime } from "@/lib/utils";
import Link from "next/link";

export default async function PortalAppointmentsPage() {
  const session = await auth();

  const appointments = await prisma.appointment.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { appointmentDate: "desc" },
  });

  const now = new Date();
  const upcoming = appointments.filter((a) => a.appointmentDate >= now);
  const past = appointments.filter((a) => a.appointmentDate < now);

  // KPI stats
  const total = appointments.length;
  const upcomingCount = upcoming.length;
  const pastCount = past.length;
  const videoCount = appointments.filter((a) => a.meetingType === "video").length;

  return (
    <div className="space-y-6">
      {/* ── Page header ───────────────────────────── */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
            <Calendar className="h-5 w-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mes rendez-vous</h1>
            <p className="text-sm text-muted-foreground">Planifiez et gerez vos rendez-vous</p>
          </div>
        </div>
        <Button asChild className="bg-[#0F2D52] hover:bg-[#1a3a66] shadow-sm">
          <Link href="/portail/reserver">
            <CalendarCheck className="h-4 w-4 mr-1.5" />
            Reserver
          </Link>
        </Button>
      </div>

      {/* ── KPI Strip ─────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
          <p className="text-2xl font-bold">{total}</p>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Total</p>
        </div>
        <div className="rounded-xl border bg-emerald-50/60 p-4">
          <p className="text-2xl font-bold">{upcomingCount}</p>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-emerald-600">A venir</p>
        </div>
        <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
          <p className="text-2xl font-bold">{pastCount}</p>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Passes</p>
        </div>
        <div className="rounded-xl border bg-[#0F2D52]/5 p-4">
          <p className="text-2xl font-bold">{videoCount}</p>
          <p className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">Video</p>
        </div>
      </div>

      {/* ── Upcoming ──────────────────────────────── */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider">
            A venir ({upcoming.length})
          </h2>
        </div>
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <Card className="border-0 shadow-sm ring-1 ring-border/50">
              <CardContent className="p-8 text-center">
                <div className="h-14 w-14 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                  <CalendarClock className="h-7 w-7 text-muted-foreground/40" />
                </div>
                <p className="text-sm font-medium text-muted-foreground">Aucun rendez-vous a venir</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Reservez un creneau pour commencer</p>
                <Button size="sm" asChild className="mt-4 bg-[#0F2D52] hover:bg-[#1a3a66]">
                  <Link href="/portail/reserver">
                    <CalendarCheck className="h-3.5 w-3.5 mr-1" />
                    Reserver maintenant
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ) : (
            upcoming.map((a) => {
              const TypeIcon = a.meetingType === "video" ? Video : a.meetingType === "phone" ? Phone : MapPin;
              const typeGradient =
                a.meetingType === "video"
                  ? "from-sky-500 to-blue-600"
                  : a.meetingType === "phone"
                    ? "from-emerald-500 to-teal-600"
                    : "from-amber-500 to-orange-600";
              return (
                <Card key={a.id} className="vnk-kpi-card border-0 shadow-sm hover:shadow-md">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className={`h-11 w-11 rounded-xl bg-gradient-to-br ${typeGradient} flex items-center justify-center shadow-sm shrink-0`}>
                          <TypeIcon className="h-5 w-5 text-white" />
                        </div>
                        <div>
                          <p className="font-semibold">{a.subject ?? "Rendez-vous"}</p>
                          <p className="text-sm text-muted-foreground mt-0.5">
                            {formatDate(a.appointmentDate)} · {formatTime(a.startTime)} - {formatTime(a.endTime)}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-4 flex gap-2">
                      {a.meetingLink && (
                        <Button size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66] shadow-sm" asChild>
                          <a href={a.meetingLink} target="_blank" rel="noreferrer">
                            <Video className="h-3.5 w-3.5 mr-1" />
                            Rejoindre
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline" className="shadow-sm">Reprogrammer</Button>
                      <Button size="sm" variant="outline" className="text-destructive shadow-sm">
                        <XCircle className="h-3.5 w-3.5 mr-1" />
                        Annuler
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      </div>

      {/* ── Past ──────────────────────────────────── */}
      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase text-muted-foreground tracking-wider mb-3">
            Passes ({past.length})
          </h2>
          <div className="space-y-2">
            {past.slice(0, 5).map((a) => {
              const TypeIcon = a.meetingType === "video" ? Video : a.meetingType === "phone" ? Phone : MapPin;
              return (
                <Card key={a.id} className="border-0 shadow-sm ring-1 ring-border/50">
                  <CardContent className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center">
                        <TypeIcon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{a.subject ?? "Rendez-vous"}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatDate(a.appointmentDate)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

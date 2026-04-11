import { setRequestLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Video, Phone, MapPin, XCircle } from "lucide-react";
import { StatusBadge } from "@/components/admin/status-badge";
import { formatDate } from "@/lib/utils";

export default async function PortalAppointmentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const session = await auth();

  const appointments = await prisma.appointment.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { appointmentDate: "desc" },
  });

  const now = new Date();
  const upcoming = appointments.filter((a) => a.appointmentDate >= now);
  const past = appointments.filter((a) => a.appointmentDate < now);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Calendar className="h-6 w-6" />
        <h1 className="text-2xl font-bold">Mes rendez-vous</h1>
      </div>

      <div>
        <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
          À venir ({upcoming.length})
        </h2>
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Aucun rendez-vous à venir
              </CardContent>
            </Card>
          ) : (
            upcoming.map((a) => {
              const TypeIcon = a.meetingType === "video" ? Video : a.meetingType === "phone" ? Phone : MapPin;
              return (
                <Card key={a.id} className="vnk-card-hover">
                  <CardContent className="p-5">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <TypeIcon className="h-5 w-5" />
                        </div>
                        <div>
                          <p className="font-semibold">{a.subject ?? "Rendez-vous"}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatDate(a.appointmentDate)} · {a.startTime} - {a.endTime}
                          </p>
                        </div>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                    <div className="mt-4 flex gap-2">
                      {a.meetingLink && (
                        <Button size="sm" asChild>
                          <a href={a.meetingLink} target="_blank" rel="noreferrer">
                            <Video className="h-4 w-4" />
                            Rejoindre
                          </a>
                        </Button>
                      )}
                      <Button size="sm" variant="outline">Reprogrammer</Button>
                      <Button size="sm" variant="outline" className="text-destructive">
                        <XCircle className="h-4 w-4" />
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

      {past.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase text-muted-foreground mb-3">
            Passés ({past.length})
          </h2>
          <div className="space-y-2">
            {past.slice(0, 5).map((a) => (
              <Card key={a.id}>
                <CardContent className="p-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{a.subject ?? "Rendez-vous"}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(a.appointmentDate)}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

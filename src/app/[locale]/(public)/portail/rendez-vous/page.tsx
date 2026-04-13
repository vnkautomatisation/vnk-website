import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Calendar, CalendarCheck } from "lucide-react";
import Link from "next/link";
import { AppointmentsList } from "./appointments-list";

/* Serialize Prisma objects to plain JSON for client component */
function serialize(rows: { id: number; subject: string | null; appointmentDate: Date; startTime: string; endTime: string; meetingType: string; meetingLink: string | null; status: string }[]) {
  return rows.map((r) => ({
    id: r.id,
    subject: r.subject,
    appointmentDate: r.appointmentDate.toISOString(),
    startTime: r.startTime,
    endTime: r.endTime,
    meetingType: r.meetingType,
    meetingLink: r.meetingLink,
    status: r.status,
  }));
}

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
    <div>
      {/* ── Sticky header + KPIs ─────────────────── */}
      <div className="sticky top-[70px] z-10 bg-background -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8 pt-4 pb-3 border-b border-border/50">
        <div className="flex items-center justify-between mb-4">
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
      </div>

      {/* ── Appointments list (client component) ── */}
      <div className="mt-4">
        <AppointmentsList upcoming={serialize(upcoming)} past={serialize(past)} />
      </div>
    </div>
  );
}

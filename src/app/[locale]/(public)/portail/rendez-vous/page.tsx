import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { AppointmentsList } from "./appointments-list";

export default async function PortalAppointmentsPage() {
  const session = await auth();
  if (!session?.user?.clientId) redirect("/portail/login");
  const clientId = session.user.clientId;
  const now = new Date();

  // Auto-maj les RDV passes
  await Promise.all([
    // confirmed + passe → completed
    prisma.appointment.updateMany({
      where: { clientId, status: "confirmed", appointmentDate: { lt: now } },
      data: { status: "completed" },
    }),
    // pending + passe → no_show
    prisma.appointment.updateMany({
      where: { clientId, status: "pending", appointmentDate: { lt: now } },
      data: { status: "no_show" },
    }),
  ]);

  const appointments = await prisma.appointment.findMany({
    where: { clientId },
    orderBy: { appointmentDate: "desc" },
  });

  const serialized = appointments.map((a) => ({
    id: a.id,
    subject: a.subject,
    appointmentDate: a.appointmentDate.toISOString(),
    startTime: a.startTime,
    endTime: a.endTime,
    meetingType: a.meetingType,
    meetingLink: a.meetingLink,
    meetingId: a.meetingId ?? null,
    meetingPassword: a.meetingPassword ?? null,
    status: a.status,
    isUpcoming: a.appointmentDate >= now,
    notesClient: a.notesClient ?? null,
    notesAdmin: a.notesAdmin ?? null,
    durationMin: a.durationMin ?? null,
  }));

  return <AppointmentsList appointments={serialized} />;
}

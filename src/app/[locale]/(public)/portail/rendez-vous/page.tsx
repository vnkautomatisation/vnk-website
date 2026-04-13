import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { AppointmentsList } from "./appointments-list";

export default async function PortalAppointmentsPage() {
  const session = await auth();

  const appointments = await prisma.appointment.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { appointmentDate: "desc" },
  });

  const now = new Date();
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

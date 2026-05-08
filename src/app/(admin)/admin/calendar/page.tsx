// Admin · Calendrier — navigation semaine + slots + RDV + creation
import { prisma } from "@/lib/prisma";
import { CalendarView } from "./calendar-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Calendrier" };

export default async function CalendarPage() {
  // Charger 4 semaines de donnees (semaine courante + 3)
  const now = new Date();
  const rangeStart = new Date(now);
  rangeStart.setDate(now.getDate() - now.getDay() - 7); // 1 semaine avant
  const rangeEnd = new Date(rangeStart);
  rangeEnd.setDate(rangeStart.getDate() + 42); // 6 semaines

  const [slots, appointments, clients] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: { slotDate: { gte: rangeStart, lte: rangeEnd } },
      orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
    }),
    prisma.appointment.findMany({
      where: { appointmentDate: { gte: rangeStart, lte: rangeEnd } },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
      include: { client: { select: { id: true, fullName: true } } },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  return (
    <CalendarView
      slots={slots.map((s) => ({
        id: s.id,
        slotDate: s.slotDate.toISOString(),
        startTime: s.startTime,
        endTime: s.endTime,
        durationMin: s.durationMin,
        status: s.status,
        notes: s.notes,
      }))}
      appointments={appointments.map((a) => ({
        id: a.id,
        slotId: a.slotId,
        clientId: a.clientId,
        clientName: a.clientName,
        appointmentDate: a.appointmentDate.toISOString(),
        startTime: a.startTime,
        endTime: a.endTime,
        subject: a.subject,
        status: a.status,
        meetingType: a.meetingType,
        meetingLink: a.meetingLink,
      }))}
      clients={clients}
    />
  );
}

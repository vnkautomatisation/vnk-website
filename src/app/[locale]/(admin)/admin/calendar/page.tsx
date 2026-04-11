import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { CalendarView } from "./calendar-view";
import { Calendar } from "lucide-react";

export default async function CalendarPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 7);

  const [slots, appointments] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: { slotDate: { gte: weekStart, lte: weekEnd } },
      orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
    }),
    prisma.appointment.findMany({
      where: { appointmentDate: { gte: weekStart, lte: weekEnd } },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
    }),
  ]);

  return (
    <div className="space-y-4">
      <PageHeader title="Calendrier" subtitle="Disponibilités et rendez-vous" icon={Calendar} action={{ label: "+ Disponibilité" }} />
      <CalendarView slots={slots} appointments={appointments} />
    </div>
  );
}

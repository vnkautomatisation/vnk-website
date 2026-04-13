import { prisma } from "@/lib/prisma";
import { BookingView } from "./booking-view";
import { CalendarPlus } from "lucide-react";

export default async function BookingPage() {
  const now = new Date();
  const horizon = new Date();
  horizon.setDate(now.getDate() + 30);

  const rawSlots = await prisma.availabilitySlot.findMany({
    where: {
      slotDate: { gte: now, lte: horizon },
      status: "available",
    },
    orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
  });

  // Serialiser les dates pour le client component
  const slots = rawSlots.map((s) => ({
    id: s.id,
    slotDate: s.slotDate.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
    durationMin: s.durationMin,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
          <CalendarPlus className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">Reserver un appel</h1>
          <p className="text-sm text-muted-foreground">Choisissez un creneau disponible</p>
        </div>
      </div>
      <BookingView slots={slots} />
    </div>
  );
}

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { BookingView } from "./booking-view";
import { CalendarPlus } from "lucide-react";

export default async function BookingPage() {
  const session = await auth();
  if (!session?.user?.clientId) redirect("/portail/login");
  const clientId = session.user.clientId;

  const now = new Date();
  const horizon = new Date();
  horizon.setDate(now.getDate() + 30);

  const [rawSlots, rawMandates] = await Promise.all([
    prisma.availabilitySlot.findMany({
      where: {
        slotDate: { gte: now, lte: horizon },
        status: "available",
      },
      orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
    }),
    prisma.mandate.findMany({
      where: { clientId, status: { in: ["active", "in_progress", "pending"] } },
      select: { id: true, title: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const slots = rawSlots.map((s) => ({
    id: s.id,
    slotDate: s.slotDate.toISOString(),
    startTime: s.startTime,
    endTime: s.endTime,
    durationMin: s.durationMin,
  }));

  const mandates = rawMandates.map((m) => ({
    id: m.id,
    title: m.title,
  }));

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 sm:h-12 sm:w-12 rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
          <CalendarPlus className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Reserver un appel</h1>
          <p className="text-sm text-muted-foreground">Choisissez un creneau disponible</p>
        </div>
      </div>
      <BookingView slots={slots} mandates={mandates} />
    </div>
  );
}

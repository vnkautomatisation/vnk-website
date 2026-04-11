import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { BookingView } from "./booking-view";
import { CalendarPlus } from "lucide-react";

export default async function BookingPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const now = new Date();
  const horizon = new Date();
  horizon.setDate(now.getDate() + 30);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      slotDate: { gte: now, lte: horizon },
      status: "available",
    },
    orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <CalendarPlus className="h-6 w-6" />
        <div>
          <h1 className="text-2xl font-bold">Réserver un appel</h1>
          <p className="text-sm text-muted-foreground">Choisissez un créneau disponible</p>
        </div>
      </div>
      <BookingView slots={slots} />
    </div>
  );
}

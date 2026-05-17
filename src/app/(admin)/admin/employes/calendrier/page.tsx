// HR · Calendrier mensuel : congés approuvés + jours fériés visualisés en grille.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { CalendarMonthView } from "./calendar-month-view";

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ month?: string; year?: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");

  const sp = await searchParams;
  const now = new Date();
  const year = sp.year ? Number(sp.year) : now.getFullYear();
  const month = sp.month != null ? Number(sp.month) : now.getMonth();

  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  // Inclure jours du mois précédent pour aligner sur lundi (convention QC)
  const gridStart = new Date(firstDay);
  const dayOfWeek = (firstDay.getDay() + 6) % 7; // 0 = lundi
  gridStart.setDate(gridStart.getDate() - dayOfWeek);
  const gridEnd = new Date(lastDay);
  gridEnd.setDate(gridEnd.getDate() + (6 - ((lastDay.getDay() + 6) % 7)));

  const [leaves, holidays] = await Promise.all([
    prisma.leaveRequest.findMany({
      where: {
        status: "approved",
        startDate: { lte: gridEnd },
        endDate: { gte: gridStart },
      },
      orderBy: { startDate: "asc" },
      include: { admin: { select: { id: true, fullName: true, email: true, avatarUrl: true } } },
    }),
    prisma.holiday.findMany({
      where: { date: { gte: gridStart, lte: gridEnd } },
      orderBy: { date: "asc" },
    }),
  ]);

  return (
    <CalendarMonthView
      year={year}
      month={month}
      gridStart={gridStart.toISOString()}
      gridEnd={gridEnd.toISOString()}
      leaves={JSON.parse(JSON.stringify(leaves))}
      holidays={JSON.parse(JSON.stringify(holidays))}
    />
  );
}

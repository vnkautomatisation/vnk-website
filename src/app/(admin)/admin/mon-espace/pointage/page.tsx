// Réutilise la TimeclockView en mode "self only".
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimeclockView } from "../../employes/pointage/timeclock-view";
import { getHolidaysInRange } from "@/lib/services/holidays";

function startOfWeekMonday(d: Date): Date {
  const n = new Date(d);
  n.setHours(0, 0, 0, 0);
  const day = n.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  n.setDate(n.getDate() + diff);
  return n;
}

export default async function MyPointagePage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; to?: string }>;
}) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const sp = await searchParams;
  const now = new Date();
  // Defaut : semaine en cours (lundi -> aujourd'hui)
  const defaultFrom = startOfWeekMonday(now);
  const from = sp.from ? new Date(sp.from) : defaultFrom;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : now;
  const periodFrom = !isNaN(from.getTime()) ? from : defaultFrom;
  const periodTo = !isNaN(to.getTime()) ? to : now;

  const [myEntries, openEntry, holidaysMap] = await Promise.all([
    prisma.timeClock.findMany({
      where: { adminId, clockIn: { gte: periodFrom, lte: periodTo } },
      orderBy: { clockIn: "desc" },
      take: 200,
      include: { approver: { select: { fullName: true, email: true } } },
    }),
    prisma.timeClock.findFirst({ where: { adminId, clockOut: null } }),
    getHolidaysInRange(periodFrom, periodTo),
  ]);

  const holidaysJson: Record<string, { name: string; isPaid: boolean; type: string }> = {};
  for (const [k, v] of holidaysMap) holidaysJson[k] = v;

  return (
    <TimeclockView
      mode="employee"
      myEntries={JSON.parse(JSON.stringify(myEntries))}
      openEntry={openEntry ? JSON.parse(JSON.stringify(openEntry)) : null}
      currentAdminId={adminId}
      periodFrom={periodFrom.toISOString()}
      periodTo={periodTo.toISOString()}
      holidays={holidaysJson}
    />
  );
}

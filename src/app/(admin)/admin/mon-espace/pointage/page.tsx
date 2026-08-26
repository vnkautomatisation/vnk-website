// TimeclockView in "self only" mode.
import { prisma } from "@/lib/prisma";
import { startOfWeek, endOfWeek } from "@/lib/week";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimeclockView } from "../../employes/pointage/timeclock-view";
import { getHolidaysInRange } from "@/lib/services/holidays";


// Long periods with several punches a day exceed this; the view says so
// rather than under-reporting the employee's own totals in silence.
const MAX_ENTRIES = 1000;

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
  // Default: current week (Sunday -> today).
  const defaultFrom = startOfWeek(now);
  // Date-only strings parse as UTC and shift a day: force LOCAL midnight.
  const from = sp.from
    ? new Date(/^\d{4}-\d{2}-\d{2}$/.test(sp.from) ? sp.from + "T00:00:00" : sp.from)
    : defaultFrom;
  const to = sp.to ? new Date(sp.to + "T23:59:59") : now;
  const periodFrom = !isNaN(from.getTime()) ? from : defaultFrom;
  const periodTo = !isNaN(to.getTime()) ? to : now;

  const { getTimeclockConfig } = await import("@/lib/services/timeclock-config");
  const [myEntries, openEntry, holidaysMap, tcConfig, pinRows] = await Promise.all([
    prisma.timeClock.findMany({
      where: { adminId, clockIn: { gte: periodFrom, lte: periodTo } },
      orderBy: { clockIn: "desc" },
      take: MAX_ENTRIES + 1,
      include: {
        approver: { select: { fullName: true, email: true } },
        // History feeds the structured "Rejeté" badge (with reason) in rows.
        history: {
          orderBy: { createdAt: "desc" },
          take: 5,
          include: { actor: { select: { id: true, fullName: true, email: true } } },
        },
      },
    }),
    prisma.timeClock.findFirst({ where: { adminId, clockOut: null }, orderBy: { clockIn: "desc" } }),
    getHolidaysInRange(periodFrom, periodTo),
    getTimeclockConfig(),
    // Kiosk PIN state only, never its value.
    prisma.$queryRaw<Array<{ has_pin: boolean; set_at: Date | null; requested_at: Date | null }>>`
      SELECT (kiosk_pin_hash IS NOT NULL) AS has_pin,
             kiosk_pin_set_at AS set_at,
             kiosk_pin_requested_at AS requested_at
      FROM admins WHERE id = ${adminId}
    `,
  ]);

  const entriesTruncated = myEntries.length > MAX_ENTRIES;
  if (entriesTruncated) myEntries.length = MAX_ENTRIES;

  const holidaysJson: Record<string, { name: string; isPaid: boolean; type: string }> = {};
  for (const [k, v] of holidaysMap) holidaysJson[k] = v;

  return (
    <TimeclockView
      mode="employee"
      myEntries={JSON.parse(JSON.stringify(myEntries))}
      entriesTruncated={entriesTruncated}
      openEntry={openEntry ? JSON.parse(JSON.stringify(openEntry)) : null}
      currentAdminId={adminId}
      periodFrom={periodFrom.toISOString()}
      periodTo={periodTo.toISOString()}
      holidays={holidaysJson}
      geolocEnabled={tcConfig.geolocEnabled || tcConfig.geofenceEnabled}
      kioskEnabled={tcConfig.kioskEnabled}
      hasKioskPin={pinRows[0]?.has_pin ?? false}
      kioskPinSetAt={pinRows[0]?.set_at ? new Date(pinRows[0].set_at).toISOString() : null}
      kioskPinRequestedAt={pinRows[0]?.requested_at ? new Date(pinRows[0].requested_at).toISOString() : null}
    />
  );
}

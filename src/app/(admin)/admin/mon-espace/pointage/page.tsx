// Réutilise la TimeclockView en mode "self only".
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimeclockView } from "../../employes/pointage/timeclock-view";

export default async function MyPointagePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [myEntries, openEntry] = await Promise.all([
    prisma.timeClock.findMany({
      where: { adminId, clockIn: { gte: since } },
      orderBy: { clockIn: "desc" },
      take: 100,
    }),
    prisma.timeClock.findFirst({ where: { adminId, clockOut: null } }),
  ]);

  return (
    <TimeclockView
      myEntries={JSON.parse(JSON.stringify(myEntries))}
      openEntry={openEntry ? JSON.parse(JSON.stringify(openEntry)) : null}
      allEntries={[]}
      isPayrollAdmin={false}
      currentAdminId={adminId}
    />
  );
}

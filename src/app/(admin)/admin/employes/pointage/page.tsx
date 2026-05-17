import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { TimeclockView } from "./timeclock-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Employés — Pointage" };

export default async function PointagePage() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const me = await prisma.admin.findUnique({ where: { id: adminId }, include: { customRole: true } });
  const perms = (me?.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
  const isPayrollAdmin = me?.customRole?.name === "super_admin" || (perms.payroll ?? []).includes("write") || (perms.users ?? []).includes("write");

  // 30 derniers jours
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [myEntries, openEntry, allEntries] = await Promise.all([
    prisma.timeClock.findMany({
      where: { adminId, clockIn: { gte: since } },
      orderBy: { clockIn: "desc" },
      take: 100,
    }),
    prisma.timeClock.findFirst({ where: { adminId, clockOut: null }, orderBy: { clockIn: "desc" } }),
    isPayrollAdmin
      ? prisma.timeClock.findMany({
          where: { clockIn: { gte: since } },
          orderBy: { clockIn: "desc" },
          take: 300,
          include: { admin: { select: { id: true, fullName: true, email: true } } },
        })
      : Promise.resolve([]),
  ]);

  return (
    <TimeclockView
      myEntries={JSON.parse(JSON.stringify(myEntries))}
      openEntry={openEntry ? JSON.parse(JSON.stringify(openEntry)) : null}
      allEntries={JSON.parse(JSON.stringify(allEntries))}
      isPayrollAdmin={isPayrollAdmin}
      currentAdminId={adminId}
    />
  );
}

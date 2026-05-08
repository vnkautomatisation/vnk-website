// Admin dashboard — server component fetches data, client component renders
import { getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DashboardView } from "@/components/admin/dashboard/dashboard-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Tableau de bord administrateur",
};

export default async function AdminDashboard() {
  const locale = await getLocale();
  const session = await auth();
  const adminId = session?.user?.adminId;

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = monthStart;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const [
    admin,
    activeClientsCount,
    newClientsThisMonth,
    activeMandatesCount,
    pendingMandatesCount,
    receivable,
    overdueCount,
    thisMonthRevenue,
    lastMonthRevenue,
    overdueInvoices,
    upcomingAppointments,
    recentEvents,
  ] = await Promise.all([
    adminId
      ? prisma.admin.findUnique({
          where: { id: adminId },
          select: { fullName: true },
        })
      : null,
    prisma.client.count({ where: { isActive: true, archived: false } }),
    prisma.client.count({
      where: { isActive: true, archived: false, createdAt: { gte: monthStart } },
    }),
    prisma.mandate.count({
      where: { status: { in: ["active", "in_progress"] } },
    }),
    prisma.mandate.count({ where: { status: "pending" } }),
    prisma.invoice.aggregate({
      _sum: { amountTtc: true },
      where: { status: { in: ["unpaid", "overdue"] } },
    }),
    prisma.invoice.count({ where: { status: "overdue" } }),
    prisma.invoice.aggregate({
      _sum: { amountTtc: true },
      where: { status: "paid", paidAt: { gte: monthStart } },
    }),
    prisma.invoice.aggregate({
      _sum: { amountTtc: true },
      where: { status: "paid", paidAt: { gte: lastMonthStart, lt: lastMonthEnd } },
    }),
    prisma.invoice.findMany({
      where: { status: "overdue" },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        id: true,
        invoiceNumber: true,
        amountTtc: true,
        dueDate: true,
        client: { select: { fullName: true } },
      },
    }),
    prisma.appointment.findMany({
      where: {
        appointmentDate: { gte: todayStart },
        status: "confirmed",
      },
      orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
      take: 5,
      select: {
        id: true,
        clientName: true,
        subject: true,
        appointmentDate: true,
        startTime: true,
        meetingType: true,
      },
    }),
    prisma.workflowEvent.findMany({
      take: 12,
      orderBy: { createdAt: "desc" },
      include: { client: { select: { fullName: true, companyName: true } } },
    }),
  ]);

  // Revenus 6 derniers mois pour le graphique
  const monthNames = ["Jan", "Fev", "Mar", "Avr", "Mai", "Jun", "Jul", "Aou", "Sep", "Oct", "Nov", "Dec"];
  const revenueByMonth: { month: string; revenue: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const mEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const agg = await prisma.invoice.aggregate({
      _sum: { amountTtc: true },
      where: { status: "paid", paidAt: { gte: mStart, lt: mEnd } },
    });
    revenueByMonth.push({
      month: monthNames[mStart.getMonth()],
      revenue: Number(agg._sum.amountTtc ?? 0),
    });
  }

  const receivableAmount = Number(receivable._sum.amountTtc ?? 0);
  const thisMonthAmount = Number(thisMonthRevenue._sum.amountTtc ?? 0);
  const lastMonthAmount = Number(lastMonthRevenue._sum.amountTtc ?? 0);
  const revenueDelta =
    lastMonthAmount > 0
      ? Math.round(((thisMonthAmount - lastMonthAmount) / lastMonthAmount) * 100)
      : 0;

  const dateStr = now.toLocaleDateString(locale === "fr" ? "fr-CA" : "en-CA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <DashboardView
      data={{
        adminName: admin?.fullName ?? "Admin",
        dateStr,
        activeClientsCount,
        newClientsThisMonth,
        activeMandatesCount,
        pendingMandatesCount,
        receivableAmount,
        overdueCount,
        thisMonthAmount,
        revenueDelta,
        overdueInvoices: overdueInvoices.map((inv) => ({
          id: inv.id,
          invoiceNumber: inv.invoiceNumber,
          clientName: inv.client.fullName,
          amountTtc: Number(inv.amountTtc),
          dueDate: inv.dueDate!.toISOString(),
        })),
        upcomingAppointments: upcomingAppointments.map((apt) => ({
          id: apt.id,
          clientName: apt.clientName,
          subject: apt.subject,
          appointmentDate: apt.appointmentDate.toISOString(),
          startTime: apt.startTime,
          meetingType: apt.meetingType,
        })),
        recentEvents: recentEvents.map((ev) => ({
          id: ev.id,
          eventType: ev.eventType,
          eventLabel: ev.eventLabel,
          clientName: ev.client.fullName,
          companyName: ev.client.companyName,
          createdAt: ev.createdAt.toISOString(),
        })),
        revenueByMonth,
      }}
    />
  );
}

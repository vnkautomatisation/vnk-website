// Mon espace · Dashboard : actions à faire + résumé personnel.
import { prisma } from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MonEspaceDashboard } from "./dashboard-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Mon espace" };

export default async function MonEspaceHome() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const today = new Date();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - today.getDay());
  startOfWeek.setHours(0, 0, 0, 0);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const [
    me,
    openClock,
    weekHours,
    unsignedDocs,
    pendingContracts,
    expiringLicenses,
    expiringTrainings,
    pendingLeaves,
    recentPayStubs,
    activeAnnouncements,
    upcomingOneOnOnes,
  ] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true, fullName: true, email: true, avatarUrl: true, twoFactorEnabled: true,
        position: { select: { name: true, color: true } },
        customRole: { select: { name: true, color: true } },
        team: { select: { name: true, color: true } },
      },
    }),
    prisma.timeClock.findFirst({
      where: { adminId, clockOut: null },
      orderBy: { clockIn: "desc" },
    }),
    prisma.timeClock.aggregate({
      where: { adminId, clockIn: { gte: startOfWeek }, clockOut: { not: null } },
      _sum: { durationMin: true },
    }),
    prisma.legalDocumentTemplate.findMany({
      where: {
        isActive: true,
        isRequired: true,
        signatures: { none: { adminId } },
      },
      select: { id: true, title: true, version: true },
    }).catch(() => []),
    prisma.employeeContract.findMany({
      where: { adminId, status: "sent" },
      select: { id: true, title: true },
    }).catch(() => []),
    prisma.professionalLicense.findMany({
      where: { adminId, expiresAt: { gte: today, lte: in30Days } },
      select: { id: true, type: true, expiresAt: true },
    }).catch(() => []),
    prisma.trainingRecord.findMany({
      where: { adminId, expiresAt: { gte: today, lte: in30Days } },
      select: { id: true, title: true, expiresAt: true },
    }).catch(() => []),
    prisma.leaveRequest.count({
      where: { adminId, status: "pending" },
    }).catch(() => 0),
    prisma.payStub.findMany({
      where: { adminId, releasedAt: { not: null } },
      orderBy: { createdAt: "desc" },
      take: 3,
      select: { id: true, netPay: true, period: { select: { startDate: true, endDate: true } } },
    }).catch(() => []),
    prisma.announcement.findMany({
      where: {
        publishedAt: { not: null, lte: today },
        OR: [
          { expiresAt: null },
          { expiresAt: { gte: today } },
        ],
      },
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }],
      take: 5,
      select: {
        id: true, title: true, category: true, body: true,
        publishedAt: true, pinned: true,
        author: { select: { fullName: true, email: true } },
      },
    }).catch(() => []),
    prisma.oneOnOneMeeting.findMany({
      where: {
        OR: [{ adminId }, { managerId: adminId }],
        scheduledAt: { gte: today },
        status: "scheduled",
      },
      orderBy: { scheduledAt: "asc" },
      take: 3,
      select: {
        id: true, scheduledAt: true, durationMin: true,
        admin: { select: { id: true, fullName: true, email: true } },
        manager: { select: { id: true, fullName: true, email: true } },
      },
    }).catch(() => []),
  ]);

  if (!me) redirect("/admin/login");

  return (
    <MonEspaceDashboard
      me={JSON.parse(JSON.stringify(me))}
      openClock={openClock ? JSON.parse(JSON.stringify(openClock)) : null}
      weekHours={weekHours?._sum?.durationMin ?? 0}
      unsignedDocs={JSON.parse(JSON.stringify(unsignedDocs))}
      pendingContracts={JSON.parse(JSON.stringify(pendingContracts))}
      expiringLicenses={JSON.parse(JSON.stringify(expiringLicenses))}
      expiringTrainings={JSON.parse(JSON.stringify(expiringTrainings))}
      pendingLeavesCount={pendingLeaves}
      recentPayStubs={JSON.parse(JSON.stringify(recentPayStubs))}
      announcements={JSON.parse(JSON.stringify(activeAnnouncements))}
      upcomingOneOnOnes={JSON.parse(JSON.stringify(upcomingOneOnOnes))}
    />
  );
}

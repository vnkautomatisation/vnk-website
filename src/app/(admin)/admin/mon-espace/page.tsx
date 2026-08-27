// Mon espace · Dashboard : actions à faire + résumé personnel.
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { useTranslations } from "next-intl";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { MonEspaceDashboard } from "./dashboard-view";
import { getLeaveBalance } from "@/lib/services/leave-balance";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("mon_espace") };
}

export default async function MonEspaceHome() {
  const t = await getTranslations("admin.my_dashboard");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") redirect("/admin/login");
  const adminId = session.user.adminId!;

  const today = new Date();

  const dayIndex = today.getDay(); // 0 = Sunday
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - dayIndex);
  startOfWeek.setHours(0, 0, 0, 0);
  const in30Days = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);





  const [
    me,
    openClock,
    weekHours,
    pendingContracts,
    expiringLicenses,
    expiringTrainings,
    pendingLeaves,
    recentPayStubs,
    activeAnnouncements,
    upcomingOneOnOnes,
    leaveBalance,
    myEquipment,
    teamAdmins,
    taxDocuments,
    emergencyContactsCount,
    bankInfo,
    familyDependentsCount,
  ] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true, fullName: true, email: true, avatarUrl: true, twoFactorEnabled: true,
        birthdate: true,
        positionId: true,
        position: { select: { name: true, color: true } },
        customRole: { select: { name: true, color: true } },
        team: { select: { name: true, color: true } },
        manager: {
          select: {
            id: true, fullName: true, email: true, avatarUrl: true,
            position: { select: { name: true } },
          },
        },
      },
    }),
    prisma.timeClock.findFirst({
      where: { adminId, clockOut: null },
      orderBy: { clockIn: "desc" },
      select: { id: true, clockIn: true, category: true, pausedAt: true, totalBreakMin: true },
    }),
    prisma.timeClock.aggregate({
      where: { adminId, clockIn: { gte: startOfWeek }, clockOut: { not: null } },
      _sum: { durationMin: true },
    }),
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
        reads: { where: { adminId }, take: 1, select: { id: true } },
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
    getLeaveBalance(adminId).catch(() => null),
    prisma.assignedEquipment.findMany({
      where: { adminId, returnedAt: null },
      take: 5,
      orderBy: { assignedAt: "desc" },
      select: { id: true, category: true, name: true, brand: true, model: true },
    }).catch(() => []),
    prisma.admin.findMany({
      where: { isActive: true, id: { not: adminId }, birthdate: { not: null } },
      select: {
        id: true, fullName: true, email: true, avatarUrl: true, birthdate: true,
        position: { select: { name: true } },
      },
    }).catch(() => []),
    prisma.taxDocument.findMany({
      where: { adminId },
      orderBy: { issuedAt: "desc" },
      take: 3,
      select: { id: true, type: true, taxYear: true, title: true, fileUrl: true, issuedAt: true },
    }).catch(() => []),
    prisma.emergencyContact.count({ where: { adminId } }).catch(() => 0),
    prisma.bankInfo.findUnique({ where: { adminId }, select: { id: true } }).catch(() => null),
    prisma.familyDependent.count({ where: { adminId } }).catch(() => 0),
  ]);



  const [pendingUploadRequests, pendingSignatureRequests, recentNotifications] = await Promise.all([
    prisma.documentUploadRequest.findMany({
      where: { targetAdminId: adminId, status: "pending" },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      select: {
        id: true, title: true, dueDate: true, isRequired: true, category: true,
        requestedBy: { select: { fullName: true, email: true } },
      },
    }).catch(() => []),
    prisma.documentSignatureRequest.findMany({
      where: {
        completedAt: null,
        status: "pending",
        OR: [{ targetAdminId: adminId }, { targetAll: true }],
      },
      orderBy: [{ dueDate: "asc" }, { requestedAt: "desc" }],
      select: {
        id: true, dueDate: true, reason: true, targetAll: true,
        template: { select: { id: true, title: true, version: true } },
      },
    }).catch(() => []),
    prisma.notification.findMany({
      where: { recipientType: "admin", recipientId: adminId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, title: true, body: true, type: true, link: true, icon: true, createdAt: true, readAt: true },
    }).catch(() => []),
  ]);


  const signedTemplateIds = await prisma.legalDocumentSignature.findMany({
    where: { adminId, templateId: { in: pendingSignatureRequests.map((r) => r.template.id) } },
    select: { templateId: true, version: true },
  }).catch(() => []);
  const signedByTemplate = new Map(signedTemplateIds.map((s) => [s.templateId, s.version]));
  const filteredSignatureRequests = pendingSignatureRequests.filter(
    (r) => signedByTemplate.get(r.template.id) !== r.template.version,
  );



  const unsignedDocs: Array<{ id: number; title: string; version: string }> = [];
  const seenUnsigned = new Set<number>();
  for (const r of filteredSignatureRequests) {
    if (seenUnsigned.has(r.template.id)) continue;
    seenUnsigned.add(r.template.id);
    unsignedDocs.push({
      id: r.template.id,
      title: r.template.title,
      version: r.template.version,
    });
  }

  if (!me) redirect("/admin/login");


  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const upcomingBirthdays = teamAdmins
    .filter((e) => e.birthdate)
    .map((e) => {
      const bd = new Date(e.birthdate!);
      const next = new Date(todayMidnight.getFullYear(), bd.getMonth(), bd.getDate());
      if (next < todayMidnight) next.setFullYear(todayMidnight.getFullYear() + 1);
      const daysUntil = Math.round((next.getTime() - todayMidnight.getTime()) / 86400000);
      const turningAge = next.getFullYear() - bd.getFullYear();
      return {
        id: e.id,
        fullName: e.fullName,
        email: e.email,
        avatarUrl: e.avatarUrl,
        positionName: e.position?.name ?? null,
        nextBirthday: next.toISOString(),
        daysUntil,
        turningAge,
      };
    })
    .filter((b) => b.daysUntil <= 14)
    .sort((a, b) => a.daysUntil - b.daysUntil);


  const completionSteps = [
    { key: "photo", label: t("ajouter_photo_profil"), href: "/admin/profile", done: !!me.avatarUrl, weight: 20 },
    { key: "emergency", label: t("contact_urgence"), href: "/admin/mon-espace/urgence", done: emergencyContactsCount > 0, weight: 20 },
    { key: "bank", label: t("informations_bancaires_depot_direct"), href: "/admin/mon-espace/bancaire", done: !!bankInfo, weight: 20 },
    { key: "2fa", label: t("activer_double_authentification"), href: "/admin/settings/security", done: me.twoFactorEnabled, weight: 20 },
    { key: "family", label: t("personnes_charge_assurance"), href: "/admin/mon-espace/famille", done: familyDependentsCount > 0, weight: 10 },
    { key: "birthdate", label: t("date_naissance"), href: "/admin/profile", done: !!me.birthdate, weight: 10 },
  ];
  const completionPct = completionSteps.reduce((sum, s) => sum + (s.done ? s.weight : 0), 0);






  const MAX_OPEN_SHIFT_MIN = 16 * 60; // 16h, journee max raisonnable
  const closedMin = weekHours?._sum?.durationMin ?? 0;
  let openMin = 0;
  if (openClock && openClock.clockIn >= startOfWeek) {

    const refMs = openClock.pausedAt ? openClock.pausedAt.getTime() : today.getTime();
    const elapsed = Math.floor((refMs - openClock.clockIn.getTime()) / 60000);
    const worked = Math.max(0, elapsed - (openClock.totalBreakMin ?? 0));
    openMin = Math.min(worked, MAX_OPEN_SHIFT_MIN);
  }
  const weekHoursTotal = closedMin + openMin;


  const availableJobCodes = me.positionId
    ? await prisma.jobCode.findMany({
        where: { positionId: me.positionId, isActive: true },
        orderBy: [{ sortOrder: "asc" }, { code: "asc" }],
        select: { id: true, code: true, label: true },
      }).catch(() => [])
    : [];

  return (
    <MonEspaceDashboard
      me={JSON.parse(JSON.stringify(me))}
      openClock={openClock ? JSON.parse(JSON.stringify(openClock)) : null}
      weekHours={weekHoursTotal}
      availableJobCodes={availableJobCodes}
      unsignedDocs={JSON.parse(JSON.stringify(unsignedDocs))}
      pendingContracts={JSON.parse(JSON.stringify(pendingContracts))}
      expiringLicenses={JSON.parse(JSON.stringify(expiringLicenses))}
      expiringTrainings={JSON.parse(JSON.stringify(expiringTrainings))}
      pendingLeavesCount={pendingLeaves}
      recentPayStubs={JSON.parse(JSON.stringify(recentPayStubs))}
      announcements={JSON.parse(JSON.stringify(activeAnnouncements))}
      upcomingOneOnOnes={JSON.parse(JSON.stringify(upcomingOneOnOnes))}
      leaveBalance={leaveBalance ? JSON.parse(JSON.stringify(leaveBalance)) : null}
      myEquipment={JSON.parse(JSON.stringify(myEquipment))}
      upcomingBirthdays={JSON.parse(JSON.stringify(upcomingBirthdays))}
      taxDocuments={JSON.parse(JSON.stringify(taxDocuments))}
      completionPct={completionPct}
      completionSteps={JSON.parse(JSON.stringify(completionSteps))}
      pendingUploadRequests={JSON.parse(JSON.stringify(pendingUploadRequests))}
      pendingSignatureRequests={JSON.parse(JSON.stringify(filteredSignatureRequests))}
      recentNotifications={JSON.parse(JSON.stringify(recentNotifications))}
    />
  );
}

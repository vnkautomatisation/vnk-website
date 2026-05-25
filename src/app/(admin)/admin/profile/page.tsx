// Mon profil admin — banner enrichi + 10 modules (compte, preferences, securite,
// notifications, sessions, activite, confidentialite Loi 25, api tokens, stats, integrations/auto)
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ProfileView } from "./profile-view";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Mon profil",
};

export default async function ProfilePage() {
  const session = await auth();
  const adminId = session!.user.adminId!;

  const [admin, sessions, auditLogs, securityEvents, loginEvents, backupCodes, trustedDevices, apiTokens] = await Promise.all([
    prisma.admin.findUnique({
      where: { id: adminId },
      select: {
        id: true, email: true, fullName: true, role: true,
        twoFactorEnabled: true, avatarUrl: true, lastLogin: true, createdAt: true,
        title: true, phone: true, phoneVerifiedAt: true, bio: true,
        emailSignature: true, presenceStatus: true, presenceMessage: true, presenceUntil: true,
        timezone: true, locale: true, theme: true, accentColor: true,
        defaultLanding: true, notificationPrefs: true, shortcuts: true,
        passwordChangedAt: true, loginAlertsEnabled: true, recoveryEmail: true,
        dataExportRequestedAt: true, marketingOptIn: true, analyticsOptIn: true,
        onboardingDone: true, onboardingSteps: true,
        delegateApprovalTo: true,
      },
    }),
    prisma.adminSession.findMany({
      where: { adminId },
      orderBy: [{ lastActiveAt: "desc" }, { createdAt: "desc" }],
      take: 100, // inclut actives ET historique récent
    }),
    prisma.auditLog.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, action: true, entityType: true, entityId: true, changes: true, ipAddress: true, createdAt: true },
    }),
    prisma.adminSecurityEvent.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.loginEvent.findMany({
      where: { adminId },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.adminBackupCode.findMany({ where: { adminId }, select: { id: true, usedAt: true, createdAt: true } }),
    prisma.adminTrustedDevice.findMany({ where: { adminId }, orderBy: { lastUsedAt: "desc" } }),
    prisma.adminApiToken.findMany({ where: { adminId, revokedAt: null }, orderBy: { createdAt: "desc" } }),
  ]);

  if (!admin) return null;

  // KPI personnels (stats du dernier 30j)
  const since30 = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [requestsHandled, invoicesIssued, revenue30, paymentsAssigned] = await Promise.all([
    prisma.projectRequest.count({ where: { updatedAt: { gte: since30 } } }).catch(() => 0),
    prisma.invoice.count({ where: { createdAt: { gte: since30 } } }).catch(() => 0),
    prisma.invoice.aggregate({ _sum: { amountTtc: true }, where: { paidAt: { gte: since30 }, status: "paid" } }).catch(() => ({ _sum: { amountTtc: null } })),
    prisma.payment.count({ where: { assignedAccountantId: adminId, paidAt: { gte: since30 } } }).catch(() => 0),
  ]);

  const backupCodesActive = backupCodes.filter((c) => !c.usedAt).length;

  // ── Delegation d'approbation : candidats (autres admins actifs ayant autorité review) ─
  const rawCandidates = await prisma.admin.findMany({
    where: { isActive: true, id: { not: adminId } },
    select: {
      id: true,
      fullName: true,
      email: true,
      title: true,
      customRole: { select: { name: true, permissions: true } },
    },
    orderBy: { fullName: "asc" },
  }).catch(() => [] as Array<{ id: number; fullName: string | null; email: string; title: string | null; customRole: { name: string; permissions: unknown } | null }>);
  const delegationCandidates = rawCandidates
    .filter((c) => {
      const perms = (c.customRole?.permissions as Record<string, string[]> | undefined) ?? {};
      const isSuper = c.customRole?.name === "super_admin";
      return isSuper || (perms.leaves ?? []).includes("write") || (perms.users ?? []).includes("write");
    })
    .map(({ id, fullName, email, title }) => ({ id, fullName, email, title }));

  const currentDelegate = admin.delegateApprovalTo
    ? await prisma.admin.findUnique({
        where: { id: admin.delegateApprovalTo },
        select: { id: true, fullName: true, email: true, title: true },
      })
    : null;

  return (
    <ProfileView
      admin={{
        ...admin,
        fullName: admin.fullName,
        lastLogin: admin.lastLogin?.toISOString() ?? null,
        createdAt: admin.createdAt.toISOString(),
        phoneVerifiedAt: admin.phoneVerifiedAt?.toISOString() ?? null,
        presenceUntil: admin.presenceUntil?.toISOString() ?? null,
        passwordChangedAt: admin.passwordChangedAt?.toISOString() ?? null,
        dataExportRequestedAt: admin.dataExportRequestedAt?.toISOString() ?? null,
      }}
      sessions={await Promise.all(sessions.map(async (s) => {
        // Calcul du fingerprint pour matcher avec les appareils de confiance
        const { deviceFingerprint } = await import("@/lib/security/ua-parser");
        const fp = await deviceFingerprint(s.userAgent ?? "", s.ipAddress);
        const trustedMatch = trustedDevices.find((td) => td.fingerprint === fp && new Date(td.expiresAt) > new Date());
        return {
          id: s.id, userAgent: s.userAgent, ipAddress: s.ipAddress,
          createdAt: s.createdAt.toISOString(), expiresAt: s.expiresAt.toISOString(),
          lastActiveAt: s.lastActiveAt?.toISOString() ?? null,
          browser: s.browser, os: s.os, deviceType: s.deviceType,
          country: s.country, city: s.city, label: s.label,
          isCurrent: session?.user?.sessionId === s.id,
          isTrusted: !!trustedMatch,
          trustedUntil: trustedMatch?.expiresAt.toISOString() ?? null,
        };
      }))}
      auditLogs={auditLogs.map((l) => ({
        id: l.id, action: l.action, entityType: l.entityType, entityId: l.entityId,
        changes: l.changes, ipAddress: l.ipAddress, createdAt: l.createdAt.toISOString(),
      }))}
      securityEvents={securityEvents.map((e) => ({
        id: e.id, type: e.type, severity: e.severity, message: e.message,
        metadata: e.metadata, ipAddress: e.ipAddress, country: e.country, city: e.city,
        createdAt: e.createdAt.toISOString(),
      }))}
      loginEvents={loginEvents.map((e) => ({
        id: e.id, type: e.type, reason: e.reason, ipAddress: e.ipAddress, userAgent: e.userAgent,
        country: e.country, city: e.city, deviceType: e.deviceType,
        createdAt: e.createdAt.toISOString(),
      }))}
      backupCodesCount={backupCodesActive}
      trustedDevices={trustedDevices.map((d) => ({
        id: d.id, fingerprint: d.fingerprint, label: d.label,
        lastUsedAt: d.lastUsedAt.toISOString(), expiresAt: d.expiresAt.toISOString(),
        createdAt: d.createdAt.toISOString(),
      }))}
      apiTokens={apiTokens.map((t) => ({
        id: t.id, name: t.name, prefix: t.prefix, scopes: t.scopes as string[],
        lastUsedAt: t.lastUsedAt?.toISOString() ?? null,
        expiresAt: t.expiresAt?.toISOString() ?? null,
        createdAt: t.createdAt.toISOString(),
      }))}
      personalKpis={{
        requestsHandled,
        invoicesIssued,
        revenue30: Number(revenue30._sum.amountTtc ?? 0),
        paymentsAssigned,
      }}
      delegation={{
        candidates: delegationCandidates,
        currentDelegate,
      }}
    />
  );
}

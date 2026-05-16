// API · Export Loi 25 — donnees personnelles admin en JSON
// Art. 27 Loi 25 (portabilite des donnees). Genere un dump
// complet de toutes les donnees liees a l'admin connecte.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const adminId = session.user.adminId!;

  try {
    const [admin, sessions, auditLogs, securityEvents, loginEvents, backupCodes, trustedDevices, apiTokens] = await Promise.all([
      prisma.admin.findUnique({
        where: { id: adminId },
        select: {
          id: true, email: true, fullName: true, role: true, isActive: true,
          twoFactorEnabled: true, avatarUrl: true, title: true, phone: true,
          phoneVerifiedAt: true, bio: true, emailSignature: true,
          presenceStatus: true, presenceMessage: true, presenceUntil: true,
          timezone: true, locale: true, theme: true, accentColor: true,
          defaultLanding: true, notificationPrefs: true, shortcuts: true,
          passwordChangedAt: true, failedLoginAttempts: true,
          loginAlertsEnabled: true, recoveryEmail: true,
          dataExportRequestedAt: true, marketingOptIn: true, analyticsOptIn: true,
          onboardingDone: true, onboardingSteps: true,
          lastLogin: true, createdAt: true, updatedAt: true,
        },
      }),
      prisma.adminSession.findMany({
        where: { adminId },
        select: { id: true, userAgent: true, ipAddress: true, browser: true, os: true, deviceType: true, country: true, city: true, label: true, lastActiveAt: true, expiresAt: true, createdAt: true },
      }),
      prisma.auditLog.findMany({
        where: { adminId },
        orderBy: { createdAt: "desc" },
        take: 5000,
        select: { id: true, action: true, entityType: true, entityId: true, changes: true, ipAddress: true, userAgent: true, createdAt: true },
      }),
      prisma.adminSecurityEvent.findMany({
        where: { adminId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.loginEvent.findMany({
        where: { adminId },
        orderBy: { createdAt: "desc" },
        take: 5000,
      }),
      prisma.adminBackupCode.findMany({
        where: { adminId },
        select: { id: true, usedAt: true, createdAt: true }, // pas de hash dans export
      }),
      prisma.adminTrustedDevice.findMany({ where: { adminId } }),
      prisma.adminApiToken.findMany({
        where: { adminId },
        select: { id: true, name: true, prefix: true, scopes: true, lastUsedAt: true, lastUsedIp: true, expiresAt: true, revokedAt: true, createdAt: true },
      }),
    ]);

    const payload = {
      _meta: {
        export_version: "1.0",
        exported_at: new Date().toISOString(),
        admin_id: adminId,
        legal_basis: "Loi 25 (Quebec) — Loi modernisant des dispositions legislatives en matiere de protection des renseignements personnels, art. 27 (portabilite)",
        contact_dpo: "privacy@vnkautomatisation.ca",
      },
      admin,
      sessions,
      audit_logs: auditLogs,
      security_events: securityEvents,
      login_events: loginEvents,
      backup_codes: backupCodes,
      trusted_devices: trustedDevices,
      api_tokens: apiTokens,
    };

    await logSecurityEvent({
      adminId,
      type: "data_export_ready",
      severity: "info",
      message: "Export Loi 25 telecharge",
    });

    await prisma.admin.update({
      where: { id: adminId },
      data: { dataExportReadyAt: new Date() },
    });

    const filename = `vnk-export-loi25-${admin?.email.replace(/[^a-z0-9]/gi, "_")}-${Date.now()}.json`;
    return new NextResponse(JSON.stringify(payload, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (err) {
    console.error("[data-export]", err);
    return NextResponse.json({ error: "Erreur lors de l'export" }, { status: 500 });
  }
}

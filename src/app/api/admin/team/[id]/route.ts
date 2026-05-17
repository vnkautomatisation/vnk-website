// API · Détail d'un utilisateur admin (pour le drawer fiche).
// Renvoie : profil étendu · stats · sessions actives · 10 derniers audit logs · security events
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id: idStr } = await params;
  const id = Number(idStr);
  if (isNaN(id)) return NextResponse.json({ error: "ID invalide" }, { status: 400 });

  try {
    // ── Fenêtre de 30 jours pour les KPI productivité ──
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [
      admin,
      sessionsCount,
      activeSessions,
      auditCount,
      recentAudits,
      recentEvents,
      assignedPayments,
      timeEntries30d,
      auditActions30d,
      loginEvents30d,
      messagesSent30d,
    ] = await Promise.all([
      prisma.admin.findUnique({
        where: { id },
        select: {
          id: true, email: true, fullName: true, isActive: true,
          avatarUrl: true, title: true, phone: true, department: true, bio: true,
          presenceStatus: true, presenceMessage: true, presenceUntil: true,
          twoFactorEnabled: true, lastLogin: true,
          startDate: true, endDate: true, internalNotes: true,
          locale: true, timezone: true, theme: true,
          lockedUntil: true, failedLoginAttempts: true,
          passwordChangedAt: true, sessionsInvalidatedAt: true,
          recoveryEmail: true, loginAlertsEnabled: true, defaultLanding: true,
          createdAt: true, updatedAt: true,
          customRole: {
            select: {
              id: true, name: true, color: true,
              description: true, permissions: true, isSystem: true,
            },
          },
          position: { select: { id: true, name: true, color: true, defaultDepartment: true } },
        },
      }),
      prisma.adminSession.count({ where: { adminId: id } }),
      prisma.adminSession.findMany({
        where: { adminId: id, expiresAt: { gt: new Date() } },
        orderBy: { lastActiveAt: "desc" },
        take: 5,
        select: {
          id: true, browser: true, os: true, deviceType: true,
          ipAddress: true, country: true, city: true,
          lastActiveAt: true, createdAt: true, expiresAt: true,
          label: true, isCurrent: true,
        },
      }),
      prisma.auditLog.count({ where: { adminId: id } }),
      prisma.auditLog.findMany({
        where: { adminId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, action: true, entityType: true, entityId: true,
          ipAddress: true, createdAt: true,
        },
      }),
      prisma.adminSecurityEvent.findMany({
        where: { adminId: id },
        orderBy: { createdAt: "desc" },
        take: 10,
        select: {
          id: true, type: true, severity: true, message: true,
          ipAddress: true, country: true, city: true, createdAt: true,
        },
      }),
      prisma.payment.count({ where: { assignedAccountantId: id } }).catch(() => 0),
      // KPI : heures saisies sur 30j (somme des durationMin / 60)
      prisma.timeEntry
        .aggregate({
          where: { adminId: id, startedAt: { gte: since30d } },
          _sum: { durationMin: true },
          _count: { _all: true },
        })
        .catch(() => null),
      // KPI : nombre d'actions admin (audit) sur 30j
      prisma.auditLog
        .count({ where: { adminId: id, createdAt: { gte: since30d } } })
        .catch(() => 0),
      // KPI : nombre de connexions réussies sur 30j
      prisma.loginEvent
        .count({
          where: {
            adminId: id,
            type: "success",
            createdAt: { gte: since30d },
          },
        })
        .catch(() => 0),
      // KPI : messages internes envoyés (chat client) -- approximation via auditLog ?
      // Pas de champ adminId sur Message, on retombe sur 0
      Promise.resolve(0),
    ]);

    if (!admin) return NextResponse.json({ error: "Utilisateur introuvable" }, { status: 404 });

    const hoursLogged30d = timeEntries30d?._sum?.durationMin ? Math.round((timeEntries30d._sum.durationMin / 60) * 10) / 10 : 0;
    const timeEntriesCount30d = timeEntries30d?._count?._all ?? 0;

    return NextResponse.json({
      admin,
      stats: {
        sessionsCount,
        auditCount,
        assignedPayments,
        // ── KPI productivité (30 derniers jours) ──
        kpi30d: {
          hoursLogged: hoursLogged30d,
          timeEntries: timeEntriesCount30d,
          actions: auditActions30d,
          logins: loginEvents30d,
          messages: messagesSent30d,
        },
      },
      activeSessions,
      recentAudits,
      recentEvents,
    });
  } catch (err) {
    console.error("[team-detail]", err);
    return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
  }
}

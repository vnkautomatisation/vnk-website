// GET /api/profile/me — données complètes de l'admin connecté pour rendu côté client
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }

  const admin = await prisma.admin.findUnique({
    where: { id: session.user.adminId! },
    select: {
      id: true, email: true, fullName: true, role: true, twoFactorEnabled: true,
      avatarUrl: true, lastLogin: true, createdAt: true,
      title: true, phone: true, phoneVerifiedAt: true, bio: true,
      emailSignature: true, presenceStatus: true, presenceMessage: true, presenceUntil: true,
      timezone: true, locale: true, theme: true, accentColor: true,
      defaultLanding: true, notificationPrefs: true, shortcuts: true,
      passwordChangedAt: true, loginAlertsEnabled: true, recoveryEmail: true,
      dataExportRequestedAt: true, marketingOptIn: true, analyticsOptIn: true,
      onboardingDone: true, onboardingSteps: true,
    },
  });
  if (!admin) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  return NextResponse.json({
    admin: {
      ...admin,
      lastLogin: admin.lastLogin?.toISOString() ?? null,
      createdAt: admin.createdAt.toISOString(),
      phoneVerifiedAt: admin.phoneVerifiedAt?.toISOString() ?? null,
      presenceUntil: admin.presenceUntil?.toISOString() ?? null,
      passwordChangedAt: admin.passwordChangedAt?.toISOString() ?? null,
      dataExportRequestedAt: admin.dataExportRequestedAt?.toISOString() ?? null,
    },
  });
}

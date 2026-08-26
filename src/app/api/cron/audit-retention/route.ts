// ─────────────────────────────────────────────────────────
// CRON · Audit retention (Loi 25 — conservation limitée)
// Purge automatique :
//  - AuditLog            > 2 ans
//  - AdminSecurityEvent  > 2 ans
//  - LoginEvent          > 2 ans
//  - PasswordResetToken  utilisés / expirés depuis > 30 jours
//  - AdminInvitation     expirées depuis > 90 jours
//
// Sécurité : token Bearer requis (CRON_SECRET).
// Appel attendu : Railway cron une fois par jour.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const RETENTION_YEARS = 2;
const RESET_TOKEN_GRACE_DAYS = 30;
const INVITATION_GRACE_DAYS = 90;

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 60 * 60 * 1000);
}

export async function POST(req: Request) {
  // Auth via CRON_SECRET
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return unauthorizedJson();
  }

  const cutoff = daysAgo(RETENTION_YEARS * 365);
  const resetCutoff = daysAgo(RESET_TOKEN_GRACE_DAYS);
  const inviteCutoff = daysAgo(INVITATION_GRACE_DAYS);

  const results: Record<string, number> = {};

  // AuditLog (sauf catégories "permanentes" — conformité Loi 25)
  const PERMANENT_ENTITIES = ["admin_anonymized", "admin_data_export", "admin_break_glass"];
  const audit = await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      NOT: { entityType: { in: PERMANENT_ENTITIES } },
    },
  });
  results.auditLog = audit.count;

  const sec = await prisma.adminSecurityEvent.deleteMany({
    where: {
      createdAt: { lt: cutoff },
      // Conserver les critiques pour traçabilité indéfinie
      severity: { not: "critical" },
    },
  });
  results.adminSecurityEvent = sec.count;

  const login = await prisma.loginEvent.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  results.loginEvent = login.count;

  // Tokens reset MDP : on garde 30 jours après usage/expiration
  try {
    const reset = await prisma.passwordResetToken.deleteMany({
      where: {
        OR: [
          { usedAt: { lt: resetCutoff } },
          { expiresAt: { lt: resetCutoff } },
        ],
      },
    });
    results.passwordResetToken = reset.count;
  } catch {
    results.passwordResetToken = 0;
  }

  // Invitations : on garde 90 jours après expiration / révocation
  const invite = await prisma.adminInvitation.deleteMany({
    where: {
      OR: [
        { acceptedAt: null, expiresAt: { lt: inviteCutoff } },
        { revokedAt: { lt: inviteCutoff } },
      ],
    },
  });
  results.adminInvitation = invite.count;

  return NextResponse.json({
    success: true,
    retentionYears: RETENTION_YEARS,
    purgedAt: new Date().toISOString(),
    deleted: results,
  });
}

// GET pour usage manuel/test (renvoie le compte qui SERAIT supprimé sans rien faire)
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorizedJson();

  const cutoff = daysAgo(RETENTION_YEARS * 365);
  const resetCutoff = daysAgo(RESET_TOKEN_GRACE_DAYS);
  const inviteCutoff = daysAgo(INVITATION_GRACE_DAYS);
  const PERMANENT_ENTITIES = ["admin_anonymized", "admin_data_export", "admin_break_glass"];

  const [auditCount, secCount, loginCount, resetCount, inviteCount] = await Promise.all([
    prisma.auditLog.count({
      where: { createdAt: { lt: cutoff }, NOT: { entityType: { in: PERMANENT_ENTITIES } } },
    }),
    prisma.adminSecurityEvent.count({
      where: { createdAt: { lt: cutoff }, severity: { not: "critical" } },
    }),
    prisma.loginEvent.count({ where: { createdAt: { lt: cutoff } } }),
    prisma.passwordResetToken.count({
      where: { OR: [{ usedAt: { lt: resetCutoff } }, { expiresAt: { lt: resetCutoff } }] },
    }).catch(() => 0),
    prisma.adminInvitation.count({
      where: {
        OR: [
          { acceptedAt: null, expiresAt: { lt: inviteCutoff } },
          { revokedAt: { lt: inviteCutoff } },
        ],
      },
    }),
  ]);

  return NextResponse.json({
    mode: "dry-run",
    retentionYears: RETENTION_YEARS,
    wouldDelete: {
      auditLog: auditCount,
      adminSecurityEvent: secCount,
      loginEvent: loginCount,
      passwordResetToken: resetCount,
      adminInvitation: inviteCount,
    },
  });
}

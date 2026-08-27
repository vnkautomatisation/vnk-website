// ─────────────────────────────────────────────────────────
// POST /api/integrations/[provider]/reveal
// Révèle les credentials d'une intégration après challenge 2FA.
// Body : { method: "totp" | "email", code: string, challengeId?: string }
// Audit log de chaque appel.
// ─────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { verifySync } from "otplib";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { captureRequestContext } from "@/lib/request-context";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";
import { decryptCredentials, verifyEmailChallenge } from "@/lib/security/crypto";
import { consumeBackupCode } from "@/lib/security/backup-codes";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const schema = z.object({
  method: z.enum(["totp", "email", "backup"]),
  code: z.string().min(1).max(64),
  challengeId: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: Promise<{ provider: string }> }) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const adminId = session.user.adminId!;
  const { provider } = await params;

  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("requete_invalide") }, { status: 400 });
  }

  // ── Vérification du challenge ────────────────────────
  let valid = false;
  let methodLabel = "";

  if (parsed.data.method === "totp") {
    const admin = await prisma.admin.findUnique({
      where: { id: adminId },
      select: { twoFactorSecret: true, twoFactorEnabled: true },
    });
    if (!admin?.twoFactorEnabled || !admin.twoFactorSecret) {
      return NextResponse.json({ error: t("2fa_non_activee_utilisez_un_code_par") }, { status: 400 });
    }
    const res = verifySync({ token: parsed.data.code, secret: admin.twoFactorSecret });
    valid = typeof res === "boolean" ? res : (res as { delta?: number } | null) !== null;
    methodLabel = "TOTP";
  } else if (parsed.data.method === "email") {
    if (!parsed.data.challengeId) {
      return NextResponse.json({ error: t("identifiant_de_defi_manquant") }, { status: 400 });
    }
    valid = verifyEmailChallenge(parsed.data.challengeId, parsed.data.code, adminId, `reveal:${provider}`);
    methodLabel = "Code courriel";
  } else if (parsed.data.method === "backup") {
    valid = await consumeBackupCode(adminId, parsed.data.code);
    methodLabel = t("code_de_recuperation");
  }

  if (!valid) {
    await logSecurityEvent({
      adminId,
      type: "login_failed",
      severity: "warning",
      message: `Tentative de révélation des secrets ${provider} — échec ${methodLabel}`,
      metadata: { provider, method: parsed.data.method },
    });
    return NextResponse.json({ error: t("code_invalide_ou_expire") }, { status: 401 });
  }

  // ── Récupération + déchiffrement ─────────────────────
  const integ = await prisma.integration.findUnique({ where: { provider } });
  if (!integ) {
    return NextResponse.json({ error: t("integration_introuvable") }, { status: 404 });
  }

  const decrypted = decryptCredentials((integ.credentials as Record<string, string>) ?? {});

  // ── Audit log + security event ───────────────────────
  const ctx = captureRequestContext(req);
  await logAudit({
    adminId,
    action: "export",
    entityType: "integration",
    entityId: integ.id,
    changes: { provider, action: "reveal_credentials", method: parsed.data.method },
    ipAddress: ctx.ipAddress,
    userAgent: ctx.userAgent,
  });
  await logSecurityEvent({
    adminId,
    type: "data_export_ready",
    severity: "warning",
    message: `Identifiants ${provider} révélés (méthode : ${methodLabel})`,
    metadata: { provider, method: parsed.data.method },
  });

  return NextResponse.json({ ok: true, credentials: decrypted });
}

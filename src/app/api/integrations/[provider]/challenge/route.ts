// ─────────────────────────────────────────────────────────
// POST /api/integrations/[provider]/challenge
// Génère et envoie un code 6 chiffres par courriel pour
// autoriser la révélation des credentials (alternative à TOTP).
// Le code expire dans 10 min, usage unique.
// ─────────────────────────────────────────────────────────
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/services/email";
import { generateEmailChallenge } from "@/lib/security/crypto";
import { logSecurityEvent } from "@/lib/security/security-events";

export async function POST(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const adminId = session.user.adminId!;
  const { provider } = await params;

  const admin = await prisma.admin.findUnique({
    where: { id: adminId },
    select: { email: true, fullName: true },
  });
  if (!admin) return NextResponse.json({ error: "Compte introuvable" }, { status: 404 });

  // Génère challenge + code
  const challenge = JSON.parse(generateEmailChallenge(adminId, `reveal:${provider}`));

  // Envoi du courriel
  const html = `
    <div style="font-family:system-ui,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:24px;">
      <div style="background:linear-gradient(135deg,#0F2D52,#1A5FB4);color:#fff;padding:24px;border-radius:12px;text-align:center;">
        <h1 style="margin:0;font-size:20px;">Code de vérification VNK</h1>
        <p style="margin:8px 0 0;opacity:.8;font-size:14px;">Révéler les identifiants ${provider}</p>
      </div>
      <p style="margin:24px 0 8px;font-size:14px;color:#333;">Bonjour ${admin.fullName ?? "Yan"},</p>
      <p style="margin:0 0 24px;font-size:14px;color:#555;">
        Vous avez demandé à révéler les identifiants chiffrés de l'intégration <strong>${provider}</strong>.
        Entrez ce code dans le portail pour confirmer&nbsp;:
      </p>
      <div style="background:#f5f5f7;border:2px solid #0F2D52;border-radius:8px;padding:20px;text-align:center;font-family:monospace;font-size:32px;letter-spacing:8px;font-weight:bold;color:#0F2D52;">
        ${challenge.code}
      </div>
      <p style="margin:16px 0 0;font-size:12px;color:#666;text-align:center;">
        Ce code expire dans <strong>10 minutes</strong>.<br>
        Si vous n'êtes pas à l'origine de cette demande, modifiez immédiatement votre mot de passe et révoquez vos sessions.
      </p>
    </div>
  `;
  const res = await sendEmail({
    to: admin.email,
    subject: `Code de vérification ${provider} — VNK`,
    html,
    text: `Code de vérification ${provider} : ${challenge.code} (expire dans 10 min)`,
  });

  if (!res.ok) {
    return NextResponse.json({ error: "Impossible d'envoyer le courriel. Vérifiez la config SMTP." }, { status: 500 });
  }

  await logSecurityEvent({
    adminId,
    type: "data_export_requested",
    severity: "info",
    message: `Code de vérification envoyé par courriel pour ${provider}`,
    metadata: { provider },
  });

  return NextResponse.json({ ok: true, challengeId: challenge.id, sentTo: admin.email });
}

// GET /api/auth/not-me/[token]
// Lien depuis l'email "Nouvelle connexion détectée" — permet à l'admin
// de révoquer une session suspecte d'un simple click depuis sa boîte mail.
// Le token est un HMAC SHA-256 signé avec AUTH_SECRET = sessionId + adminId.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";
import crypto from "crypto";

function verifyNotMeToken(token: string): { sessionId: string; adminId: number } | null {
  try {
    const [payload, sig] = token.split(".");
    if (!payload || !sig) return null;
    const expected = crypto
      .createHmac("sha256", process.env.AUTH_SECRET ?? "fallback")
      .update(payload)
      .digest("base64url");
    if (expected !== sig) return null;
    const data = JSON.parse(Buffer.from(payload, "base64url").toString("utf-8"));
    if (typeof data.sessionId !== "string" || typeof data.adminId !== "number") return null;
    // Expiration : 7 jours
    if (typeof data.iat !== "number" || Date.now() - data.iat > 7 * 24 * 60 * 60 * 1000) return null;
    return { sessionId: data.sessionId, adminId: data.adminId };
  } catch {
    return null;
  }
}

export function buildNotMeToken(sessionId: string, adminId: number): string {
  const payload = Buffer.from(JSON.stringify({ sessionId, adminId, iat: Date.now() })).toString("base64url");
  const sig = crypto
    .createHmac("sha256", process.env.AUTH_SECRET ?? "fallback")
    .update(payload)
    .digest("base64url");
  return `${payload}.${sig}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = verifyNotMeToken(token);
  if (!verified) {
    return NextResponse.redirect(new URL("/admin/login?not_me_expired=1", req.url));
  }

  try {
    // Vérifier que la session existe et appartient bien à cet admin
    const session = await prisma.adminSession.findUnique({
      where: { id: verified.sessionId },
    });

    if (session && session.adminId === verified.adminId) {
      // Révoque la session
      await prisma.adminSession.delete({ where: { id: verified.sessionId } });
    }

    // Log security event critical (même si la session n'existe plus)
    await logSecurityEvent({
      adminId: verified.adminId,
      type: "suspicious_login",
      severity: "critical",
      message: `Connexion signalée comme non autorisée via courriel (« Ce n'était pas moi »). Session révoquée.`,
      metadata: {
        sessionId: verified.sessionId,
        userAgent: session?.userAgent,
        ipAddress: session?.ipAddress,
        country: session?.country,
        city: session?.city,
        reportedVia: "email_link",
      },
    });

    // Bumper le timestamp d'invalidation globale pour révoquer tous les JWT existants
    await prisma.admin.update({
      where: { id: verified.adminId },
      data: { sessionsInvalidatedAt: new Date() },
    }).catch(() => null);

    return NextResponse.redirect(new URL("/admin/login?not_me=success", req.url));
  } catch {
    return NextResponse.redirect(new URL("/admin/login?not_me_error=1", req.url));
  }
}

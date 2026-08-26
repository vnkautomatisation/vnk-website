// GET /api/auth/not-me/[token]
// The "Ce n'etait pas moi" link in the new-login email: one click from the
// mailbox revokes the suspicious session.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logSecurityEvent } from "@/lib/security/security-events";
import { verifyNotMeToken } from "@/lib/security/not-me-token";

export async function GET(req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const verified = verifyNotMeToken(token);
  if (!verified) {
    return NextResponse.redirect(new URL("/admin/login?not_me_expired=1", req.url));
  }

  try {
    // The session must exist and belong to that admin.
    const session = await prisma.adminSession.findUnique({
      where: { id: verified.sessionId },
    });

    if (session && session.adminId === verified.adminId) {
      // Revoke it.
      await prisma.adminSession.delete({ where: { id: verified.sessionId } });
    }

    // Critical security event, logged even when the session is already gone.
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

    // Bump the global invalidation stamp so every existing JWT dies too.
    await prisma.admin.update({
      where: { id: verified.adminId },
      data: { sessionsInvalidatedAt: new Date() },
    }).catch(() => null);

    return NextResponse.redirect(new URL("/admin/login?not_me=success", req.url));
  } catch {
    return NextResponse.redirect(new URL("/admin/login?not_me_error=1", req.url));
  }
}

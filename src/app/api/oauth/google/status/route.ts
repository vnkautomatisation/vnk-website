// GET /api/oauth/google/status + DELETE
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGoogleStatus, disconnectGoogle, isGoogleAppConfigured, getGoogleRedirectUri } from "@/lib/integrations/google";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  try {
    const status = await getGoogleStatus();
    const configured = await isGoogleAppConfigured();
    const origin = new URL(req.url).origin;
    return NextResponse.json({
      connected: status.connected,
      accountEmail: status.accountEmail,
      expiresAt: status.expiresAt?.toISOString() ?? null,
      configured,
      redirectUri: getGoogleRedirectUri(origin),
    });
  } catch {
    return NextResponse.json({ connected: false, configured: false });
  }
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  await disconnectGoogle();
  return NextResponse.json({ ok: true });
}

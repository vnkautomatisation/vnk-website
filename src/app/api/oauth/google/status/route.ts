// GET /api/oauth/google/status + DELETE
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getGoogleStatus, disconnectGoogle, isGoogleAppConfigured, getGoogleRedirectUri } from "@/lib/integrations/google";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
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
    return unauthorizedJson();
  }
  await disconnectGoogle();
  return NextResponse.json({ ok: true });
}

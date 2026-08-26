// GET /api/oauth/microsoft/status — état de connexion Microsoft pour l'UI
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMicrosoftStatus, isMicrosoftAppConfigured, getMicrosoftRedirectUri } from "@/lib/integrations/microsoft";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }

  try {
    const status = await getMicrosoftStatus();
    const configured = await isMicrosoftAppConfigured();
    const origin = new URL(req.url).origin;
    return NextResponse.json({
      connected: status.connected,
      accountEmail: status.accountEmail,
      expiresAt: status.expiresAt?.toISOString() ?? null,
      configured,
      redirectUri: getMicrosoftRedirectUri(origin),
    });
  } catch {
    return NextResponse.json({ connected: false, configured: false });
  }
}

// DELETE — déconnexion
export async function DELETE() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  const { disconnectMicrosoft } = await import("@/lib/integrations/microsoft");
  await disconnectMicrosoft();
  return NextResponse.json({ ok: true });
}

// GET /api/oauth/google/callback
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, storeGoogleTokens } from "@/lib/integrations/google";
import { logSecurityEvent } from "@/lib/security/security-events";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const { searchParams } = new URL(req.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const error = searchParams.get("error");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/profile?tab=integrations&g_error=${encodeURIComponent(error)}`, req.url)
    );
  }
  if (!code || !state) {
    return NextResponse.redirect(new URL("/admin/profile?tab=integrations&g_error=missing_params", req.url));
  }

  const c = await cookies();
  const storedState = c.get("g_oauth_state")?.value;
  c.delete("g_oauth_state");
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/admin/profile?tab=integrations&g_error=invalid_state", req.url));
  }

  try {
    const origin = new URL(req.url).origin;
    const tokens = await exchangeCodeForTokens(code, origin);

    // Récupérer l'email du compte
    let accountEmail: string | undefined;
    try {
      const meRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        accountEmail = me.email;
      }
    } catch { /* non bloquant */ }

    await storeGoogleTokens(tokens, accountEmail);

    await logSecurityEvent({
      adminId: session.user.adminId!,
      type: "preferences_updated",
      severity: "info",
      message: `Google Calendar connecté${accountEmail ? ` (${accountEmail})` : ""}`,
      metadata: { provider: "google_calendar", account: accountEmail },
    });

    return NextResponse.redirect(new URL("/admin/profile?tab=integrations&g_connected=1", req.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.redirect(
      new URL(`/admin/profile?tab=integrations&g_error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}

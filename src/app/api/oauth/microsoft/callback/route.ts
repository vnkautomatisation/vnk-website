// GET /api/oauth/microsoft/callback
// Reçoit le code d'autorisation depuis Microsoft, échange contre
// access_token + refresh_token, stocke chiffrés dans Integration.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { cookies } from "next/headers";
import { exchangeCodeForTokens, storeMicrosoftTokens } from "@/lib/integrations/microsoft";
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
  const errorDesc = searchParams.get("error_description");

  if (error) {
    return NextResponse.redirect(
      new URL(`/admin/profile?tab=integrations&ms_error=${encodeURIComponent(errorDesc ?? error)}`, req.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL("/admin/profile?tab=integrations&ms_error=missing_params", req.url));
  }

  // Validation CSRF du state via cookie httpOnly
  const c = await cookies();
  const storedState = c.get("ms_oauth_state")?.value;
  c.delete("ms_oauth_state");
  if (!storedState || storedState !== state) {
    return NextResponse.redirect(new URL("/admin/profile?tab=integrations&ms_error=invalid_state", req.url));
  }

  try {
    const origin = new URL(req.url).origin;
    const tokens = await exchangeCodeForTokens(code, origin);

    // Récupère l'email du compte connecté pour l'affichage
    let accountEmail: string | undefined;
    try {
      const meRes = await fetch("https://graph.microsoft.com/v1.0/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      if (meRes.ok) {
        const me = await meRes.json();
        accountEmail = me.mail ?? me.userPrincipalName;
      }
    } catch { /* non bloquant */ }

    await storeMicrosoftTokens(tokens, accountEmail);

    await logSecurityEvent({
      adminId: session.user.adminId!,
      type: "preferences_updated",
      severity: "info",
      message: `Microsoft Outlook connecté${accountEmail ? ` (${accountEmail})` : ""}`,
      metadata: { provider: "microsoft_calendar", account: accountEmail },
    });

    return NextResponse.redirect(new URL("/admin/profile?tab=integrations&ms_connected=1", req.url));
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.redirect(
      new URL(`/admin/profile?tab=integrations&ms_error=${encodeURIComponent(msg)}`, req.url)
    );
  }
}

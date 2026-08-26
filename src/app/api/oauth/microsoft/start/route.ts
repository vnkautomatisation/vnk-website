// GET /api/oauth/microsoft/start
// Démarre le flow OAuth Microsoft. Redirige l'utilisateur vers Azure
// pour autoriser l'accès Calendars.ReadWrite + OnlineMeetings.ReadWrite.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { buildAuthorizeUrl } from "@/lib/integrations/microsoft";
import crypto from "crypto";
import { cookies } from "next/headers";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }

  try {
    const state = crypto.randomBytes(32).toString("hex");
    const c = await cookies();
    c.set("ms_oauth_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 600,
      path: "/",
    });

    const origin = new URL(req.url).origin;
    const url = await buildAuthorizeUrl(state, origin);
    return NextResponse.redirect(url);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur";
    return NextResponse.redirect(new URL(`/admin/profile?tab=integrations&ms_error=${encodeURIComponent(msg)}`, req.url));
  }
}

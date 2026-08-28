// GET · Locale switch for the public site and the portal, which share the same
// header. A link, not a script: the header button must work before React
// hydrates - in development a first compile can take tens of seconds, and a
// JS-only button is dead until then.
import { NextRequest, NextResponse } from "next/server";
import { LOCALE_COOKIES } from "@/i18n/request";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_LOCALES = ["fr", "en"] as const;

export async function GET(request: NextRequest) {
  const to = request.nextUrl.searchParams.get("to");
  const next = request.nextUrl.searchParams.get("next") || "/";
  // Le portail ignore le cookie public : sans cette portee, son bouton de
  // langue ecrivait la preference du site et ne changeait rien a l'ecran.
  const scope = request.nextUrl.searchParams.get("scope") === "portal" ? "portal" : "public";

  if (!VALID_LOCALES.includes(to as (typeof VALID_LOCALES)[number])) {
    return NextResponse.redirect(new URL("/", request.url));
  }
  // Only same-origin paths, never an absolute URL from the query string.
  const target = next.startsWith("/") && !next.startsWith("//") ? next : "/";

  // Un client connecte garde sa langue en base, donc elle le suit d'un appareil
  // a l'autre ; le cookie ne couvre que la page de connexion, hors session.
  if (scope === "portal") {
    try {
      const session = await auth();
      if (session?.user?.role === "client" && session.user.clientId) {
        await prisma.client.update({
          where: { id: session.user.clientId },
          data: { locale: `${to}-CA` },
        });
      }
    } catch { /* le cookie ci-dessous prend le relais */ }
  }

  const response = NextResponse.redirect(new URL(target, request.url));
  response.cookies.set(LOCALE_COOKIES[scope], to as string, {
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
    sameSite: "lax",
  });
  return response;
}

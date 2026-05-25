import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth cookie check
  const sessionCookie =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  // ── /admin/* : AUTH DESACTIVEE TEMPORAIREMENT ──
  // Le check de session a ete retire — n'importe qui accede a /admin.
  // A reactiver quand l'auth aura ete reconstruite (cf. src/lib/auth.ts).
  if (pathname.startsWith("/admin")) {
    // Si quelqu'un essaie d'aller sur /admin/login, on l'envoie directement
    // sur le tableau de bord — le login n'a plus de raison d'etre.
    if (pathname === "/admin/login" || pathname.startsWith("/admin/login/")) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin";
      url.search = "";
      return NextResponse.redirect(url);
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── /portail/login : pas de prefixe locale, pas d'auth ──
  if (pathname === "/portail/login" || pathname.startsWith("/portail/login?")) {
    return NextResponse.next();
  }

  // ── /portail/* : auth check PUIS passer au intl middleware ──
  if (pathname.startsWith("/portail") || pathname.match(/^\/(fr|en)\/portail/)) {
    if (!sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/portail/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    // Passe au intl middleware pour resoudre la locale
    return intlMiddleware(request);
  }

  // ── Site public : next-intl middleware ──
  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/",
    "/(fr|en)/:path*",
    "/portail/:path*",
    "/admin/:path*",
    "/services",
    "/a-propos",
    "/contact",
  ],
};

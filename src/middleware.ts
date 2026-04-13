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

  // ── /admin/* : pas de prefixe locale, auth requise (sauf login) ──
  if (pathname.startsWith("/admin")) {
    if (!pathname.startsWith("/admin/login") && !sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── /portail/* : pas de prefixe locale, auth requise (sauf login) ──
  if (pathname.startsWith("/portail")) {
    if (!pathname.startsWith("/portail/login") && !sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/portail/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Site public : next-intl middleware (FR sans prefixe, EN avec /en) ──
  return intlMiddleware(request);
}

export const config = {
  // Match uniquement les routes qui en ont besoin — skip fichiers statiques, API, images
  matcher: [
    // Public pages (intl)
    "/",
    "/(fr|en)/:path*",
    // Portal + Admin (auth check)
    "/portail/:path*",
    "/admin/:path*",
    // Public pages without locale prefix
    "/services",
    "/a-propos",
    "/contact",
  ],
};

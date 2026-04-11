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

  // ── /admin/* : pas de préfixe locale, auth requise (sauf login) ──
  if (pathname.startsWith("/admin")) {
    if (!pathname.startsWith("/admin/login") && !sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── /portail/* : pas de préfixe locale, auth requise (sauf login) ──
  if (pathname.startsWith("/portail")) {
    if (!pathname.startsWith("/portail/login") && !sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/portail/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    return NextResponse.next();
  }

  // ── Site public : next-intl middleware (FR sans préfixe, EN avec /en) ──
  return intlMiddleware(request);
}

export const config = {
  // Match tous les chemins sauf fichiers statiques et API
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

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

  // ── /portail/* : auth check PUIS passer au intl middleware ──
  if (pathname.startsWith("/portail") || pathname.match(/^\/(fr|en)\/portail/)) {
    if (!pathname.includes("/portail/login") && !sessionCookie) {
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

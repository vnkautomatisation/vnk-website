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

  // ── /admin/* : no locale prefix, sign-in required ──
  // The bypass mirrors lib/auth.ts: development only, and only when asked for
  // explicitly. A production build always enforces the check.
  if (pathname.startsWith("/admin")) {
    const devBypass =
      process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "1";
    if (!devBypass && !pathname.startsWith("/admin/login") && !sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/admin/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    // request.ts reads this header to detect the admin context.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── /portail/login: no locale prefix, no auth ──
  if (pathname === "/portail/login" || pathname.startsWith("/portail/login?")) {
    return NextResponse.next();
  }

  // ── /portail/*: auth check, then the intl middleware ──
  if (pathname.startsWith("/portail") || pathname.match(/^\/(fr|en)\/portail/)) {
    if (!sessionCookie) {
      const url = request.nextUrl.clone();
      url.pathname = "/portail/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    // Hand over to the intl middleware to resolve the locale.
    return intlMiddleware(request);
  }

  // ── Public site ──
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

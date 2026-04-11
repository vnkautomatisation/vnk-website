import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Protected path prefixes (avec ou sans préfixe /en)
const PROTECTED_ADMIN = /^(?:\/en)?\/admin(?!\/login)/;
const PROTECTED_PORTAL = /^(?:\/en)?\/portail(?!\/login)/;

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth check via cookie NextAuth
  const sessionCookie =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  if (PROTECTED_ADMIN.test(pathname) && !sessionCookie) {
    const url = request.nextUrl.clone();
    const isEnglish = pathname.startsWith("/en/");
    url.pathname = isEnglish ? "/en/admin/login" : "/admin/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (PROTECTED_PORTAL.test(pathname) && !sessionCookie) {
    const url = request.nextUrl.clone();
    const isEnglish = pathname.startsWith("/en/");
    url.pathname = isEnglish ? "/en/portail/login" : "/portail/login";
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  return intlMiddleware(request);
}

export const config = {
  // Match tous les chemins sauf :
  // - fichiers statiques (/_next, /api, /favicon.ico, images, etc.)
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};

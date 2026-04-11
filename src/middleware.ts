import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

// Protected path prefixes (after locale segment)
const PROTECTED_ADMIN = /^\/[a-z]{2}\/admin(?!\/login)/;
const PROTECTED_PORTAL = /^\/[a-z]{2}\/portail(?!\/login)/;

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth check : vérifie le cookie de session (NextAuth v5 stocke dans 'authjs.session-token')
  const sessionCookie =
    request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  if (PROTECTED_ADMIN.test(pathname) && !sessionCookie) {
    const url = request.nextUrl.clone();
    const locale = pathname.split("/")[1] || "fr";
    url.pathname = `/${locale}/admin/login`;
    url.searchParams.set("redirect", pathname);
    return NextResponse.redirect(url);
  }

  if (PROTECTED_PORTAL.test(pathname) && !sessionCookie) {
    const url = request.nextUrl.clone();
    const locale = pathname.split("/")[1] || "fr";
    url.pathname = `/${locale}/portail/login`;
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

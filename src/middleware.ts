import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Chaque espace a son cookie : on peut etre connecte a l'admin ET au
  // portail client dans le meme navigateur sans que l'un chasse l'autre.
  // NextAuth fragmente un jeton trop gros en `<nom>.0`, `<nom>.1`. Ne chercher
  // que le nom exact rendait ces sessions invisibles ici alors que la page de
  // connexion, elle, les reassemblait : /admin et /admin/login se renvoyaient
  // la balle indefiniment.
  const hasSession = (base: string) =>
    !!(
      request.cookies.get(base) ||
      request.cookies.get(`__Secure-${base}`) ||
      request.cookies.get(`${base}.0`) ||
      request.cookies.get(`__Secure-${base}.0`)
    );

  const adminSession = hasSession("authjs.session-token");
  const clientSession = hasSession("vnk.portal-session-token");

  // ── /api/* : la surface appelante vient du Referer ──
  // Une requete same-origin porte les cookies des deux espaces. Sans cette
  // detection, une page du portail lirait la session admin et verrait donc
  // toutes les donnees, pas seulement les siennes.
  if (pathname.startsWith("/api")) {
    let caller = pathname;
    const referer = request.headers.get("referer");
    if (referer) {
      try { caller = new URL(referer).pathname; } catch { /* referer illisible */ }
    }
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname.startsWith("/api/portal") ? "/portail" : caller);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── /admin/* : no locale prefix, sign-in required ──
  // The bypass mirrors lib/auth.ts: development only, and only when asked for
  // explicitly. A production build always enforces the check.
  if (pathname.startsWith("/admin")) {
    const devBypass =
      process.env.NODE_ENV !== "production" && process.env.AUTH_DEV_BYPASS === "1";
    if (!devBypass && !pathname.startsWith("/admin/login") && !adminSession) {
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

  // ── /kiosque: shared device, no account, its own locale cookie ──
  if (pathname.startsWith("/kiosque")) {
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── /portail/login: no locale prefix, no auth ──
  if (pathname === "/portail/login" || pathname.startsWith("/portail/login?")) {
    // auth() lit cet en-tete pour savoir quelle session interroger.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    return NextResponse.next({ request: { headers: requestHeaders } });
  }

  // ── /portail/*: auth check, then a fixed rewrite ──
  if (pathname.startsWith("/portail") || pathname.match(/^\/(fr|en)\/portail/)) {
    // The portal shows no locale prefix: fold a prefixed URL back onto the
    // plain one before anything else looks at it.
    const prefixed = pathname.match(/^\/(fr|en)(\/portail.*)$/);
    if (prefixed) {
      const url = request.nextUrl.clone();
      url.pathname = prefixed[2];
      return NextResponse.redirect(url);
    }
    if (!clientSession) {
      const url = request.nextUrl.clone();
      url.pathname = "/portail/login";
      url.searchParams.set("redirect", pathname);
      return NextResponse.redirect(url);
    }
    // Rewrite onto the [locale] segment ourselves rather than letting the intl
    // middleware redirect: its detection would send /portail to /en/portail and
    // the fold above would bounce it straight back. The segment is only a
    // routing artefact here - request.ts picks the real language.
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set("x-pathname", pathname);
    const url = request.nextUrl.clone();
    url.pathname = `/${routing.defaultLocale}${pathname}`;
    return NextResponse.rewrite(url, { request: { headers: requestHeaders } });
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
    "/api/:path*",
    "/kiosque/:path*",
    "/kiosque",
    "/services",
    "/a-propos",
    "/contact",
  ],
};

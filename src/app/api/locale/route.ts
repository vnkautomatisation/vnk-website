// API · Switch locale. One cookie per surface (see i18n/request.ts) so the
// public site, the portal and the kiosk never flip one another. Signed-in
// surfaces also persist the choice, which then follows the person.
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { LOCALE_COOKIES, type LocaleScope } from "@/i18n/request";

const VALID_LOCALES = ["fr", "en"] as const;
type Locale = (typeof VALID_LOCALES)[number];

// "admin" keeps its choice in the database only: no cookie, so the admin
// toggle cannot reach the public site.
const VALID_SCOPES = ["public", "portal", "kiosk", "admin"] as const;

export async function POST(request: NextRequest) {
  try {
    const { locale, scope } = await request.json();

    if (!VALID_LOCALES.includes(locale)) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }
    const target: LocaleScope | "admin" = VALID_SCOPES.includes(scope) ? scope : "public";

    // Only the surface being switched is written: toggling the marketing site
    // must not rewrite the signed-in admin's own preference.
    let persisted = false;
    if (target === "admin" || target === "portal") {
      const session = await auth();
      if (target === "admin" && session?.user?.role === "admin" && session.user.adminId) {
        await prisma.admin.update({
          where: { id: session.user.adminId },
          data: { locale: `${locale as Locale}-CA` },
        });
        persisted = true;
      }
      if (target === "portal" && session?.user?.role === "client" && session.user.clientId) {
        await prisma.client.update({
          where: { id: session.user.clientId },
          data: { locale: `${locale as Locale}-CA` },
        });
        persisted = true;
      }
    }

    const response = NextResponse.json({ ok: true, locale, scope: target, persisted });
    if (target !== "admin") {
      response.cookies.set(LOCALE_COOKIES[target], locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }
    return response;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

// API · Switch locale — cookie NEXT_LOCALE pour le site public,
// préférence en base pour un admin connecté (source de vérité côté /admin).
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const VALID_LOCALES = ["fr", "en"] as const;
type Locale = (typeof VALID_LOCALES)[number];

export async function POST(request: NextRequest) {
  try {
    const { locale } = await request.json();

    if (!VALID_LOCALES.includes(locale)) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }

    // src/i18n/request.ts ignore le cookie sur /admin/* : sans cette écriture
    // le bouton FR/EN de la topbar admin resterait sans effet.
    let persisted = false;
    const session = await auth();
    if (session?.user?.role === "admin" && session.user.adminId) {
      await prisma.admin.update({
        where: { id: session.user.adminId },
        data: { locale: `${locale as Locale}-CA` },
      });
      persisted = true;
    }

    const response = NextResponse.json({ ok: true, locale, persisted });
    response.cookies.set("NEXT_LOCALE", locale, {
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 1 an
      sameSite: "lax",
    });
    return response;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
}

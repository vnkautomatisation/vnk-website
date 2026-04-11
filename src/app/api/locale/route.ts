// API · Switch locale — set NEXT_LOCALE cookie
// Utilisé par admin/portail pour basculer FR/EN sans préfixe URL
import { NextRequest, NextResponse } from "next/server";

const VALID_LOCALES = ["fr", "en"] as const;

export async function POST(request: NextRequest) {
  try {
    const { locale } = await request.json();

    if (!VALID_LOCALES.includes(locale)) {
      return NextResponse.json({ error: "Invalid locale" }, { status: 400 });
    }

    const response = NextResponse.json({ ok: true, locale });
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

// The two refusals every server action and route handler needs.
//
// "Non autorisé" was written out 501 times and "Permission refusée" 104, which
// meant translating the same sentence in 641 places. They live here instead:
// one implementation, one translation, one place to change the wording.
import "server-only";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

/**
 * No session at all.
 *
 * A handful of routes answer 403 with this message, which reads as a
 * mismatch - 403 is "forbidden" - but changing the status would change an API
 * response, so the caller keeps the code it already returned.
 */
export async function unauthorizedJson(status: 401 | 403 = 401): Promise<NextResponse> {
  const t = await getTranslations("errors");
  return NextResponse.json({ error: t("unauthorized") }, { status });
}

/** Signed in, but lacking the permission. */
export async function forbiddenJson(): Promise<NextResponse> {
  const t = await getTranslations("errors");
  return NextResponse.json({ error: t("forbidden") }, { status: 403 });
}

/** The server-action shape of the same two refusals. */
export async function unauthorized(): Promise<{ success: false; error: string }> {
  const t = await getTranslations("errors");
  return { success: false, error: t("unauthorized") };
}

export async function forbidden(): Promise<{ success: false; error: string }> {
  const t = await getTranslations("errors");
  return { success: false, error: t("forbidden") };
}

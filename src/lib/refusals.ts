// The two authorization refusals, shared by every action and route handler.
import "server-only";
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";

/** No session. A few routes answer 403 with it; they keep their status. */
export async function unauthorizedJson(status: 401 | 403 = 401): Promise<NextResponse> {
  const t = await getTranslations("errors");
  return NextResponse.json({ error: t("unauthorized") }, { status });
}

/** Signed in, but lacking the permission. */
export async function forbiddenJson(): Promise<NextResponse> {
  const t = await getTranslations("errors");
  return NextResponse.json({ error: t("forbidden") }, { status: 403 });
}

/** Server-action shape. */
export async function unauthorized(): Promise<{ success: false; error: string }> {
  const t = await getTranslations("errors");
  return { success: false, error: t("unauthorized") };
}

export async function forbidden(): Promise<{ success: false; error: string }> {
  const t = await getTranslations("errors");
  return { success: false, error: t("forbidden") };
}

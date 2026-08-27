// GET /api/fx?currency=USD&date=2026-05-08 — taux de change vers CAD
// GET /api/fx?refresh=1 — force le rafraichissement (vide cache memoire + Next fetch cache)
// GET /api/fx — liste des devises supportées + taux courants
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { getRate, SUPPORTED_CURRENCIES, clearFxCache } from "@/lib/services/fx";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(req: Request) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("finance", "read")) {
    return forbiddenJson();
  }

  const { searchParams } = new URL(req.url);
  const currency = searchParams.get("currency");
  const dateParam = searchParams.get("date");
  const force = searchParams.get("refresh") === "1";
  const date = dateParam ? new Date(dateParam) : undefined;

  if (force) clearFxCache();

  if (currency) {
    const quote = await getRate(currency.toUpperCase(), date, force);
    if (!quote) {
      return NextResponse.json({ error: t("devise_non_supportee_ou_taux_indisponible") }, { status: 404 });
    }
    return NextResponse.json({ currency: currency.toUpperCase(), ...quote });
  }

  // Sinon, retourner les taux courants pour toutes les devises supportées
  const rates: Record<string, { rate: number; source: string; date: string } | null> = {};
  await Promise.all(
    SUPPORTED_CURRENCIES.map(async (c) => {
      const quote = await getRate(c, date, force);
      rates[c] = quote;
    }),
  );

  return NextResponse.json({ rates, fetchedAt: new Date().toISOString() });
}

// GET /api/fx?currency=USD&date=2026-05-08 — taux de change vers CAD
// GET /api/fx — liste des devises supportées + taux courants
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getRate, SUPPORTED_CURRENCIES } from "@/lib/services/fx";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const currency = searchParams.get("currency");
  const dateParam = searchParams.get("date");
  const date = dateParam ? new Date(dateParam) : undefined;

  if (currency) {
    const quote = await getRate(currency.toUpperCase(), date);
    if (!quote) {
      return NextResponse.json({ error: "Devise non supportée ou taux indisponible" }, { status: 404 });
    }
    return NextResponse.json({ currency: currency.toUpperCase(), ...quote });
  }

  // Sinon, retourner les taux courants pour toutes les devises supportées
  const rates: Record<string, { rate: number; source: string; date: string } | null> = {};
  await Promise.all(
    SUPPORTED_CURRENCIES.map(async (c) => {
      const quote = await getRate(c, date);
      rates[c] = quote;
    }),
  );

  return NextResponse.json({ rates, fetchedAt: new Date().toISOString() });
}

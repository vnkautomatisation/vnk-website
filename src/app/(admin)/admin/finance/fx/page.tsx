import { FxView } from "./fx-view";
import { getTranslations } from "next-intl/server";
import type { Metadata } from "next";
import { SUPPORTED_CURRENCIES, getRate } from "@/lib/services/fx";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("devises_fx") };
}
export const dynamic = "force-dynamic";

export default async function FxPage() {
  // Récupère les taux courants pour toutes les devises supportées
  const rates: { currency: string; rate: number | null; source: string | null; date: string | null }[] = [];
  await Promise.all(
    SUPPORTED_CURRENCIES.map(async (c) => {
      const quote = await getRate(c).catch(() => null);
      rates.push({
        currency: c,
        rate: quote?.rate ?? null,
        source: quote?.source ?? null,
        date: quote?.date ?? null,
      });
    }),
  );

  return <FxView rates={rates.sort((a, b) => a.currency.localeCompare(b.currency))} />;
}

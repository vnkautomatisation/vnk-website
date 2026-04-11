import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return { title: t("page_title") };
}

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <>
      <section className="vnk-gradient text-white py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold">{t("hero_title")}</h1>
          <p className="text-lg opacity-90 mt-3">{t("subtitle")}</p>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-5xl">
          <Card>
            <CardContent className="p-8 space-y-6">
              <div>
                <h2 className="text-2xl font-bold">{t("founder_label")}</h2>
                <p className="text-muted-foreground">{t("founder_title")}</p>
              </div>
              <p className="text-base leading-relaxed">
                VNK Automatisation Inc. est une entreprise québécoise
                spécialisée en automatisation industrielle : PLC, SCADA, HMI,
                audit, documentation et refactorisation. Nous accompagnons les
                entreprises industrielles dans la modernisation de leurs
                systèmes de contrôle.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>
    </>
  );
}

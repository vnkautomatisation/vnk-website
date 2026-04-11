import { setRequestLocale, getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";
import { Wrench, FileCheck, Cpu, Clock } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "services" });
  return { title: t("page_title") };
}

const SERVICES = [
  { key: "support_plc", icon: Wrench },
  { key: "audit", icon: FileCheck },
  { key: "documentation", icon: Cpu },
  { key: "refactoring", icon: Clock },
] as const;

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  return (
    <>
      <section className="vnk-gradient text-white py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold">
            {t("services.hero_title")}
          </h1>
        </div>
      </section>

      <section className="py-16">
        <div className="container mx-auto px-4 max-w-5xl space-y-8">
          {SERVICES.map((svc) => {
            const Icon = svc.icon;
            return (
              <Card key={svc.key} id={svc.key.replace("_", "-")} className="overflow-hidden">
                <CardContent className="p-8">
                  <div className="flex items-start gap-5">
                    <div className="h-14 w-14 rounded-xl vnk-gradient text-white flex items-center justify-center shrink-0">
                      <Icon className="h-7 w-7" />
                    </div>
                    <div className="flex-1">
                      <h2 className="text-2xl font-bold">
                        {t(`services.${svc.key}.title`)}
                      </h2>
                      <p className="text-muted-foreground mt-2">
                        {t(`services.${svc.key}.description`)}
                      </p>
                      <div className="mt-4 inline-block px-3 py-1 bg-primary/10 text-primary rounded-full text-sm font-semibold">
                        {t(`services.${svc.key}.price`)}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </>
  );
}

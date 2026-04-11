// Public · Home page (refactorée, Server Component)
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowRight, Clock, FileCheck, Cpu, Wrench } from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "meta" });
  return {
    title: t("site_name"),
    description:
      "Services d'automatisation industrielle : support PLC, SCADA, HMI, audit, documentation, refactorisation. Québec.",
    openGraph: {
      title: t("site_name"),
      description: "Solutions PLC, SCADA & HMI pour l'industrie",
      images: ["/images/vnk-twitter-card-1200x600.png"],
    },
  };
}

const SERVICES = [
  {
    key: "support_plc",
    icon: Wrench,
    href: "/services#support-plc",
  },
  {
    key: "audit",
    icon: FileCheck,
    href: "/services#audit",
  },
  {
    key: "documentation",
    icon: Cpu,
    href: "/services#documentation",
  },
  {
    key: "refactoring",
    icon: Clock,
    href: "/services#refactoring",
  },
] as const;

export default async function HomePage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale });

  return (
    <>
      {/* ── Hero ────────────────────────────────────── */}
      <section className="relative min-h-[600px] vnk-gradient text-white overflow-hidden">
        <div className="absolute inset-0 opacity-20">
          <Image
            src="/images/hero-bg.jpg"
            alt=""
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
        </div>
        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 max-w-6xl">
          <span className="inline-block px-4 py-1.5 bg-white/10 rounded-full text-xs font-medium tracking-wider uppercase mb-6">
            {t("home.hero.kicker")}
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight max-w-3xl">
            {t("home.hero.title")}
          </h1>
          <p className="text-sm italic opacity-80 mt-6">{t("meta.tagline")}</p>
          <p className="text-lg opacity-90 mt-4 max-w-2xl leading-relaxed">
            {t("home.hero.subtitle")}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            <Button asChild size="lg" className="bg-white text-[#0F2D52] hover:bg-white/90">
              <Link href="/contact">{t("home.hero.cta_primary")}</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="bg-transparent border-white/30 text-white hover:bg-white/10">
              <Link href="/services">
                {t("home.hero.cta_secondary")} <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── Services ─────────────────────────────────── */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              {t("home.services_section.kicker")}
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-2">
              {t("home.services_section.title")}
            </h2>
            <p className="text-muted-foreground mt-2 max-w-2xl mx-auto">
              {t("home.services_section.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {SERVICES.map((svc) => {
              const Icon = svc.icon;
              return (
                <Card key={svc.key} className="vnk-card-hover">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-lg vnk-gradient flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-bold text-lg">
                      {t(`services.${svc.key}.title`)}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-2 line-clamp-3">
                      {t(`services.${svc.key}.description`)}
                    </p>
                    <div className="mt-4 pt-4 border-t flex items-center justify-between">
                      <span className="text-xs font-semibold text-primary">
                        {t(`services.${svc.key}.price`)}
                      </span>
                      <Link
                        href={svc.href as "/services"}
                        className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
                      >
                        {t("home.services_section.learn_more")}
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="text-center mt-10">
            <Button asChild variant="outline" size="lg">
              <Link href="/services">{t("home.services_section.view_all")}</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────── */}
      <section className="py-20 vnk-gradient text-white">
        <div className="container mx-auto px-4 text-center max-w-2xl">
          <h2 className="text-3xl sm:text-4xl font-bold">{t("home.cta.title")}</h2>
          <p className="mt-3 opacity-90">{t("home.cta.subtitle")}</p>
          <Button asChild size="lg" className="mt-6 bg-white text-[#0F2D52] hover:bg-white/90">
            <Link href="/contact">{t("home.cta.button")}</Link>
          </Button>
        </div>
      </section>
    </>
  );
}

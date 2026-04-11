// Public · Contact (form avec CAPTCHA + honeypot + rate limit côté API)
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ContactForm } from "./contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { Mail, MapPin, Clock } from "lucide-react";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "contact" });
  return {
    title: t("page_title"),
    description: t("hero_subtitle"),
  };
}

export default async function ContactPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "contact" });

  return (
    <>
      {/* Hero */}
      <section className="vnk-gradient text-white py-20">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h1 className="text-4xl sm:text-5xl font-bold">{t("hero_title")}</h1>
          <p className="text-lg opacity-90 mt-3">{t("hero_subtitle")}</p>
        </div>
      </section>

      {/* Form + info */}
      <section className="py-16 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2">
              <ContactForm />
            </div>

            <div className="space-y-4">
              <Card>
                <CardContent className="p-5 space-y-4">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">{t("info.email_label")}</p>
                      <p className="text-sm text-muted-foreground">
                        vnkautomatisation@gmail.com
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <MapPin className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">{t("info.location_label")}</p>
                      <p className="text-sm text-muted-foreground">Québec, Canada</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <Clock className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-sm">{t("info.response_time_label")}</p>
                      <p className="text-sm text-muted-foreground">24h ouvrables</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

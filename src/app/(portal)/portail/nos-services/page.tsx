import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { Bot, FileText, Calendar, ShieldCheck, ArrowRight } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const services = [
  {
    icon: Bot,
    title: "Automatisation des processus",
    desc: "Nous automatisons vos taches repetitives pour vous faire gagner du temps et reduire les erreurs. Workflows, notifications, rappels automatiques.",
    price: "Sur devis",
    href: "/portail/devis",
  },
  {
    icon: FileText,
    title: "Gestion documentaire",
    desc: "Generation automatique de documents, contrats, devis et factures. Signature electronique integree et archivage securise.",
    price: "Sur devis",
    href: "/portail/documents",
  },
  {
    icon: Calendar,
    title: "Planification et rendez-vous",
    desc: "Systeme de reservation en ligne avec synchronisation calendrier. Rappels automatiques et gestion des disponibilites.",
    price: "Inclus",
    href: "/portail/rendez-vous",
  },
  {
    icon: ShieldCheck,
    title: "Conformite et securite",
    desc: "Mise en conformite RGPD, securisation des donnees, audits et rapports. Protection de vos informations sensibles.",
    price: "Sur devis",
    href: "/portail/devis",
  },
];

export default async function PortalServicesPage() {
  const t = await getTranslations("Services");
  const locale = await getLocale();

  return (
    <div className="space-y-8">
      <ScrollReveal>
        <section className="rounded-2xl bg-gradient-to-br from-[#0F2D52] to-[#1a4a80] p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Nos services</h1>
          <p className="text-white/80 max-w-xl">
            Decouvrez nos solutions d&apos;automatisation et de gestion adaptees a votre activite.
          </p>
        </section>
      </ScrollReveal>

      <div className="grid md:grid-cols-2 gap-6">
        {services.map((s, i) => (
          <ScrollReveal key={s.title} delay={i * 100}>
            <Card className="h-full flex flex-col">
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-[#0F2D52]/10 p-2.5">
                    <s.icon className="h-6 w-6 text-[#0F2D52]" />
                  </div>
                  <CardTitle className="text-lg">{s.title}</CardTitle>
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col gap-4">
                <p className="text-sm text-muted-foreground flex-1">{s.desc}</p>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-[#0F2D52]">{s.price}</span>
                  <Button variant="outline" size="sm" asChild>
                    <Link href={s.href}>
                      En savoir plus <ArrowRight className="h-3.5 w-3.5 ml-1" />
                    </Link>
                  </Button>
                </div>
              </CardContent>
            </Card>
          </ScrollReveal>
        ))}
      </div>

      <div className="text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Voir le site complet <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </div>
  );
}

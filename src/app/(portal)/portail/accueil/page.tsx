import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, Bot, FileText, Calendar, ShieldCheck } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";
import { AnimatedCounter } from "@/components/ui/animated-counter";

const services = [
  { icon: Bot, title: "Automatisation", desc: "Processus automatises pour gagner du temps" },
  { icon: FileText, title: "Documents", desc: "Generation et gestion documentaire intelligente" },
  { icon: Calendar, title: "Rendez-vous", desc: "Planification et suivi de vos rendez-vous" },
  { icon: ShieldCheck, title: "Conformite", desc: "Respect des normes et reglementations" },
];

const stats = [
  { value: 150, label: "Clients accompagnes" },
  { value: 98, label: "Taux de satisfaction (%)" },
  { value: 500, label: "Projets realises" },
  { value: 24, label: "Support (h/24)" },
];

export default async function PortalAccueilPage() {
  const t = await getTranslations("Home");
  const locale = await getLocale();

  return (
    <div className="space-y-10">
      {/* Hero */}
      <ScrollReveal>
        <section className="rounded-2xl bg-gradient-to-br from-[#0F2D52] to-[#1a4a80] p-8 md:p-12 text-white">
          <h1 className="text-3xl md:text-4xl font-bold mb-3">
            Bienvenue sur votre portail
          </h1>
          <p className="text-white/80 max-w-xl mb-6">
            Gerez vos documents, suivez vos devis et factures, et planifiez vos rendez-vous en toute simplicite.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild>
              <Link href="/portail/devis">Mes devis</Link>
            </Button>
            <Button variant="outline" className="border-white/30 text-white hover:bg-white/10" asChild>
              <Link href="/portail/rendez-vous">Prendre rendez-vous</Link>
            </Button>
          </div>
        </section>
      </ScrollReveal>

      {/* Services grid */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Nos services</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {services.map((s, i) => (
            <ScrollReveal key={s.title} delay={i * 100}>
              <Card className="h-full">
                <CardContent className="p-5 flex flex-col items-center text-center gap-2">
                  <s.icon className="h-8 w-8 text-[#0F2D52]" />
                  <h3 className="font-medium">{s.title}</h3>
                  <p className="text-sm text-muted-foreground">{s.desc}</p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </section>

      {/* Stats */}
      <ScrollReveal>
        <section className="rounded-2xl bg-muted/50 p-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 text-center">
            {stats.map((s) => (
              <div key={s.label}>
                <div className="text-3xl font-bold text-[#0F2D52]">
                  <AnimatedCounter value={s.value} />
                  {s.label.includes("%") ? "" : "+"}
                </div>
                <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
              </div>
            ))}
          </div>
        </section>
      </ScrollReveal>

      {/* Link to full site */}
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

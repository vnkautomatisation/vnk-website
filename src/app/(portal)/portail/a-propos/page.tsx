import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, Target, Lightbulb, Users, Zap } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const values = [
  { icon: Target, title: "Precision", desc: "Des solutions sur mesure, adaptees a chaque client." },
  { icon: Lightbulb, title: "Innovation", desc: "Technologies modernes pour des resultats concrets." },
  { icon: Users, title: "Proximite", desc: "Un accompagnement humain et reactif." },
  { icon: Zap, title: "Efficacite", desc: "Automatiser pour vous concentrer sur l'essentiel." },
];

export default async function PortalAboutPage() {
  const t = await getTranslations("About");
  const locale = await getLocale();

  return (
    <div className="space-y-8">
      <ScrollReveal>
        <section className="rounded-2xl bg-gradient-to-br from-[#0F2D52] to-[#1a4a80] p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">A propos de VNK</h1>
          <p className="text-white/80 max-w-xl">
            VNK Automatisation accompagne les entreprises dans leur transformation numerique.
          </p>
        </section>
      </ScrollReveal>

      {/* Mission */}
      <ScrollReveal>
        <Card>
          <CardContent className="p-6 space-y-3">
            <h2 className="text-xl font-semibold">Notre mission</h2>
            <p className="text-muted-foreground leading-relaxed">
              Chez VNK Automatisation, nous croyons que chaque entreprise merite des outils performants
              pour simplifier son quotidien. Notre mission est de concevoir des solutions d&apos;automatisation
              accessibles, fiables et adaptees aux besoins reels de nos clients.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Fondee par Yan Verone, VNK allie expertise technique et ecoute attentive pour transformer
              vos processus metier et vous faire gagner un temps precieux.
            </p>
          </CardContent>
        </Card>
      </ScrollReveal>

      {/* Values */}
      <section>
        <h2 className="text-xl font-semibold mb-4">Nos valeurs</h2>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {values.map((v, i) => (
            <ScrollReveal key={v.title} delay={i * 100}>
              <Card className="h-full">
                <CardContent className="p-5 flex flex-col items-center text-center gap-2">
                  <div className="rounded-lg bg-[#0F2D52]/10 p-2.5">
                    <v.icon className="h-6 w-6 text-[#0F2D52]" />
                  </div>
                  <h3 className="font-medium">{v.title}</h3>
                  <p className="text-sm text-muted-foreground">{v.desc}</p>
                </CardContent>
              </Card>
            </ScrollReveal>
          ))}
        </div>
      </section>

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

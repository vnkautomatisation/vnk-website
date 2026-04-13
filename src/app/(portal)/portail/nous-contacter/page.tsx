import { getTranslations, getLocale } from "next-intl/server";
import Link from "next/link";
import { ArrowRight, Mail, Phone, MapPin, Clock } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

const contactInfo = [
  { icon: Mail, label: "Email", value: "contact@vnk-automatisation.com", href: "mailto:contact@vnk-automatisation.com" },
  { icon: Phone, label: "Telephone", value: "+33 6 00 00 00 00", href: "tel:+33600000000" },
  { icon: MapPin, label: "Adresse", value: "France", href: null },
  { icon: Clock, label: "Horaires", value: "Lun-Ven, 9h-18h", href: null },
];

export default async function PortalContactPage() {
  const t = await getTranslations("Contact");
  const locale = await getLocale();

  return (
    <div className="space-y-8">
      <ScrollReveal>
        <section className="rounded-2xl bg-gradient-to-br from-[#0F2D52] to-[#1a4a80] p-8 text-white">
          <h1 className="text-3xl font-bold mb-2">Nous contacter</h1>
          <p className="text-white/80 max-w-xl">
            Une question, un projet ? N&apos;hesitez pas a nous contacter.
          </p>
        </section>
      </ScrollReveal>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Contact info */}
        <ScrollReveal>
          <Card className="h-full">
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold">Coordonnees</h2>
              {contactInfo.map((c) => (
                <div key={c.label} className="flex items-start gap-3">
                  <div className="rounded-lg bg-[#0F2D52]/10 p-2">
                    <c.icon className="h-5 w-5 text-[#0F2D52]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{c.label}</p>
                    {c.href ? (
                      <a href={c.href} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
                        {c.value}
                      </a>
                    ) : (
                      <p className="text-sm text-muted-foreground">{c.value}</p>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </ScrollReveal>

        {/* Quick actions */}
        <ScrollReveal delay={100}>
          <Card className="h-full">
            <CardContent className="p-6 space-y-5">
              <h2 className="text-lg font-semibold">Actions rapides</h2>
              <p className="text-sm text-muted-foreground">
                Depuis votre portail, vous pouvez directement :
              </p>
              <div className="space-y-3">
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/portail/demandes">
                    <Mail className="h-4 w-4 mr-2" /> Envoyer une demande
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/portail/rendez-vous">
                    <Phone className="h-4 w-4 mr-2" /> Prendre rendez-vous
                  </Link>
                </Button>
                <Button className="w-full justify-start" variant="outline" asChild>
                  <Link href="/portail/devis">
                    <ArrowRight className="h-4 w-4 mr-2" /> Demander un devis
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </ScrollReveal>
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

// Public · Contact — formulaire complet + coordonnées + infos entreprise
import { setRequestLocale, getTranslations } from "next-intl/server";
import { ContactForm } from "./contact-form";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Phone,
  MapPin,
  Clock,
  CheckCircle2,
  Building2,
  Shield,
  FileText,
  MessageSquare,
  Calendar,
} from "lucide-react";
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

const ENGAGEMENTS = [
  {
    icon: Clock,
    title: "Réponse sous 24h ouvrables",
    desc: "Votre demande est traitée le jour même ou le suivant.",
  },
  {
    icon: MessageSquare,
    title: "Consultation initiale gratuite",
    desc: "Premier échange de 30 min sans engagement, pour cerner votre besoin.",
  },
  {
    icon: FileText,
    title: "Devis détaillé et transparent",
    desc: "Ventilation claire par étape, sans frais cachés.",
  },
  {
    icon: Shield,
    title: "Confidentialité garantie (NDA)",
    desc: "Vos données techniques, codes PLC et secrets industriels restent confidentiels.",
  },
];

const STEPS = [
  {
    num: "01",
    title: "Réception de votre message",
    desc: "Accusé de réception automatique, votre dossier est créé.",
  },
  {
    num: "02",
    title: "Appel de qualification",
    desc: "Un technicien vous rappelle sous 24h pour cerner votre besoin.",
  },
  {
    num: "03",
    title: "Devis ou intervention urgente",
    desc: "Selon l'urgence : devis écrit ou déploiement immédiat.",
  },
  {
    num: "04",
    title: "Démarrage du mandat",
    desc: "Contrat électronique, accès portail client, début des travaux.",
  },
];

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
      <section className="relative bg-gradient-to-br from-[#0F2D52] via-[#1a3a66] to-[#0F2D52] text-white py-24 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.1),transparent_70%)]" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-3xl mx-auto text-center">
            <Badge className="bg-white/10 text-white border border-white/20 backdrop-blur-sm mb-4">
              <MessageSquare className="h-3 w-3 mr-1" />
              Consultation gratuite
            </Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              {t("hero_title")}
            </h1>
            <p className="text-lg sm:text-xl text-white/80 leading-relaxed">
              {t("hero_subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>Réponse &lt; 24h</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>Sans engagement</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>Devis gratuit</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Form + info */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 max-w-6xl">
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Form — 2/3 */}
            <div className="lg:col-span-2">
              <div className="mb-6">
                <h2 className="text-2xl font-bold mb-2">Envoyez-nous un message</h2>
                <p className="text-sm text-muted-foreground">
                  Remplissez le formulaire ci-dessous — nous vous répondons en moins de 24h
                  ouvrables.
                </p>
              </div>
              <ContactForm />
            </div>

            {/* Coordonnées — 1/3 */}
            <div className="space-y-4">
              {/* Coordonnées */}
              <Card className="border-2 border-[#0F2D52]/10">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">Coordonnées</h3>
                    <p className="text-xs text-muted-foreground">
                      Joignez-nous directement
                    </p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-[#0F2D52]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Courriel
                        </p>
                        <a
                          href="mailto:vnkautomatisation@gmail.com"
                          className="text-sm font-medium hover:text-[#0F2D52] break-all"
                        >
                          vnkautomatisation@gmail.com
                        </a>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                        <Phone className="h-4 w-4 text-[#0F2D52]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Téléphone
                        </p>
                        <a
                          href="tel:+18192908686"
                          className="text-sm font-medium hover:text-[#0F2D52]"
                        >
                          (819) 290-8686
                        </a>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Urgences PLC 24/7
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-[#0F2D52]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Adresse
                        </p>
                        <p className="text-sm font-medium">Québec, QC</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Canada · Service à distance et sur site
                        </p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-[#0F2D52]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                          Heures d'ouverture
                        </p>
                        <p className="text-sm font-medium">Lun – Ven : 8h – 17h</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Support d'urgence 24/7
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Entreprise */}
              <Card className="bg-gradient-to-br from-[#0F2D52] to-[#1a3a66] text-white border-0">
                <CardContent className="p-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Building2 className="h-4 w-4" />
                    <h3 className="text-sm font-bold uppercase tracking-wider">
                      Entreprise
                    </h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="font-bold text-base">VNK Automatisation Inc.</p>
                    <p className="text-white/70 text-xs">
                      Société par actions incorporée au Québec
                    </p>
                    <div className="pt-3 border-t border-white/20 mt-3 space-y-1">
                      <p className="text-white/70 text-xs">NEQ : sur demande</p>
                      <p className="text-white/70 text-xs">TPS/TVQ : disponibles</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Engagements */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-4">
                    Nos engagements
                  </h3>
                  <ul className="space-y-3">
                    {ENGAGEMENTS.map((e, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <e.icon className="h-4 w-4 text-[#0F2D52] shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-semibold">{e.title}</p>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">
                            {e.desc}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* "Et après ?" */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4 max-w-5xl">
          <div className="text-center mb-12">
            <Badge variant="secondary" className="mb-3">
              <Calendar className="h-3 w-3 mr-1" />
              Processus
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">
              Et après l'envoi ?
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Voici comment se déroule notre prise de contact — de votre message à
              l'intervention
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS.map((step, i) => (
              <div
                key={i}
                className="relative p-6 rounded-xl bg-background border border-border hover:border-[#0F2D52]/30 hover:shadow-md transition-all"
              >
                <div className="text-4xl font-bold text-[#0F2D52]/10 mb-3 leading-none">
                  {step.num}
                </div>
                <h3 className="font-bold text-sm mb-2">{step.title}</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final reassurance */}
      <section className="py-16 bg-background border-t border-border">
        <div className="container mx-auto px-4 max-w-4xl text-center">
          <Shield className="h-10 w-10 text-[#0F2D52] mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-3">Vos données sont protégées</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">
            Toutes les informations soumises via ce formulaire sont traitées de manière
            confidentielle. Nous ne partageons jamais vos données avec des tiers et nous
            nous engageons à respecter un accord de non-divulgation (NDA) pour tout mandat
            sensible.
          </p>
        </div>
      </section>
    </>
  );
}

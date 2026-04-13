// Public · Home page — riche, Server Component
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Clock,
  FileCheck,
  Cpu,
  Wrench,
  Shield,
  Zap,
  Award,
  Users,
  TrendingUp,
  CheckCircle2,
  Star,
  Building2,
  MessageCircle,
  Search,
  Hammer,
  Rocket,
  Phone,
  Mail,
  MapPin,
  Headphones,
  Lock,
  Sparkles,
  BadgeCheck,
} from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";
import { ScrollReveal } from "@/components/ui/scroll-reveal";

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

// ─── Données des 4 services ───────────────────────────
const SERVICES = [
  {
    key: "support_plc",
    icon: Wrench,
    image: "/images/plc-support.jpg",
    tags: ["Siemens", "Rockwell", "B&R"],
    price: "120–150 CAD/h",
    href: "/services#support-plc",
  },
  {
    key: "audit",
    icon: FileCheck,
    image: "/images/audit.jpg",
    tags: ["Analyse code", "Rapport détaillé"],
    price: "1 500–4 000 CAD",
    href: "/services#audit",
  },
  {
    key: "documentation",
    icon: Cpu,
    image: "/images/documentation.jpg",
    tags: ["Opérateur", "Maintenance"],
    price: "800–5 000 CAD",
    href: "/services#documentation",
  },
  {
    key: "refactoring",
    icon: Clock,
    image: "/images/refactoring.jpg",
    tags: ["IEC 61131-3", "Legacy code"],
    price: "3 000–50 000 CAD",
    href: "/services#refactoring",
  },
] as const;

// ─── Marques d'automates supportées ──────────────────
const BRANDS = [
  { name: "Siemens", sub: "WinCC · Step 7" },
  { name: "Rockwell", sub: "ControlLogix · Studio 5000" },
  { name: "B&R Automation", sub: "Automation Studio · X20" },
  { name: "Schneider Electric", sub: "Modicon · EcoStruxure" },
  { name: "Autres marques", sub: "Sur demande" },
];

// ─── Stats ────────────────────────────────────────────
const STATS = [
  { value: "120", unit: "CAD/h", label: "Taux horaire de départ — support PLC" },
  { value: "24h", unit: "", label: "Temps de réponse maximum" },
  { value: "100", unit: "%", label: "Intervention documentée avec rapport écrit" },
  { value: "5", unit: "+", label: "Marques d'automates supportées" },
];

// ─── Pourquoi VNK ? ───────────────────────────────────
const WHY = [
  {
    icon: Award,
    title: "Spécialisé",
    desc: "Pas de généraliste — expertise exclusive en automatisation industrielle PLC, SCADA, HMI.",
  },
  {
    icon: Zap,
    title: "Rapide",
    desc: "Support à distance dans les 24h — pas besoin d'attendre un déplacement sur site.",
  },
  {
    icon: Shield,
    title: "Documenté",
    desc: "Chaque intervention est accompagnée d'un rapport écrit livré à votre équipe.",
  },
  {
    icon: TrendingUp,
    title: "Pérenne",
    desc: "Refactorisation de code legacy pour éliminer la dette technique sur le long terme.",
  },
];

// ─── Processus de travail (4 étapes) ─────────────────
const PROCESS = [
  {
    num: "01",
    icon: MessageCircle,
    title: "Contact initial",
    desc: "Appel ou courriel pour comprendre vos besoins et contraintes techniques.",
  },
  {
    num: "02",
    icon: Search,
    title: "Diagnostic & devis",
    desc: "Analyse à distance ou sur site, puis devis détaillé avec échéancier.",
  },
  {
    num: "03",
    icon: Hammer,
    title: "Intervention",
    desc: "Exécution selon le planning convenu, avec suivi en temps réel sur votre portail.",
  },
  {
    num: "04",
    icon: Rocket,
    title: "Livraison & support",
    desc: "Rapport écrit, documentation et support post-intervention garanti.",
  },
];

// ─── Garanties / engagements ─────────────────────────
const GUARANTEES = [
  {
    icon: Shield,
    title: "Confidentialité garantie",
    desc: "NDA signé avant toute intervention. Votre code et vos données restent chez vous.",
  },
  {
    icon: BadgeCheck,
    title: "Travail documenté",
    desc: "Chaque intervention est livrée avec un rapport écrit détaillé et réutilisable.",
  },
  {
    icon: Headphones,
    title: "Support 24h",
    desc: "Temps de réponse maximum garanti de 24 heures ouvrables sur toute demande.",
  },
  {
    icon: Lock,
    title: "Sans engagement",
    desc: "Pas de contrat de rétention obligatoire. Payez uniquement ce que vous utilisez.",
  },
];

// ─── FAQ ──────────────────────────────────────────────
const FAQ = [
  {
    q: "Intervenez-vous en urgence ?",
    a: "Oui, nous priorisons les interventions urgentes (ligne de production arrêtée). Temps de réponse maximum : 24h ouvrables, souvent beaucoup moins.",
  },
  {
    q: "Travaillez-vous à distance ou sur site ?",
    a: "Les deux. Nous privilégions le support à distance (VPN, TeamViewer, AnyDesk) pour la rapidité, mais intervenons sur site au Québec lorsque nécessaire.",
  },
  {
    q: "Quelles marques d'automates supportez-vous ?",
    a: "Siemens (Step 7, TIA Portal, WinCC), Rockwell/Allen-Bradley (RSLogix, Studio 5000, FactoryTalk), B&R (Automation Studio), Schneider (Modicon, EcoStruxure). Autres marques sur demande.",
  },
  {
    q: "Comment se déroule un audit technique ?",
    a: "Nous analysons votre code, votre architecture et vos procédures. Livrable : un rapport détaillé avec les risques identifiés, les améliorations possibles et un plan d'action chiffré.",
  },
  {
    q: "Acceptez-vous les paiements Stripe ?",
    a: "Oui, nous acceptons les paiements par carte via Stripe (sécurisé), virement bancaire, et chèque pour les clients établis.",
  },
];

// ─── Témoignages ──────────────────────────────────────
const TESTIMONIALS = [
  {
    content:
      "VNK a diagnostiqué et corrigé un problème sur notre ligne de production en moins de 4 heures. Service impeccable, rapport détaillé fourni.",
    author: "Directeur Maintenance",
    company: "Fabrication industrielle",
    rating: 5,
  },
  {
    content:
      "L'audit technique nous a permis d'identifier 3 failles critiques qu'on avait jamais vues. Plan d'action clair, chiffré et réaliste.",
    author: "Responsable automatisation",
    company: "Agroalimentaire",
    rating: 5,
  },
  {
    content:
      "La refactorisation du code PLC a divisé par 2 le temps de cycle de notre machine. Expertise Siemens impressionnante.",
    author: "Ingénieur procédés",
    company: "Pâtes et papiers",
    rating: 5,
  },
];

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
      {/* ═══════════════════════════════════════════════════
          HERO — background image + gradient + CTA
          ═══════════════════════════════════════════════════ */}
      <section className="relative min-h-[720px] flex items-center overflow-hidden">
        {/* Background image */}
        <div className="absolute inset-0">
          <Image
            src="/images/hero-bg.jpg"
            alt=""
            fill
            className="object-cover"
            priority
            sizes="100vw"
          />
          <div className="absolute inset-0 bg-[#0F2D52]/85" />
          <div className="absolute inset-0 vnk-gradient opacity-60" />
        </div>

        <div className="relative container mx-auto px-4 sm:px-6 lg:px-8 py-24 lg:py-32 max-w-7xl">
          <div className="max-w-3xl">
            <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold tracking-wider uppercase mb-6 text-white border border-white/20">
              <Zap className="h-3 w-3" />
              {t("home.hero.kicker")}
            </span>

            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-bold leading-[1.1] text-white">
              {t("home.hero.title")}
            </h1>

            <p className="text-sm sm:text-base italic opacity-80 mt-6 text-white tracking-wider">
              {t("meta.tagline")}
            </p>

            <p className="text-lg sm:text-xl opacity-90 mt-4 max-w-2xl leading-relaxed text-white">
              {t("home.hero.subtitle")}
            </p>

            <div className="flex flex-col sm:flex-row gap-3 mt-10">
              <Button
                asChild
                size="lg"
                className="bg-white text-[#0F2D52] hover:bg-white/90 h-14 px-8 text-base shadow-xl"
              >
                <Link href="/contact">
                  {t("home.hero.cta_primary")}
                  <ArrowRight className="h-5 w-5" />
                </Link>
              </Button>
              <Button
                asChild
                size="lg"
                variant="outline"
                className="bg-transparent border-white/30 text-white hover:bg-white/10 h-14 px-8 text-base"
              >
                <Link href="/services">{t("home.hero.cta_secondary")}</Link>
              </Button>
            </div>

            {/* Hero stats inline */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-6 mt-12 pt-10 border-t border-white/20 max-w-2xl">
              <div>
                <div className="text-4xl font-bold text-white">4</div>
                <div className="text-xs uppercase tracking-wider text-white/70 mt-1">
                  Services spécialisés
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white">5+</div>
                <div className="text-xs uppercase tracking-wider text-white/70 mt-1">
                  Marques d&apos;automates
                </div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white">B2B</div>
                <div className="text-xs uppercase tracking-wider text-white/70 mt-1">
                  Marché industriel
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          MARQUES D'AUTOMATES
          ═══════════════════════════════════════════════════ */}
      <ScrollReveal animation="animate-reveal-up">
      <section className="py-16 bg-muted/30 border-y">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-8">
            Nous supportons les principales marques d&apos;automates
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {BRANDS.map((brand) => (
              <div
                key={brand.name}
                className="flex flex-col items-center justify-center py-6 px-4 text-center border-r last:border-r-0"
              >
                <Building2 className="h-8 w-8 text-primary mb-3" />
                <div className="font-bold text-sm text-foreground">{brand.name}</div>
                <div className="text-[10px] text-muted-foreground mt-1">
                  {brand.sub}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* ═══════════════════════════════════════════════════
          SERVICES — 4 cartes avec image
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16 max-w-2xl mx-auto">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              {t("home.services_section.kicker")}
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">
              {t("home.services_section.title")}
            </h2>
            <p className="text-muted-foreground mt-4 text-lg">
              {t("home.services_section.subtitle")}
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {SERVICES.map((svc, i) => {
              const Icon = svc.icon;
              return (
                <ScrollReveal key={svc.key} delay={i * 100}>
                <Card className="vnk-card-hover overflow-hidden group">
                  {/* Image */}
                  <div className="relative h-44 overflow-hidden bg-muted">
                    <Image
                      src={svc.image}
                      alt={t(`services.${svc.key}.title`)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-500"
                      sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                    <div className="absolute top-3 left-3 h-10 w-10 rounded-lg vnk-gradient flex items-center justify-center shadow-lg">
                      <Icon className="h-5 w-5 text-white" />
                    </div>
                  </div>

                  <CardContent className="p-5 space-y-3">
                    <h3 className="font-bold text-lg leading-tight">
                      {t(`services.${svc.key}.title`)}
                    </h3>
                    <p className="text-sm text-muted-foreground line-clamp-3">
                      {t(`services.${svc.key}.description`)}
                    </p>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {svc.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                    <div className="pt-3 border-t flex items-center justify-between">
                      <span className="text-xs font-bold text-primary">
                        {svc.price}
                      </span>
                      <Link
                        href={svc.href as "/services"}
                        className="text-xs font-semibold text-primary hover:underline inline-flex items-center gap-1"
                      >
                        En savoir plus
                        <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </CardContent>
                </Card>
                </ScrollReveal>
              );
            })}
          </div>

          <div className="text-center mt-12">
            <Button asChild variant="outline" size="lg">
              <Link href="/services">
                {t("home.services_section.view_all")}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          STATS — bande stats
          ═══════════════════════════════════════════════════ */}
      <ScrollReveal animation="animate-reveal-scale">
      <section className="py-20 vnk-gradient text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS.map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-5xl sm:text-6xl font-bold tracking-tight">
                  {stat.value}
                  <span className="text-2xl font-semibold opacity-80 ml-1">
                    {stat.unit}
                  </span>
                </div>
                <p className="mt-3 text-sm opacity-80 max-w-[200px] mx-auto">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* ═══════════════════════════════════════════════════
          POURQUOI VNK — avec image + 4 cards
          ═══════════════════════════════════════════════════ */}
      <ScrollReveal animation="animate-reveal-up">
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Photo + badge */}
            <div className="relative">
              <div className="relative aspect-[4/5] max-w-md mx-auto rounded-2xl overflow-hidden shadow-2xl">
                <Image
                  src="/images/about-hero.jpg"
                  alt="Expert en automatisation industrielle"
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 lg:right-0 bg-card rounded-xl p-4 shadow-xl border max-w-[240px]">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase">
                    Société par actions
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Constituée au Québec — mars 2026
                </p>
              </div>
            </div>

            {/* Content */}
            <div>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                {t("home.why_vnk.kicker")}
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3">
                {t("home.why_vnk.title")}
              </h2>
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                {t("home.why_vnk.description")}
              </p>

              <div className="grid sm:grid-cols-2 gap-4 mt-8">
                {WHY.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.title} className="flex gap-3">
                      <div className="shrink-0 h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm">{item.title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                          {item.desc}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </section>
      </ScrollReveal>

      {/* ═══════════════════════════════════════════════════
          TÉMOIGNAGES
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-12">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Témoignages
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-3">
              Ce que disent nos clients
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((testimonial, i) => (
              <Card key={i} className="vnk-card-hover">
                <CardContent className="p-6">
                  <div className="flex gap-0.5 mb-4">
                    {Array.from({ length: testimonial.rating }).map((_, j) => (
                      <Star
                        key={j}
                        className="h-4 w-4 fill-amber-400 text-amber-400"
                      />
                    ))}
                  </div>
                  <p className="text-sm leading-relaxed text-foreground italic">
                    &ldquo;{testimonial.content}&rdquo;
                  </p>
                  <div className="mt-6 pt-4 border-t">
                    <p className="font-bold text-sm">{testimonial.author}</p>
                    <p className="text-xs text-muted-foreground">
                      {testimonial.company}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          PROCESSUS DE TRAVAIL — 4 étapes
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Notre processus
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">
              Du premier appel à la livraison
            </h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
              Un processus clair en 4 étapes pour que vous sachiez exactement où
              en est votre projet à chaque instant.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Ligne de connexion desktop */}
            <div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10" />

            {PROCESS.map((step) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.num}
                  className="relative bg-card rounded-xl border p-6 vnk-card-hover"
                >
                  <div className="h-16 w-16 rounded-full vnk-gradient flex items-center justify-center mx-auto mb-4 shadow-lg relative z-10">
                    <Icon className="h-7 w-7 text-white" />
                  </div>
                  <div className="absolute top-4 right-4 text-4xl font-bold text-primary/10">
                    {step.num}
                  </div>
                  <h3 className="font-bold text-lg text-center">{step.title}</h3>
                  <p className="text-sm text-muted-foreground text-center mt-2 leading-relaxed">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          GARANTIES / ENGAGEMENTS
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Nos engagements
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">
              Des garanties claires
            </h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
              Nous nous engageons sur la transparence, la qualité et la rapidité.
              Voici nos promesses concrètes.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {GUARANTEES.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="p-6 rounded-xl border bg-card vnk-card-hover"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <Icon className="h-6 w-6 text-primary" />
                  </div>
                  <h3 className="font-bold text-base">{item.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                    {item.desc}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          FAQ
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Questions fréquentes
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">
              Des réponses claires
            </h2>
          </div>

          <div className="space-y-4">
            {FAQ.map((item, i) => (
              <details
                key={i}
                className="group rounded-xl border bg-card overflow-hidden"
              >
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer font-semibold text-foreground hover:bg-muted/50 list-none">
                  <span className="text-base">{item.q}</span>
                  <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-lg group-open:rotate-45 transition-transform">
                    +
                  </span>
                </summary>
                <div className="px-6 pb-5 pt-2 text-sm text-muted-foreground leading-relaxed border-t">
                  {item.a}
                </div>
              </details>
            ))}
          </div>

          <div className="text-center mt-12">
            <p className="text-muted-foreground mb-4">
              Une autre question ?
            </p>
            <Button asChild size="lg">
              <Link href="/contact">
                Contactez-nous
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          CTA FINAL
          ═══════════════════════════════════════════════════ */}
      <ScrollReveal animation="animate-reveal-scale">
      <section className="py-24 vnk-gradient text-white relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image
            src="/images/hero-bg.jpg"
            alt=""
            fill
            className="object-cover"
            sizes="100vw"
          />
        </div>
        <div className="relative container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
            {t("home.cta.title")}
          </h2>
          <p className="mt-4 text-lg opacity-90">{t("home.cta.subtitle")}</p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
            <Button
              asChild
              size="lg"
              className="bg-white text-[#0F2D52] hover:bg-white/90 h-14 px-8 shadow-xl"
            >
              <Link href="/contact">
                {t("home.cta.button")}
                <ArrowRight className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="bg-transparent border-white/30 text-white hover:bg-white/10 h-14 px-8"
            >
              <Link href="/services">Voir les services</Link>
            </Button>
          </div>
        </div>
      </section>
      </ScrollReveal>
    </>
  );
}

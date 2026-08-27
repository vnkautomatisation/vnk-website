// Public · Home page — riche, Server Component
import { getTranslations, setRequestLocale } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AnimatedCounter } from "@/components/ui/animated-counter";
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
  const th = await getTranslations({ locale, namespace: "home" });
  return {
    title: t("site_name"),
    description:
      th("hm_services_d_automatisation_industrielle_support_plc_scada"),
    openGraph: {
      title: t("site_name"),
      description: th("hm_solutions_plc_scada_hmi_pour_l_industrie"),
      images: ["/images/vnk-twitter-card-1200x600.png"],
    },
  };
}

// ─── Données des 4 services ───────────────────────────
const SERVICES = (t: (k: string) => string) => [
  {
    key: "support_plc",
    icon: Wrench,
    image: "/images/plc-support.jpg",
    tags: ["Siemens", "Rockwell", "B&R"],
    price: t("home.hm_120150_cad_h"),
    href: "/services#support-plc",
  },
  {
    key: "audit",
    icon: FileCheck,
    image: "/images/audit.jpg",
    tags: [t("home.hm_tag_analyse_code"), t("home.hm_tag_rapport_detaille")],
    price: t("home.hm_1_5004_000_cad"),
    href: "/services#audit",
  },
  {
    key: "documentation",
    icon: Cpu,
    image: "/images/documentation.jpg",
    tags: [t("home.hm_tag_operateur"), t("home.hm_tag_maintenance")],
    price: t("home.hm_8005_000_cad"),
    href: "/services#documentation",
  },
  {
    key: "refactoring",
    icon: Clock,
    image: "/images/refactoring.jpg",
    tags: ["IEC 61131-3", "Legacy code"],
    price: t("home.hm_3_00050_000_cad"),
    href: "/services#refactoring",
  },
] as const;

// ─── Marques d'automates supportées ──────────────────
const BRANDS = (t: (k: string) => string) => [
  { name: "Siemens", sub: t("home.hm_wincc_step_7") },
  { name: "Rockwell", sub: t("home.hm_controllogix_studio_5000") },
  { name: t("home.hm_b_r_automation"), sub: t("home.hm_automation_studio_x20") },
  { name: t("home.hm_schneider_electric"), sub: t("home.hm_modicon_ecostruxure") },
  { name: t("home.hm_autres_marques"), sub: t("home.hm_sur_demande") },
];

// ─── Stats ────────────────────────────────────────────
const STATS = (t: (k: string) => string) => [
  { num: 120, unit: "CAD/h", label: t("home.hm_taux_horaire_de_depart_support_plc") },
  { num: 24, unit: "h", label: t("home.hm_temps_de_reponse_maximum") },
  { num: 100, unit: "%", label: t("home.hm_intervention_documentee_avec_rapport_ecrit") },
  { num: 5, unit: "+", label: t("home.hm_marques_d_automates_supportees") },
];

// ─── Pourquoi VNK ? ───────────────────────────────────
const WHY = (t: (k: string) => string) => [
  {
    icon: Award,
    title: t("home.hm_specialise"),
    desc: t("home.hm_pas_de_generaliste_expertise_exclusive_en_automatisation"),
  },
  {
    icon: Zap,
    title: "Rapide",
    desc: t("home.hm_support_a_distance_dans_les_24h_pas"),
  },
  {
    icon: Shield,
    title: t("home.hm_documente"),
    desc: t("home.hm_chaque_intervention_est_accompagnee_d_un_rapport"),
  },
  {
    icon: TrendingUp,
    title: t("home.hm_perenne"),
    desc: t("home.hm_refactorisation_de_code_legacy_pour_eliminer_la"),
  },
];

// ─── Processus de travail (4 étapes) ─────────────────
const PROCESS = (t: (k: string) => string) => [
  {
    num: "01",
    icon: MessageCircle,
    title: t("home.hm_contact_initial"),
    desc: t("home.hm_appel_ou_courriel_pour_comprendre_vos_besoins"),
  },
  {
    num: "02",
    icon: Search,
    title: t("home.hm_diagnostic_devis"),
    desc: t("home.hm_analyse_a_distance_ou_sur_site_puis"),
  },
  {
    num: "03",
    icon: Hammer,
    title: "Intervention",
    desc: t("home.hm_execution_selon_le_planning_convenu_avec_suivi"),
  },
  {
    num: "04",
    icon: Rocket,
    title: t("home.hm_livraison_support"),
    desc: t("home.hm_rapport_ecrit_documentation_et_support_post_intervention"),
  },
];

// ─── Garanties / engagements ─────────────────────────
const GUARANTEES = (t: (k: string) => string) => [
  {
    icon: Shield,
    title: t("home.hm_confidentialite_garantie"),
    desc: t("home.hm_nda_signe_avant_toute_intervention_votre_code"),
  },
  {
    icon: BadgeCheck,
    title: t("home.hm_travail_documente"),
    desc: t("home.hm_chaque_intervention_est_livree_avec_un_rapport"),
  },
  {
    icon: Headphones,
    title: t("home.hm_support_24h"),
    desc: t("home.hm_temps_de_reponse_maximum_garanti_de_24"),
  },
  {
    icon: Lock,
    title: t("home.hm_sans_engagement"),
    desc: t("home.hm_pas_de_contrat_de_retention_obligatoire_payez"),
  },
];

// ─── FAQ(t) ──────────────────────────────────────────────
const FAQ = (t: (k: string) => string) => [
  {
    q: t("home.hm_intervenez_vous_en_urgence"),
    a: t("home.hm_oui_nous_priorisons_les_interventions_urgentes_ligne"),
  },
  {
    q: t("home.hm_travaillez_vous_a_distance_ou_sur_site"),
    a: t("home.hm_les_deux_nous_privilegions_le_support_a"),
  },
  {
    q: t("home.hm_quelles_marques_d_automates_supportez_vous"),
    a: t("home.hm_siemens_step_7_tia_portal_wincc_rockwell"),
  },
  {
    q: t("home.hm_comment_se_deroule_un_audit_technique"),
    a: t("home.hm_nous_analysons_votre_code_votre_architecture_et"),
  },
  {
    q: t("home.hm_acceptez_vous_les_paiements_stripe"),
    a: t("home.hm_oui_nous_acceptons_les_paiements_par_carte"),
  },
];

// ─── Témoignages ──────────────────────────────────────
const TESTIMONIALS = (t: (k: string) => string) => [
  {
    content:
      t("home.hm_vnk_a_diagnostique_et_corrige_un_probleme"),
    author: t("home.hm_directeur_maintenance"),
    company: t("home.hm_fabrication_industrielle"),
    rating: 5,
  },
  {
    content:
      t("home.hm_l_audit_technique_nous_a_permis_d"),
    author: t("home.hm_responsable_automatisation"),
    company: "Agroalimentaire",
    rating: 5,
  },
  {
    content:
      t("home.hm_la_refactorisation_du_code_plc_a_divise"),
    author: t("home.hm_ingenieur_procedes"),
    company: t("home.hm_pates_et_papiers"),
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
                <div className="text-xs uppercase tracking-wider text-white/70 mt-1">{t("home.hm_services_specialises")}</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white">5+</div>
                <div className="text-xs uppercase tracking-wider text-white/70 mt-1">{t("home.hm_marques_d_automates")}</div>
              </div>
              <div>
                <div className="text-4xl font-bold text-white">B2B</div>
                <div className="text-xs uppercase tracking-wider text-white/70 mt-1">{t("home.hm_marche_industriel")}</div>
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
          <p className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-8">{t("home.hm_nous_supportons_les_principales_marques_d_automates")}</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-6">
            {BRANDS(t).map((brand) => (
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
          SERVICES(t) — 4 cartes avec image
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
            {SERVICES(t).map((svc, i) => {
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
                      >{t("home.hm_en_savoir_plus")}<ArrowRight className="h-3 w-3" />
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
          STATS(t) — bande stats
          ═══════════════════════════════════════════════════ */}
      <ScrollReveal animation="animate-reveal-scale">
      <section className="py-20 vnk-gradient text-white">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {STATS(t).map((stat, i) => (
              <div key={i} className="text-center">
                <div className="text-5xl sm:text-6xl font-bold tracking-tight">
                  <AnimatedCounter value={stat.num} duration={1500 + i * 200} />
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
                  alt={t("home.hm_alt_expert")}
                  fill
                  className="object-cover"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                />
              </div>
              <div className="absolute -bottom-4 -right-4 lg:right-0 bg-card rounded-xl p-4 shadow-xl border max-w-[240px]">
                <div className="flex items-center gap-2 mb-1">
                  <Award className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary uppercase">{t("home.hm_societe_par_actions")}</span>
                </div>
                <p className="text-xs text-muted-foreground">{t("home.hm_constituee_au_quebec_mars_2026")}</p>
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
                {WHY(t).map((item) => {
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
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{t("home.hm_temoignages")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-3">{t("home.hm_ce_que_disent_nos_clients")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {TESTIMONIALS(t).map((testimonial, i) => (
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
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{t("home.hm_notre_processus")}</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">{t("home.hm_du_premier_appel_a_la_livraison")}</h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">{t("home.hm_un_processus_clair_en_4_etapes_pour")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 relative">
            {/* Ligne de connexion desktop */}
            <div className="hidden lg:block absolute top-12 left-[12%] right-[12%] h-0.5 bg-gradient-to-r from-primary/10 via-primary/40 to-primary/10" />

            {PROCESS(t).map((step) => {
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
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{t("home.hm_nos_engagements")}</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">{t("home.hm_des_garanties_claires")}</h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">{t("home.hm_nous_nous_engageons_sur_la_transparence_la")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {GUARANTEES(t).map((item) => {
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
          FAQ(t)
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{t("home.hm_questions_frequentes")}</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">{t("home.hm_des_reponses_claires")}</h2>
          </div>

          <div className="space-y-4">
            {FAQ(t).map((item, i) => (
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
            <p className="text-muted-foreground mb-4">{t("home.hm_une_autre_question")}</p>
            <Button asChild size="lg">
              <Link href="/contact">{t("home.hm_contactez_nous")}<ArrowRight className="h-4 w-4" />
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
              <Link href="/services">{t("home.voir_les_services")}</Link>
            </Button>
          </div>
        </div>
      </section>
      </ScrollReveal>
    </>
  );
}

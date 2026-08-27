// Public · Services — page détaillée avec sections par service
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Wrench,
  FileCheck,
  Cpu,
  Clock,
  ArrowRight,
  CheckCircle2,
  Zap,
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
  const t = await getTranslations({ locale, namespace: "services" });
  return {
    title: t("page_title"),
    description:
      t("sv_services_d_automatisation_industrielle_support_plc_a"),
    openGraph: {
      title: t("page_title") + " | VNK Automatisation",
      description: t("sv_support_plc_audit_documentation_refactorisation"),
    },
  };
}

const SERVICES = (t: (k: string) => string) => [
  {
    id: "support-plc",
    icon: Wrench,
    image: "/images/plc-support.jpg",
    badge: "Support",
    title: t("sv_support_plc_a_distance"),
    description:
      t("sv_diagnostic_et_resolution_rapide_de_pannes_sur"),
    price: t("sv_120150_cad_h"),
    priceSub: t("sv_minimum_1h_facturation_au_quart_d_heure"),
    features: [
      t("sv_diagnostic_a_distance_via_teamviewer_anydesk_ou"),
      t("sv_acces_au_code_plc_pour_analyse_approfondie"),
      t("sv_correction_et_tests_en_ligne_avec_votre"),
      t("sv_rapport_ecrit_detaille_livre_apres_chaque_intervention"),
      t("sv_support_siemens_step_7_tia_portal_wincc"),
      t("sv_support_rockwell_rslogix_studio_5000_factorytalk"),
      t("sv_support_b_r_automation_studio"),
      t("sv_support_schneider_modicon_ecostruxure"),
    ],
  },
  {
    id: "audit",
    icon: FileCheck,
    image: "/images/audit.jpg",
    badge: "Audit",
    title: t("sv_audit_technique"),
    description:
      t("sv_evaluation_complete_de_votre_systeme_risques_performance"),
    price: t("sv_1_5004_000_cad"),
    priceSub: t("sv_forfait_selon_la_taille_du_systeme"),
    features: [
      t("sv_analyse_du_code_plc_existant"),
      t("sv_evaluation_de_l_architecture_scada_hmi"),
      t("sv_identification_des_risques_et_points_de_defaillance"),
      t("sv_recommandations_de_securite_fonctionnelle"),
      t("sv_rapport_detaille_avec_plan_d_action_chiffre"),
      t("sv_priorisation_des_ameliorations_critique_important_nice_to"),
      t("sv_estimation_des_couts_de_modernisation"),
      t("sv_presentation_des_resultats_a_votre_equipe"),
    ],
  },
  {
    id: "documentation",
    icon: Cpu,
    image: "/images/documentation.jpg",
    badge: "Documentation",
    title: t("sv_documentation_industrielle"),
    description:
      t("sv_procedures_operateur_maintenance_et_depannage_redigees_pour"),
    price: t("sv_8005_000_cad"),
    priceSub: t("sv_selon_la_portee_du_projet"),
    features: [
      t("sv_procedures_operateur_pas_a_pas_illustrees"),
      t("sv_manuel_de_maintenance_preventive"),
      t("sv_guide_de_depannage_avec_arbres_de_decision"),
      t("sv_fiches_techniques_des_automates_et_i_o"),
      t("sv_schemas_p_id_et_architecture_reseau"),
      t("sv_livraison_en_pdf_sources_editables"),
      t("sv_traduction_fr_en_disponible"),
      t("sv_mises_a_jour_gratuites_pendant_6_mois"),
    ],
  },
  {
    id: "refactoring",
    icon: Clock,
    image: "/images/refactoring.jpg",
    badge: "Refactoring",
    title: t("sv_refactorisation_plc"),
    description:
      t("sv_modernisation_de_code_legacy_fiabilite_amelioree_dette"),
    price: t("sv_3_00050_000_cad"),
    priceSub: t("sv_selon_la_complexite_et_la_taille_du"),
    features: [
      t("sv_migration_vers_iec_61131_3_st_fbd"),
      t("sv_refactor_de_code_awl_stl_legacy"),
      t("sv_separation_modulaire_fonctions_fb_programmes"),
      t("sv_optimisation_des_temps_de_cycle"),
      t("sv_normalisation_des_noms_de_variables_et_commentaires"),
      t("sv_tests_de_non_regression_complets"),
      t("sv_documentation_technique_du_nouveau_code"),
      t("sv_formation_de_votre_equipe_au_nouveau_code"),
    ],
  },
] as const;

export default async function ServicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "services" });

  return (
    <>
      {/* ── HERO ─────────────────────────────────────── */}
      <section className="relative pt-40 pb-24 vnk-gradient text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image src="/images/hero-bg.jpg" alt="" fill className="object-cover" sizes="100vw" />
        </div>
        <div className="relative container mx-auto px-4 text-center max-w-3xl">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold uppercase tracking-wider border border-white/20 mb-6">
            <Zap className="h-3 w-3" />{t("sv_tarifs_transparents")}</span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">{t("sv_solutions_techniques_pour_votre_industrie")}</h1>
          <p className="text-lg opacity-90 mt-4">{t("sv_quatre_services_specialises_des_tarifs_clairs_zero")}</p>
        </div>
      </section>

      {/* ── Nav rapide par service ───────────────────── */}
      <section className="py-6 bg-muted/30 border-b sticky top-[72px] z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-wrap gap-2 justify-center">
            {SERVICES(t).map((svc) => {
              const Icon = svc.icon;
              return (
                <a
                  key={svc.id}
                  href={`#${svc.id}`}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-card border text-sm font-medium hover:bg-primary hover:text-primary-foreground hover:border-primary transition-colors"
                >
                  <Icon className="h-4 w-4" />
                  {svc.title}
                </a>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Les 4 services en détail ─────────────────── */}
      <section className="py-16">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl space-y-24">
          {SERVICES(t).map((svc, i) => {
            const Icon = svc.icon;
            const reverse = i % 2 === 1;
            return (
              <ScrollReveal key={svc.id} animation={reverse ? "animate-reveal-left" : "animate-reveal-right"} delay={i * 100}>
              <article
                id={svc.id}
                className="scroll-mt-[160px] grid lg:grid-cols-2 gap-12 items-center"
              >
                <div
                  className={`relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl ${
                    reverse ? "lg:order-2" : ""
                  }`}
                >
                  <Image
                    src={svc.image}
                    alt={svc.title}
                    fill
                    className="object-cover"
                    sizes="(max-width: 1024px) 100vw, 50vw"
                  />
                  <div className="absolute top-4 left-4 px-3 py-1.5 bg-white/90 backdrop-blur-sm rounded-full text-xs font-bold text-primary uppercase tracking-wider shadow-lg">
                    {svc.badge}
                  </div>
                </div>

                <div className={reverse ? "lg:order-1" : ""}>
                  <div className="flex items-center gap-3 mb-4">
                    <div className="h-12 w-12 rounded-lg vnk-gradient flex items-center justify-center">
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <h2 className="text-3xl sm:text-4xl font-bold">{svc.title}</h2>
                  </div>

                  <p className="text-lg text-muted-foreground leading-relaxed">
                    {svc.description}
                  </p>

                  <div className="mt-6 p-4 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="text-2xl font-bold text-primary">{svc.price}</div>
                    <div className="text-xs text-muted-foreground mt-1">{svc.priceSub}</div>
                  </div>

                  <ul className="mt-6 space-y-2">
                    {svc.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <div className="mt-8 flex gap-3 flex-wrap">
                    <Button asChild size="lg">
                      <Link href={`/contact?service=${svc.id}` as "/contact"}>{t("sv_demander_un_devis")}<ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link href="/contact">{t("poser_une_question")}</Link>
                    </Button>
                  </div>
                </div>
              </article>
              </ScrollReveal>
            );
          })}
        </div>
      </section>

      {/* ── Tableau comparatif ───────────────────────── */}
      <ScrollReveal animation="animate-reveal-up">
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">{t("lequel_choisir")}</h2>
            <p className="text-muted-foreground mt-3">{t("sv_un_guide_rapide_pour_identifier_le_service")}</p>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">{t("sv_besoin")}</th>
                      <th className="text-left px-4 py-3 font-semibold">{t("sv_service")}</th>
                      <th className="text-left px-4 py-3 font-semibold">{t("delai")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3">{t("panne_urgente")}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{t("sv_support_plc")}</td>
                      <td className="px-4 py-3">{t("sv_24h_ouvrables")}</td>
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <td className="px-4 py-3">{t("reprendre_ligne_sans_doc")}</td>
                      <td className="px-4 py-3 font-semibold text-primary">Audit + Documentation</td>
                      <td className="px-4 py-3">{t("sv_2_4_semaines")}</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">{t("sv_code_plc_vieux_et_instable")}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{t("sv_refactorisation")}</td>
                      <td className="px-4 py-3">{t("sv_4_12_semaines")}</td>
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <td className="px-4 py-3">{t("former_nouvelle_equipe")}</td>
                      <td className="px-4 py-3 font-semibold text-primary">Documentation</td>
                      <td className="px-4 py-3">{t("sv_2_6_semaines")}</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">{t("preparer_modernisation_usine")}</td>
                      <td className="px-4 py-3 font-semibold text-primary">{t("sv_audit_technique_col")}</td>
                      <td className="px-4 py-3">{t("sv_1_3_semaines")}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
      </ScrollReveal>

      {/* ── CTA final ───────────────────────────────── */}
      <ScrollReveal animation="animate-reveal-scale">
      <section className="py-24 vnk-gradient text-white">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">{t("sv_besoin_d_un_conseil_gratuit")}</h2>
          <p className="mt-4 text-lg opacity-90">{t("sv_un_appel_de_30_minutes_pour_comprendre")}</p>
          <Button
            asChild
            size="lg"
            className="bg-white text-[#0F2D52] hover:bg-white/90 h-14 px-8 mt-8"
          >
            <Link href="/contact">{t("sv_reserver_un_appel")}<ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
      </ScrollReveal>
    </>
  );
}

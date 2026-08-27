// Public · À propos — sur l'ENTREPRISE VNK Automatisation Inc.
import { setRequestLocale, getTranslations } from "next-intl/server";
import { Link } from "@/i18n/routing";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  ArrowRight,
  Target,
  Eye,
  Heart,
  Award,
  Shield,
  Users,
  TrendingUp,
  Building2,
  Cpu,
  Wrench,
  Zap,
} from "lucide-react";
import Image from "next/image";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "about" });
  return {
    title: t("page_title"),
    description:
      t("ab_vnk_automatisation_inc_societe_quebecoise_specialisee_en"),
  };
}

// ─── Valeurs de l'entreprise ─────────────────────────
const VALUES = (t: (k: string) => string) => [
  {
    icon: Target,
    title: t("ab_specialisation"),
    desc: t("ab_nous_ne_sommes_pas_generalistes_toute_notre"),
  },
  {
    icon: Shield,
    title: "Transparence",
    desc: t("ab_tarifs_publics_rapports_ecrits_systematiques_engagements_clairs"),
  },
  {
    icon: Heart,
    title: t("ab_qualite_technique"),
    desc: t("ab_code_propre_normalise_iec_61131_3_teste"),
  },
  {
    icon: TrendingUp,
    title: t("ab_amelioration_continue"),
    desc: t("ab_veille_technologique_permanente_formations_aux_nouvelles_versions"),
  },
];

// ─── Marques d'automates supportées ──────────────────
const BRANDS = (t: (k: string) => string) => [
  {
    name: "Siemens",
    software: ["Step 7", "TIA Portal", "WinCC"],
    desc: t("ab_expertise_s7_1200_s7_1500_s7_300"),
  },
  {
    name: t("ab_rockwell_automation"),
    software: ["RSLogix 5000", "Studio 5000", "FactoryTalk"],
    desc: t("ab_expertise_controllogix_compactlogix_micrologix"),
  },
  {
    name: t("ab_b_r_automation"),
    software: ["Automation Studio", "X20 / X2X"],
    desc: t("ab_expertise_x20_mapp_technology_servocommandes"),
  },
  {
    name: t("ab_schneider_electric"),
    software: ["EcoStruxure", "Control Expert", "Unity Pro"],
    desc: t("ab_expertise_modicon_m340_m580_quantum"),
  },
];

// ─── Logiciels & technologies maîtrisés ───────────────
const SOFTWARE = (t: (k: string) => string) => [
  { name: t("ab_tia_portal"), category: t("ab_ide_plc") },
  { name: t("ab_studio_5000"), category: t("ab_ide_plc") },
  { name: t("ab_automation_studio"), category: t("ab_ide_plc") },
  { name: "EcoStruxure", category: t("ab_ide_plc") },
  { name: "WinCC", category: t("ab_scada_hmi") },
  { name: "FactoryTalk", category: t("ab_scada_hmi") },
  { name: "Ignition", category: t("ab_scada_hmi") },
  { name: "Wonderware", category: t("ab_scada_hmi") },
  { name: "Profinet", category: t("ab_protocole_reseau") },
  { name: "EtherNet/IP", category: t("ab_protocole_reseau") },
  { name: t("ab_modbus_tcp_rtu"), category: t("ab_protocole_reseau") },
  { name: t("ab_opc_ua"), category: t("ab_protocole_reseau") },
];

// ─── Secteurs desservis ──────────────────────────────
const SECTORS = (t: (k: string) => string) => [
  t("ab_sec_fabrication"),
  t("ab_sec_agroalimentaire"),
  t("ab_sec_pates_papiers"),
  t("ab_sec_metallurgie"),
  t("ab_sec_automobile"),
  t("ab_sec_pharmaceutique"),
  t("ab_sec_chimie"),
  t("ab_sec_energie"),
  t("ab_sec_aeronautique"),
  t("ab_sec_mines"),
];

// ─── Timeline ────────────────────────────────────────
const TIMELINE = (t: (k: string) => string) => [
  {
    year: "2026",
    title: t("ab_constitution_au_quebec"),
    desc: t("ab_vnk_automatisation_inc_est_constituee_comme_societe"),
  },
  {
    year: "2026",
    title: t("ab_lancement_des_services"),
    desc: t("ab_demarrage_officiel_des_services_support_plc_a"),
  },
  {
    year: "2026",
    title: t("ab_portail_client_en_ligne"),
    desc: t("ab_mise_en_ligne_du_portail_client_permettant"),
  },
];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const t = await getTranslations({ locale, namespace: "about" });

  return (
    <>
      {/* ═══════════════════════════════════════════════════
          HERO
          ═══════════════════════════════════════════════════ */}
      <section className="relative pt-40 pb-24 vnk-gradient text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image src="/images/about-hero.jpg" alt="" fill className="object-cover" sizes="100vw" />
        </div>
        <div className="relative container mx-auto px-4 max-w-4xl">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold uppercase tracking-wider border border-white/20 mb-6">
            <Building2 className="h-3 w-3" />{t("ab_a_propos_de_l_entreprise")}</span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
            VNK Automatisation Inc.
          </h1>
          <p className="text-xl opacity-90 mt-6 max-w-2xl">{t("ab_une_societe_quebecoise_specialisee_en_automatisation_industrielle")}</p>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          MISSION / VISION
          ═══════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="grid md:grid-cols-2 gap-8">
            <Card className="vnk-card-hover">
              <CardContent className="p-8">
                <div className="h-12 w-12 rounded-lg vnk-gradient flex items-center justify-center mb-4">
                  <Target className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-3">{t("ab_notre_mission")}</h2>
                <p className="text-muted-foreground leading-relaxed">{t("ab_accompagner_les_entreprises_industrielles_quebecoises_dans_la")}</p>
              </CardContent>
            </Card>

            <Card className="vnk-card-hover">
              <CardContent className="p-8">
                <div className="h-12 w-12 rounded-lg vnk-gradient flex items-center justify-center mb-4">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-3">{t("ab_notre_vision")}</h2>
                <p className="text-muted-foreground leading-relaxed">{t("ab_devenir_la_reference_au_quebec_pour_les")}</p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          VALEURS
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{t("ab_nos_valeurs")}</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">{t("ab_ce_qui_nous_guide_au_quotidien")}</h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES(t).map((val) => {
              const Icon = val.icon;
              return (
                <Card key={val.title} className="vnk-card-hover">
                  <CardContent className="p-6">
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-bold text-lg">{val.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {val.desc}
                    </p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          MARQUES SUPPORTÉES
          ═══════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{t("ab_partenaires_technologiques")}</span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">{t("ab_marques_d_automates_supportees")}</h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">{t("ab_nous_maitrisons_les_grandes_familles_de_plc")}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BRANDS(t).map((brand) => (
              <Card key={brand.name} className="vnk-card-hover">
                <CardContent className="p-6">
                  <div className="flex items-start gap-4">
                    <div className="h-14 w-14 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Cpu className="h-7 w-7 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-xl">{brand.name}</h3>
                      <p className="text-sm text-muted-foreground mt-1">
                        {brand.desc}
                      </p>
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {brand.software.map((sw) => (
                          <span
                            key={sw}
                            className="inline-flex px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-semibold"
                          >
                            {sw}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          LOGICIELS & TECHNOS
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">{t("ab_logiciels_et_technologies_maitrises")}</h2>
            <p className="text-muted-foreground mt-3">{t("ab_nous_travaillons_au_quotidien_avec_les_outils")}</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {SOFTWARE(t).map((sw) => (
              <div
                key={sw.name}
                className="p-4 rounded-lg border bg-card text-center vnk-card-hover"
              >
                <div className="h-8 w-8 rounded bg-primary/10 flex items-center justify-center mx-auto mb-2">
                  <Wrench className="h-4 w-4 text-primary" />
                </div>
                <div className="font-semibold text-sm">{sw.name}</div>
                <div className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider">
                  {sw.category}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          SECTEURS DESSERVIS
          ═══════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">{t("ab_secteurs_d_activite")}</span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3">{t("ab_industries_desservies")}</h2>
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed">{t("ab_vnk_automatisation_inc_intervient_dans_l_ensemble")}</p>

              <div className="flex flex-wrap gap-2 mt-6">
                {SECTORS(t).map((sector) => (
                  <span
                    key={sector}
                    className="inline-flex px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium"
                  >
                    {sector}
                  </span>
                ))}
              </div>
            </div>

            <div className="relative aspect-[4/3] rounded-2xl overflow-hidden shadow-xl">
              <Image
                src="/images/about-workspace.jpg"
                alt={t("ab_alt_environnement")}
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          HISTORIQUE / TIMELINE(t)
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">{t("ab_notre_histoire")}</span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-3">{t("ab_un_projet_ne_de_l_expertise_terrain")}</h2>
          </div>

          <div className="relative space-y-8 pl-8 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-primary/20">
            {TIMELINE(t).map((event, i) => (
              <div key={i} className="relative">
                <div className="absolute -left-8 top-2 h-6 w-6 rounded-full vnk-gradient flex items-center justify-center ring-4 ring-muted/30">
                  <div className="h-2 w-2 rounded-full bg-white" />
                </div>
                <Card>
                  <CardContent className="p-6">
                    <div className="text-xs font-bold text-primary uppercase tracking-wider">
                      {event.year}
                    </div>
                    <h3 className="font-bold text-lg mt-1">{event.title}</h3>
                    <p className="text-sm text-muted-foreground mt-2 leading-relaxed">
                      {event.desc}
                    </p>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          INFOS LÉGALES
          ═══════════════════════════════════════════════════ */}
      <section className="py-24">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <Card>
            <CardContent className="p-8">
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1">
                  <h2 className="text-xl font-bold">{t("informations_legales")}</h2>
                  <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">{t("ab_denomination")}</div>
                      <div className="font-semibold">VNK Automatisation Inc.</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">{t("ab_forme_juridique")}</div>
                      <div className="font-semibold">{t("societe_par_actions")}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">{t("ab_constituee")}</div>
                      <div className="font-semibold">{t("mars_2026_quebec")}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">{t("ab_secteur")}</div>
                      <div className="font-semibold">{t("ab_services_d_automatisation_industrielle")}</div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          CTA
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 vnk-gradient text-white">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">{t("ab_travaillons_ensemble")}</h2>
          <p className="mt-4 text-lg opacity-90">{t("ab_que_ce_soit_pour_une_urgence_un")}</p>
          <Button
            asChild
            size="lg"
            className="bg-white text-[#0F2D52] hover:bg-white/90 h-14 px-8 mt-8"
          >
            <Link href="/contact">{t("ab_nous_contacter")}<ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

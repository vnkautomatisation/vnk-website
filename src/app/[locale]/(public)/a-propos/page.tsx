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
      "VNK Automatisation Inc. — Société québécoise spécialisée en automatisation industrielle. Mission, vision, valeurs et partenaires technologiques.",
  };
}

// ─── Valeurs de l'entreprise ─────────────────────────
const VALUES = [
  {
    icon: Target,
    title: "Spécialisation",
    desc: "Nous ne sommes pas généralistes. Toute notre expertise est concentrée exclusivement sur l'automatisation industrielle — PLC, SCADA, HMI.",
  },
  {
    icon: Shield,
    title: "Transparence",
    desc: "Tarifs publics, rapports écrits systématiques, engagements clairs. Aucune zone d'ombre dans nos interventions ni nos factures.",
  },
  {
    icon: Heart,
    title: "Qualité technique",
    desc: "Code propre, normalisé IEC 61131-3, testé et documenté. Nous ne livrons jamais un travail dont nous ne serions pas fiers.",
  },
  {
    icon: TrendingUp,
    title: "Amélioration continue",
    desc: "Veille technologique permanente, formations aux nouvelles versions des outils, participation active à la communauté automation.",
  },
];

// ─── Marques d'automates supportées ──────────────────
const BRANDS = [
  {
    name: "Siemens",
    software: ["Step 7", "TIA Portal", "WinCC"],
    desc: "Expertise S7-1200 / S7-1500 / S7-300 / S7-400",
  },
  {
    name: "Rockwell Automation",
    software: ["RSLogix 5000", "Studio 5000", "FactoryTalk"],
    desc: "Expertise ControlLogix / CompactLogix / MicroLogix",
  },
  {
    name: "B&R Automation",
    software: ["Automation Studio", "X20 / X2X"],
    desc: "Expertise X20, Mapp Technology, Servocommandes",
  },
  {
    name: "Schneider Electric",
    software: ["EcoStruxure", "Control Expert", "Unity Pro"],
    desc: "Expertise Modicon M340 / M580 / Quantum",
  },
];

// ─── Logiciels & technologies maîtrisés ───────────────
const SOFTWARE = [
  { name: "TIA Portal", category: "IDE PLC" },
  { name: "Studio 5000", category: "IDE PLC" },
  { name: "Automation Studio", category: "IDE PLC" },
  { name: "EcoStruxure", category: "IDE PLC" },
  { name: "WinCC", category: "SCADA / HMI" },
  { name: "FactoryTalk", category: "SCADA / HMI" },
  { name: "Ignition", category: "SCADA / HMI" },
  { name: "Wonderware", category: "SCADA / HMI" },
  { name: "Profinet", category: "Protocole réseau" },
  { name: "EtherNet/IP", category: "Protocole réseau" },
  { name: "Modbus TCP/RTU", category: "Protocole réseau" },
  { name: "OPC UA", category: "Protocole réseau" },
];

// ─── Secteurs desservis ──────────────────────────────
const SECTORS = [
  "Fabrication industrielle",
  "Agroalimentaire",
  "Pâtes et papiers",
  "Métallurgie",
  "Automobile",
  "Pharmaceutique",
  "Chimie",
  "Énergie",
  "Aéronautique",
  "Mines",
];

// ─── Timeline ────────────────────────────────────────
const TIMELINE = [
  {
    year: "2026",
    title: "Constitution au Québec",
    desc: "VNK Automatisation Inc. est constituée comme société par actions en mars 2026, enregistrée au Registre des entreprises du Québec.",
  },
  {
    year: "2026",
    title: "Lancement des services",
    desc: "Démarrage officiel des services : support PLC à distance, audit technique, documentation industrielle et refactorisation de code legacy.",
  },
  {
    year: "2026",
    title: "Portail client en ligne",
    desc: "Mise en ligne du portail client permettant le suivi des mandats, devis, factures et échanges en temps réel.",
  },
];

export default async function AboutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

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
            <Building2 className="h-3 w-3" />
            À propos de l&apos;entreprise
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold">
            VNK Automatisation Inc.
          </h1>
          <p className="text-xl opacity-90 mt-6 max-w-2xl">
            Une société québécoise spécialisée en automatisation industrielle,
            dédiée à offrir des services techniques de haut niveau aux
            entreprises manufacturières.
          </p>
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
                <h2 className="text-2xl font-bold mb-3">Notre mission</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Accompagner les entreprises industrielles québécoises dans la
                  fiabilisation, la modernisation et la documentation de leurs
                  systèmes automatisés, avec une approche technique rigoureuse
                  et une transparence totale sur nos interventions.
                </p>
              </CardContent>
            </Card>

            <Card className="vnk-card-hover">
              <CardContent className="p-8">
                <div className="h-12 w-12 rounded-lg vnk-gradient flex items-center justify-center mb-4">
                  <Eye className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-2xl font-bold mb-3">Notre vision</h2>
                <p className="text-muted-foreground leading-relaxed">
                  Devenir la référence au Québec pour les services
                  d&apos;automatisation industrielle spécialisés — reconnue pour
                  la qualité de son code, la clarté de sa documentation et la
                  rapidité de ses interventions.
                </p>
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
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Nos valeurs
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">
              Ce qui nous guide au quotidien
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {VALUES.map((val) => {
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
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Partenaires technologiques
            </span>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mt-3">
              Marques d&apos;automates supportées
            </h2>
            <p className="text-muted-foreground mt-4 text-lg max-w-2xl mx-auto">
              Nous maîtrisons les grandes familles de PLC utilisées dans
              l&apos;industrie nord-américaine et européenne.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {BRANDS.map((brand) => (
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
            <h2 className="text-3xl sm:text-4xl font-bold">
              Logiciels et technologies maîtrisés
            </h2>
            <p className="text-muted-foreground mt-3">
              Nous travaillons au quotidien avec les outils standards de
              l&apos;industrie.
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {SOFTWARE.map((sw) => (
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
              <span className="text-xs font-bold text-primary uppercase tracking-wider">
                Secteurs d&apos;activité
              </span>
              <h2 className="text-3xl sm:text-4xl font-bold mt-3">
                Industries desservies
              </h2>
              <p className="text-muted-foreground mt-4 text-lg leading-relaxed">
                VNK Automatisation Inc. intervient dans l&apos;ensemble des
                secteurs industriels où l&apos;automatisation est présente, du
                petit atelier manufacturier aux grandes installations de
                production continue.
              </p>

              <div className="flex flex-wrap gap-2 mt-6">
                {SECTORS.map((sector) => (
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
                alt="Environnement industriel"
                fill
                className="object-cover"
                sizes="(max-width: 1024px) 100vw, 50vw"
              />
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════
          HISTORIQUE / TIMELINE
          ═══════════════════════════════════════════════════ */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-4xl">
          <div className="text-center mb-16">
            <span className="text-xs font-bold text-primary uppercase tracking-wider">
              Notre histoire
            </span>
            <h2 className="text-3xl sm:text-4xl font-bold mt-3">
              Un projet né de l&apos;expertise terrain
            </h2>
          </div>

          <div className="relative space-y-8 pl-8 before:content-[''] before:absolute before:left-3 before:top-2 before:bottom-2 before:w-0.5 before:bg-primary/20">
            {TIMELINE.map((event, i) => (
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
                  <h2 className="text-xl font-bold">Informations légales</h2>
                  <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Dénomination
                      </div>
                      <div className="font-semibold">VNK Automatisation Inc.</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Forme juridique
                      </div>
                      <div className="font-semibold">Société par actions (Inc.)</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Constituée
                      </div>
                      <div className="font-semibold">Mars 2026 · Québec, Canada</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground uppercase tracking-wider">
                        Secteur
                      </div>
                      <div className="font-semibold">
                        Services d&apos;automatisation industrielle
                      </div>
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
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
            Travaillons ensemble
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Que ce soit pour une urgence, un audit ou une modernisation, nous
            sommes à votre disposition pour en discuter.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-white text-[#0F2D52] hover:bg-white/90 h-14 px-8 mt-8"
          >
            <Link href="/contact">
              Nous contacter
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

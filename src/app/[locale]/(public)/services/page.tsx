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
      "Services d'automatisation industrielle : support PLC à distance, audit technique, documentation industrielle, refactorisation PLC. Tarifs transparents.",
    openGraph: {
      title: t("page_title") + " | VNK Automatisation",
      description: "Support PLC, audit, documentation, refactorisation",
    },
  };
}

const SERVICES = [
  {
    id: "support-plc",
    icon: Wrench,
    image: "/images/plc-support.jpg",
    badge: "Support",
    title: "Support PLC à distance",
    description:
      "Diagnostic et résolution rapide de pannes sur vos automates — sans attendre un déplacement sur site. Interventions priorisées, documentées et garanties.",
    price: "120–150 CAD/h",
    priceSub: "Minimum 1h · Facturation au quart d'heure après",
    features: [
      "Diagnostic à distance via TeamViewer, AnyDesk ou VPN",
      "Accès au code PLC pour analyse approfondie",
      "Correction et tests en ligne avec votre équipe",
      "Rapport écrit détaillé livré après chaque intervention",
      "Support Siemens (Step 7, TIA Portal, WinCC)",
      "Support Rockwell (RSLogix, Studio 5000, FactoryTalk)",
      "Support B&R (Automation Studio)",
      "Support Schneider (Modicon, EcoStruxure)",
    ],
  },
  {
    id: "audit",
    icon: FileCheck,
    image: "/images/audit.jpg",
    badge: "Audit",
    title: "Audit technique",
    description:
      "Évaluation complète de votre système — risques, performance et plan d'action concret. Identifiez les faiblesses avant qu'elles ne causent des arrêts de production.",
    price: "1 500–4 000 CAD",
    priceSub: "Forfait selon la taille du système",
    features: [
      "Analyse du code PLC existant",
      "Évaluation de l'architecture SCADA/HMI",
      "Identification des risques et points de défaillance",
      "Recommandations de sécurité fonctionnelle",
      "Rapport détaillé avec plan d'action chiffré",
      "Priorisation des améliorations (critique / important / nice-to-have)",
      "Estimation des coûts de modernisation",
      "Présentation des résultats à votre équipe",
    ],
  },
  {
    id: "documentation",
    icon: Cpu,
    image: "/images/documentation.jpg",
    badge: "Documentation",
    title: "Documentation industrielle",
    description:
      "Procédures opérateur, maintenance et dépannage — rédigées pour votre équipe. Formez plus vite vos nouveaux employés et réduisez les dépendances.",
    price: "800–5 000 CAD",
    priceSub: "Selon la portée du projet",
    features: [
      "Procédures opérateur pas-à-pas illustrées",
      "Manuel de maintenance préventive",
      "Guide de dépannage avec arbres de décision",
      "Fiches techniques des automates et I/O",
      "Schémas P&ID et architecture réseau",
      "Livraison en PDF + sources éditables",
      "Traduction FR/EN disponible",
      "Mises à jour gratuites pendant 6 mois",
    ],
  },
  {
    id: "refactoring",
    icon: Clock,
    image: "/images/refactoring.jpg",
    badge: "Refactoring",
    title: "Refactorisation PLC",
    description:
      "Modernisation de code legacy — fiabilité améliorée, dette technique éliminée. Transformez vos vieux programmes en code maintenable aux standards actuels.",
    price: "3 000–50 000 CAD",
    priceSub: "Selon la complexité et la taille du code",
    features: [
      "Migration vers IEC 61131-3 (ST, FBD, LD, SFC)",
      "Refactor de code AWL/STL legacy",
      "Séparation modulaire (fonctions, FB, programmes)",
      "Optimisation des temps de cycle",
      "Normalisation des noms de variables et commentaires",
      "Tests de non-régression complets",
      "Documentation technique du nouveau code",
      "Formation de votre équipe au nouveau code",
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

  return (
    <>
      {/* ── HERO ─────────────────────────────────────── */}
      <section className="relative pt-40 pb-24 vnk-gradient text-white overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <Image src="/images/hero-bg.jpg" alt="" fill className="object-cover" sizes="100vw" />
        </div>
        <div className="relative container mx-auto px-4 text-center max-w-3xl">
          <span className="inline-flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-sm rounded-full text-xs font-semibold uppercase tracking-wider border border-white/20 mb-6">
            <Zap className="h-3 w-3" />
            Tarifs transparents
          </span>
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-tight">
            Solutions techniques pour votre industrie
          </h1>
          <p className="text-lg opacity-90 mt-4">
            Quatre services spécialisés, des tarifs clairs, zéro surprise sur votre facture.
          </p>
        </div>
      </section>

      {/* ── Nav rapide par service ───────────────────── */}
      <section className="py-6 bg-muted/30 border-b sticky top-[72px] z-20 backdrop-blur-md">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="flex flex-wrap gap-2 justify-center">
            {SERVICES.map((svc) => {
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
          {SERVICES.map((svc, i) => {
            const Icon = svc.icon;
            const reverse = i % 2 === 1;
            return (
              <article
                key={svc.id}
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
                      <Link href={`/contact?service=${svc.id}` as "/contact"}>
                        Demander un devis
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild size="lg" variant="outline">
                      <Link href="/contact">Poser une question</Link>
                    </Button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ── Tableau comparatif ───────────────────────── */}
      <section className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8 max-w-5xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold">Lequel choisir ?</h2>
            <p className="text-muted-foreground mt-3">
              Un guide rapide pour identifier le service adapté à votre besoin.
            </p>
          </div>

          <Card className="overflow-hidden">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary text-primary-foreground">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Besoin</th>
                      <th className="text-left px-4 py-3 font-semibold">Service</th>
                      <th className="text-left px-4 py-3 font-semibold">Délai</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="px-4 py-3">Panne urgente, production arrêtée</td>
                      <td className="px-4 py-3 font-semibold text-primary">Support PLC</td>
                      <td className="px-4 py-3">24h ouvrables</td>
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <td className="px-4 py-3">Reprendre une ligne sans documentation</td>
                      <td className="px-4 py-3 font-semibold text-primary">Audit + Documentation</td>
                      <td className="px-4 py-3">2–4 semaines</td>
                    </tr>
                    <tr className="border-b">
                      <td className="px-4 py-3">Code PLC vieux et instable</td>
                      <td className="px-4 py-3 font-semibold text-primary">Refactorisation</td>
                      <td className="px-4 py-3">4–12 semaines</td>
                    </tr>
                    <tr className="border-b bg-muted/30">
                      <td className="px-4 py-3">Former une nouvelle équipe</td>
                      <td className="px-4 py-3 font-semibold text-primary">Documentation</td>
                      <td className="px-4 py-3">2–6 semaines</td>
                    </tr>
                    <tr>
                      <td className="px-4 py-3">Préparer une modernisation d&apos;usine</td>
                      <td className="px-4 py-3 font-semibold text-primary">Audit technique</td>
                      <td className="px-4 py-3">1–3 semaines</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ── CTA final ───────────────────────────────── */}
      <section className="py-24 vnk-gradient text-white">
        <div className="container mx-auto px-4 text-center max-w-3xl">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold">
            Besoin d&apos;un conseil gratuit ?
          </h2>
          <p className="mt-4 text-lg opacity-90">
            Un appel de 30 minutes pour comprendre votre besoin et vous diriger
            vers le bon service — sans engagement.
          </p>
          <Button
            asChild
            size="lg"
            className="bg-white text-[#0F2D52] hover:bg-white/90 h-14 px-8 mt-8"
          >
            <Link href="/contact">
              Réserver un appel
              <ArrowRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>
    </>
  );
}

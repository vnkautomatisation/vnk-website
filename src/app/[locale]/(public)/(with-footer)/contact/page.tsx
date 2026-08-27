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

const ENGAGEMENTS = (t: (k: string) => string) => [
  {
    icon: Clock,
    title: t("ct_reponse_sous_24h_ouvrables"),
    desc: t("ct_votre_demande_est_traitee_le_jour_meme"),
  },
  {
    icon: MessageSquare,
    title: t("ct_consultation_initiale_gratuite"),
    desc: t("ct_premier_echange_de_30_min_sans_engagement"),
  },
  {
    icon: FileText,
    title: t("ct_devis_detaille_et_transparent"),
    desc: t("ct_ventilation_claire_par_etape_sans_frais_caches"),
  },
  {
    icon: Shield,
    title: t("ct_confidentialite_garantie_nda"),
    desc: t("ct_vos_donnees_techniques_codes_plc_et_secrets"),
  },
];

const STEPS = (t: (k: string) => string) => [
  {
    num: "01",
    title: t("ct_reception_de_votre_message"),
    desc: t("ct_accuse_de_reception_automatique_votre_dossier_est"),
  },
  {
    num: "02",
    title: t("ct_appel_de_qualification"),
    desc: t("ct_un_technicien_vous_rappelle_sous_24h_pour"),
  },
  {
    num: "03",
    title: t("ct_devis_ou_intervention_urgente"),
    desc: t("ct_selon_l_urgence_devis_ecrit_ou_deploiement"),
  },
  {
    num: "04",
    title: t("ct_demarrage_du_mandat"),
    desc: t("ct_contrat_electronique_acces_portail_client_debut_des"),
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
              <MessageSquare className="h-3 w-3 mr-1" />{t("ct_consultation_gratuite")}</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold mb-6">
              {t("hero_title")}
            </h1>
            <p className="text-lg sm:text-xl text-white/80 leading-relaxed">
              {t("hero_subtitle")}
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>{t("reponse_moins_24h")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>{t("ct_sans_engagement")}</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-green-400" />
                <span>{t("ct_devis_gratuit")}</span>
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
                <h2 className="text-2xl font-bold mb-2">{t("envoyez_nous_message")}</h2>
                <p className="text-sm text-muted-foreground">{t("ct_remplissez_le_formulaire_ci_dessous_nous_vous")}</p>
              </div>
              <ContactForm />
            </div>

            {/* Coordonnées — 1/3 */}
            <div className="space-y-4">
              {/* Coordonnées */}
              <Card className="border-2 border-[#0F2D52]/10">
                <CardContent className="p-6 space-y-5">
                  <div>
                    <h3 className="text-lg font-bold mb-1">{t("coordonnees")}</h3>
                    <p className="text-xs text-muted-foreground">{t("ct_joignez_nous_directement")}</p>
                  </div>

                  <div className="space-y-4">
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                        <Mail className="h-4 w-4 text-[#0F2D52]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("ct_courriel")}</p>
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
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("ct_telephone")}</p>
                        <a
                          href="tel:+18192908686"
                          className="text-sm font-medium hover:text-[#0F2D52]"
                        >
                          (819) 290-8686
                        </a>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t("ct_urgences_plc")}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-[#0F2D52]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("ct_adresse")}</p>
                        <p className="text-sm font-medium">{t("quebec_qc")}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t("ct_canada_service_a_distance_et_sur_site")}</p>
                      </div>
                    </div>

                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                        <Clock className="h-4 w-4 text-[#0F2D52]" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("ct_heures_ouverture")}</p>
                        <p className="text-sm font-medium">{t("ct_lun_ven")}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{t("ct_support_urgence")}</p>
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
                    <h3 className="text-sm font-bold uppercase tracking-wider">{t("ct_entreprise")}</h3>
                  </div>
                  <div className="space-y-2 text-sm">
                    <p className="font-bold text-base">VNK Automatisation Inc.</p>
                    <p className="text-white/70 text-xs">{t("ct_societe_par_actions_incorporee_au_quebec")}</p>
                    <div className="pt-3 border-t border-white/20 mt-3 space-y-1">
                      <p className="text-white/70 text-xs">{t("neq_sur_demande")}</p>
                      <p className="text-white/70 text-xs">{t("ct_tps_tvq")}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Engagements */}
              <Card>
                <CardContent className="p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider mb-4">{t("ct_nos_engagements")}</h3>
                  <ul className="space-y-3">
                    {ENGAGEMENTS(t).map((e, i) => (
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
              <Calendar className="h-3 w-3 mr-1" />{t("ct_processus")}</Badge>
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">{t("ct_et_apres_l_envoi")}</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">{t("ct_voici_comment_se_deroule_notre_prise_de")}</p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {STEPS(t).map((step, i) => (
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
          <h2 className="text-2xl font-bold mb-3">{t("vos_donnees_sont_protegees")}</h2>
          <p className="text-muted-foreground max-w-2xl mx-auto leading-relaxed">{t("ct_toutes_les_informations_soumises_via_ce_formulaire")}</p>
        </div>
      </section>
    </>
  );
}

"use client";
// Assistant de configuration initiale — wizard 6 étapes.
// Chaque étape pousse la valeur dans la table Setting via updateSettingsAction.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles, ChevronLeft, ChevronRight as ChevronRightIcon,
  Building2, Palette, Receipt, Wallet, Shield, Users,
  CheckCircle2, Circle, Rocket, ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { updateSettingsAction } from "@/app/actions/settings";

type StepKey = "company" | "branding" | "fiscal" | "finance" | "law25" | "team";

const STEPS: { key: StepKey; labelKey: string; icon: React.ComponentType<{ className?: string }>; descriptionKey: string }[] = [
  { key: "company", labelKey: "identite_entreprise", icon: Building2, descriptionKey: "nom_adresse_coordonnees" },
  { key: "branding", labelKey: "charte_graphique", icon: Palette, descriptionKey: "logos_couleurs" },
  { key: "fiscal", labelKey: "identifiants_fiscaux", icon: Receipt, descriptionKey: "neq_tps_tvq" },
  { key: "finance", labelKey: "compte_bancaire", icon: Wallet, descriptionKey: "banque_virements_interac" },
  { key: "law25", labelKey: "loi_25_quebec", icon: Shield, descriptionKey: "rprp_politique" },
  { key: "team", labelKey: "equipe", icon: Users, descriptionKey: "creer_premiers_employes" },
];

export function OnboardingWizard({
  initial, progress,
}: {
  initial: Record<string, string>;
  progress: Record<StepKey, boolean>;
}) {
  const t = useTranslations("admin.onboarding");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<StepKey>(() => {

    const firstIncomplete = STEPS.find((s) => !progress[s.key]);
    return firstIncomplete?.key ?? "company";
  });


  const [companyName, setCompanyName] = useState(initial["company.name"] ?? "");
  const [companyLegalName, setCompanyLegalName] = useState(initial["company.legal_name"] ?? "");
  const [companyEmail, setCompanyEmail] = useState(initial["company.email"] ?? "");
  const [companyPhone, setCompanyPhone] = useState(initial["company.phone"] ?? "");
  const [companyAddress, setCompanyAddress] = useState(initial["company.address"] ?? "");
  const [companyCity, setCompanyCity] = useState(initial["company.city"] ?? "");
  const [companyProvince, setCompanyProvince] = useState(initial["company.province"] || "QC");
  const [companyPostal, setCompanyPostal] = useState(initial["company.postal_code"] ?? "");

  const [primaryColor, setPrimaryColor] = useState(initial["appearance.color_primary"] || "#0F2D52");
  const [secondaryColor, setSecondaryColor] = useState(initial["appearance.color_secondary"] || "#1A5FB4");

  const [neq, setNeq] = useState(initial["fiscal.neq"] ?? "");
  const [gst, setGst] = useState(initial["fiscal.gst_number"] ?? "");
  const [qst, setQst] = useState(initial["fiscal.qst_number"] ?? "");

  const [bankName, setBankName] = useState(initial["finance.bank_name"] ?? "");
  const [bankInstitution, setBankInstitution] = useState(initial["finance.bank_institution"] ?? "");
  const [bankTransit, setBankTransit] = useState(initial["finance.bank_transit"] ?? "");
  const [bankAccount, setBankAccount] = useState(initial["finance.bank_account"] ?? "");

  const [rprpName, setRprpName] = useState(initial["legal.rprp_name"] ?? "");
  const [rprpEmail, setRprpEmail] = useState(initial["legal.rprp_email"] ?? "");
  const [rprpTitle, setRprpTitle] = useState(initial["legal.rprp_title"] ?? "");


  const saveCompany = async () => {
    return updateSettingsAction({
      category: "company",
      updates: [
        { key: "name", value: companyName },
        { key: "legal_name", value: companyLegalName },
        { key: "email", value: companyEmail },
        { key: "phone", value: companyPhone },
        { key: "address", value: companyAddress },
        { key: "city", value: companyCity },
        { key: "province", value: companyProvince },
        { key: "postal_code", value: companyPostal },
      ],
    });
  };
  const saveBranding = async () => {
    return updateSettingsAction({
      category: "appearance",
      updates: [
        { key: "color_primary", value: primaryColor },
        { key: "color_secondary", value: secondaryColor },
      ],
    });
  };
  const saveFiscal = async () => {
    return updateSettingsAction({
      category: "fiscal",
      updates: [
        { key: "neq", value: neq },
        { key: "gst_number", value: gst },
        { key: "qst_number", value: qst },
      ],
    });
  };
  const saveFinance = async () => {
    return updateSettingsAction({
      category: "finance",
      updates: [
        { key: "bank_name", value: bankName },
        { key: "bank_institution", value: bankInstitution },
        { key: "bank_transit", value: bankTransit },
        { key: "bank_account", value: bankAccount },
      ],
    });
  };
  const saveLaw25 = async () => {
    return updateSettingsAction({
      category: "legal",
      updates: [
        { key: "rprp_name", value: rprpName },
        { key: "rprp_email", value: rprpEmail },
        { key: "rprp_title", value: rprpTitle },
      ],
    });
  };

  const handleNext = () => {
    startTransition(async () => {
      let r;
      switch (currentStep) {
        case "company": r = await saveCompany(); break;
        case "branding": r = await saveBranding(); break;
        case "fiscal": r = await saveFiscal(); break;
        case "finance": r = await saveFinance(); break;
        case "law25": r = await saveLaw25(); break;
        default: r = { success: true };
      }
      if (!r.success && "error" in r) {
        toast.error(r.error);
        return;
      }
      toast.success(t("etape_enregistree"));
      const idx = STEPS.findIndex((s) => s.key === currentStep);
      if (idx < STEPS.length - 1) {
        setCurrentStep(STEPS[idx + 1].key);
      } else {
        router.refresh();
      }
    });
  };

  const handleSkip = () => {
    const idx = STEPS.findIndex((s) => s.key === currentStep);
    if (idx < STEPS.length - 1) setCurrentStep(STEPS[idx + 1].key);
  };

  const completedCount = Object.values(progress).filter(Boolean).length;
  const totalSteps = STEPS.length;
  const progressPct = Math.round((completedCount / totalSteps) * 100);

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-violet-500 to-fuchsia-500 shrink-0">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("configuration_guidee")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {completedCount}/{totalSteps} étapes complétées · {progressPct}%
          </p>
        </div>
      </div>


      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">

        <div className="space-y-1">
          {STEPS.map((s, idx) => {
            const Icon = s.icon;
            const isCurrent = s.key === currentStep;
            const isDone = progress[s.key];
            return (
              <button
                key={s.key}
                onClick={() => setCurrentStep(s.key)}
                className={cn(
                  "w-full flex items-start gap-3 text-left p-3 rounded-lg border transition-colors",
                  isCurrent ? "border-[#0F2D52] bg-blue-50" : "border-transparent hover:bg-muted/40"
                )}
              >
                <div className="shrink-0 mt-0.5">
                  {isDone ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                  ) : isCurrent ? (
                    <div className="h-5 w-5 rounded-full bg-[#0F2D52] text-white flex items-center justify-center text-[10px] font-bold">{idx + 1}</div>
                  ) : (
                    <Circle className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    <p className={cn("font-medium text-sm", isCurrent && "text-[#0F2D52]")}>{t(s.labelKey)}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{t(s.descriptionKey)}</p>
                </div>
              </button>
            );
          })}
        </div>


        <Card>
          <CardContent className="p-6 space-y-4">
            {currentStep === "company" && (
              <>
                <StepHeader icon={Building2} title={t("identite_entreprise")} />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label={t("nom_commercial")}><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={t("vnk_automatisation")} /></F>
                  <F label={t("raison_sociale_legale")}><Input value={companyLegalName} onChange={(e) => setCompanyLegalName(e.target.value)} placeholder={t("vnk_automatisation_inc")} /></F>
                  <F label={t("courriel_public")}><Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder={t("contact")} /></F>
                  <F label={t("telephone")}><Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="+1 514 555-0100" /></F>
                </div>
                <F label={t("adresse")}><Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder={t("123_rue_principale")} /></F>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <F label={t("ville")}><Input value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} /></F>
                  <F label={t("province")}>
                    <Select value={companyProvince} onValueChange={setCompanyProvince}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["QC","ON","BC","AB","NB","NS","PE","NL","MB","SK","YT","NT","NU"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </F>
                  <F label={t("code_postal")}><Input value={companyPostal} onChange={(e) => setCompanyPostal(e.target.value)} placeholder="H1A 1A1" className="font-mono uppercase" /></F>
                </div>
              </>
            )}

            {currentStep === "branding" && (
              <>
                <StepHeader icon={Palette} title={t("charte_graphique")} />
                <p className="text-xs text-muted-foreground">{t("onboarding_wizard_definissez_vos_deux_couleurs_principales_pour_televerser")}<Link href="/admin/settings/branding" className="text-[#0F2D52] underline">{t("charte_graphique")}</Link>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label={t("couleur_primaire")}>
                    <div className="flex gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-12 rounded-md border cursor-pointer" />
                      <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono flex-1" />
                    </div>
                  </F>
                  <F label={t("couleur_secondaire")}>
                    <div className="flex gap-2">
                      <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-12 rounded-md border cursor-pointer" />
                      <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono flex-1" />
                    </div>
                  </F>
                </div>
                <div className="flex gap-2 mt-4 p-4 rounded-lg border bg-muted/20">
                  <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>{t("bouton_primaire")}</button>
                  <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: secondaryColor }}>{t("bouton_secondaire")}</button>
                </div>
              </>
            )}

            {currentStep === "fiscal" && (
              <>
                <StepHeader icon={Receipt} title={t("identifiants_fiscaux")} />
                <p className="text-xs text-muted-foreground">
                  {t("indispensables_facturation_quebec_si_vous")}
                </p>
                <F label={t("neq_numero_entreprise_quebec")}>
                  <Input value={neq} onChange={(e) => setNeq(e.target.value)} placeholder="1234567890" maxLength={10} className="font-mono" />
                </F>
                <F label={t("n_tps_gst")}>
                  <Input value={gst} onChange={(e) => setGst(e.target.value)} placeholder={t("123456789_rt0001")} className="font-mono" />
                </F>
                <F label={t("n_tvq_qst")}>
                  <Input value={qst} onChange={(e) => setQst(e.target.value)} placeholder={t("1234567890_tq0001")} className="font-mono" />
                </F>
              </>
            )}

            {currentStep === "finance" && (
              <>
                <StepHeader icon={Wallet} title={t("compte_bancaire")} />
                <p className="text-xs text-muted-foreground">
                  {t("informations_servent_generer_modeles_virement")}
                </p>
                <F label={t("institution_bancaire")}>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder={t("desjardins_rbc_td")} />
                </F>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <F label={t("n_institution")}><Input value={bankInstitution} onChange={(e) => setBankInstitution(e.target.value)} maxLength={3} placeholder="815" className="font-mono" /></F>
                  <F label={t("n_transit")}><Input value={bankTransit} onChange={(e) => setBankTransit(e.target.value)} maxLength={5} placeholder="30000" className="font-mono" /></F>
                  <F label={t("n_folio")}><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} maxLength={12} placeholder="1234567" className="font-mono" /></F>
                </div>
              </>
            )}

            {currentStep === "law25" && (
              <>
                <StepHeader icon={Shield} title={t("conformite_loi_25_quebec")} />
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  {t("loi_25_exige_qu_apos")}
                </div>
                <F label={t("nom_rprp")}>
                  <Input value={rprpName} onChange={(e) => setRprpName(e.target.value)} placeholder={t("jean_tremblay")} />
                </F>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label={t("titre_fonction")}>
                    <Input value={rprpTitle} onChange={(e) => setRprpTitle(e.target.value)} placeholder={t("president")} />
                  </F>
                  <F label={t("courriel_dedie")}>
                    <Input type="email" value={rprpEmail} onChange={(e) => setRprpEmail(e.target.value)} placeholder={t("confidentialite")} />
                  </F>
                </div>
              </>
            )}

            {currentStep === "team" && (
              <>
                <StepHeader icon={Users} title={t("equipe")} />
                <p className="text-xs text-muted-foreground">
                  {t("creez_premiers_comptes_employes_depuis")}
                </p>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-medium mb-2">{t("comptes_employes")}</p>
                  <p className="text-xs text-muted-foreground mb-3">{t("7_roles_rbac_pre_definis")}</p>
                  <Button asChild className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                    <Link href="/admin/settings/team" className="flex items-center gap-2">{t("onboarding_wizard_gerer_l_equipe")}<ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  {t("fois_employes_crees_vous_pourrez")}
                </div>
              </>
            )}


            <div className="flex items-center justify-between border-t pt-4 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  const idx = STEPS.findIndex((s) => s.key === currentStep);
                  if (idx > 0) setCurrentStep(STEPS[idx - 1].key);
                }}
                disabled={STEPS.findIndex((s) => s.key === currentStep) === 0 || pending}
              >
                <ChevronLeft className="h-4 w-4 mr-1.5" />{tc("previous")}
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkip} disabled={pending}>
                  {t("passer")}
                </Button>
                {STEPS.findIndex((s) => s.key === currentStep) === STEPS.length - 1 ? (
                  <Button asChild className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90">
                    <Link href="/admin"><Rocket className="h-4 w-4 mr-1.5" />{t("terminer")}</Link>
                  </Button>
                ) : (
                  <Button onClick={handleNext} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                    {pending ? "..." : t("suivant")}<ChevronRightIcon className="h-4 w-4 ml-1.5" />
                  </Button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {completedCount === totalSteps && (
        <Card className="border-emerald-200 bg-emerald-50">
          <CardContent className="p-5 flex items-center gap-3">
            <Rocket className="h-6 w-6 text-emerald-600" />
            <div className="flex-1">
              <p className="font-semibold text-emerald-900">{t("configuration_complete")}</p>
              <p className="text-xs text-emerald-800">{t("portail_pret_etre_utilise")}</p>
            </div>
            <Badge className="bg-emerald-600 hover:bg-emerald-600">100%</Badge>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function StepHeader({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b">
      <Icon className="h-5 w-5 text-[#0F2D52]" />
      <h2 className="text-lg font-semibold">{title}</h2>
    </div>
  );
}

function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}

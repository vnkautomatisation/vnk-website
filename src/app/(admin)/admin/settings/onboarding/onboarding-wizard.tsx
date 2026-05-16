"use client";
// Assistant de configuration initiale — wizard 6 étapes.
// Chaque étape pousse la valeur dans la table Setting via updateSettingsAction.
import { useState, useTransition } from "react";
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

const STEPS: { key: StepKey; label: string; icon: React.ComponentType<{ className?: string }>; description: string }[] = [
  { key: "company", label: "Identité de l'entreprise", icon: Building2, description: "Nom, adresse, coordonnées" },
  { key: "branding", label: "Charte graphique", icon: Palette, description: "Logos et couleurs" },
  { key: "fiscal", label: "Identifiants fiscaux", icon: Receipt, description: "NEQ, TPS, TVQ" },
  { key: "finance", label: "Compte bancaire", icon: Wallet, description: "Banque pour virements Interac" },
  { key: "law25", label: "Loi 25 (Québec)", icon: Shield, description: "RPRP et politique" },
  { key: "team", label: "Équipe", icon: Users, description: "Créer vos premiers employés" },
];

export function OnboardingWizard({
  initial, progress,
}: {
  initial: Record<string, string>;
  progress: Record<StepKey, boolean>;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [currentStep, setCurrentStep] = useState<StepKey>(() => {
    // Auto-sélectionne la première étape incomplète
    const firstIncomplete = STEPS.find((s) => !progress[s.key]);
    return firstIncomplete?.key ?? "company";
  });

  // États contrôlés par étape
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

  // ── Sauvegardes par étape ─────────────────────────────────
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
      toast.success("Étape enregistrée");
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
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Retour"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-gradient-to-br from-violet-500 to-fuchsia-500 shrink-0">
          <Sparkles className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Configuration guidée</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {completedCount}/{totalSteps} étapes complétées · {progressPct}%
          </p>
        </div>
      </div>

      {/* Barre de progression */}
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      {/* Sidebar étapes + contenu */}
      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6">
        {/* Liste des étapes */}
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
                    <p className={cn("font-medium text-sm", isCurrent && "text-[#0F2D52]")}>{s.label}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{s.description}</p>
                </div>
              </button>
            );
          })}
        </div>

        {/* Contenu de l'étape */}
        <Card>
          <CardContent className="p-6 space-y-4">
            {currentStep === "company" && (
              <>
                <StepHeader icon={Building2} title="Identité de l'entreprise" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label="Nom commercial *"><Input value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="VNK Automatisation" /></F>
                  <F label="Raison sociale (légale)"><Input value={companyLegalName} onChange={(e) => setCompanyLegalName(e.target.value)} placeholder="VNK Automatisation Inc." /></F>
                  <F label="Courriel public"><Input type="email" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} placeholder="contact@..." /></F>
                  <F label="Téléphone"><Input value={companyPhone} onChange={(e) => setCompanyPhone(e.target.value)} placeholder="+1 514 555-0100" /></F>
                </div>
                <F label="Adresse"><Input value={companyAddress} onChange={(e) => setCompanyAddress(e.target.value)} placeholder="123 rue Principale" /></F>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <F label="Ville"><Input value={companyCity} onChange={(e) => setCompanyCity(e.target.value)} /></F>
                  <F label="Province">
                    <Select value={companyProvince} onValueChange={setCompanyProvince}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {["QC","ON","BC","AB","NB","NS","PE","NL","MB","SK","YT","NT","NU"].map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </F>
                  <F label="Code postal"><Input value={companyPostal} onChange={(e) => setCompanyPostal(e.target.value)} placeholder="H1A 1A1" className="font-mono uppercase" /></F>
                </div>
              </>
            )}

            {currentStep === "branding" && (
              <>
                <StepHeader icon={Palette} title="Charte graphique" />
                <p className="text-xs text-muted-foreground">
                  Définissez vos deux couleurs principales. Pour téléverser les logos, utilisez ensuite la page <Link href="/admin/settings/branding" className="text-[#0F2D52] underline">Charte graphique</Link>.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <F label="Couleur primaire">
                    <div className="flex gap-2">
                      <input type="color" value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="h-9 w-12 rounded-md border cursor-pointer" />
                      <Input value={primaryColor} onChange={(e) => setPrimaryColor(e.target.value)} className="font-mono flex-1" />
                    </div>
                  </F>
                  <F label="Couleur secondaire">
                    <div className="flex gap-2">
                      <input type="color" value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="h-9 w-12 rounded-md border cursor-pointer" />
                      <Input value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)} className="font-mono flex-1" />
                    </div>
                  </F>
                </div>
                <div className="flex gap-2 mt-4 p-4 rounded-lg border bg-muted/20">
                  <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: primaryColor }}>Bouton primaire</button>
                  <button className="px-4 py-2 rounded-md text-sm font-medium text-white" style={{ backgroundColor: secondaryColor }}>Bouton secondaire</button>
                </div>
              </>
            )}

            {currentStep === "fiscal" && (
              <>
                <StepHeader icon={Receipt} title="Identifiants fiscaux" />
                <p className="text-xs text-muted-foreground">
                  Indispensables pour la facturation au Québec. Si vous êtes petit fournisseur (&lt; 30 000 $/an), TPS et TVQ peuvent rester vides.
                </p>
                <F label="NEQ (Numéro d'entreprise du Québec)">
                  <Input value={neq} onChange={(e) => setNeq(e.target.value)} placeholder="1234567890" maxLength={10} className="font-mono" />
                </F>
                <F label="N° TPS / GST">
                  <Input value={gst} onChange={(e) => setGst(e.target.value)} placeholder="123456789 RT0001" className="font-mono" />
                </F>
                <F label="N° TVQ / QST">
                  <Input value={qst} onChange={(e) => setQst(e.target.value)} placeholder="1234567890 TQ0001" className="font-mono" />
                </F>
              </>
            )}

            {currentStep === "finance" && (
              <>
                <StepHeader icon={Wallet} title="Compte bancaire" />
                <p className="text-xs text-muted-foreground">
                  Ces informations servent à générer les modèles de virement Interac sur vos factures.
                </p>
                <F label="Institution bancaire">
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Desjardins, RBC, TD..." />
                </F>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <F label="N° institution"><Input value={bankInstitution} onChange={(e) => setBankInstitution(e.target.value)} maxLength={3} placeholder="815" className="font-mono" /></F>
                  <F label="N° transit"><Input value={bankTransit} onChange={(e) => setBankTransit(e.target.value)} maxLength={5} placeholder="30000" className="font-mono" /></F>
                  <F label="N° folio"><Input value={bankAccount} onChange={(e) => setBankAccount(e.target.value)} maxLength={12} placeholder="1234567" className="font-mono" /></F>
                </div>
              </>
            )}

            {currentStep === "law25" && (
              <>
                <StepHeader icon={Shield} title="Conformité Loi 25 (Québec)" />
                <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                  La Loi 25 exige qu&apos;une personne responsable de la protection des renseignements personnels (RPRP) soit désignée et identifiée publiquement.
                </div>
                <F label="Nom du RPRP *">
                  <Input value={rprpName} onChange={(e) => setRprpName(e.target.value)} placeholder="Jean Tremblay" />
                </F>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <F label="Titre / fonction">
                    <Input value={rprpTitle} onChange={(e) => setRprpTitle(e.target.value)} placeholder="Président" />
                  </F>
                  <F label="Courriel dédié *">
                    <Input type="email" value={rprpEmail} onChange={(e) => setRprpEmail(e.target.value)} placeholder="confidentialite@..." />
                  </F>
                </div>
              </>
            )}

            {currentStep === "team" && (
              <>
                <StepHeader icon={Users} title="Équipe" />
                <p className="text-xs text-muted-foreground">
                  Créez vos premiers comptes employés depuis la page dédiée. Vous pourrez leur attribuer un rôle (comptable, vendeur, support, technicien...) ou en créer un sur mesure.
                </p>
                <div className="rounded-lg border bg-muted/20 p-4">
                  <p className="text-sm font-medium mb-2">Comptes employés</p>
                  <p className="text-xs text-muted-foreground mb-3">7 rôles RBAC pré-définis + 6 postes templates prêts à l&apos;emploi.</p>
                  <Button asChild className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                    <Link href="/admin/settings/team" className="flex items-center gap-2">
                      Gérer l&apos;équipe <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
                  Une fois vos employés créés, vous pourrez les inviter à se connecter au portail admin. Pensez à activer la 2FA pour les comptes sensibles.
                </div>
              </>
            )}

            {/* Footer navigation */}
            <div className="flex items-center justify-between border-t pt-4 mt-6">
              <Button
                variant="outline"
                onClick={() => {
                  const idx = STEPS.findIndex((s) => s.key === currentStep);
                  if (idx > 0) setCurrentStep(STEPS[idx - 1].key);
                }}
                disabled={STEPS.findIndex((s) => s.key === currentStep) === 0 || pending}
              >
                <ChevronLeft className="h-4 w-4 mr-1.5" />Précédent
              </Button>
              <div className="flex gap-2">
                <Button variant="ghost" onClick={handleSkip} disabled={pending}>
                  Passer
                </Button>
                {STEPS.findIndex((s) => s.key === currentStep) === STEPS.length - 1 ? (
                  <Button asChild className="bg-gradient-to-r from-violet-500 to-fuchsia-500 hover:opacity-90">
                    <Link href="/admin"><Rocket className="h-4 w-4 mr-1.5" />Terminer</Link>
                  </Button>
                ) : (
                  <Button onClick={handleNext} disabled={pending} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                    {pending ? "..." : "Suivant"}<ChevronRightIcon className="h-4 w-4 ml-1.5" />
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
              <p className="font-semibold text-emerald-900">Configuration complète</p>
              <p className="text-xs text-emerald-800">Votre portail est prêt à être utilisé.</p>
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

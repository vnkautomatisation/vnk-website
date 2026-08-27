"use client";
// Wizard de bienvenue pour les nouveaux utilisateurs invités.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sparkles, ShieldCheck, ArrowRight, CheckCircle2, Shield,
  LayoutDashboard, Users, FileText, Briefcase,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { completeOnboardingAction } from "@/app/actions/onboarding";

type AdminInfo = {
  id: number;
  email: string;
  fullName: string | null;
  twoFactorEnabled: boolean;
  avatarUrl: string | null;
  title: string | null;
  department: string | null;
  customRole: { name: string; color: string | null } | null;
  position: { name: string; color: string | null } | null;
};

export function WelcomeWizard({ admin, require2FA }: { admin: AdminInfo; require2FA: boolean }) {
  const t = useTranslations("admin.welcome");
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);

  const finish = () => {
    startTransition(async () => {
      const r = await completeOnboardingAction();
      if (r.success) {
        toast.success(t("bienvenue_vnk"));
        router.push("/admin");
      } else {
        toast.error(r.error || t("erreur"));
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-2xl space-y-4">

        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-[#0F2D52] mb-2">
            <Sparkles className="h-4 w-4" />
            {t("activation_compte")}
          </div>
          <div className="flex items-center justify-center gap-2">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-12 rounded-full transition-colors ${
                  s <= step ? "bg-[#0F2D52]" : "bg-muted"
                }`}
              />
            ))}
          </div>
        </div>


        {step === 1 && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto ring-4 ring-white shadow-lg"
                style={{ backgroundColor: admin.position?.color ?? admin.customRole?.color ?? "#0F2D52" }}
              >
                {admin.avatarUrl ? (

                  <img src={admin.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  (admin.fullName || admin.email).charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">Bienvenue {admin.fullName?.split(" ")[0] ?? ""} !</h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  {t("compte_active_configurons_ensemble_acces")}
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                {admin.title && <Badge variant="outline">{admin.title}</Badge>}
                {admin.position && (
                  <Badge variant="outline" style={{ borderColor: admin.position.color ?? undefined, color: admin.position.color ?? undefined }}>
                    {admin.position.name}
                  </Badge>
                )}
                {admin.customRole && (
                  <Badge variant="outline" style={{ borderColor: admin.customRole.color ?? undefined, color: admin.customRole.color ?? undefined }}>
                    <Shield className="h-2.5 w-2.5 mr-0.5" />{admin.customRole.name}
                  </Badge>
                )}
              </div>
              <Button onClick={() => setStep(2)} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 mt-4">
                Commencer<ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </CardContent>
          </Card>
        )}


        {step === 2 && (
          <Card>
            <CardContent className="p-8 space-y-4">
              <div className="text-center">
                <div className={`h-16 w-16 rounded-2xl mx-auto flex items-center justify-center ${
                  admin.twoFactorEnabled ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                }`}>
                  <ShieldCheck className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mt-4">
                  {admin.twoFactorEnabled ? t("excellent") : t("securisez_compte")}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {admin.twoFactorEnabled
                    ? t("2fa_deja_active")
                    : t("activez_double_authentification_proteger_compte")}
                </p>
              </div>

              {!admin.twoFactorEnabled && (
                <div className={`rounded-md border p-3 text-xs ${require2FA ? "border-amber-300 bg-amber-50 text-amber-900" : "border-blue-300 bg-blue-50 text-blue-900"}`}>
                  {require2FA ? (
                    <>
                      <p className="font-semibold mb-1">{t("2fa_requise_politique_securite")}</p>
                      <p>{t("vous_devez_activer_2fa_avant")}</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold mb-1">{t("optionnel_mais_fortement_recommande")}</p>
                      <p>{t("2fa_empeche_apos_acces_meme")}</p>
                    </>
                  )}
                </div>
              )}

              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {t("compatible_google_authenticator_authy_1password")}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {t("codes_secours_fournis_cas_perte")}
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  {t("modifiable_tout_moment_depuis_profil")}
                </li>
              </ul>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  {tc("previous")}
                </Button>
                {!admin.twoFactorEnabled ? (
                  <Button asChild className="flex-1 bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                    <Link href="/admin/profile?tab=security&from=welcome">
                      <Shield className="h-4 w-4 mr-1.5" />{t("welcome_wizard_activer_la_2fa")}</Link>
                  </Button>
                ) : (
                  <Button onClick={() => setStep(3)} className="flex-1 bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                    Continuer<ArrowRight className="h-4 w-4 ml-1.5" />
                  </Button>
                )}
              </div>

              {!admin.twoFactorEnabled && !require2FA && (
                <button
                  type="button"
                  onClick={() => setStep(3)}
                  className="text-[11px] text-muted-foreground hover:text-foreground underline mx-auto block"
                >
                  {t("plus_tard_non_recommande")}
                </button>
              )}
            </CardContent>
          </Card>
        )}


        {step === 3 && (
          <Card>
            <CardContent className="p-8 space-y-4">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl mx-auto flex items-center justify-center bg-[#0F2D52]/8 text-[#0F2D52]">
                  <LayoutDashboard className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mt-4">{t("vous_etes_pret")}</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("voici_modules_principaux_portail_vnk")}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ModuleCard icon={Users} label={t("clients")} desc={t("fiches_historique")} />
                <ModuleCard icon={Briefcase} label={t("mandats")} desc={t("projets_cours")} />
                <ModuleCard icon={FileText} label={t("devis_factures")} desc={t("facturation")} />
                <ModuleCard icon={LayoutDashboard} label={t("tableau_bord")} desc={t("vue_ensemble")} />
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <p className="font-semibold mb-1">{t("astuce")}</p>
                <p>{t("appuyez")} <kbd className="bg-white px-1.5 py-0.5 rounded font-mono text-[10px]">{t("ctrl_cmd_k")}</kbd> {t("n_apos_importe_apos_app")}</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  {tc("previous")}
                </Button>
                <Button onClick={finish} disabled={pending} className="flex-1 bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                  {pending ? "..." : (
                    <>{t("acceder_portail")}<ArrowRight className="h-4 w-4 ml-1.5" /></>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

function ModuleCard({ icon: Icon, label, desc }: { icon: React.ComponentType<{ className?: string }>; label: string; desc: string }) {
  return (
    <div className="rounded-lg border bg-card p-3 flex items-start gap-2.5">
      <div className="h-8 w-8 rounded-md bg-[#0F2D52]/8 text-[#0F2D52] flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
    </div>
  );
}

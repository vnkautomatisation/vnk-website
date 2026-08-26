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
  const tc = useTranslations("common");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(1);

  const finish = () => {
    startTransition(async () => {
      const r = await completeOnboardingAction();
      if (r.success) {
        toast.success("Bienvenue dans VNK !");
        router.push("/admin");
      } else {
        toast.error(r.error || "Erreur");
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-2xl space-y-4">
        {/* Header avec progression */}
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-xs uppercase tracking-wider font-semibold text-[#0F2D52] mb-2">
            <Sparkles className="h-4 w-4" />
            Activation de votre compte
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

        {/* Étape 1 : Bienvenue */}
        {step === 1 && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <div
                className="h-20 w-20 rounded-full flex items-center justify-center text-white font-bold text-2xl mx-auto ring-4 ring-white shadow-lg"
                style={{ backgroundColor: admin.position?.color ?? admin.customRole?.color ?? "#0F2D52" }}
              >
                {admin.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={admin.avatarUrl} alt="" className="h-full w-full rounded-full object-cover" />
                ) : (
                  (admin.fullName || admin.email).charAt(0).toUpperCase()
                )}
              </div>
              <div>
                <h1 className="text-2xl font-bold">Bienvenue {admin.fullName?.split(" ")[0] ?? ""} !</h1>
                <p className="text-sm text-muted-foreground mt-1.5">
                  Votre compte est activé. Configurons ensemble votre accès en quelques étapes.
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

        {/* Étape 2 : 2FA */}
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
                  {admin.twoFactorEnabled ? "Excellent !" : "Sécurisez votre compte"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {admin.twoFactorEnabled
                    ? "Votre 2FA est déjà active."
                    : "Activez la double authentification pour protéger votre compte."}
                </p>
              </div>

              {!admin.twoFactorEnabled && (
                <div className={`rounded-md border p-3 text-xs ${require2FA ? "border-amber-300 bg-amber-50 text-amber-900" : "border-blue-300 bg-blue-50 text-blue-900"}`}>
                  {require2FA ? (
                    <>
                      <p className="font-semibold mb-1">⚠ 2FA requise par la politique de sécurité</p>
                      <p>Vous devez activer la 2FA avant de continuer.</p>
                    </>
                  ) : (
                    <>
                      <p className="font-semibold mb-1">Optionnel mais fortement recommandé</p>
                      <p>La 2FA empêche l&apos;accès même si votre mot de passe est compromis.</p>
                    </>
                  )}
                </div>
              )}

              <ul className="text-xs text-muted-foreground space-y-1.5">
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  Compatible avec Google Authenticator, Authy, 1Password...
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  Codes de secours fournis en cas de perte du téléphone
                </li>
                <li className="flex items-start gap-2">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0 mt-0.5" />
                  Modifiable à tout moment depuis votre profil
                </li>
              </ul>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1">
                  {tc("previous")}
                </Button>
                {!admin.twoFactorEnabled ? (
                  <Button asChild className="flex-1 bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                    <Link href="/admin/profile?tab=security&from=welcome">
                      <Shield className="h-4 w-4 mr-1.5" />Activer la 2FA
                    </Link>
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
                  Plus tard (non recommandé)
                </button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Étape 3 : Tour rapide */}
        {step === 3 && (
          <Card>
            <CardContent className="p-8 space-y-4">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl mx-auto flex items-center justify-center bg-[#0F2D52]/8 text-[#0F2D52]">
                  <LayoutDashboard className="h-8 w-8" />
                </div>
                <h2 className="text-xl font-bold mt-4">Vous êtes prêt</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Voici les modules principaux du portail VNK Automatisation
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <ModuleCard icon={Users} label="Clients" desc="Fiches et historique" />
                <ModuleCard icon={Briefcase} label="Mandats" desc="Projets en cours" />
                <ModuleCard icon={FileText} label="Devis & Factures" desc="Facturation" />
                <ModuleCard icon={LayoutDashboard} label="Tableau de bord" desc="Vue d'ensemble" />
              </div>

              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900">
                <p className="font-semibold mb-1">Astuce</p>
                <p>Appuyez sur <kbd className="bg-white px-1.5 py-0.5 rounded font-mono text-[10px]">Ctrl/Cmd + K</kbd> n&apos;importe où dans l&apos;app pour ouvrir la recherche universelle.</p>
              </div>

              <div className="flex gap-2 pt-2">
                <Button variant="outline" onClick={() => setStep(2)} className="flex-1">
                  {tc("previous")}
                </Button>
                <Button onClick={finish} disabled={pending} className="flex-1 bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                  {pending ? "..." : (
                    <>Accéder au portail<ArrowRight className="h-4 w-4 ml-1.5" /></>
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

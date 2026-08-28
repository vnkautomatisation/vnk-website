"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import {
  CheckCircle2, User, Shield, Fingerprint, FileText, ArrowRight, ArrowLeft, PartyPopper, Hand,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { completeOnboardingAction, updateOnboardingProfileAction } from "@/app/actions/onboarding";

type AdminSeed = {
  id: number;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
  twoFactorEnabled: boolean;
  phone: string | null;
  title: string | null;
  bio: string | null;
};

type Step = "welcome" | "profile" | "2fa" | "passkey" | "docs" | "done";

export function OnboardingWizard({
  admin, hasPasskey, unsignedDocs,
}: {
  admin: AdminSeed;
  hasPasskey: boolean;
  unsignedDocs: Array<{ id: number; title: string; version: string; key: string }>;
}) {
  const t = useTranslations("admin.onboarding");
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");

  const steps: Array<{ key: Step; label: string; icon: typeof User; done: boolean }> = [
    { key: "welcome", label: t("bienvenue"), icon: PartyPopper, done: step !== "welcome" },
    { key: "profile", label: t("profil_2"), icon: User, done: ["2fa", "passkey", "docs", "done"].includes(step) },
    { key: "2fa", label: "2FA", icon: Shield, done: admin.twoFactorEnabled || ["passkey", "docs", "done"].includes(step) },
    { key: "passkey", label: t("passkey"), icon: Fingerprint, done: hasPasskey || ["docs", "done"].includes(step) },
    { key: "docs", label: t("documents"), icon: FileText, done: unsignedDocs.length === 0 || step === "done" },
  ];

  const finalize = async () => {
    const r = await completeOnboardingAction();
    if (r.success) {
      toast.success(t("bienvenue_portail_vnk"));
      router.push("/admin");
    } else toast.error(r.error || "");
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-100 via-white to-slate-50">
      <Card className="w-full max-w-2xl overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-6 py-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center ring-2 ring-white/15">
              <span className="font-bold text-lg">VNK</span>
            </div>
            <div>
              <h1 className="font-bold text-lg">{t("activation_compte")}</h1>
              <p className="text-xs text-white/80">{t("bonjour_etapes", { name: admin.fullName || admin.email })}</p>
            </div>
          </div>


          <div className="flex items-center gap-1 mt-4">
            {steps.map((s, idx) => {
              const Icon = s.icon;
              const active = s.key === step;
              return (
                <div key={s.key} className="flex items-center flex-1 last:flex-none">
                  <div className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] ${
                    active ? "bg-white text-[#0F2D52] font-semibold" :
                    s.done ? "bg-emerald-500/20 text-white" : "text-white/60"
                  }`}>
                    {s.done ? <CheckCircle2 className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                    <span className="hidden sm:inline">{s.label}</span>
                  </div>
                  {idx < steps.length - 1 && <div className={`flex-1 h-px ${s.done ? "bg-emerald-500/40" : "bg-white/20"}`} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-6">
          {step === "welcome" && (
            <StepWelcome admin={admin} onNext={() => setStep("profile")} />
          )}
          {step === "profile" && (
            <StepProfile
              admin={admin}
              onBack={() => setStep("welcome")}
              onNext={() => setStep(admin.twoFactorEnabled ? (hasPasskey ? (unsignedDocs.length > 0 ? "docs" : "done") : "passkey") : "2fa")}
            />
          )}
          {step === "2fa" && (
            <StepTwoFactor
              done={admin.twoFactorEnabled}
              onBack={() => setStep("profile")}
              onNext={() => setStep(hasPasskey ? (unsignedDocs.length > 0 ? "docs" : "done") : "passkey")}
            />
          )}
          {step === "passkey" && (
            <StepPasskey
              done={hasPasskey}
              onBack={() => setStep("2fa")}
              onNext={() => setStep(unsignedDocs.length > 0 ? "docs" : "done")}
            />
          )}
          {step === "docs" && (
            <StepDocs
              docs={unsignedDocs}
              onBack={() => setStep("passkey")}
              onNext={() => setStep("done")}
            />
          )}
          {step === "done" && (
            <StepDone onFinalize={finalize} />
          )}
        </div>
      </Card>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
function StepWelcome({ admin, onNext }: { admin: AdminSeed; onNext: () => void }) {
  const t = useTranslations("admin.onboarding");
  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center text-[#0F2D52]"><Hand className="h-14 w-14" /></div>
      <h2 className="text-xl font-bold">{t("bienvenue_nom", { name: admin.fullName || t("vnk_automatisation") })}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("wizard_avant_d_acceder_au_portail_prenez_2")}</p>
      <Button onClick={onNext} size="lg" className="mt-4">
        {t("c_apos_parti")}
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
}

function StepProfile({ admin, onBack, onNext }: { admin: AdminSeed; onBack: () => void; onNext: () => void }) {
  const t = useTranslations("admin.onboarding");
  const tc = useTranslations("common");
  const [fullName, setFullName] = useState(admin.fullName ?? "");
  const [phone, setPhone] = useState(admin.phone ?? "");
  const [title, setTitle] = useState(admin.title ?? "");
  const [bio, setBio] = useState(admin.bio ?? "");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const r = await updateOnboardingProfileAction({ fullName, phone: phone || null, title: title || null, bio: bio || null });
    setPending(false);
    if (r.success) onNext();
    else toast.error(r.error || "");
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-base flex items-center gap-2"><User className="h-4 w-4 text-[#0F2D52]" />{t("profil")}</h2>
        <p className="text-xs text-muted-foreground">{t("aide_collegues_vous_identifier_facilement")}</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">{t("nom_complet")}</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("jean_tremblay")} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("telephone")}</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="514-555-1234" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("titre")}</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("comptable_senior")} />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">{t("bio_courte")}</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} maxLength={280} placeholder={t("parlez_brievement_role")} />
        </div>
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />{tc("back")}</Button>
        <Button onClick={submit} disabled={pending || !fullName.trim()}>
          {pending ? "..." : t("enregistrer_continuer")}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepTwoFactor({ done, onBack, onNext }: { done: boolean; onBack: () => void; onNext: () => void }) {
  const t = useTranslations("admin.onboarding");
  const tc = useTranslations("common");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-base flex items-center gap-2"><Shield className="h-4 w-4 text-[#0F2D52]" />{t("authentification_deux_facteurs")}</h2>
        <p className="text-xs text-muted-foreground">{t("protection_essentielle_contre_piratage_compte")}</p>
      </div>
      {done ? (
        <Card className="p-4 bg-emerald-50 border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-sm text-emerald-900">{t("2fa_activee")}</p>
            <p className="text-xs text-emerald-700">{t("compte_protege")}</p>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-amber-50 border-amber-200 space-y-3">
          <div>
            <p className="font-medium text-sm text-amber-900">{t("recommande_fortement")}</p>
            <p className="text-xs text-amber-700">{t("utilisez_google_authenticator_authy_1password")}</p>
          </div>
          <Button asChild size="sm">
            <Link href="/admin/settings/security" target="_blank">
              {t("configurer_2fa_parametres_securite")}
            </Link>
          </Button>
          <p className="text-[10px] text-amber-800 italic">{t("revenez_ici_quand_c_apos")}</p>
        </Card>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />{tc("back")}</Button>
        <Button onClick={onNext} variant={done ? "default" : "outline"}>
          {done ? t("continuer") : t("passer_instant")}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepPasskey({ done, onBack, onNext }: { done: boolean; onBack: () => void; onNext: () => void }) {
  const t = useTranslations("admin.onboarding");
  const tc = useTranslations("common");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-base flex items-center gap-2"><Fingerprint className="h-4 w-4 text-[#0F2D52]" />{t("passkey_sans_mot_passe")}</h2>
        <p className="text-xs text-muted-foreground">{t("connectez_vous_touch_id_face")}</p>
      </div>
      {done ? (
        <Card className="p-4 bg-emerald-50 border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-sm text-emerald-900">{t("passkey_enregistree")}</p>
            <p className="text-xs text-emerald-700">{t("vous_pouvez_vous_connecter_sans")}</p>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-muted/40 space-y-3">
          <div>
            <p className="font-medium text-sm">{t("optionnel_mais_recommande")}</p>
            <p className="text-xs text-muted-foreground">{t("plus_rapide_plus_mots_passe")}</p>
          </div>
          <Button asChild size="sm">
            <Link href="/admin/settings/security" target="_blank">
              {t("ajouter_passkey_parametres_securite")}
            </Link>
          </Button>
        </Card>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />{tc("back")}</Button>
        <Button onClick={onNext} variant={done ? "default" : "outline"}>
          {done ? t("continuer") : t("passer")}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepDocs({
  docs, onBack, onNext,
}: {
  docs: Array<{ id: number; title: string; version: string; key: string }>;
  onBack: () => void;
  onNext: () => void;
}) {
  const t = useTranslations("admin.onboarding");
  const tc = useTranslations("common");
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-base flex items-center gap-2"><FileText className="h-4 w-4 text-[#0F2D52]" />{t("documents_signer")}</h2>
        <p className="text-xs text-muted-foreground">
          {docs.length} document{docs.length > 1 ? "s" : ""} obligatoire{docs.length > 1 ? "s" : ""} à signer pour finaliser votre activation.
        </p>
      </div>
      <div className="space-y-2">
        {docs.map((d) => (
          <Card key={d.id} className="p-3 flex items-center gap-3">
            <FileText className="h-4 w-4 text-[#0F2D52] shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-sm">{d.title}</p>
              <p className="text-[11px] text-muted-foreground">Version {d.version}</p>
            </div>
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">{t("signer")}</Badge>
          </Card>
        ))}
      </div>
      <Card className="p-3 bg-[#0F2D52]/5 border-[#0F2D52]/20">
        <p className="text-xs text-muted-foreground">{t("wizard_cliquez_ci_dessous_pour_ouvrir_la_page")}</p>
        <Button asChild size="sm" className="mt-2">
          <Link href="/admin/employes/documents" target="_blank">
            {t("signer_documents")}
          </Link>
        </Button>
      </Card>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />{tc("back")}</Button>
        <Button onClick={onNext} variant="outline">
          {t("continuer_je_signerai_plus_tard")}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepDone({ onFinalize }: { onFinalize: () => void }) {
  const t = useTranslations("admin.onboarding");
  return (
    <div className="space-y-4 text-center py-4">
      <div className="flex justify-center text-amber-500"><PartyPopper className="h-14 w-14" /></div>
      <h2 className="font-bold text-xl">{t("tout_pret")}</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">{t("wizard_votre_compte_est_configure_vous_accedez_maintenant")}<strong>{t("parametres")}</strong>.
      </p>
      <Button onClick={onFinalize} size="lg" className="mt-4">
        {t("acceder_tableau_bord")}
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
}

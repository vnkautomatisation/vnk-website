"use client";
import { useState } from "react";
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
  const router = useRouter();
  const [step, setStep] = useState<Step>("welcome");

  const steps: Array<{ key: Step; label: string; icon: typeof User; done: boolean }> = [
    { key: "welcome", label: "Bienvenue", icon: PartyPopper, done: step !== "welcome" },
    { key: "profile", label: "Profil", icon: User, done: ["2fa", "passkey", "docs", "done"].includes(step) },
    { key: "2fa", label: "2FA", icon: Shield, done: admin.twoFactorEnabled || ["passkey", "docs", "done"].includes(step) },
    { key: "passkey", label: "Passkey", icon: Fingerprint, done: hasPasskey || ["docs", "done"].includes(step) },
    { key: "docs", label: "Documents", icon: FileText, done: unsignedDocs.length === 0 || step === "done" },
  ];

  const finalize = async () => {
    const r = await completeOnboardingAction();
    if (r.success) {
      toast.success("Bienvenue dans le portail VNK !");
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
              <h1 className="font-bold text-lg">Activation de votre compte</h1>
              <p className="text-xs text-white/80">Bonjour {admin.fullName || admin.email} · 5 étapes rapides</p>
            </div>
          </div>

          {/* Stepper */}
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
  return (
    <div className="space-y-4 text-center">
      <div className="flex justify-center text-[#0F2D52]"><Hand className="h-14 w-14" /></div>
      <h2 className="text-xl font-bold">Bienvenue {admin.fullName || "à VNK Automatisation"} !</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Avant d&apos;accéder au portail, prenez 2 minutes pour configurer votre compte en toute sécurité.
        Vous pouvez sauter certaines étapes et les compléter plus tard.
      </p>
      <Button onClick={onNext} size="lg" className="mt-4">
        C&apos;est parti
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
}

function StepProfile({ admin, onBack, onNext }: { admin: AdminSeed; onBack: () => void; onNext: () => void }) {
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
        <h2 className="font-bold text-base flex items-center gap-2"><User className="h-4 w-4 text-[#0F2D52]" />Votre profil</h2>
        <p className="text-xs text-muted-foreground">Aide vos collègues à vous identifier facilement.</p>
      </div>
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">Nom complet *</Label>
          <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jean Tremblay" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Téléphone</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="514-555-1234" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Comptable senior" />
          </div>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs uppercase tracking-wider font-semibold">Bio courte</Label>
          <Textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={2} maxLength={280} placeholder="Parlez brièvement de votre rôle…" />
        </div>
      </div>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        <Button onClick={submit} disabled={pending || !fullName.trim()}>
          {pending ? "..." : "Enregistrer et continuer"}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepTwoFactor({ done, onBack, onNext }: { done: boolean; onBack: () => void; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-base flex items-center gap-2"><Shield className="h-4 w-4 text-[#0F2D52]" />Authentification à deux facteurs</h2>
        <p className="text-xs text-muted-foreground">Une protection essentielle contre le piratage de votre compte.</p>
      </div>
      {done ? (
        <Card className="p-4 bg-emerald-50 border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-sm text-emerald-900">2FA activée</p>
            <p className="text-xs text-emerald-700">Votre compte est protégé.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-amber-50 border-amber-200 space-y-3">
          <div>
            <p className="font-medium text-sm text-amber-900">Recommandé fortement</p>
            <p className="text-xs text-amber-700">Utilisez Google Authenticator, Authy ou 1Password.</p>
          </div>
          <Button asChild size="sm">
            <Link href="/admin/settings/security" target="_blank">
              Configurer 2FA dans Paramètres → Sécurité
            </Link>
          </Button>
          <p className="text-[10px] text-amber-800 italic">Revenez ici quand c&apos;est fait pour continuer.</p>
        </Card>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        <Button onClick={onNext} variant={done ? "default" : "outline"}>
          {done ? "Continuer" : "Passer pour l'instant"}
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepPasskey({ done, onBack, onNext }: { done: boolean; onBack: () => void; onNext: () => void }) {
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-base flex items-center gap-2"><Fingerprint className="h-4 w-4 text-[#0F2D52]" />Passkey (sans mot de passe)</h2>
        <p className="text-xs text-muted-foreground">Connectez-vous avec Touch ID, Face ID, ou une clé physique.</p>
      </div>
      {done ? (
        <Card className="p-4 bg-emerald-50 border-emerald-200 flex items-center gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          <div>
            <p className="font-medium text-sm text-emerald-900">Passkey enregistrée</p>
            <p className="text-xs text-emerald-700">Vous pouvez vous connecter sans mot de passe.</p>
          </div>
        </Card>
      ) : (
        <Card className="p-4 bg-muted/40 space-y-3">
          <div>
            <p className="font-medium text-sm">Optionnel mais recommandé</p>
            <p className="text-xs text-muted-foreground">Plus rapide et plus sûr que les mots de passe.</p>
          </div>
          <Button asChild size="sm">
            <Link href="/admin/settings/security" target="_blank">
              Ajouter une passkey dans Paramètres → Sécurité
            </Link>
          </Button>
        </Card>
      )}
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        <Button onClick={onNext} variant={done ? "default" : "outline"}>
          {done ? "Continuer" : "Passer"}
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
  return (
    <div className="space-y-4">
      <div>
        <h2 className="font-bold text-base flex items-center gap-2"><FileText className="h-4 w-4 text-[#0F2D52]" />Documents à signer</h2>
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
            <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">À signer</Badge>
          </Card>
        ))}
      </div>
      <Card className="p-3 bg-[#0F2D52]/5 border-[#0F2D52]/20">
        <p className="text-xs text-muted-foreground">
          Cliquez ci-dessous pour ouvrir la page des documents légaux et les signer un par un.
          Revenez sur cette page après pour terminer l&apos;activation.
        </p>
        <Button asChild size="sm" className="mt-2">
          <Link href="/admin/employes/documents" target="_blank">
            Signer les documents
          </Link>
        </Button>
      </Card>
      <div className="flex justify-between pt-2">
        <Button variant="ghost" onClick={onBack}><ArrowLeft className="h-4 w-4 mr-1" />Retour</Button>
        <Button onClick={onNext} variant="outline">
          Continuer (je signerai plus tard)
          <ArrowRight className="h-4 w-4 ml-1.5" />
        </Button>
      </div>
    </div>
  );
}

function StepDone({ onFinalize }: { onFinalize: () => void }) {
  return (
    <div className="space-y-4 text-center py-4">
      <div className="flex justify-center text-amber-500"><PartyPopper className="h-14 w-14" /></div>
      <h2 className="font-bold text-xl">Tout est prêt !</h2>
      <p className="text-sm text-muted-foreground max-w-md mx-auto">
        Votre compte est configuré. Vous accédez maintenant au portail VNK Automatisation.
        Vous pouvez ajuster vos préférences à tout moment dans <strong>Paramètres</strong>.
      </p>
      <Button onClick={onFinalize} size="lg" className="mt-4">
        Accéder au tableau de bord
        <ArrowRight className="h-4 w-4 ml-1.5" />
      </Button>
    </div>
  );
}

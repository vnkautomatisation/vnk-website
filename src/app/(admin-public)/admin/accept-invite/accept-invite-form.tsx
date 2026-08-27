"use client";
// Formulaire d'acceptation d'invitation — création du mot de passe par l'employé.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Eye, EyeOff, ShieldCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { acceptInvitationAction } from "@/app/actions/invitations";

export function AcceptInviteForm({
  token, email, fullName,
}: {
  token: string;
  email: string;
  fullName: string;
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [consentPolicies, setConsentPolicies] = useState(false);

  const checks = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    match: password.length > 0 && password === confirm,
  };
  const allValid =
    checks.length && checks.upper && checks.lower && checks.digit && checks.match && consentPolicies;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!checks.length || !checks.upper || !checks.lower || !checks.digit || !checks.match) {
      toast.error(t("mot_passe_ne_respecte_pas"));
      return;
    }
    if (!consentPolicies) {
      toast.error(t("vous_devez_accepter_politique_utilisation"));
      return;
    }
    startTransition(async () => {
      const result = await acceptInvitationAction({ token, password, consentAccepted: consentPolicies });
      if (result.success) {
        toast.success(t("compte_cree_succes"));
        router.push("/admin/login?invited=1");
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-6 py-6 text-center">
          <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur mx-auto flex items-center justify-center ring-2 ring-white/15 mb-3">
            <ShieldCheck className="h-7 w-7" />
          </div>
          <h1 className="text-xl font-bold">{t("activez_compte")}</h1>
          <p className="text-sm text-white/80 mt-1">{t("creez_mot_passe_finaliser")}</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">

          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("compte")}</p>
            <p className="text-sm font-medium mt-0.5">{fullName}</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t("mot_passe")}
            </Label>
            <div className="relative mt-1">
              <Input
                type={show ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={t("minimum_12_caracteres")}
                autoComplete="new-password"
                required
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShow(!show)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={show ? t("masquer") : t("afficher")}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              {t("confirmer_mot_passe")}
            </Label>
            <Input
              type={show ? "text" : "password"}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              className="mt-1"
            />
          </div>


          <div className="rounded-lg border bg-muted/20 p-3 space-y-1">
            <Check ok={checks.length} label={t("moins_12_caracteres")} />
            <Check ok={checks.upper} label={t("majuscule")} />
            <Check ok={checks.lower} label={t("minuscule")} />
            <Check ok={checks.digit} label={t("chiffre")} />
            <Check ok={checks.match} label={t("deux_mots_passe_correspondent")} />
          </div>


          <label className="flex items-start gap-2 text-xs text-muted-foreground cursor-pointer p-3 rounded-md border bg-muted/20">
            <input
              type="checkbox"
              checked={consentPolicies}
              onChange={(e) => setConsentPolicies(e.target.checked)}
              className="h-4 w-4 mt-0.5 rounded border-input flex-shrink-0"
            />
            <span>
              J&apos;ai lu et j&apos;accepte la{" "}
              <a href="/politique-utilisation" target="_blank" rel="noopener" className="text-[#0F2D52] underline font-medium">
                {t("politique_apos_utilisation")}
              </a>{" "}
              et la{" "}
              <a href="/politique-confidentialite" target="_blank" rel="noopener" className="text-[#0F2D52] underline font-medium">
                {t("politique_confidentialite")}
              </a>{" "}
              de VNK Automatisation.
            </span>
          </label>

          <Button
            type="submit"
            disabled={pending || !allValid}
            className="w-full bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm"
          >
            {pending ? (
              <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t("creation_cours")}</>
            ) : (
              t("creer_mon_compte")
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            {t("apres_creation_vous_pourrez_activer")}
          </p>
        </form>
      </div>
    </div>
  );
}

function Check({ ok, label }: { ok: boolean; label: string }) {
  const t = useTranslations("auth");
  return (
    <div className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-700" : "text-muted-foreground"}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${ok ? "bg-emerald-500" : "bg-muted-foreground/30"}`} />
      {label}
    </div>
  );
}

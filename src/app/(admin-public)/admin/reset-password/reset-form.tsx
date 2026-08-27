"use client";
// Formulaire reset : saisie du code 6 chiffres + nouveau mot de passe.
import { useState, useEffect, useTransition, useRef } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ShieldCheck, Eye, EyeOff, Loader2, ArrowLeft, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { completePasswordResetAction, verifyResetCodeAction } from "@/app/actions/password-reset";

export function ResetPasswordForm({
  tokenFromUrl, audience,
}: {
  tokenFromUrl: string | null;
  audience: "admin" | "client";
}) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [token, setToken] = useState<string>("");
  const [email, setEmail] = useState<string>("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"code" | "password">("code");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPw, setShowPw] = useState(false);
  const codeInputRef = useRef<HTMLInputElement>(null);


  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl);
    } else if (typeof window !== "undefined") {
      const stored = sessionStorage.getItem("vnk-reset-token");
      const storedEmail = sessionStorage.getItem("vnk-reset-email");
      if (stored) setToken(stored);
      if (storedEmail) setEmail(storedEmail);
    }
    setTimeout(() => codeInputRef.current?.focus(), 100);
  }, [tokenFromUrl]);


  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
          <h1 className="text-xl font-bold text-[#0F2D52]">{t("lien_invalide")}</h1>
          <p className="text-sm text-muted-foreground mt-2">
            {t("lien_n_apos_pas_valide")}
          </p>
          <Link
            href={audience === "admin" ? "/admin/forgot-password" : "/portail/forgot-password"}
            className="inline-block mt-6 text-sm text-[#0F2D52] hover:underline"
          >
            {t("recommencer")}
          </Link>
        </div>
      </div>
    );
  }

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== 6) return;
    startTransition(async () => {
      const r = await verifyResetCodeAction({ token, code });
      if (r.success) {
        setStep("password");
      } else {
        toast.error(r.error);
        if (r.error.includes("expiré") || r.error.includes("Trop")) {

          setTimeout(() => router.push(audience === "admin" ? "/admin/forgot-password" : "/portail/forgot-password"), 2000);
        }
      }
    });
  };

  const checks = {
    length: password.length >= 12,
    upper: /[A-Z]/.test(password),
    lower: /[a-z]/.test(password),
    digit: /\d/.test(password),
    match: password.length > 0 && password === confirm,
  };
  const allValid = checks.length && checks.upper && checks.lower && checks.digit && checks.match;

  const handleComplete = (e: React.FormEvent) => {
    e.preventDefault();
    if (!allValid) return;
    startTransition(async () => {
      const r = await completePasswordResetAction({ token, code, newPassword: password });
      if (r.success) {
        sessionStorage.removeItem("vnk-reset-token");
        sessionStorage.removeItem("vnk-reset-email");
        sessionStorage.removeItem("vnk-reset-audience");
        toast.success(t("mot_passe_modifie"));
        router.push(audience === "admin" ? "/admin/login?reset=1" : "/portail/login?reset=1");
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-6 py-6 text-center">
          <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur mx-auto flex items-center justify-center ring-2 ring-white/15 mb-3">
            {step === "code" ? <KeyRound className="h-7 w-7" /> : <ShieldCheck className="h-7 w-7" />}
          </div>
          <h1 className="text-xl font-bold">
            {step === "code" ? t("code_verification") : t("nouveau_mot_passe")}
          </h1>
          <p className="text-sm text-white/80 mt-1">
            {step === "code"
              ? t("saisissez_code_6_chiffres_recu")
              : t("creez_mot_passe_securise")}
          </p>
          {email && <p className="text-[11px] text-white/60 mt-1">{email}</p>}
        </div>

        {step === "code" ? (
          <form onSubmit={handleVerifyCode} className="p-6 space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t("code_6_chiffres")}
              </Label>
              <Input
                ref={codeInputRef}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                maxLength={6}
                placeholder="000000"
                autoComplete="one-time-code"
                required
                className="mt-1 text-center text-2xl tracking-[0.5em] font-mono font-semibold"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                {t("verifiez_boite_reception_courriers_indesirables")}
              </p>
            </div>

            <Button
              type="submit"
              disabled={pending || code.length !== 6}
              className="w-full bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm"
            >
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t("verification")}</>
              ) : (
                t("verifier_code")
              )}
            </Button>

            <Link
              href={audience === "admin" ? "/admin/forgot-password" : "/portail/forgot-password"}
              className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 w-full"
            >
              <ArrowLeft className="h-3 w-3" />Recommencer (autre adresse)
            </Link>
          </form>
        ) : (
          <form onSubmit={handleComplete} className="p-6 space-y-4">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t("nouveau_mot_passe")}
              </Label>
              <div className="relative mt-1">
                <Input
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={t("minimum_12_caracteres")}
                  autoComplete="new-password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPw(!showPw)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  aria-label={showPw ? t("masquer") : t("afficher")}
                >
                  {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                {t("confirmer")}
              </Label>
              <Input
                type={showPw ? "text" : "password"}
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

            <Button
              type="submit"
              disabled={pending || !allValid}
              className="w-full bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm"
            >
              {pending ? (
                <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t("enregistrement")}</>
              ) : (
                t("modifier_mon_mot_passe")
              )}
            </Button>
          </form>
        )}
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

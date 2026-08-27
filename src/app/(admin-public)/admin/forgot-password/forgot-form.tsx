"use client";
// Formulaire "mot de passe oublié" — saisie de l'email + redirection vers page de code
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Mail, ArrowLeft, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requestPasswordResetAction } from "@/app/actions/password-reset";

export function ForgotPasswordForm({ audience }: { audience: "admin" | "client" }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    startTransition(async () => {
      const r = await requestPasswordResetAction({ email, audience });
      if (r.success) {

        setSent(true);

        if ("data" in r && r.data.tokenHint) {

          sessionStorage.setItem("vnk-reset-token", r.data.tokenHint);
          sessionStorage.setItem("vnk-reset-audience", audience);
          sessionStorage.setItem("vnk-reset-email", email);

          setTimeout(() => {
            router.push(`/${audience === "admin" ? "admin" : "portail"}/reset-password`);
          }, 1500);
        }
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-xl shadow-lg overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-6 py-6 text-center">
            <div className="h-14 w-14 rounded-full bg-white/10 backdrop-blur mx-auto flex items-center justify-center ring-2 ring-white/15 mb-3">
              {sent ? <CheckCircle2 className="h-7 w-7" /> : <Mail className="h-7 w-7" />}
            </div>
            <h1 className="text-xl font-bold">
              {sent ? t("verifiez_courriel") : t("mot_passe_oublie")}
            </h1>
            <p className="text-sm text-white/80 mt-1">
              {sent
                ? t("si_compte_existe_courriel_ete")
                : t("saisissez_adresse_on_vous_envoie")}
            </p>
          </div>

          {sent ? (
            <div className="p-6 space-y-4 text-center">
              <p className="text-sm text-muted-foreground">{t("forgot_form_si_l_adresse")}<span className="font-medium text-foreground">{email}</span>{t("forgot_form_est_associee_a_un_compte_vous_recevrez")}</p>
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 text-left">
                <p className="font-semibold mb-1">{t("pas_recu_courriel")}</p>
                <ul className="list-disc list-inside space-y-1">
                  <li>{t("verifiez_courriers_indesirables")}</li>
                  <li>{t("patientez_1_2_minutes")}</li>
                  <li>{t("verifiez_apos_adresse_saisie_correcte")}</li>
                </ul>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setSent(false);
                    setEmail("");
                  }}
                  className="w-full"
                >
                  {t("essayer_autre_adresse")}
                </Button>
                <Link
                  href={audience === "admin" ? "/admin/login" : "/portail/login"}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="h-3 w-3" />{t("retour_a_la_connexion")}
                </Link>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  {t("adresse_courriel")}
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={t("forgot_form_vous_exemple_ca")}
                  autoComplete="email"
                  required
                  className="mt-1"
                />
              </div>

              <Button
                type="submit"
                disabled={pending || !email.trim()}
                className="w-full bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm"
              >
                {pending ? (
                  <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />{t("envoi_cours")}</>
                ) : (
                  <>{t("envoyer_lien_reinitialisation")}<Mail className="h-4 w-4 ml-1.5" /></>
                )}
              </Button>

              <Link
                href={audience === "admin" ? "/admin/login" : "/portail/login"}
                className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center justify-center gap-1 w-full"
              >
                <ArrowLeft className="h-3 w-3" />{t("retour_a_la_connexion")}
              </Link>
            </form>
          )}
        </div>

        <p className="text-[10px] text-center text-muted-foreground mt-4">
          {t("vnk_automatisation_inc_securite_geree")}
        </p>
      </div>
    </div>
  );
}

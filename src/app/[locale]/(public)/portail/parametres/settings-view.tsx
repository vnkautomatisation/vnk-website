"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Settings, Lock, Shield, Eye, EyeOff, ChevronRight, Bell, Globe, Palette, Smartphone, Copy, CheckCircle,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn, formatDate } from "@/lib/utils";

export function SettingsView({
  email,
  twoFactorEnabled,
  lastLogin,
}: {
  email: string;
  twoFactorEnabled: boolean;
  lastLogin: string | null;
}) {
  const t = useTranslations("portal");
  const router = useRouter();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: "", newPw: "", confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [twoFa, setTwoFa] = useState(twoFactorEnabled);


  const [twoFaOpen, setTwoFaOpen] = useState(false);
  const [twoFaStep, setTwoFaStep] = useState<"idle" | "setup" | "verify" | "disable">("idle");
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [twoFaLoading, setTwoFaLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handlePasswordChange() {
    if (pw.newPw !== pw.confirm) { toast.error(t("mots_passe_ne_correspondent_pas")); return; }
    if (pw.newPw.length < 8) { toast.error(t("minimum_8_caracteres")); return; }
    setPwSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: pw.current, newPassword: pw.newPw }),
      });
      if (res.ok) {
        toast.success(t("mot_passe_modifie"));
        setPw({ current: "", newPw: "", confirm: "" });
        setPwOpen(false);
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? t("mot_passe_actuel_incorrect"));
      }
    } catch { toast.error(t("erreur_connexion")); }
    finally { setPwSaving(false); }
  }

  async function startTwoFaSetup() {
    setTwoFaLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/setup", { method: "POST" });
      if (!res.ok) { toast.error(t("erreur_configuration_2fa")); return; }
      const data = await res.json();
      setQrCode(data.qrCode);
      setSecret(data.secret);
      setTwoFaStep("setup");
    } catch { toast.error(t("erreur_connexion")); }
    finally { setTwoFaLoading(false); }
  }

  async function verifyTwoFa() {
    if (verifyCode.length !== 6) { toast.error(t("code_6_chiffres_requis")); return; }
    setTwoFaLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (res.ok) {
        toast.success(t("2fa_activee_succes"));
        setTwoFa(true);
        setTwoFaStep("idle");
        setTwoFaOpen(false);
        setVerifyCode("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? t("code_incorrect"));
      }
    } catch { toast.error(t("erreur_connexion")); }
    finally { setTwoFaLoading(false); }
  }

  async function disableTwoFa() {
    if (verifyCode.length !== 6) { toast.error(t("code_6_chiffres_requis")); return; }
    setTwoFaLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verifyCode }),
      });
      if (res.ok) {
        toast.success(t("2fa_desactivee"));
        setTwoFa(false);
        setTwoFaStep("idle");
        setTwoFaOpen(false);
        setVerifyCode("");
        router.refresh();
      } else {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? t("code_incorrect"));
      }
    } catch { toast.error(t("erreur_connexion")); }
    finally { setTwoFaLoading(false); }
  }

  function copySecret() {
    navigator.clipboard.writeText(secret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="max-w-2xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <div className="portal-icon-lg rounded-xl vnk-gradient flex items-center justify-center shadow-lg">
          <Settings className="h-5 w-5 text-white" />
        </div>
        <div>
          <h1 className="portal-title">{t("parametres")}</h1>
          <p className="text-sm text-muted-foreground">{t("securite_preferences_compte")}</p>
        </div>
      </div>


      <Card>
        <CardContent className="p-4 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-[#0F2D52]" />
            {t("securite")}
          </h3>


          <button
            type="button"
            onClick={() => setPwOpen((o) => !o)}
            className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                <Lock className="h-4 w-4 text-[#0F2D52]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{t("mot_passe")}</p>
                <p className="text-xs text-muted-foreground">{t("modifier_mot_passe")}</p>
              </div>
            </div>
            <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", pwOpen && "rotate-90")} />
          </button>

          {pwOpen && (
            <div className="space-y-3 p-3 ml-12 border-l-2 border-[#0F2D52]/10">
              <div>
                <Label className="text-xs">{t("mot_passe_actuel")}</Label>
                <div className="relative">
                  <Input type={showCurrent ? "text" : "password"} value={pw.current} onChange={(e) => setPw((p) => ({ ...p, current: e.target.value }))} />
                  <button type="button" onClick={() => setShowCurrent((s) => !s)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                    {showCurrent ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                <div><Label className="text-xs">{t("nouveau")}</Label><Input type="password" value={pw.newPw} onChange={(e) => setPw((p) => ({ ...p, newPw: e.target.value }))} placeholder={t("min_8_caracteres")} /></div>
                <div><Label className="text-xs">{t("confirmer")}</Label><Input type="password" value={pw.confirm} onChange={(e) => setPw((p) => ({ ...p, confirm: e.target.value }))} /></div>
              </div>
              <Button onClick={handlePasswordChange} disabled={pwSaving} size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]">
                <Lock className="h-3.5 w-3.5 mr-1.5" />
                {pwSaving ? t("modification") : t("modifier")}
              </Button>
            </div>
          )}


          <button
            type="button"
            onClick={() => { setTwoFaOpen((o) => !o); setTwoFaStep("idle"); setVerifyCode(""); }}
            className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                <Smartphone className="h-4 w-4 text-[#0F2D52]" />
              </div>
              <div className="text-left">
                <p className="text-sm font-medium">{t("authentification_2fa")}</p>
                <p className="text-xs text-muted-foreground">
                  {twoFa ? t("active") : t("recommande_plus_securite")}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full", twoFa ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700")}>
                {twoFa ? t("active") : t("desactive")}
              </span>
              <ChevronRight className={cn("h-4 w-4 text-muted-foreground transition-transform", twoFaOpen && "rotate-90")} />
            </div>
          </button>

          {twoFaOpen && (
            <div className="space-y-3 p-3 ml-12 border-l-2 border-[#0F2D52]/10">
              {!twoFa && twoFaStep === "idle" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">{t("settings_view_protegez_votre_compte_avec_une_application_d")}</p>
                  <Button onClick={startTwoFaSetup} disabled={twoFaLoading} size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]">
                    <Shield className="h-3.5 w-3.5 mr-1.5" />
                    {twoFaLoading ? t("configuration") : t("activer_2fa")}
                  </Button>
                </div>
              )}

              {twoFaStep === "setup" && (
                <div className="space-y-3">
                  <p className="text-xs font-medium">{t("1_scannez_qr_code_application")}</p>
                  {qrCode && (
                    <div className="flex justify-center">
                      <img src={qrCode} alt={t("qr_code_2fa")} className="h-40 w-40 rounded-lg border p-2 bg-white" />
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">{t("entrez_cle_manuellement")}</p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded-lg break-all select-all">{secret}</code>
                      <Button variant="outline" size="sm" onClick={copySecret} className="shrink-0 h-8">
                        {copied ? <CheckCircle className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-medium mb-1">{t("2_entrez_code_6_chiffres")}</p>
                    <div className="flex gap-2">
                      <Input
                        value={verifyCode}
                        onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                        placeholder="000000"
                        className="font-mono text-center text-lg tracking-[0.3em] max-w-[180px]"
                        maxLength={6}
                      />
                      <Button onClick={verifyTwoFa} disabled={twoFaLoading || verifyCode.length !== 6} size="sm" className="bg-[#0F2D52] hover:bg-[#1a3a66]">
                        {twoFaLoading ? t("verification") : t("verifier")}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {twoFa && twoFaStep === "idle" && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">
                    {t("desactiver_2fa_entrez_code_application")}
                  </p>
                  <Button onClick={() => setTwoFaStep("disable")} variant="outline" size="sm" className="text-destructive">
                    {t("desactiver_2fa")}
                  </Button>
                </div>
              )}

              {twoFaStep === "disable" && (
                <div className="space-y-2">
                  <p className="text-xs font-medium">{t("entrez_code_6_chiffres_confirmer")}</p>
                  <div className="flex gap-2">
                    <Input
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="font-mono text-center text-lg tracking-[0.3em] max-w-[180px]"
                      maxLength={6}
                    />
                    <Button onClick={disableTwoFa} disabled={twoFaLoading || verifyCode.length !== 6} size="sm" variant="destructive">
                      {twoFaLoading ? "..." : t("confirmer")}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}


          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-lg bg-[#0F2D52]/10 flex items-center justify-center shrink-0">
                <Globe className="h-4 w-4 text-[#0F2D52]" />
              </div>
              <div>
                <p className="text-sm font-medium">{t("derniere_connexion")}</p>
                <p className="text-xs text-muted-foreground">{lastLogin ? formatDate(lastLogin) : "—"}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>


      <Card>
        <CardContent className="p-4 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Bell className="h-4 w-4 text-[#0F2D52]" />
            {t("notifications")}
          </h3>

          {[
            { label: t("factures_paiements"), desc: t("recevoir_courriel_chaque_nouvelle_facture") },
            { label: t("devis_contrats"), desc: t("etre_notifie_quand_devis_contrat") },
            { label: t("messages"), desc: t("notifications_nouveaux_messages_vnk") },
            { label: t("rendez_vous"), desc: t("rappels_avant_rendez_vous") },
          ].map((item) => (
            <div key={item.label} className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <p className="text-sm font-medium">{item.label}</p>
                <p className="text-xs text-muted-foreground">{item.desc}</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input type="checkbox" defaultChecked className="sr-only peer" />
                <div className="w-9 h-5 bg-muted rounded-full peer peer-checked:bg-[#0F2D52] after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
              </label>
            </div>
          ))}
        </CardContent>
      </Card>


      <Card>
        <CardContent className="p-4 sm:p-6 space-y-1">
          <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
            <Palette className="h-4 w-4 text-[#0F2D52]" />
            {t("preferences")}
          </h3>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="text-sm font-medium">{t("langue")}</p>
              <p className="text-xs text-muted-foreground">{t("settings_view_langue_de_l_interface")}</p>
            </div>
            <select defaultValue="fr" className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="fr">{t("francais")}</option>
              <option value="en">{t("english")}</option>
            </select>
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border">
            <div>
              <p className="text-sm font-medium">{t("fuseau_horaire")}</p>
              <p className="text-xs text-muted-foreground">{t("rendez_vous_notifications")}</p>
            </div>
            <select defaultValue="America/Toronto" className="h-8 rounded-md border border-input bg-background px-2 text-sm">
              <option value="America/Toronto">{t("montreal")}</option>
              <option value="America/Vancouver">{t("vancouver_pst")}</option>
              <option value="America/Winnipeg">{t("winnipeg_cst")}</option>
            </select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

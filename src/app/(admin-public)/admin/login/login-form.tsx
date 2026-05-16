"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, ShieldCheck, ArrowLeft } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function LoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(false);
  const [pending, startTransition] = useTransition();

  // Étape 2FA
  const [needs2FA, setNeeds2FA] = useState(false);
  const [twoFactorCode, setTwoFactorCode] = useState("");
  const [trustDevice, setTrustDevice] = useState(false);

  const completeSignIn = async (code: string, trust: boolean) => {
    const result = await signIn("admin-credentials", {
      email,
      password,
      twoFactorCode: code,
      trustDevice: trust ? "true" : "",
      redirect: false,
    });
    if (result?.error) {
      toast.error(code ? "Code 2FA incorrect" : "Identifiants invalides");
      if (code) setTwoFactorCode("");
      return false;
    }

    // ── Redirection : ?redirect param > admin.defaultLanding > /admin ──
    let redirectTo = params.get("redirect");
    if (!redirectTo) {
      try {
        const me = await fetch("/api/profile/me", { cache: "no-store" }).then((r) => r.ok ? r.json() : null);
        const landing = me?.admin?.defaultLanding;
        if (landing && ["dashboard", "requests", "calendar", "messages", "invoices"].includes(landing)) {
          redirectTo = landing === "dashboard" ? "/admin" : `/admin/${landing === "requests" ? "requests" : landing}`;
        }
      } catch { /* fallback */ }
    }
    router.push(redirectTo ?? "/admin");
    return true;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      // Étape 2FA : si on est déjà à cette étape, on submit le code
      if (needs2FA) {
        if (twoFactorCode.length !== 6) {
          toast.error("Entrez un code à 6 chiffres");
          return;
        }
        await completeSignIn(twoFactorCode, trustDevice);
        return;
      }

      // Étape 1 : vérifier credentials + détection 2FA + appareil de confiance
      const checkRes = await fetch("/api/auth/check-2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, kind: "admin" }),
      });
      const check = await checkRes.json();
      if (!check.valid) {
        toast.error("Identifiants invalides");
        return;
      }

      if (check.requires2FA) {
        setNeeds2FA(true);
        return;
      }

      // Pas de 2FA OU appareil déjà de confiance → connexion directe
      await completeSignIn("", false);
    });
  };

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader className="text-center pt-8">
        <div className="mx-auto h-14 w-14 rounded-lg vnk-gradient flex items-center justify-center mb-4">
          <span className="text-white font-bold text-lg">VNK</span>
        </div>
        <CardTitle className="text-xl">
          {needs2FA ? "Vérification en deux étapes" : t("admin_login_title")}
        </CardTitle>
        <CardDescription>
          {needs2FA ? "Entrez le code de votre application d'authentification" : "Automatisation Inc."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pb-8">
        <form onSubmit={handleSubmit} className="space-y-4">
          {!needs2FA ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="admin@vnk.ca"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    aria-label={showPassword ? "Masquer" : "Afficher"}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-muted-foreground cursor-pointer">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-input"
                />
                {t("remember_me")}
              </label>

              <Button type="submit" className="w-full" disabled={pending}>
                <LogIn className="h-4 w-4" />
                {pending ? "Connexion…" : t("sign_in_admin")}
              </Button>
            </>
          ) : (
            <>
              {/* Étape 2FA */}
              <div className="rounded-md border border-blue-200 bg-blue-50 p-3 text-xs text-blue-900 flex gap-2">
                <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <p>Ouvrez votre application d&apos;authentification (Google Authenticator, Authy, 1Password…) et entrez le code à 6 chiffres associé à votre compte VNK.</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="2fa-code">Code de vérification</Label>
                <Input
                  id="2fa-code"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={twoFactorCode}
                  onChange={(e) => setTwoFactorCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-2xl font-mono tracking-widest h-14"
                  maxLength={6}
                  autoFocus
                />
              </div>

              <label className="flex items-start gap-2 text-sm cursor-pointer p-3 rounded-md border bg-muted/30 hover:bg-muted/50 transition">
                <input
                  type="checkbox"
                  checked={trustDevice}
                  onChange={(e) => setTrustDevice(e.target.checked)}
                  className="h-4 w-4 rounded border-input mt-0.5"
                />
                <span className="flex-1">
                  <span className="font-medium block">Se souvenir de cet appareil pendant 30 jours</span>
                  <span className="text-xs text-muted-foreground">
                    Aucun code 2FA ne vous sera demandé depuis cet appareil. Ne cochez pas sur un appareil partagé ou public.
                  </span>
                </span>
              </label>

              <Button type="submit" className="w-full" disabled={pending || twoFactorCode.length !== 6}>
                {pending ? "Vérification…" : "Vérifier et se connecter"}
              </Button>

              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs"
                onClick={() => { setNeeds2FA(false); setTwoFactorCode(""); setTrustDevice(false); }}
              >
                <ArrowLeft className="h-3 w-3 mr-1" />
                Retour
              </Button>
            </>
          )}

          {!needs2FA && (
            <p className="text-center text-xs text-muted-foreground mt-6">
              {t("access_restricted")}
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}

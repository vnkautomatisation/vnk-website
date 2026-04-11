"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn } from "next-auth/react";
import { toast } from "sonner";
import { Eye, EyeOff, LogIn, Mail, Lock } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

export function PortalLoginForm() {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    startTransition(async () => {
      const result = await signIn("client-credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        toast.error("Identifiants invalides");
        return;
      }
      const redirectTo = searchParams.get("redirect") ?? "/portail";
      router.push(redirectTo);
    });
  };

  return (
    <Card className="w-full max-w-md shadow-2xl">
      <CardHeader className="pt-8 text-center">
        <div className="mx-auto h-14 w-14 rounded-xl vnk-gradient flex items-center justify-center mb-4">
          <span className="text-white font-bold text-lg">VNK</span>
        </div>
        <div>
          <h1 className="text-xl font-semibold">{t("portal_login_title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("portal_login_subtitle")}
          </p>
        </div>
      </CardHeader>
      <CardContent className="pb-8 space-y-4">
        <Button variant="outline" className="w-full" disabled>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.545 10.239v3.821h5.445c-.712 2.315-2.647 3.972-5.445 3.972a6.033 6.033 0 110-12.064c1.498 0 2.866.549 3.921 1.453l2.814-2.814A9.969 9.969 0 0012.545 2C7.021 2 2.543 6.477 2.543 12s4.478 10 10.002 10c8.396 0 10.249-7.85 9.426-11.748l-9.426-.013z" />
          </svg>
          {t("sign_in_with_google")}
        </Button>
        <Button variant="outline" className="w-full" disabled>
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M11.4 24H0V12.6h11.4V24zM24 24H12.6V12.6H24V24zM11.4 11.4H0V0h11.4v11.4zm12.6 0H12.6V0H24v11.4z" />
          </svg>
          {t("sign_in_with_microsoft")}
        </Button>

        <div className="relative">
          <Separator />
          <span className="absolute left-1/2 -translate-x-1/2 -top-2.5 bg-card px-3 text-xs text-muted-foreground uppercase">
            {t("or_connect")}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="portal-email">{t("email")}</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="portal-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                placeholder="votre@courriel.com"
                className="pl-10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="portal-password">{t("password")}</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="portal-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="pl-10 pr-10"
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

          <Button type="submit" className="w-full" disabled={pending}>
            <LogIn className="h-4 w-4" />
            {pending ? "Connexion…" : t("sign_in")}
          </Button>
        </form>

        <div className="text-center pt-4 border-t">
          <p className="text-sm text-muted-foreground">{t("no_account")}</p>
          <Button variant="link" asChild>
            <a href="/contact">{t("create_account")}</a>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

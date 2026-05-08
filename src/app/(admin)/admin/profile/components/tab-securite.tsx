"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Lock, ShieldCheck, ShieldOff, Eye, EyeOff } from "lucide-react";

export function TabSecurite({
  twoFactorEnabled,
}: {
  twoFactorEnabled: boolean;
}) {
  // ── Mot de passe ──────────────────────────────────────
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);

  const handleChangePassword = async () => {
    if (newPw !== confirmPw) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    if (newPw.length < 12) {
      toast.error("Minimum 12 caracteres");
      return;
    }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          currentPassword: oldPw,
          newPassword: newPw,
          confirmPassword: confirmPw,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Mot de passe modifie");
        setOldPw("");
        setNewPw("");
        setConfirmPw("");
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setPwLoading(false);
    }
  };

  // ── 2FA ───────────────────────────────────────────────
  const [is2FAEnabled, setIs2FAEnabled] = useState(twoFactorEnabled);
  const [setupDialog, setSetupDialog] = useState(false);
  const [disableDialog, setDisableDialog] = useState(false);
  const [qrCode, setQrCode] = useState("");
  const [secret, setSecret] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [tfaLoading, setTfaLoading] = useState(false);

  const handleSetup2FA = async () => {
    setTfaLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/setup", { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setQrCode(data.qrCode);
        setSecret(data.secret);
        setSetupDialog(true);
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleVerify2FA = async () => {
    if (totpCode.length !== 6) {
      toast.error("Entrez un code a 6 chiffres");
      return;
    }
    setTfaLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("2FA active avec succes");
        setIs2FAEnabled(true);
        setSetupDialog(false);
        setTotpCode("");
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setTfaLoading(false);
    }
  };

  const handleDisable2FA = async () => {
    if (totpCode.length !== 6) {
      toast.error("Entrez un code a 6 chiffres");
      return;
    }
    setTfaLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/disable", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("2FA desactive");
        setIs2FAEnabled(false);
        setDisableDialog(false);
        setTotpCode("");
      } else {
        toast.error(data.error);
      }
    } catch {
      toast.error("Erreur reseau");
    } finally {
      setTfaLoading(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* Mot de passe */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Lock className="h-4 w-4" />
            Changer le mot de passe
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="old-pw">Mot de passe actuel</Label>
            <div className="relative">
              <Input
                id="old-pw"
                type={showOld ? "text" : "password"}
                value={oldPw}
                onChange={(e) => setOldPw(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowOld(!showOld)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pw">Nouveau mot de passe</Label>
            <div className="relative">
              <Input
                id="new-pw"
                type={showNew ? "text" : "password"}
                value={newPw}
                onChange={(e) => setNewPw(e.target.value)}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <p className="text-[11px] text-muted-foreground">Minimum 12 caracteres</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pw">Confirmer</Label>
            <Input
              id="confirm-pw"
              type="password"
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
            />
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleChangePassword}
            disabled={pwLoading || !oldPw || !newPw || !confirmPw}
          >
            {pwLoading ? "Modification..." : "Changer le mot de passe"}
          </Button>
        </CardContent>
      </Card>

      {/* 2FA */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" />
            Authentification 2FA
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div>
              <p className="text-sm font-medium">Statut</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Application TOTP (Google Authenticator, Authy, etc.)
              </p>
            </div>
            <Badge className={is2FAEnabled
              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
              : "bg-amber-100 text-amber-700 hover:bg-amber-100"
            }>
              {is2FAEnabled ? "Active" : "Desactive"}
            </Badge>
          </div>

          {is2FAEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => { setTotpCode(""); setDisableDialog(true); }}
              className="border-destructive/30 text-destructive hover:bg-destructive/10"
            >
              <ShieldOff className="h-3.5 w-3.5" />
              Desactiver 2FA
            </Button>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={handleSetup2FA}
              disabled={tfaLoading}
            >
              <ShieldCheck className="h-3.5 w-3.5" />
              {tfaLoading ? "Chargement..." : "Activer 2FA"}
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Dialog Setup 2FA */}
      <Dialog open={setupDialog} onOpenChange={setSetupDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Activer l&apos;authentification 2FA</DialogTitle>
            <DialogDescription>
              Scannez le code QR avec votre application d&apos;authentification, puis entrez le code a 6 chiffres.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 rounded-lg border" />
              </div>
            )}
            {secret && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">Cle manuelle :</p>
                <code className="text-xs bg-muted px-3 py-1.5 rounded-md font-mono select-all">
                  {secret}
                </code>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="totp-verify">Code de verification</Label>
              <Input
                id="totp-verify"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                className="text-center text-lg font-mono tracking-widest"
                maxLength={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetupDialog(false)}>
              Annuler
            </Button>
            <Button onClick={handleVerify2FA} disabled={tfaLoading || totpCode.length !== 6}>
              {tfaLoading ? "Verification..." : "Activer"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog Disable 2FA */}
      <Dialog open={disableDialog} onOpenChange={setDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desactiver 2FA</DialogTitle>
            <DialogDescription>
              Entrez un code de votre application pour confirmer la desactivation.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="totp-disable">Code TOTP</Label>
            <Input
              id="totp-disable"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              placeholder="000000"
              className="text-center text-lg font-mono tracking-widest"
              maxLength={6}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisableDialog(false)}>
              Annuler
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable2FA}
              disabled={tfaLoading || totpCode.length !== 6}
            >
              {tfaLoading ? "Desactivation..." : "Desactiver"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

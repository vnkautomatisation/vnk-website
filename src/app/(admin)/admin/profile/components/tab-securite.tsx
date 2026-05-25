"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Lock, ShieldCheck, ShieldOff, Eye, EyeOff, KeyRound, AlertTriangle,
  RefreshCw, Trash2, ShieldAlert, Smartphone, MonitorSmartphone, Copy, Check, Fingerprint, Pencil,
  UserPlus, UserMinus,
} from "lucide-react";
import { regenerateBackupCodesAction, removeTrustedDeviceAction } from "@/app/actions/profile";
import { delegateLeaveApprovalAction } from "@/app/actions/hr-leaves";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { TrustedDeviceRow, DelegationCandidate } from "../profile-view";
import { useRouter } from "next/navigation";

type BreachInfo = { breached: boolean; count: number; strength: number; strengthLabel: string } | null;

export function TabSecurite({
  twoFactorEnabled, passwordChangedAt, backupCodesCount, trustedDevices, securityScore, loginAlertsEnabled,
  delegationCandidates, currentDelegate,
}: {
  twoFactorEnabled: boolean;
  passwordChangedAt: string | null;
  backupCodesCount: number;
  trustedDevices: TrustedDeviceRow[];
  securityScore: number;
  loginAlertsEnabled: boolean;
  delegationCandidates: DelegationCandidate[];
  currentDelegate: DelegationCandidate | null;
}) {
  const t = useTranslations("admin.profile.security");
  const tCommon = useTranslations("admin.profile.common");
  const router = useRouter();

  // ── Password change (en modal dédié) ────────────────
  const [pwDialog, setPwDialog] = useState(false);
  const [oldPw, setOldPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwLoading, setPwLoading] = useState(false);
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [breachInfo, setBreachInfo] = useState<BreachInfo>(null);
  const [breachWarningOpen, setBreachWarningOpen] = useState(false);
  const [hibpChecking, setHibpChecking] = useState(false);

  const resetPwForm = () => {
    setOldPw(""); setNewPw(""); setConfirmPw(""); setBreachInfo(null);
    setShowOld(false); setShowNew(false);
  };

  const handleNewPwChange = (val: string) => {
    setNewPw(val);
    setBreachInfo(null);
    if (val.length < 8) return;
    setHibpChecking(true);
    setTimeout(async () => {
      try {
        const res = await fetch("/api/security/password-check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password: val }),
        });
        if (res.ok) {
          const data = await res.json();
          setBreachInfo(data);
        }
      } finally {
        setHibpChecking(false);
      }
    }, 500);
  };

  const doChangePassword = async (bypassBreachCheck: boolean) => {
    if (newPw !== confirmPw) { toast.error("Les mots de passe ne correspondent pas"); return; }
    if (newPw.length < 12) { toast.error("Minimum 12 caractères"); return; }
    setPwLoading(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword: oldPw, newPassword: newPw, confirmPassword: confirmPw, bypassBreachCheck }),
      });
      const data = await res.json();
      if (res.status === 422 && data.error === "breach_detected") {
        setBreachWarningOpen(true);
        return;
      }
      if (res.ok) {
        toast.success("Mot de passe modifié");
        resetPwForm();
        setPwDialog(false);
        setBreachWarningOpen(false);
        router.refresh();
      } else {
        toast.error(data.error || data.message || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setPwLoading(false);
    }
  };

  // ── 2FA ─────────────────────────────────────────────
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
      if (res.ok) { setQrCode(data.qrCode); setSecret(data.secret); setSetupDialog(true); }
      else toast.error(data.error);
    } catch { toast.error("Erreur réseau"); }
    finally { setTfaLoading(false); }
  };

  const handleVerify2FA = async () => {
    if (totpCode.length !== 6) { toast.error("Entrez un code à 6 chiffres"); return; }
    setTfaLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/verify", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (res.ok) { toast.success("2FA activée"); setIs2FAEnabled(true); setSetupDialog(false); setTotpCode(""); router.refresh(); }
      else toast.error(data.error);
    } catch { toast.error("Erreur réseau"); }
    finally { setTfaLoading(false); }
  };

  const handleDisable2FA = async () => {
    if (totpCode.length !== 6) { toast.error("Entrez un code"); return; }
    setTfaLoading(true);
    try {
      const res = await fetch("/api/auth/two-factor/disable", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode }),
      });
      const data = await res.json();
      if (res.ok) { toast.success("2FA désactivée"); setIs2FAEnabled(false); setDisableDialog(false); setTotpCode(""); router.refresh(); }
      else toast.error(data.error);
    } catch { toast.error("Erreur réseau"); }
    finally { setTfaLoading(false); }
  };

  // ── Backup codes ────────────────────────────────────
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [backupDialog, setBackupDialog] = useState(false);
  const [copied, setCopied] = useState(false);
  const [backupPending, startBackup] = useTransition();

  const handleRegenBackupCodes = () => {
    startBackup(async () => {
      const result = await regenerateBackupCodesAction();
      if (result.success && "data" in result) {
        setBackupCodes(result.data.codes);
        setBackupDialog(true);
        toast.success("10 codes générés");
      } else if (!result.success) {
        toast.error(result.error);
      }
    });
  };

  const copyBackupCodes = () => {
    navigator.clipboard.writeText(backupCodes.join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Trusted devices ──────────────────────────────────
  const [trustedPending, startTrusted] = useTransition();
  const handleRemoveTrusted = (id: number) => {
    startTrusted(async () => {
      const r = await removeTrustedDeviceAction(id);
      if (r.success) toast.success(tCommon("saved"));
      else toast.error(r.error);
    });
  };

  const pwDaysSince = passwordChangedAt
    ? Math.floor((Date.now() - new Date(passwordChangedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const pwExpired = pwDaysSince !== null && pwDaysSince > 180;

  // ── Delegation d'approbation de congés ───────────────
  const [delegateSel, setDelegateSel] = useState<string>(currentDelegate ? String(currentDelegate.id) : "");
  const [delPending, startDel] = useTransition();
  const saveDelegation = (delegateId: number | null) => {
    startDel(async () => {
      const r = await delegateLeaveApprovalAction({ delegateId });
      if (r.success) {
        toast.success(delegateId === null ? "Délégation désactivée" : "Délégation enregistrée");
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };
  const handleActivateDelegation = () => {
    if (!delegateSel) { toast.error("Sélectionnez un délégué"); return; }
    saveDelegation(Number(delegateSel));
  };
  const handleClearDelegation = () => {
    setDelegateSel("");
    saveDelegation(null);
  };

  return (
    <div className="space-y-4">
      {/* ─── Banner score sécurité ─── */}
      <Card className={securityScore >= 80 ? "border-emerald-200 bg-emerald-50/30" : securityScore >= 50 ? "border-amber-200 bg-amber-50/30" : "border-red-200 bg-red-50/30"}>
        <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className={`flex items-center justify-center h-12 w-12 rounded-full ${securityScore >= 80 ? "bg-emerald-100 text-emerald-700" : securityScore >= 50 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"}`}>
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold">{t("score_title", { score: securityScore })}</p>
            <p className="text-xs text-muted-foreground">
              {securityScore >= 80 ? t("score_excellent") :
               securityScore >= 50 ? t("score_good") :
               t("score_weak")}
            </p>
          </div>
          <div className="h-2 w-full sm:w-32 bg-muted rounded-full overflow-hidden">
            <div className={`h-full ${securityScore >= 80 ? "bg-emerald-500" : securityScore >= 50 ? "bg-amber-500" : "bg-red-500"}`} style={{ width: `${securityScore}%` }} />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ─── Carte Mot de passe (lecture seule + bouton modifier) ─── */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Lock className="h-4 w-4" />
                  {t("password.title")}
                </CardTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("password.description")}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => { resetPwForm(); setPwDialog(true); }} className="h-8">
                <Pencil className="h-3.5 w-3.5" />
                <span className="hidden sm:inline ml-1">{t("password.modify")}</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">{t("password.last_changed")}</span>
              <span className="text-sm font-medium">
                {passwordChangedAt
                  ? new Date(passwordChangedAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })
                  : <span className="text-muted-foreground italic">{tCommon("not_set")}</span>}
              </span>
            </div>
            <div className="flex items-center justify-between py-2 border-b">
              <span className="text-sm text-muted-foreground">{t("password.age")}</span>
              <span className={`text-sm font-medium ${pwExpired ? "text-red-600" : pwDaysSince !== null && pwDaysSince > 90 ? "text-amber-600" : ""}`}>
                {pwDaysSince !== null ? t("password.days_old", { count: pwDaysSince }) : "—"}
              </span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-muted-foreground">{t("password.reuse_blocked")}</span>
              <span className="text-sm font-medium">{t("password.reuse_blocked_value")}</span>
            </div>
            {pwExpired && (
              <div className="flex items-center gap-2 rounded-md p-2.5 text-xs bg-red-50 text-red-700 border border-red-200">
                <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                <span>{t("password.renew_recommended")}</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ─── Carte 2FA + Backup codes (lecture + actions) ─── */}
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" />
              {t("tfa.title")}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div>
                <p className="text-sm font-medium">{t("tfa.status_label")}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{t("tfa.status_apps")}</p>
              </div>
              <div className="flex items-center gap-2">
                <Badge className={is2FAEnabled ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" : "bg-amber-100 text-amber-700 hover:bg-amber-100"}>
                  {is2FAEnabled ? t("tfa.enabled") : t("tfa.disabled")}
                </Badge>
                {is2FAEnabled ? (
                  <Button variant="outline" size="sm" onClick={() => { setTotpCode(""); setDisableDialog(true); }} className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10">
                    <ShieldOff className="h-3.5 w-3.5" />
                  </Button>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleSetup2FA} disabled={tfaLoading} className="h-8">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    {t("tfa.enable")}
                  </Button>
                )}
              </div>
            </div>

            {/* Backup codes */}
            <div className="pt-3 border-t space-y-2">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium flex items-center gap-1.5"><KeyRound className="h-3.5 w-3.5" /> {t("backup_codes.title")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {t("backup_codes.active_count", { count: backupCodesCount })}
                  </p>
                </div>
                <Button variant="outline" size="sm" onClick={handleRegenBackupCodes} disabled={backupPending}>
                  <RefreshCw className={`h-3.5 w-3.5 ${backupPending ? "animate-spin" : ""}`} />
                  {backupCodesCount > 0 ? t("backup_codes.regenerate") : t("backup_codes.generate")}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("backup_codes.hint")}
              </p>
            </div>

            {/* Login alerts */}
            <div className="pt-3 border-t flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">{t("login_alerts.title")}</p>
                <p className="text-xs text-muted-foreground">{t("login_alerts.description")}</p>
              </div>
              <Badge className={loginAlertsEnabled ? "bg-emerald-100 text-emerald-700" : "bg-zinc-100 text-zinc-600"}>
                {loginAlertsEnabled ? t("tfa.enabled") : t("tfa.disabled")}
              </Badge>
            </div>
          </CardContent>
        </Card>

        {/* ─── Trusted devices ─── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Fingerprint className="h-4 w-4" />
              {t("trusted_devices.title")}
              <Badge variant="secondary" className="ml-1">{trustedDevices.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {trustedDevices.length === 0 ? (
              <div className="text-center py-8 text-sm text-muted-foreground">
                <MonitorSmartphone className="h-8 w-8 mx-auto mb-2 opacity-40" />
                <p>{t("trusted_devices.empty_title")}</p>
                <p className="text-[11px] mt-1">{t("trusted_devices.empty_hint")}</p>
              </div>
            ) : (
              <ul className="divide-y">
                {trustedDevices.map((d) => {
                  const daysLeft = Math.max(0, Math.ceil((new Date(d.expiresAt).getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
                  const lastUsedStr = new Date(d.lastUsedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
                  const expDateStr = new Date(d.expiresAt).toLocaleDateString(undefined, { day: "numeric", month: "short" });
                  return (
                  <li key={d.id} className="flex items-center gap-3 py-2.5">
                    <Smartphone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{d.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("trusted_devices.last_used", { date: lastUsedStr })}
                        {daysLeft > 0
                          ? " · " + t("trusted_devices.expires_in", { count: daysLeft, date: expDateStr })
                          : " · " + t("trusted_devices.expired")}
                      </p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRemoveTrusted(d.id)} disabled={trustedPending} className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                  );
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* ─── Délégation d'approbation de congés ─── */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <UserPlus className="h-4 w-4" />
              Délégation d&apos;approbation
              {currentDelegate && (
                <Badge className="ml-1 bg-emerald-100 text-emerald-700 hover:bg-emerald-100">Active</Badge>
              )}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-1">
              En cas d&apos;absence, désignez un collègue qui pourra approuver les demandes de congé à votre place.
              Le routage s&apos;active automatiquement quand vous êtes en congé approuvé.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {currentDelegate ? (
              <div className="rounded-md border bg-muted/30 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-[#0F2D52] truncate">
                      Délégué actuel : {currentDelegate.fullName || currentDelegate.email}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {currentDelegate.title ? `${currentDelegate.title} · ` : ""}{currentDelegate.email}
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleClearDelegation}
                    disabled={delPending}
                    className="border-destructive/30 text-destructive hover:bg-destructive/10"
                  >
                    <UserMinus className="h-3.5 w-3.5" />
                    <span className="hidden sm:inline ml-1">Désactiver</span>
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Aucune délégation configurée.</p>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 items-end">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-bold">
                  {currentDelegate ? "Changer le délégué" : "Désigner un délégué"}
                </Label>
                <Select value={delegateSel} onValueChange={setDelegateSel}>
                  <SelectTrigger className="h-9 mt-1.5">
                    <SelectValue placeholder="Sélectionner un administrateur" />
                  </SelectTrigger>
                  <SelectContent>
                    {delegationCandidates.length === 0 ? (
                      <div className="px-2 py-3 text-xs text-muted-foreground italic">Aucun candidat éligible</div>
                    ) : delegationCandidates.map((c) => (
                      <SelectItem key={c.id} value={String(c.id)}>
                        {(c.fullName || c.email)}
                        {c.title ? ` — ${c.title}` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button
                onClick={handleActivateDelegation}
                disabled={delPending || !delegateSel || String(currentDelegate?.id ?? "") === delegateSel}
                className="bg-[#0F2D52] hover:bg-[#0a223e] text-white"
              >
                <UserPlus className="h-4 w-4" />
                <span className="ml-1">{currentDelegate ? "Mettre à jour" : "Activer"}</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground">
              Seuls les admins avec droit de revue des congés sont éligibles. Un cron quotidien
              déclenche le routage des demandes en attente vers le délégué quand vous êtes absent.
            </p>
          </CardContent>
        </Card>
      </div>

      {/* ─── Dialog Changement mot de passe ─── */}
      <Dialog open={pwDialog} onOpenChange={(o) => { setPwDialog(o); if (!o) resetPwForm(); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white flex items-center gap-2"><Lock className="h-5 w-5" /> {t("password.modal_title")}</DialogTitle>
            <DialogDescription className="text-white/80 text-sm mt-1">
              {t("password.modal_description")}
            </DialogDescription>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="old-pw" className="text-xs">{t("password.current")}</Label>
              <div className="relative">
                <Input id="old-pw" type={showOld ? "text" : "password"} value={oldPw} onChange={(e) => setOldPw(e.target.value)} className="pr-10 h-9" autoComplete="current-password" />
                <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showOld ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="new-pw" className="text-xs">{t("password.new")}</Label>
              <div className="relative">
                <Input id="new-pw" type={showNew ? "text" : "password"} value={newPw} onChange={(e) => handleNewPwChange(e.target.value)} className="pr-10 h-9" autoComplete="new-password" />
                <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {newPw.length >= 8 && (
                <div className="space-y-1.5">
                  <div className="flex items-center gap-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <span
                        key={i}
                        className={`h-1 flex-1 rounded-full ${i < (breachInfo?.strength ?? 0) ? (breachInfo!.strength >= 3 ? "bg-emerald-500" : breachInfo!.strength >= 2 ? "bg-amber-500" : "bg-red-500") : "bg-muted"}`}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] flex items-center gap-1.5">
                    {hibpChecking ? (
                      <span className="text-muted-foreground">{t("password.checking")}</span>
                    ) : breachInfo?.breached ? (
                      <span className="text-red-600 font-semibold flex items-center gap-1">
                        <ShieldAlert className="h-3 w-3" />
                        {t("password.breached", { count: breachInfo.count })}
                      </span>
                    ) : breachInfo ? (
                      <span className="text-emerald-600 flex items-center gap-1">
                        <ShieldCheck className="h-3 w-3" />
                        {t("password.safe", { label: breachInfo.strengthLabel })}
                      </span>
                    ) : null}
                  </p>
                </div>
              )}
              <p className="text-[10px] text-muted-foreground">{t("password.too_short")}</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw" className="text-xs">{t("password.confirm")}</Label>
              <Input id="confirm-pw" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="h-9" autoComplete="new-password" />
            </div>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => { setPwDialog(false); resetPwForm(); }}>{tCommon("cancel")}</Button>
            <Button onClick={() => doChangePassword(false)} disabled={pwLoading || !oldPw || !newPw || !confirmPw}>
              {pwLoading ? tCommon("saving") : t("password.modify")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Setup 2FA ─── */}
      <Dialog open={setupDialog} onOpenChange={setSetupDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white">{t("tfa.setup_title")}</DialogTitle>
            <DialogDescription className="text-white/80 text-sm mt-1">
              {t("tfa.setup_description")}
            </DialogDescription>
          </div>
          <div className="p-5 space-y-4">
            {qrCode && (
              <div className="flex justify-center">
                <img src={qrCode} alt="QR Code 2FA" className="w-48 h-48 rounded-lg border" />
              </div>
            )}
            {secret && (
              <div className="text-center">
                <p className="text-xs text-muted-foreground mb-1">{t("tfa.manual_key")}</p>
                <code className="text-xs bg-muted px-3 py-1.5 rounded-md font-mono select-all">{secret}</code>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="totp-verify" className="text-xs">{t("tfa.verification_code")}</Label>
              <Input id="totp-verify" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="text-center text-lg font-mono tracking-widest" maxLength={6} />
            </div>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setSetupDialog(false)}>{tCommon("cancel")}</Button>
            <Button onClick={handleVerify2FA} disabled={tfaLoading || totpCode.length !== 6}>
              {tfaLoading ? "…" : t("tfa.enable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Disable 2FA ─── */}
      <Dialog open={disableDialog} onOpenChange={setDisableDialog}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white">{t("tfa.disable_title")}</DialogTitle>
            <DialogDescription className="text-white/80 text-sm mt-1">
              {t("tfa.disable_description")}
            </DialogDescription>
          </div>
          <div className="p-5 space-y-2">
            <Label htmlFor="totp-disable" className="text-xs">{t("tfa.verification_code")}</Label>
            <Input id="totp-disable" value={totpCode} onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" className="text-center text-lg font-mono tracking-widest" maxLength={6} />
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setDisableDialog(false)}>{tCommon("cancel")}</Button>
            <Button variant="destructive" onClick={handleDisable2FA} disabled={tfaLoading || totpCode.length !== 6}>
              {tfaLoading ? "…" : t("tfa.disable")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Backup codes ─── */}
      <Dialog open={backupDialog} onOpenChange={setBackupDialog}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white">{t("backup_codes.modal_title")}</DialogTitle>
            <DialogDescription className="text-white/80 text-sm mt-1">
              {t("backup_codes.modal_description")}
            </DialogDescription>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-2 gap-2 font-mono text-sm">
              {backupCodes.map((c, i) => (
                <div key={i} className="bg-muted rounded-md px-3 py-2 select-all tracking-widest text-center">{c}</div>
              ))}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800">
              <strong>{t("backup_codes.important")}</strong> {t("backup_codes.important_text")}
            </div>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={copyBackupCodes}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? t("backup_codes.copied") : t("backup_codes.copy_all")}
            </Button>
            <Button onClick={() => setBackupDialog(false)}>{t("backup_codes.saved")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Dialog Breach warning ─── */}
      <Dialog open={breachWarningOpen} onOpenChange={setBreachWarningOpen}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-red-600 text-white p-5">
            <DialogTitle className="text-white flex items-center gap-2"><ShieldAlert className="h-5 w-5" /> {t("password.breach_warning_title")}</DialogTitle>
            <DialogDescription className="text-white/85 text-sm mt-1">
              {t("password.breach_warning_description")}
            </DialogDescription>
          </div>
          <div className="p-5 text-sm space-y-2">
            <p>{t("password.breach_count_text", { count: breachInfo?.count ?? 0 })}</p>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setBreachWarningOpen(false)}>{t("password.choose_other")}</Button>
            <Button variant="destructive" onClick={() => doChangePassword(true)}>{t("password.use_anyway")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

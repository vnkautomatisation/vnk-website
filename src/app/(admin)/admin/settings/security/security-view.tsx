"use client";
// Vue Sécurité — politique globale + events critiques + verrouillage comptes.
import React, { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Shield, ChevronLeft, KeyRound, Lock, Globe, AlertTriangle,
  UserX, UserCheck, Save, LogOut, Unlock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  updateSecurityPolicyAction, forceLogoutAllAction,
  lockAdminAction, unlockAdminAction,
} from "@/app/actions/security";

type EventRow = {
  id: number; type: string; severity: string; message: string;
  ipAddress: string | null; country: string | null; city: string | null;
  createdAt: string;
  admin: { email: string; fullName: string | null } | null;
};
type AdminRow = {
  id: number; email: string; fullName: string | null;
  twoFactorEnabled: boolean;
  lastLogin: string | null; lockedUntil: string | null; failedLoginAttempts: number;
  customRole: { name: string; color: string | null } | null;
};

type Tab = "policy" | "events" | "accounts";

const SEVERITY_META: Record<string, { color: string; labelKey: string }> = {
  critical: { color: "bg-red-600", labelKey: "sev_critical" },
  warning: { color: "bg-amber-500", labelKey: "sev_warning" },
  info: { color: "bg-blue-500", labelKey: "sev_info" },
  success: { color: "bg-emerald-500", labelKey: "sev_success" },
};

export function SecurityView({
  policy, recentEvents, allAdmins, currentAdminId, isSuperAdmin,
}: {
  policy: Record<string, string>;
  recentEvents: EventRow[];
  lockedAdmins: AdminRow[];
  allAdmins: AdminRow[];
  currentAdminId: number;
  isSuperAdmin: boolean;
}) {
  const t = useTranslations("admin.security");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("policy");
  const dateTag = useDateLocale();
  const [pending, startTransition] = useTransition();


  const [minPasswordLength, setMinPasswordLength] = useState(policy.minPasswordLength || "12");
  const [requireUppercase, setRequireUppercase] = useState(policy.requireUppercase !== "false");
  const [requireDigits, setRequireDigits] = useState(policy.requireDigits !== "false");
  const [requireSymbols, setRequireSymbols] = useState(policy.requireSymbols === "true");
  const [passwordHistorySize, setPasswordHistorySize] = useState(policy.passwordHistorySize || "5");
  const [passwordExpiryDays, setPasswordExpiryDays] = useState(policy.passwordExpiryDays || "0");
  const [require2FAForAdmins, setRequire2FAForAdmins] = useState(policy.require2FAForAdmins === "true");
  const [require2FAForSuperAdmins, setRequire2FAForSuperAdmins] = useState(policy.require2FAForSuperAdmins !== "false");
  const [trustedDeviceDays, setTrustedDeviceDays] = useState(policy.trustedDeviceDays || "30");
  const [sessionMaxAgeHours, setSessionMaxAgeHours] = useState(policy.sessionMaxAgeHours || "168");
  const [maxConcurrentSessions, setMaxConcurrentSessions] = useState(policy.maxConcurrentSessions || "10");
  const [maxFailedAttempts, setMaxFailedAttempts] = useState(policy.maxFailedAttempts || "5");
  const [lockoutMinutes, setLockoutMinutes] = useState(policy.lockoutMinutes || "30");
  const [alertOnNewDevice, setAlertOnNewDevice] = useState(policy.alertOnNewDevice !== "false");
  const [alertOnFailedLogin, setAlertOnFailedLogin] = useState(policy.alertOnFailedLogin !== "false");
  const [alertOnPasswordChange, setAlertOnPasswordChange] = useState(policy.alertOnPasswordChange !== "false");
  const [alertOnRoleChange, setAlertOnRoleChange] = useState(policy.alertOnRoleChange !== "false");
  const [ipWhitelistEnabled, setIpWhitelistEnabled] = useState(policy.ipWhitelistEnabled === "true");
  const [ipWhitelist, setIpWhitelist] = useState(policy.ipWhitelist || "");

  const [confirmForceLogout, setConfirmForceLogout] = useState(false);
  const [confirmLock, setConfirmLock] = useState<{ id: number; email: string } | null>(null);

  const savePolicy = () => {
    startTransition(async () => {
      const r = await updateSecurityPolicyAction({
        minPasswordLength: Number(minPasswordLength),
        requireUppercase, requireDigits, requireSymbols,
        passwordHistorySize: Number(passwordHistorySize),
        passwordExpiryDays: Number(passwordExpiryDays),
        require2FAForAdmins, require2FAForSuperAdmins,
        trustedDeviceDays: Number(trustedDeviceDays),
        sessionMaxAgeHours: Number(sessionMaxAgeHours),
        maxConcurrentSessions: Number(maxConcurrentSessions),
        maxFailedAttempts: Number(maxFailedAttempts),
        lockoutMinutes: Number(lockoutMinutes),
        alertOnNewDevice, alertOnFailedLogin, alertOnPasswordChange, alertOnRoleChange,
        ipWhitelistEnabled, ipWhitelist,
      });
      if (r.success) { toast.success(t("politique_enregistree")); router.refresh(); }
      else toast.error(r.error || t("erreur"));
    });
  };

  const handleForceLogout = () => {
    startTransition(async () => {
      const r = await forceLogoutAllAction();
      if (r.success && "data" in r) {
        toast.success(t("security_view_p0_session_s_terminee_s", { p0: r.data.count }));
        router.refresh();
      } else if (!r.success) {
        toast.error(r.error);
      }
      setConfirmForceLogout(false);
    });
  };

  const handleLock = (id: number, minutes: number) => {
    startTransition(async () => {
      const r = await lockAdminAction({ id, minutes });
      if (r.success) { toast.success(t("compte_bloque")); router.refresh(); }
      else toast.error(r.error || t("erreur"));
      setConfirmLock(null);
    });
  };

  const handleUnlock = (id: number) => {
    startTransition(async () => {
      const r = await unlockAdminAction({ id });
      if (r.success) { toast.success(t("compte_debloque")); router.refresh(); }
      else toast.error(r.error || t("erreur"));
    });
  };

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { key: "policy", label: t("politique"), icon: Shield },
    { key: "events", label: t("evenements"), icon: AlertTriangle, count: recentEvents.length },
    { key: "accounts", label: t("comptes"), icon: Lock, count: allAdmins.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-red-600 shrink-0">
          <Shield className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("securite")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("politique_globale_evenements_critiques_gestion")}
          </p>
        </div>
        {!isSuperAdmin && (
          <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">{t("lecture_seule")}</Badge>
        )}
      </div>

      <div className="border-b">
        <div className="flex gap-1">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.key;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2",
                  active ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                )}
              >
                <Icon className="h-4 w-4" />{t.label}
                {t.count !== undefined && <Badge variant="secondary" className="text-[10px] ml-1">{t.count}</Badge>}
              </button>
            );
          })}
        </div>
      </div>


      {tab === "policy" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <H icon={KeyRound} title={t("politique_mots_passe")} />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <F label={t("longueur_minimale")}>
                  <Input type="number" min="8" max="128" value={minPasswordLength} onChange={(e) => setMinPasswordLength(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label={t("historique_nb_derniers")}>
                  <Input type="number" min="0" max="20" value={passwordHistorySize} onChange={(e) => setPasswordHistorySize(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label={t("expiration_jours_0_jamais")}>
                  <Input type="number" min="0" max="730" value={passwordExpiryDays} onChange={(e) => setPasswordExpiryDays(e.target.value)} disabled={!isSuperAdmin} />
                </F>
              </div>
              <div className="space-y-2">
                <Toggle label={t("exiger_majuscule")} checked={requireUppercase} onChange={setRequireUppercase} disabled={!isSuperAdmin} />
                <Toggle label={t("exiger_chiffre")} checked={requireDigits} onChange={setRequireDigits} disabled={!isSuperAdmin} />
                <Toggle label={t("exiger_caractere_special")} checked={requireSymbols} onChange={setRequireSymbols} disabled={!isSuperAdmin} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <H icon={Shield} title={t("authentification_2_facteurs_2fa")} />
              <div className="space-y-2">
                <Toggle label={t("exiger_2fa_tous_administrateurs")} checked={require2FAForAdmins} onChange={setRequire2FAForAdmins} disabled={!isSuperAdmin} description={t("admins_sans_2fa_seront_forces")} />
                <Toggle label={t("exiger_2fa_super_administrateurs")} checked={require2FAForSuperAdmins} onChange={setRequire2FAForSuperAdmins} disabled={!isSuperAdmin} description={t("recommande_toujours_activer")} />
              </div>
              <F label={t("duree_confiance_appareils_jours")}>
                <Input type="number" min="1" max="365" value={trustedDeviceDays} onChange={(e) => setTrustedDeviceDays(e.target.value)} disabled={!isSuperAdmin} />
              </F>
            </CardContent>
          </Card>

          <PasskeysSection />

          <Card>
            <CardContent className="p-5 space-y-4">
              <H icon={Lock} title={t("sessions_verrouillage")} />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label={t("duree_session_max_heures")}>
                  <Input type="number" min="1" max="720" value={sessionMaxAgeHours} onChange={(e) => setSessionMaxAgeHours(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label={t("sessions_concurrentes_max")}>
                  <Input type="number" min="1" max="50" value={maxConcurrentSessions} onChange={(e) => setMaxConcurrentSessions(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label={t("tentatives_echouees_avant_blocage")}>
                  <Input type="number" min="3" max="20" value={maxFailedAttempts} onChange={(e) => setMaxFailedAttempts(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label={t("duree_blocage_minutes")}>
                  <Input type="number" min="1" max="1440" value={lockoutMinutes} onChange={(e) => setLockoutMinutes(e.target.value)} disabled={!isSuperAdmin} />
                </F>
              </div>
              {isSuperAdmin && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-900 mb-2">{t("action_immediate")}</p>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmForceLogout(true)}>
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    {t("deconnecter_tous_autres_admins")}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <H icon={AlertTriangle} title={t("alertes_courriel")} />
              <Toggle label={t("connexion_depuis_nouvel_appareil")} checked={alertOnNewDevice} onChange={setAlertOnNewDevice} disabled={!isSuperAdmin} />
              <Toggle label={t("tentative_connexion_echouee")} checked={alertOnFailedLogin} onChange={setAlertOnFailedLogin} disabled={!isSuperAdmin} />
              <Toggle label={t("changement_mot_passe")} checked={alertOnPasswordChange} onChange={setAlertOnPasswordChange} disabled={!isSuperAdmin} />
              <Toggle label={t("changement_role")} checked={alertOnRoleChange} onChange={setAlertOnRoleChange} disabled={!isSuperAdmin} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <H icon={Globe} title={t("liste_blanche_adresses_ip")} />
              <Toggle label={t("activer_liste_blanche_ip")} checked={ipWhitelistEnabled} onChange={setIpWhitelistEnabled} disabled={!isSuperAdmin} description={t("bloque_toute_connexion_admin_depuis")} />
              {ipWhitelistEnabled && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {t("adresses_autorisees_ligne_ipv4_cidr")}
                  </Label>
                  <Textarea
                    value={ipWhitelist}
                    onChange={(e) => setIpWhitelist(e.target.value)}
                    rows={5}
                    placeholder={"192.168.1.0/24\n10.0.0.5\n2001:db8::/32"}
                    className="mt-1 font-mono text-xs"
                    disabled={!isSuperAdmin}
                  />
                  <p className="text-[10px] text-amber-700 mt-1">
                    {t("si_vous_activez_ceci_sans")}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <div className="sticky bottom-4 z-30">
              <Button onClick={savePolicy} disabled={pending} className="w-full bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-lg">
                <Save className="h-4 w-4 mr-1.5" />
                {pending ? t("enregistrement") : t("enregistrer_politique")}
              </Button>
            </div>
          )}
        </div>
      )}


      {tab === "events" && (
        <Card>
          <div className="divide-y">
            {recentEvents.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                {t("aucun_evenement_critique_recent")}
              </p>
            ) : (
              recentEvents.map((e) => {
                const sev = SEVERITY_META[e.severity] ?? SEVERITY_META.info;
                return (
                  <div key={e.id} className="flex items-start gap-4 p-4 hover:bg-muted/30">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white", sev.color)}>
                      <AlertTriangle className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge className={cn("text-[10px] text-white", sev.color)}>{t(sev.labelKey)}</Badge>
                        <code className="text-[10px] font-mono text-muted-foreground">{e.type}</code>
                        {e.admin && <span className="text-xs text-muted-foreground">· {e.admin.fullName || e.admin.email}</span>}
                      </div>
                      <p className="text-sm font-medium mt-1">{e.message}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{new Date(e.createdAt).toLocaleString(dateTag, { dateStyle: "short", timeStyle: "short" })}</span>
                        {e.ipAddress && <span className="font-mono">{e.ipAddress}</span>}
                        {e.city && <span>{e.city}, {e.country}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>
      )}


      {tab === "accounts" && (
        <Card>
          <div className="divide-y">
            {allAdmins.map((a) => {
              const isLocked = a.lockedUntil && new Date(a.lockedUntil) > new Date();
              const isMe = a.id === currentAdminId;
              return (
                <div key={a.id} className="flex items-center gap-4 p-4 hover:bg-muted/30">
                  <div className="h-9 w-9 rounded-full bg-[#0F2D52] text-white flex items-center justify-center font-semibold text-sm shrink-0">
                    {(a.fullName || a.email).charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">{a.fullName || a.email}</p>
                      {isMe && <Badge variant="secondary" className="text-[10px]">{t("vous")}</Badge>}
                      {a.customRole && (
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: a.customRole.color ?? undefined, color: a.customRole.color ?? undefined }}>
                          {a.customRole.name}
                        </Badge>
                      )}
                      {a.twoFactorEnabled ? (
                        <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">2FA</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">{t("sans_2fa")}</Badge>
                      )}
                      {isLocked && <Badge className="text-[10px] bg-red-600 hover:bg-red-600">{t("bloque")}</Badge>}
                      {a.failedLoginAttempts >= 3 && <Badge variant="outline" className="text-[10px] text-amber-700">{a.failedLoginAttempts} tentatives</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {a.email} · {a.lastLogin ? t("security_view_derniere_connexion_p0", { p0: new Date(a.lastLogin).toLocaleDateString(dateTag) }) : t("jamais_connecte")}
                      {isLocked && a.lockedUntil && t("security_view_bloque_jusqu_au_p0", { p0: new Date(a.lockedUntil).toLocaleString(dateTag, { dateStyle: "short", timeStyle: "short" }) })}
                    </p>
                  </div>
                  {isSuperAdmin && !isMe && (
                    <div className="flex gap-1">
                      {isLocked ? (
                        <Button size="sm" variant="outline" onClick={() => handleUnlock(a.id)} disabled={pending}>
                          <Unlock className="h-3.5 w-3.5 mr-1.5" />{t("security_view_debloquer")}</Button>
                      ) : (
                        <Button size="sm" variant="outline" onClick={() => setConfirmLock({ id: a.id, email: a.email })}>
                          <UserX className="h-3.5 w-3.5 mr-1.5" />Bloquer
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      <ConfirmDialog
        open={confirmForceLogout}
        onOpenChange={setConfirmForceLogout}
        title={t("deconnecter_tous_autres_admins_2")}
        description={t("tous_autres_administrateurs_seront_deconnectes")}
        confirmLabel={t("deconnecter_tout_monde")}
        variant="destructive"
        onConfirm={handleForceLogout}
      />
      <ConfirmDialog
        open={!!confirmLock}
        onOpenChange={(open) => !open && setConfirmLock(null)}
        title={`Bloquer ${confirmLock?.email} ?`}
        description={t("compte_sera_bloque_pendant_60")}
        confirmLabel={t("bloquer_60_min")}
        variant="destructive"
        onConfirm={() => confirmLock && handleLock(confirmLock.id, 60)}
      />
    </div>
  );
}

function H({ icon: Icon, title }: { icon: React.ComponentType<{ className?: string }>; title: string }) {
  return (
    <div className="flex items-center gap-2 pb-2 border-b">
      <Icon className="h-4 w-4 text-[#0F2D52]" />
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#0F2D52]">{title}</h2>
    </div>
  );
}
function F({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</Label>
      <div className="mt-1">{children}</div>
    </div>
  );
}
function Toggle({ label, checked, onChange, disabled, description }: { label: string; checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; description?: string }) {
  return (
    <div className="flex items-center justify-between rounded-lg border p-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        {description && <p className="text-[10px] text-muted-foreground">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
}

// ─── Passkeys (WebAuthn) ────────────────────────────────────
type Passkey = {
  id: number;
  deviceLabel: string | null;
  transports: string | null;
  backupEligible: boolean;
  createdAt: string;
  lastUsedAt: string | null;
};

function PasskeysSection() {
  const t = useTranslations("admin.security");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();
  const [passkeys, setPasskeys] = React.useState<Passkey[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [registering, setRegistering] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/auth/passkey/list");
      if (r.ok) {
        const data = await r.json();
        setPasskeys(data.passkeys ?? []);
      }
    } finally { setLoading(false); }
  }, []);

  React.useEffect(() => { load(); }, [load]);

  const bufToB64u = (b: ArrayBuffer) => {
    const bytes = new Uint8Array(b);
    let bin = "";
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const b64uToBuf = (s: string) => {
    const bin = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
    const buf = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
    return buf.buffer;
  };

  const register = async () => {
    if (!("credentials" in navigator)) {
      toast.error(t("navigateur_ne_supporte_pas_passkeys"));
      return;
    }
    setRegistering(true);
    try {
      const label = prompt(t("nom_de_l_appareil_prompt"));
      if (!label) { setRegistering(false); return; }

      const begin = await fetch("/api/auth/passkey/register-begin", { method: "POST" });
      if (!begin.ok) throw new Error(t("init_impossible"));
      const { publicKey } = await begin.json();

      const cred = await navigator.credentials.create({
        publicKey: {
          ...publicKey,
          challenge: b64uToBuf(publicKey.challenge),
          user: { ...publicKey.user, id: b64uToBuf(publicKey.user.id) },
          excludeCredentials: (publicKey.excludeCredentials || []).map((c: { id: string; type: "public-key" }) => ({ ...c, id: b64uToBuf(c.id) })),
        },
      }) as PublicKeyCredential | null;
      if (!cred) throw new Error(t("annule"));

      const resp = cred.response as AuthenticatorAttestationResponse;
      const finish = await fetch("/api/auth/passkey/register-finish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: cred.id,
          deviceLabel: label,
          response: {
            attestationObject: bufToB64u(resp.attestationObject),
            clientDataJSON: bufToB64u(resp.clientDataJSON),
            transports: (resp as AuthenticatorAttestationResponse & { getTransports?: () => string[] }).getTransports?.() ?? [],
          },
        }),
      });
      const data = await finish.json();
      if (!finish.ok || !data.success) throw new Error(data.error || t("echec"));
      toast.success(t("passkey_ajoutee"));
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("erreur_passkey"));
    } finally { setRegistering(false); }
  };

  const remove = async (id: number) => {
    if (!confirm(t("supprimer_passkey"))) return;
    const r = await fetch(`/api/auth/passkey/list?id=${id}`, { method: "DELETE" });
    if (r.ok) { toast.success(t("supprimee")); load(); }
    else toast.error(t("erreur"));
  };

  return (
    <Card>
      <CardContent className="p-5 space-y-4">
        <H icon={Shield} title={t("passkeys_sans_mot_passe")} />
        <p className="text-xs text-muted-foreground">{t("security_view_connectez_vous_sans_mot_de_passe_via")}</p>
        <Button onClick={register} disabled={registering} size="sm">
          <Shield className="h-3.5 w-3.5 mr-1.5" />
          {registering ? t("configuration") : t("ajouter_passkey")}
        </Button>
        {loading ? (
          <p className="text-sm text-muted-foreground">{tc("loading")}</p>
        ) : passkeys.length === 0 ? (
          <p className="text-sm text-muted-foreground italic">{t("aucune_passkey_enregistree")}</p>
        ) : (
          <div className="space-y-2">
            {passkeys.map((p) => (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-md border">
                <Shield className="h-4 w-4 text-[#0F2D52] shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{p.deviceLabel || t("appareil_sans_nom")}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Ajoutée le {new Date(p.createdAt).toLocaleDateString(dateTag)}
                    {p.lastUsedAt && t("security_view_derniere_utilisation_p0", { p0: new Date(p.lastUsedAt).toLocaleDateString(dateTag) })}
                    {p.transports && ` · ${p.transports}`}
                  </p>
                </div>
                {p.backupEligible && (
                  <Badge variant="outline" className="text-[10px]">{t("synchronisee")}</Badge>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs hover:text-destructive" onClick={() => remove(p.id)}>
                  {t("retirer")}
                </Button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

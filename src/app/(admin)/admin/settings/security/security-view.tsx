"use client";
// Vue Sécurité — politique globale + events critiques + verrouillage comptes.
import { useState, useTransition } from "react";
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

const SEVERITY_META: Record<string, { color: string; label: string }> = {
  critical: { color: "bg-red-600", label: "Critique" },
  warning: { color: "bg-amber-500", label: "Avertissement" },
  info: { color: "bg-blue-500", label: "Info" },
  success: { color: "bg-emerald-500", label: "Succès" },
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
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("policy");
  const [pending, startTransition] = useTransition();

  // Politique
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
      if (r.success) { toast.success("Politique enregistrée"); router.refresh(); }
      else toast.error(r.error || "Erreur");
    });
  };

  const handleForceLogout = () => {
    startTransition(async () => {
      const r = await forceLogoutAllAction();
      if (r.success && "data" in r) {
        toast.success(`${r.data.count} session(s) terminée(s)`);
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
      if (r.success) { toast.success("Compte bloqué"); router.refresh(); }
      else toast.error(r.error || "Erreur");
      setConfirmLock(null);
    });
  };

  const handleUnlock = (id: number) => {
    startTransition(async () => {
      const r = await unlockAdminAction({ id });
      if (r.success) { toast.success("Compte débloqué"); router.refresh(); }
      else toast.error(r.error || "Erreur");
    });
  };

  const TABS: { key: Tab; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }[] = [
    { key: "policy", label: "Politique", icon: Shield },
    { key: "events", label: "Événements", icon: AlertTriangle, count: recentEvents.length },
    { key: "accounts", label: "Comptes", icon: Lock, count: allAdmins.length },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label="Retour"><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-red-600 shrink-0">
          <Shield className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">Sécurité</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Politique globale, événements critiques et gestion des comptes
          </p>
        </div>
        {!isSuperAdmin && (
          <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">Lecture seule</Badge>
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

      {/* POLITIQUE */}
      {tab === "policy" && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-4">
              <H icon={KeyRound} title="Politique des mots de passe" />
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <F label="Longueur minimale">
                  <Input type="number" min="8" max="128" value={minPasswordLength} onChange={(e) => setMinPasswordLength(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label="Historique (nb derniers)">
                  <Input type="number" min="0" max="20" value={passwordHistorySize} onChange={(e) => setPasswordHistorySize(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label="Expiration (jours, 0=jamais)">
                  <Input type="number" min="0" max="730" value={passwordExpiryDays} onChange={(e) => setPasswordExpiryDays(e.target.value)} disabled={!isSuperAdmin} />
                </F>
              </div>
              <div className="space-y-2">
                <Toggle label="Exiger une majuscule" checked={requireUppercase} onChange={setRequireUppercase} disabled={!isSuperAdmin} />
                <Toggle label="Exiger un chiffre" checked={requireDigits} onChange={setRequireDigits} disabled={!isSuperAdmin} />
                <Toggle label="Exiger un caractère spécial" checked={requireSymbols} onChange={setRequireSymbols} disabled={!isSuperAdmin} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <H icon={Shield} title="Authentification à 2 facteurs (2FA)" />
              <div className="space-y-2">
                <Toggle label="Exiger 2FA pour tous les administrateurs" checked={require2FAForAdmins} onChange={setRequire2FAForAdmins} disabled={!isSuperAdmin} description="Les admins sans 2FA seront forcés de l'activer à la prochaine connexion" />
                <Toggle label="Exiger 2FA pour les super-administrateurs" checked={require2FAForSuperAdmins} onChange={setRequire2FAForSuperAdmins} disabled={!isSuperAdmin} description="Recommandé : toujours activer" />
              </div>
              <F label="Durée de confiance des appareils (jours)">
                <Input type="number" min="1" max="365" value={trustedDeviceDays} onChange={(e) => setTrustedDeviceDays(e.target.value)} disabled={!isSuperAdmin} />
              </F>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-4">
              <H icon={Lock} title="Sessions & verrouillage" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <F label="Durée session max (heures)">
                  <Input type="number" min="1" max="720" value={sessionMaxAgeHours} onChange={(e) => setSessionMaxAgeHours(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label="Sessions concurrentes max">
                  <Input type="number" min="1" max="50" value={maxConcurrentSessions} onChange={(e) => setMaxConcurrentSessions(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label="Tentatives échouées avant blocage">
                  <Input type="number" min="3" max="20" value={maxFailedAttempts} onChange={(e) => setMaxFailedAttempts(e.target.value)} disabled={!isSuperAdmin} />
                </F>
                <F label="Durée du blocage (minutes)">
                  <Input type="number" min="1" max="1440" value={lockoutMinutes} onChange={(e) => setLockoutMinutes(e.target.value)} disabled={!isSuperAdmin} />
                </F>
              </div>
              {isSuperAdmin && (
                <div className="rounded-md border border-red-200 bg-red-50 p-3">
                  <p className="text-sm font-semibold text-red-900 mb-2">Action immédiate</p>
                  <Button variant="destructive" size="sm" onClick={() => setConfirmForceLogout(true)}>
                    <LogOut className="h-3.5 w-3.5 mr-1.5" />
                    Déconnecter tous les autres admins
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <H icon={AlertTriangle} title="Alertes par courriel" />
              <Toggle label="Connexion depuis un nouvel appareil" checked={alertOnNewDevice} onChange={setAlertOnNewDevice} disabled={!isSuperAdmin} />
              <Toggle label="Tentative de connexion échouée" checked={alertOnFailedLogin} onChange={setAlertOnFailedLogin} disabled={!isSuperAdmin} />
              <Toggle label="Changement de mot de passe" checked={alertOnPasswordChange} onChange={setAlertOnPasswordChange} disabled={!isSuperAdmin} />
              <Toggle label="Changement de rôle" checked={alertOnRoleChange} onChange={setAlertOnRoleChange} disabled={!isSuperAdmin} />
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5 space-y-3">
              <H icon={Globe} title="Liste blanche d'adresses IP" />
              <Toggle label="Activer la liste blanche IP" checked={ipWhitelistEnabled} onChange={setIpWhitelistEnabled} disabled={!isSuperAdmin} description="Bloque toute connexion admin depuis une IP non listée" />
              {ipWhitelistEnabled && (
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    Adresses autorisées (une par ligne, IPv4 ou CIDR)
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
                    ⚠ Si vous activez ceci sans ajouter votre IP, vous perdrez l&apos;accès. Ajoutez votre IP en premier.
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {isSuperAdmin && (
            <div className="sticky bottom-4 z-30">
              <Button onClick={savePolicy} disabled={pending} className="w-full bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-lg">
                <Save className="h-4 w-4 mr-1.5" />
                {pending ? "Enregistrement..." : "Enregistrer la politique"}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ÉVÉNEMENTS */}
      {tab === "events" && (
        <Card>
          <div className="divide-y">
            {recentEvents.length === 0 ? (
              <p className="p-8 text-center text-sm text-muted-foreground">
                Aucun événement critique récent. ✓
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
                        <Badge className={cn("text-[10px] text-white", sev.color)}>{sev.label}</Badge>
                        <code className="text-[10px] font-mono text-muted-foreground">{e.type}</code>
                        {e.admin && <span className="text-xs text-muted-foreground">· {e.admin.fullName || e.admin.email}</span>}
                      </div>
                      <p className="text-sm font-medium mt-1">{e.message}</p>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{new Date(e.createdAt).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}</span>
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

      {/* COMPTES */}
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
                      {isMe && <Badge variant="secondary" className="text-[10px]">Vous</Badge>}
                      {a.customRole && (
                        <Badge variant="outline" className="text-[10px]" style={{ borderColor: a.customRole.color ?? undefined, color: a.customRole.color ?? undefined }}>
                          {a.customRole.name}
                        </Badge>
                      )}
                      {a.twoFactorEnabled ? (
                        <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">2FA</Badge>
                      ) : (
                        <Badge className="text-[10px] bg-amber-500 hover:bg-amber-500">Sans 2FA</Badge>
                      )}
                      {isLocked && <Badge className="text-[10px] bg-red-600 hover:bg-red-600">Bloqué</Badge>}
                      {a.failedLoginAttempts >= 3 && <Badge variant="outline" className="text-[10px] text-amber-700">{a.failedLoginAttempts} tentatives</Badge>}
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {a.email} · {a.lastLogin ? `Dernière connexion ${new Date(a.lastLogin).toLocaleDateString("fr-CA")}` : "Jamais connecté"}
                      {isLocked && a.lockedUntil && ` · Bloqué jusqu'au ${new Date(a.lockedUntil).toLocaleString("fr-CA", { dateStyle: "short", timeStyle: "short" })}`}
                    </p>
                  </div>
                  {isSuperAdmin && !isMe && (
                    <div className="flex gap-1">
                      {isLocked ? (
                        <Button size="sm" variant="outline" onClick={() => handleUnlock(a.id)} disabled={pending}>
                          <Unlock className="h-3.5 w-3.5 mr-1.5" />Débloquer
                        </Button>
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
        title="Déconnecter tous les autres admins ?"
        description="Tous les autres administrateurs seront déconnectés immédiatement et devront se reconnecter. Votre propre session reste active."
        confirmLabel="Déconnecter tout le monde"
        variant="destructive"
        onConfirm={handleForceLogout}
      />
      <ConfirmDialog
        open={!!confirmLock}
        onOpenChange={(open) => !open && setConfirmLock(null)}
        title={`Bloquer ${confirmLock?.email} ?`}
        description="Le compte sera bloqué pendant 60 minutes (durée par défaut). Toutes ses sessions seront fermées."
        confirmLabel="Bloquer 60 min"
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

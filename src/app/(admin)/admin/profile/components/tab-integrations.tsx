"use client";
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Plug, ExternalLink, Settings, CheckCircle2, AlertCircle, Trash2, Loader2,
  Eye, EyeOff, Database, Info, ShieldCheck, KeyRound, Mail, Lock, Copy,
} from "lucide-react";
import {
  INTEGRATION_PROVIDERS, CATEGORY_LABELS, type IntegrationProvider,
} from "@/lib/integrations/providers";
import { upsertIntegrationAction, toggleIntegrationAction, deleteIntegrationAction } from "@/app/actions/integrations";
import { BrandLogo } from "@/components/brand-logos";

type IntegrationRow = {
  id: number;
  provider: string;
  name: string;
  isEnabled: boolean;
  credentials: Record<string, string> | null;
  config: Record<string, string> | null;
  lastSyncAt: string | null;
  lastError: string | null;
  updatedAt: string;
};

export function TabIntegrations() {
  const [list, setList] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState<IntegrationProvider | null>(null);

  // Charger la liste initiale
  const reload = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/integrations", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        setList(data.integrations ?? []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { reload(); }, []);

  const findIntegration = (provider: string) => list.find((i) => i.provider === provider);

  // Filtrer par catégorie
  const grouped: Record<string, IntegrationProvider[]> = {};
  INTEGRATION_PROVIDERS.forEach((p) => {
    if (!grouped[p.category]) grouped[p.category] = [];
    grouped[p.category].push(p);
  });

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Plug className="h-4 w-4" />
            Intégrations tierces
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Connectez votre portail VNK aux services externes que vous utilisez : paiement, signature
            électronique, calendrier, communication, automatisation.
          </p>
        </CardHeader>
        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
            </div>
          ) : (
            Object.entries(grouped).map(([cat, providers]) => (
              <section key={cat}>
                <h3 className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-2">
                  {CATEGORY_LABELS[cat]}
                  <span className="flex-1 border-t" />
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {providers.map((p) => {
                    const integ = findIntegration(p.key);
                    const hasCredentials = integ && integ.credentials && Object.keys(integ.credentials).length > 0;
                    const status = !integ
                      ? "not_configured"
                      : !hasCredentials
                        ? "incomplete"
                        : integ.lastError
                          ? "error"
                          : integ.isEnabled
                            ? "connected"
                            : "paused";
                    return (
                      <div key={p.key} className="rounded-lg border p-3 hover:border-muted-foreground/30 transition flex flex-col">
                        <div className="flex items-start gap-3">
                          <div className="h-10 w-10 rounded-lg flex items-center justify-center flex-shrink-0 bg-white border" style={{ color: p.brandColor }}>
                            <BrandLogo provider={p.key} className="h-6 w-6" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold truncate">{p.name}</p>
                              <StatusBadge status={status} />
                            </div>
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{p.description}</p>
                            {integ?.lastError && (
                              <p className="text-[10px] text-red-600 mt-1 line-clamp-2"><AlertCircle className="h-2.5 w-2.5 inline mr-0.5" />{integ.lastError}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t gap-2">
                          <div className="flex items-center gap-1.5">
                            {integ && (
                              <Switch
                                checked={integ.isEnabled}
                                onCheckedChange={async (v) => {
                                  const r = await toggleIntegrationAction(p.key, v);
                                  if (r.success) {
                                    toast.success(v ? "Activée" : "Désactivée");
                                    reload();
                                  } else toast.error(r.error);
                                }}
                              />
                            )}
                            <Button variant="ghost" size="sm" asChild className="h-7 px-1.5">
                              <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" title="Documentation">
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                          <Button size="sm" variant={integ ? "outline" : "default"} onClick={() => setActiveProvider(p)} className="h-8">
                            <Settings className="h-3.5 w-3.5" />
                            {integ ? "Configurer" : "Connecter"}
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </CardContent>
      </Card>

      {activeProvider && (
        <IntegrationDialog
          provider={activeProvider}
          existing={findIntegration(activeProvider.key)}
          onClose={() => setActiveProvider(null)}
          onSaved={() => { reload(); setActiveProvider(null); }}
        />
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  if (status === "connected")  return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />Connecté</Badge>;
  if (status === "error")      return <Badge variant="destructive" className="text-[10px]"><AlertCircle className="h-2.5 w-2.5 mr-0.5" />Erreur</Badge>;
  if (status === "paused")     return <Badge className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100 text-[10px]">En pause</Badge>;
  if (status === "incomplete") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">Incomplet</Badge>;
  return <Badge variant="outline" className="text-[10px]">Non configuré</Badge>;
}

// ─────────────────────────────────────────────────────────
// Dialog de configuration générique (1 par fournisseur)
// ─────────────────────────────────────────────────────────
function IntegrationDialog({
  provider, existing, onClose, onSaved,
}: {
  provider: IntegrationProvider;
  existing: IntegrationRow | undefined;
  onClose: () => void;
  onSaved: () => void;
}) {
  const tc = useTranslations("common");
  // Pour chaque champ, on garde l'état :
  // - valeur affichée (vide si jamais configuré, "••••" si configuré et non révélé, vraie valeur si révélé/édité)
  // - "isMasked" = true si on n'a pas révélé, donc en cas de save on ignore ce champ
  const [values, setValues] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    provider.fields.forEach((f) => {
      init[f.key] = existing?.credentials?.[f.key] ?? "";
    });
    return init;
  });
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [pending, startTransition] = useTransition();
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message: string } | null>(null);

  // Dialog de révélation 2FA
  const [revealDialog, setRevealDialog] = useState(false);
  const [revealMethod, setRevealMethod] = useState<"totp" | "email" | "backup">("totp");
  const [revealCode, setRevealCode] = useState("");
  const [emailChallengeId, setEmailChallengeId] = useState<string | null>(null);
  const [emailSentTo, setEmailSentTo] = useState<string | null>(null);
  const [revealing, setRevealing] = useState(false);
  const [revealError, setRevealError] = useState<string | null>(null);

  const handleSendEmailCode = async () => {
    setRevealing(true);
    setRevealError(null);
    try {
      const res = await fetch(`/api/integrations/${provider.key}/challenge`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setEmailChallengeId(data.challengeId);
        setEmailSentTo(data.sentTo);
        toast.success("Code envoyé par courriel");
      } else {
        setRevealError(data.error ?? "Erreur");
      }
    } finally {
      setRevealing(false);
    }
  };

  const handleRevealSubmit = async () => {
    if (!revealCode.trim()) { setRevealError("Saisissez un code"); return; }
    setRevealing(true);
    setRevealError(null);
    try {
      const res = await fetch(`/api/integrations/${provider.key}/reveal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: revealMethod,
          code: revealCode.trim(),
          challengeId: revealMethod === "email" ? emailChallengeId : undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        // Remplir les champs avec les valeurs déchiffrées et marquer comme révélés
        const newValues = { ...values };
        const newRevealed = { ...revealed };
        for (const [k, v] of Object.entries(data.credentials as Record<string, string>)) {
          newValues[k] = v;
          newRevealed[k] = true;
        }
        setValues(newValues);
        setRevealed(newRevealed);
        setRevealDialog(false);
        setRevealCode("");
        setEmailChallengeId(null);
        setEmailSentTo(null);
        toast.success("Identifiants révélés. Modification en clair activée.");
      } else {
        setRevealError(data.error ?? "Code invalide");
      }
    } catch {
      setRevealError("Erreur réseau");
    } finally {
      setRevealing(false);
    }
  };

  const handleSave = () => {
    startTransition(async () => {
      const r = await upsertIntegrationAction({
        provider: provider.key,
        credentials: values,
        enable: true,
      });
      if (r.success) {
        toast.success(`${provider.name} configuré`);
        onSaved();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      // D'abord on sauvegarde puis on teste
      const save = await upsertIntegrationAction({ provider: provider.key, credentials: values, enable: existing?.isEnabled ?? false });
      if (!save.success) { toast.error(save.error); return; }
      const res = await fetch(`/api/integrations/${provider.key}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({ ok: data.ok, message: data.message ?? data.error ?? "Aucune réponse" });
    } catch {
      setTestResult({ ok: false, message: "Erreur réseau" });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = () => {
    if (!confirm(`Déconnecter ${provider.name} ? Les configurations seront supprimées.`)) return;
    startTransition(async () => {
      const r = await deleteIntegrationAction(provider.key);
      if (r.success) {
        toast.success("Déconnecté");
        onSaved();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header navy VNK + logo officiel du fournisseur */}
        <div className="vnk-gradient text-white p-5">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-white shadow-sm" style={{ color: provider.brandColor }}>
              <BrandLogo provider={provider.key} className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white">{provider.name}</DialogTitle>
              <DialogDescription className="text-white/85 text-sm mt-1">
                {provider.description}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">
          {/* ─── Mode OAuth (Microsoft / Google) ─── */}
          {provider.oauthFlow ? (
            <OAuthPanel provider={provider} existing={existing} onChanged={onSaved} />
          ) : (
          <>
          {/* Info : chiffrement + révélation */}
          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex gap-2">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-semibold">Vos identifiants sont sécurisés</p>
              <p>
                Pour afficher ou modifier les informations déjà enregistrées, vous devrez valider votre identité
                (code de votre application 2FA ou code reçu par courriel).
              </p>
              {existing && (
                <button
                  type="button"
                  onClick={() => { setRevealDialog(true); setRevealError(null); }}
                  className="mt-1 inline-flex items-center gap-1 underline font-semibold hover:no-underline"
                >
                  <Eye className="h-3 w-3" />
                  Afficher ou modifier les identifiants
                </button>
              )}
            </div>
          </div>

          {provider.fields.map((f) => {
            // Champ déjà configuré ET non révélé = lecture seule + masqué
            const isExistingMasked = existing && values[f.key] && !revealed[f.key] && /^•+$/.test(values[f.key]);

            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`f-${f.key}`} className="text-xs flex items-center gap-1.5">
                  {f.label} {f.required && <span className="text-red-500">*</span>}
                  {f.type === "secret" && isExistingMasked && (
                    <span className="text-[9px] uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" /> Chiffré
                    </span>
                  )}
                  {f.type === "secret" && revealed[f.key] && (
                    <span className="text-[9px] uppercase tracking-wider bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <Eye className="h-2.5 w-2.5" /> Visible
                    </span>
                  )}
                </Label>
                {f.type === "select" && f.options ? (
                  <Select value={values[f.key] ?? ""} onValueChange={(v) => setValues({ ...values, [f.key]: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                ) : f.type === "secret" ? (
                  <div className="relative">
                    <Input
                      id={`f-${f.key}`}
                      type={revealed[f.key] ? "text" : "password"}
                      value={values[f.key] ?? ""}
                      onChange={(e) => { if (!isExistingMasked) setValues({ ...values, [f.key]: e.target.value }); }}
                      readOnly={!!isExistingMasked}
                      placeholder={isExistingMasked ? "Déjà configuré — cliquez sur Afficher pour modifier" : f.placeholder}
                      className={`pr-10 h-9 font-mono text-xs ${isExistingMasked ? "bg-muted cursor-not-allowed" : ""}`}
                      autoComplete="off"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (isExistingMasked) { setRevealDialog(true); setRevealError(null); }
                        else setRevealed({ ...revealed, [f.key]: !revealed[f.key] });
                      }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                      title={isExistingMasked ? "Authentifiez-vous pour afficher" : "Afficher/masquer"}
                    >
                      {revealed[f.key] ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                ) : (
                  <Input
                    id={`f-${f.key}`}
                    type={f.type === "email" ? "email" : f.type === "url" ? "url" : "text"}
                    value={values[f.key] ?? ""}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                    placeholder={f.placeholder}
                    className="h-9"
                  />
                )}
                {f.helper && <p className="text-[10px] text-muted-foreground">{f.helper}</p>}
              </div>
            );
          })}

          {testResult && (
            <div className={`rounded-md p-3 text-xs flex gap-2 ${testResult.ok ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-red-50 text-red-800 border border-red-200"}`}>
              {testResult.ok ? <CheckCircle2 className="h-4 w-4 flex-shrink-0" /> : <AlertCircle className="h-4 w-4 flex-shrink-0" />}
              <span>{testResult.message}</span>
            </div>
          )}
          </>
          )}
        </div>

        {!provider.oauthFlow && (
          <DialogFooter className="px-5 pb-5 flex-row justify-between sm:justify-between gap-2">
            <div>
              {existing && (
                <Button variant="ghost" size="sm" onClick={handleDelete} disabled={pending} className="text-destructive hover:bg-destructive/10">
                  <Trash2 className="h-3.5 w-3.5" />
                  Déconnecter
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {provider.testable && (
                <Button variant="outline" onClick={handleTest} disabled={testing || pending}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Tester"}
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </DialogFooter>
        )}

        {provider.oauthFlow && (
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
          </DialogFooter>
        )}
      </DialogContent>

      {/* ───────────────────── Dialog Reveal 2FA ───────────────────── */}
      <Dialog open={revealDialog} onOpenChange={(o) => !o && setRevealDialog(false)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              Authentification renforcée requise
            </DialogTitle>
            <DialogDescription className="text-white/85 text-sm mt-1">
              Pour afficher ou modifier les identifiants chiffrés, validez votre identité.
            </DialogDescription>
          </div>

          <div className="p-5 space-y-4">
            {/* Onglets méthode */}
            <div className="grid grid-cols-3 gap-1.5">
              {([
                { v: "totp", icon: KeyRound, label: "App 2FA" },
                { v: "email", icon: Mail, label: "Courriel" },
                { v: "backup", icon: KeyRound, label: "Récup." },
              ] as const).map(({ v, icon: Icon, label }) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => { setRevealMethod(v); setRevealCode(""); setRevealError(null); setEmailChallengeId(null); }}
                  className={`flex flex-col items-center gap-1 rounded-md border-2 p-2.5 transition ${revealMethod === v ? "border-[#0F2D52] bg-[#0F2D52]/5" : "border-input hover:border-muted-foreground/50"}`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="text-[11px] font-medium">{label}</span>
                </button>
              ))}
            </div>

            {revealMethod === "totp" && (
              <div className="space-y-2">
                <Label className="text-xs">Code à 6 chiffres de votre application 2FA</Label>
                <Input
                  value={revealCode}
                  onChange={(e) => setRevealCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-lg font-mono tracking-widest"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground">Google Authenticator, Authy, 1Password, etc.</p>
              </div>
            )}

            {revealMethod === "email" && (
              <div className="space-y-3">
                {!emailChallengeId ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      Un code à 6 chiffres sera envoyé à votre adresse courriel. Valide 10 minutes.
                    </p>
                    <Button onClick={handleSendEmailCode} disabled={revealing} size="sm">
                      <Mail className="h-3.5 w-3.5" />
                      {revealing ? "Envoi…" : "Envoyer le code par courriel"}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">
                      Code envoyé à <strong>{emailSentTo}</strong>. Vérifiez votre boîte de réception.
                    </p>
                    <Label className="text-xs">Code reçu par courriel</Label>
                    <Input
                      value={revealCode}
                      onChange={(e) => setRevealCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      placeholder="000000"
                      className="text-center text-lg font-mono tracking-widest"
                      maxLength={6}
                      autoFocus
                    />
                    <button
                      onClick={handleSendEmailCode}
                      className="text-[10px] underline text-muted-foreground hover:text-foreground"
                    >
                      Renvoyer un nouveau code
                    </button>
                  </>
                )}
              </div>
            )}

            {revealMethod === "backup" && (
              <div className="space-y-2">
                <Label className="text-xs">Code de récupération à usage unique</Label>
                <Input
                  value={revealCode}
                  onChange={(e) => setRevealCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 9))}
                  placeholder="xxxx-xxxx"
                  className="text-center text-base font-mono tracking-wider"
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground">Format xxxx-xxxx — le code sera consommé.</p>
              </div>
            )}

            {revealError && (
              <div className="rounded-md bg-red-50 border border-red-200 p-2.5 text-xs text-red-700 flex gap-2">
                <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
                <span>{revealError}</span>
              </div>
            )}
          </div>

          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setRevealDialog(false)}>{tc("cancel")}</Button>
            <Button
              onClick={handleRevealSubmit}
              disabled={revealing || !revealCode.trim() || (revealMethod === "email" && !emailChallengeId)}
            >
              {revealing ? "Validation…" : "Valider et afficher"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────
// Panneau OAuth (Microsoft / Google) — bouton « Se connecter »
// au lieu de saisir des clés à la main. L'admin est redirigé
// vers le fournisseur pour autoriser, puis revient ici.
// ─────────────────────────────────────────────────────────
function OAuthPanel({
  provider,
  existing,
  onChanged,
}: {
  provider: IntegrationProvider;
  existing: IntegrationRow | undefined;
  onChanged: () => void;
}) {
  const [status, setStatus] = useState<{
    connected: boolean;
    accountEmail: string | null;
    expiresAt: string | null;
    configured: boolean;
    redirectUri?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);

  // Formulaire de configuration de l'app OAuth (client_id/secret/tenant)
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [tenantId, setTenantId] = useState("common");
  const [savingConfig, startSaveConfig] = useTransition();
  const [redirectCopied, setRedirectCopied] = useState(false);
  const [secretVisible, setSecretVisible] = useState(false);

  const statusUrl = `/api/oauth/${provider.oauthFlow}/status`;
  const startUrl = `/api/oauth/${provider.oauthFlow}/start`;

  const loadStatus = async () => {
    setLoading(true);
    try {
      const res = await fetch(statusUrl, { cache: "no-store" });
      if (res.ok) setStatus(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadStatus(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const handleConnect = () => {
    window.location.href = startUrl;
  };

  const handleDisconnect = async () => {
    if (!confirm(`Déconnecter votre compte ${provider.name} ? Les rendez-vous ne seront plus synchronisés.`)) return;
    setDisconnecting(true);
    try {
      const res = await fetch(statusUrl, { method: "DELETE" });
      if (res.ok) {
        toast.success("Déconnecté");
        await loadStatus();
        onChanged();
      } else {
        toast.error("Erreur");
      }
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveAppConfig = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error("Identifiant et secret obligatoires");
      return;
    }
    startSaveConfig(async () => {
      const creds: Record<string, string> = {
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
      };
      if (provider.oauthFlow === "microsoft") {
        creds.tenant_id = tenantId.trim() || "common";
      }
      const r = await upsertIntegrationAction({
        provider: provider.key,
        credentials: creds,
        enable: false, // pas encore connecté côté compte
      });
      if (r.success) {
        toast.success("Configuration enregistrée. Vous pouvez maintenant vous connecter.");
        setClientId(""); setClientSecret(""); setTenantId("common");
        await loadStatus();
        onChanged();
      } else {
        toast.error(r.error);
      }
    });
  };

  const handleCopyRedirect = async () => {
    if (!status?.redirectUri) return;
    try {
      await navigator.clipboard.writeText(status.redirectUri);
      setRedirectCopied(true);
      setTimeout(() => setRedirectCopied(false), 2000);
    } catch {
      toast.error("Impossible de copier");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  // App pas configurée — afficher le formulaire de setup OAuth
  if (!status?.configured) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-2">
          <p className="font-semibold">Étape 1 — Créez votre application OAuth</p>
          {provider.oauthFlow === "microsoft" ? (
            <ol className="text-xs space-y-1 list-decimal list-inside">
              <li>Allez sur <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">portal.azure.com</a> &rarr; Microsoft Entra ID &rarr; App registrations &rarr; Nouvelle inscription</li>
              <li>Donnez-lui un nom (ex : « VNK Portal »)</li>
              <li>Type de comptes pris en charge : choisissez ce qui correspond à votre organisation</li>
              <li>URI de redirection (type « Web ») : copiez l&apos;URL ci-dessous</li>
              <li>Une fois créée : ouvrez « Certificates &amp; secrets » &rarr; « Nouveau secret client » &rarr; copiez la <strong>Valeur</strong> (pas l&apos;ID)</li>
              <li>Onglet « Permissions API » &rarr; ajoutez les permissions <strong>Calendars.ReadWrite</strong>, <strong>OnlineMeetings.ReadWrite</strong>, <strong>User.Read</strong>, <strong>offline_access</strong></li>
            </ol>
          ) : (
            <ol className="text-xs space-y-1 list-decimal list-inside">
              <li>Allez sur <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">console.cloud.google.com</a> &rarr; APIs &amp; Services &rarr; Credentials</li>
              <li>Cliquez « Create credentials » &rarr; « OAuth client ID » &rarr; Type : Web application</li>
              <li>« Authorized redirect URIs » : ajoutez l&apos;URL ci-dessous</li>
              <li>Une fois créé : notez l&apos;identifiant et le secret</li>
              <li>Activez l&apos;API <strong>Google Calendar API</strong> dans la section « APIs &amp; Services » &rarr; « Library »</li>
            </ol>
          )}
        </div>

        {/* URL de redirection à copier-coller */}
        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <Label className="text-xs font-semibold">URL de redirection à coller</Label>
          <div className="flex gap-2">
            <Input
              value={status?.redirectUri ?? ""}
              readOnly
              className="font-mono text-xs h-9 bg-background"
            />
            <Button variant="outline" size="sm" onClick={handleCopyRedirect} className="h-9 flex-shrink-0">
              {redirectCopied ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground">
            Collez exactement cette URL dans l&apos;URI de redirection de votre application {provider.name}.
          </p>
        </div>

        {/* Formulaire de saisie des credentials */}
        <div className="space-y-3">
          <p className="text-sm font-semibold">Étape 2 — Collez les identifiants ici</p>
          <div className="space-y-1.5">
            <Label className="text-xs">Identifiant client (Client ID)</Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={provider.oauthFlow === "microsoft" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" : "xxxxxxxx.apps.googleusercontent.com"}
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Secret client</Label>
            <div className="relative">
              <Input
                type={secretVisible ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={provider.oauthFlow === "microsoft" ? "Valeur du secret (pas l'ID)" : "GOCSPX-…"}
                className="h-9 font-mono text-xs pr-10"
              />
              <button type="button" onClick={() => setSecretVisible(!secretVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {secretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {provider.oauthFlow === "microsoft" && (
            <div className="space-y-1.5">
              <Label className="text-xs">Identifiant de répertoire (Tenant ID)</Label>
              <Input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="common"
                className="h-9 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">Laissez <code>common</code> pour accepter tous les comptes Microsoft personnels et professionnels.</p>
            </div>
          )}
          <Button onClick={handleSaveAppConfig} disabled={savingConfig || !clientId.trim() || !clientSecret.trim()} className="w-full">
            {savingConfig ? "Enregistrement…" : "Enregistrer la configuration"}
          </Button>
        </div>
      </div>
    );
  }

  // Connecté
  if (status?.connected) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-900 text-sm">Compte connecté</p>
            <p className="text-xs text-emerald-700 mt-0.5 break-all">{status.accountEmail ?? "Authentifié"}</p>
            {status.expiresAt && (
              <p className="text-[10px] text-emerald-600 mt-1">
                Jeton valide jusqu&apos;au {new Date(status.expiresAt).toLocaleString("fr-CA", { dateStyle: "medium", timeStyle: "short" })} — renouvellement automatique
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5"><Info className="h-3 w-3" /> Ce qui est synchronisé</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            {provider.oauthFlow === "microsoft" ? (
              <>
                <li>Création automatique de réunions Teams lors des rendez-vous (type vidéo)</li>
                <li>Évènements ajoutés à votre calendrier Outlook</li>
                <li>Annulation automatique du Teams meeting quand un RDV est annulé/supprimé</li>
                <li>Renouvellement automatique du jeton d&apos;accès via refresh token</li>
              </>
            ) : (
              <>
                <li>Création automatique de liens Google Meet lors des rendez-vous</li>
                <li>Évènements ajoutés à votre Google Calendar</li>
                <li>Annulation automatique du meeting Google Meet</li>
                <li>Renouvellement automatique du jeton d&apos;accès</li>
              </>
            )}
          </ul>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleConnect}>
            Reconnecter
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
            {disconnecting ? "Déconnexion…" : "Déconnecter"}
          </Button>
        </div>

        {existing?.lastError && (
          <div className="rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700 flex gap-2">
            <AlertCircle className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" />
            <span>{existing.lastError}</span>
          </div>
        )}
      </div>
    );
  }

  // Non connecté
  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-semibold">Autorisation requise</p>
        <p className="text-xs text-muted-foreground">
          Cliquez sur le bouton ci-dessous pour vous connecter à votre compte {provider.name}.
          Vous serez redirigé vers le fournisseur pour autoriser l&apos;accès au calendrier et aux réunions.
        </p>
      </div>
      <Button onClick={handleConnect} className="w-full" style={{ backgroundColor: provider.brandColor }}>
        <BrandLogo provider={provider.key} className="h-4 w-4 mr-2" />
        Se connecter à {provider.name}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        Permissions demandées : lecture/écriture du calendrier, création de réunions en ligne, accès profil.
      </p>
    </div>
  );
}

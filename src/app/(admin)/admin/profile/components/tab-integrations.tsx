"use client";
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
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
  const t = useTranslations("admin.profile");
  const [list, setList] = useState<IntegrationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProvider, setActiveProvider] = useState<IntegrationProvider | null>(null);


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
            {t("integrations_tierces")}
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">{t("tab_integrations_connectez_votre_portail_vnk_aux_services_externes")}</p>
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
                            <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">{t(p.descriptionKey)}</p>
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
                                    toast.success(v ? t("activee") : t("desactivee"));
                                    reload();
                                  } else toast.error(r.error);
                                }}
                              />
                            )}
                            <Button variant="ghost" size="sm" asChild className="h-7 px-1.5">
                              <a href={p.docsUrl} target="_blank" rel="noopener noreferrer" title={t("documentation")}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </a>
                            </Button>
                          </div>
                          <Button size="sm" variant={integ ? "outline" : "default"} onClick={() => setActiveProvider(p)} className="h-8">
                            <Settings className="h-3.5 w-3.5" />
                            {integ ? t("configurer") : t("connecter")}
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
  const t = useTranslations("admin.profile");
  if (status === "connected")  return <Badge className="bg-emerald-100 text-emerald-700 hover:bg-emerald-100 text-[10px]"><CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{t("connecte")}</Badge>;
  if (status === "error")      return <Badge variant="destructive" className="text-[10px]"><AlertCircle className="h-2.5 w-2.5 mr-0.5" />{t("erreur")}</Badge>;
  if (status === "paused")     return <Badge className="bg-zinc-100 text-zinc-700 hover:bg-zinc-100 text-[10px]">{t("pause")}</Badge>;
  if (status === "incomplete") return <Badge className="bg-amber-100 text-amber-700 hover:bg-amber-100 text-[10px]">{t("incomplet")}</Badge>;
  return <Badge variant="outline" className="text-[10px]">{t("non_configure")}</Badge>;
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
  const t = useTranslations("admin.profile");
  const tc = useTranslations("common");



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
        toast.success(t("code_envoye_courriel"));
      } else {
        setRevealError(data.error ?? t("erreur"));
      }
    } finally {
      setRevealing(false);
    }
  };

  const handleRevealSubmit = async () => {
    if (!revealCode.trim()) { setRevealError(t("saisissez_code")); return; }
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
        toast.success(t("identifiants_reveles_modification_clair_activee"));
      } else {
        setRevealError(data.error ?? t("code_invalide"));
      }
    } catch {
      setRevealError(t("erreur_reseau"));
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
        toast.success(t("tab_integrations_p0_configure", { p0: provider.name }));
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

      const save = await upsertIntegrationAction({ provider: provider.key, credentials: values, enable: existing?.isEnabled ?? false });
      if (!save.success) { toast.error(save.errorField ? t("champ_obligatoire_manquant", { field: t(save.errorField) }) : save.error); return; }
      const res = await fetch(`/api/integrations/${provider.key}/test`, { method: "POST" });
      const data = await res.json();
      setTestResult({ ok: data.ok, message: data.message ?? data.error ?? t("aucune_reponse") });
    } catch {
      setTestResult({ ok: false, message: t("erreur_reseau") });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = () => {
    if (!confirm(t("tab_integrations_deconnecter_p0_les_configurations_seront_supprimees", { p0: provider.name }))) return;
    startTransition(async () => {
      const r = await deleteIntegrationAction(provider.key);
      if (r.success) {
        toast.success(t("deconnecte"));
        onSaved();
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden max-h-[90vh] overflow-y-auto">

        <div className="vnk-gradient text-white p-5">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg flex items-center justify-center flex-shrink-0 bg-white shadow-sm" style={{ color: provider.brandColor }}>
              <BrandLogo provider={provider.key} className="h-7 w-7" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-white">{provider.name}</DialogTitle>
              <DialogDescription className="text-white/85 text-sm mt-1">
                {t(provider.descriptionKey)}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-3">

          {provider.oauthFlow ? (
            <OAuthPanel provider={provider} existing={existing} onChanged={onSaved} />
          ) : (
          <>

          <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-900 flex gap-2">
            <ShieldCheck className="h-4 w-4 flex-shrink-0 mt-0.5" />
            <div className="space-y-1 flex-1">
              <p className="font-semibold">{t("identifiants_securises")}</p>
              <p>{t("tab_integrations_pour_afficher_ou_modifier_les_informations_deja")}</p>
              {existing && (
                <button
                  type="button"
                  onClick={() => { setRevealDialog(true); setRevealError(null); }}
                  className="mt-1 inline-flex items-center gap-1 underline font-semibold hover:no-underline"
                >
                  <Eye className="h-3 w-3" />
                  {t("afficher_modifier_identifiants")}
                </button>
              )}
            </div>
          </div>

          {provider.fields.map((f) => {

            const isExistingMasked = existing && values[f.key] && !revealed[f.key] && /^•+$/.test(values[f.key]);

            return (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={`f-${f.key}`} className="text-xs flex items-center gap-1.5">
                  {t(f.labelKey)} {f.required && <span className="text-red-500">*</span>}
                  {f.type === "secret" && isExistingMasked && (
                    <span className="text-[9px] uppercase tracking-wider bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold flex items-center gap-1">
                      <Lock className="h-2.5 w-2.5" />{t("tab_integrations_chiffre")}</span>
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
                      {f.options.map((o) => <SelectItem key={o.value} value={o.value}>{t(o.labelKey)}</SelectItem>)}
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
                      placeholder={isExistingMasked ? t("deja_configure_cliquez_afficher_modifier") : f.placeholder}
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
                      title={isExistingMasked ? t("authentifiez_vous_afficher") : "Afficher/masquer"}
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
                {f.helperKey && <p className="text-[10px] text-muted-foreground">{t(f.helperKey)}</p>}
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
                  {t("deconnecter")}
                </Button>
              )}
            </div>
            <div className="flex gap-2">
              {provider.testable && (
                <Button variant="outline" onClick={handleTest} disabled={testing || pending}>
                  {testing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("tester")}
                </Button>
              )}
              <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
              <Button onClick={handleSave} disabled={pending}>
                {pending ? t("enregistrement") : t("enregistrer")}
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


      <Dialog open={revealDialog} onOpenChange={(o) => !o && setRevealDialog(false)}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white flex items-center gap-2">
              <ShieldCheck className="h-5 w-5" />
              {t("authentification_renforcee_requise")}
            </DialogTitle>
            <DialogDescription className="text-white/85 text-sm mt-1">
              {t("afficher_modifier_identifiants_chiffres_validez")}
            </DialogDescription>
          </div>

          <div className="p-5 space-y-4">

            <div className="grid grid-cols-3 gap-1.5">
              {([
                { v: "totp", icon: KeyRound, label: t("app_2fa") },
                { v: "email", icon: Mail, label: t("courriel") },
                { v: "backup", icon: KeyRound, label: t("recup") },
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
                <Label className="text-xs">{t("code_6_chiffres_application_2fa")}</Label>
                <Input
                  value={revealCode}
                  onChange={(e) => setRevealCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                  placeholder="000000"
                  className="text-center text-lg font-mono tracking-widest"
                  maxLength={6}
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground">{t("google_authenticator_authy_1password_etc")}</p>
              </div>
            )}

            {revealMethod === "email" && (
              <div className="space-y-3">
                {!emailChallengeId ? (
                  <>
                    <p className="text-sm text-muted-foreground">
                      {t("code_6_chiffres_sera_envoye")}
                    </p>
                    <Button onClick={handleSendEmailCode} disabled={revealing} size="sm">
                      <Mail className="h-3.5 w-3.5" />
                      {revealing ? t("envoi") : t("envoyer_code_courriel")}
                    </Button>
                  </>
                ) : (
                  <>
                    <p className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md p-2">{t("tab_integrations_code_envoye_a")}<strong>{emailSentTo}</strong>{t("tab_integrations_verifiez_votre_boite_de_reception")}</p>
                    <Label className="text-xs">{t("code_recu_courriel")}</Label>
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
                      {t("renvoyer_nouveau_code")}
                    </button>
                  </>
                )}
              </div>
            )}

            {revealMethod === "backup" && (
              <div className="space-y-2">
                <Label className="text-xs">{t("code_recuperation_usage_unique")}</Label>
                <Input
                  value={revealCode}
                  onChange={(e) => setRevealCode(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 9))}
                  placeholder="xxxx-xxxx"
                  className="text-center text-base font-mono tracking-wider"
                  autoFocus
                />
                <p className="text-[10px] text-muted-foreground">{t("format_xxxx_xxxx_code_sera")}</p>
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
              {revealing ? t("validation") : t("valider_afficher")}
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
  const t = useTranslations("admin.profile");
  const dateTag = useDateLocale();
  const [status, setStatus] = useState<{
    connected: boolean;
    accountEmail: string | null;
    expiresAt: string | null;
    configured: boolean;
    redirectUri?: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [disconnecting, setDisconnecting] = useState(false);


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
    if (!confirm(t("tab_integrations_deconnecter_votre_compte_p0_les_rendez_vous_ne", { p0: provider.name }))) return;
    setDisconnecting(true);
    try {
      const res = await fetch(statusUrl, { method: "DELETE" });
      if (res.ok) {
        toast.success(t("deconnecte"));
        await loadStatus();
        onChanged();
      } else {
        toast.error(t("erreur"));
      }
    } finally {
      setDisconnecting(false);
    }
  };

  const handleSaveAppConfig = () => {
    if (!clientId.trim() || !clientSecret.trim()) {
      toast.error(t("identifiant_secret_obligatoires"));
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
        toast.success(t("configuration_enregistree_vous_pouvez_maintenant"));
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
      toast.error(t("impossible_copier"));
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }


  if (!status?.configured) {
    return (
      <div className="space-y-4">
        <div className="rounded-md border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900 space-y-2">
          <p className="font-semibold">{t("etape_1_creez_application_oauth")}</p>
          {provider.oauthFlow === "microsoft" ? (
            <ol className="text-xs space-y-1 list-decimal list-inside">
              <li>{t("allez")} <a href="https://portal.azure.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">portal.azure.com</a> {t("rarr_microsoft_entra_id_rarr")}</li>
              <li>{t("donnez_lui_nom_ex_vnk")}</li>
              <li>{t("type_comptes_pris_charge_choisissez")}</li>
              <li>{t("uri_redirection_type_web_copiez")}</li>
              <li>{t("fois_creee_ouvrez_certificates_amp")} <strong>{t("valeur")}</strong> {t("pas_apos_id")}</li>
              <li>{t("onglet_permissions_api_rarr_ajoutez")} <strong>Calendars.ReadWrite</strong>, <strong>OnlineMeetings.ReadWrite</strong>, <strong>User.Read</strong>, <strong>offline_access</strong></li>
            </ol>
          ) : (
            <ol className="text-xs space-y-1 list-decimal list-inside">
              <li>{t("allez")} <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline font-medium">console.cloud.google.com</a> {t("rarr_apis_amp_services_rarr")}</li>
              <li>{t("cliquez_create_credentials_rarr_oauth")}</li>
              <li>{t("authorized_redirect_uris_ajoutez_apos")}</li>
              <li>{t("fois_cree_notez_apos_identifiant")}</li>
              <li>{t("activez_apos_api")} <strong>{t("google_calendar_api")}</strong> {t("section_apis_amp_services_rarr")}</li>
            </ol>
          )}
        </div>


        <div className="rounded-md border bg-muted/30 p-3 space-y-2">
          <Label className="text-xs font-semibold">{t("url_redirection_coller")}</Label>
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


        <div className="space-y-3">
          <p className="text-sm font-semibold">{t("etape_2_collez_identifiants_ici")}</p>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("identifiant_client_client_id")}</Label>
            <Input
              value={clientId}
              onChange={(e) => setClientId(e.target.value)}
              placeholder={provider.oauthFlow === "microsoft" ? "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" : "xxxxxxxx.apps.googleusercontent.com"}
              className="h-9 font-mono text-xs"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("secret_client")}</Label>
            <div className="relative">
              <Input
                type={secretVisible ? "text" : "password"}
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder={provider.oauthFlow === "microsoft" ? t("valeur_secret_pas_id") : t("gocspx")}
                className="h-9 font-mono text-xs pr-10"
              />
              <button type="button" onClick={() => setSecretVisible(!secretVisible)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {secretVisible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
          </div>
          {provider.oauthFlow === "microsoft" && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("identifiant_repertoire_tenant_id")}</Label>
              <Input
                value={tenantId}
                onChange={(e) => setTenantId(e.target.value)}
                placeholder="common"
                className="h-9 font-mono text-xs"
              />
              <p className="text-[10px] text-muted-foreground">{t("laissez")} <code>common</code> {t("accepter_tous_comptes_microsoft_personnels")}</p>
            </div>
          )}
          <Button onClick={handleSaveAppConfig} disabled={savingConfig || !clientId.trim() || !clientSecret.trim()} className="w-full">
            {savingConfig ? t("enregistrement") : t("enregistrer_configuration")}
          </Button>
        </div>
      </div>
    );
  }


  if (status?.connected) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-emerald-200 bg-emerald-50 p-4 flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-emerald-900 text-sm">{t("compte_connecte")}</p>
            <p className="text-xs text-emerald-700 mt-0.5 break-all">{status.accountEmail ?? t("authentifie")}</p>
            {status.expiresAt && (
              <p className="text-[10px] text-emerald-600 mt-1">
                Jeton valide jusqu&apos;au {new Date(status.expiresAt).toLocaleString(dateTag, { dateStyle: "medium", timeStyle: "short" })} — renouvellement automatique
              </p>
            )}
          </div>
        </div>

        <div className="rounded-md border bg-muted/30 p-3 text-xs space-y-1.5">
          <p className="font-semibold flex items-center gap-1.5"><Info className="h-3 w-3" /> {t("synchronise")}</p>
          <ul className="list-disc list-inside text-muted-foreground space-y-0.5">
            {provider.oauthFlow === "microsoft" ? (
              <>
                <li>{t("creation_automatique_reunions_teams_lors")}</li>
                <li>{t("evenements_ajoutes_calendrier_outlook")}</li>
                <li>{t("annulation_automatique_teams_meeting_quand")}</li>
                <li>{t("renouvellement_automatique_jeton_apos_acces")}</li>
              </>
            ) : (
              <>
                <li>{t("creation_automatique_liens_google_meet")}</li>
                <li>{t("evenements_ajoutes_google_calendar")}</li>
                <li>{t("annulation_automatique_meeting_google_meet")}</li>
                <li>{t("renouvellement_automatique_jeton_apos_acces_2")}</li>
              </>
            )}
          </ul>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="outline" size="sm" onClick={handleConnect}>
            {t("reconnecter")}
          </Button>
          <Button variant="ghost" size="sm" onClick={handleDisconnect} disabled={disconnecting} className="text-destructive hover:bg-destructive/10">
            <Trash2 className="h-3.5 w-3.5" />
            {disconnecting ? t("deconnexion") : t("deconnecter")}
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


  return (
    <div className="space-y-3">
      <div className="rounded-md border bg-muted/30 p-4 text-sm space-y-2">
        <p className="font-semibold">{t("autorisation_requise")}</p>
        <p className="text-xs text-muted-foreground">
          Cliquez sur le bouton ci-dessous pour vous connecter à votre compte {provider.name}.
          {t("redirige_vers_fournisseur")}
        </p>
      </div>
      <Button onClick={handleConnect} className="w-full" style={{ backgroundColor: provider.brandColor }}>
        <BrandLogo provider={provider.key} className="h-4 w-4 mr-2" />
        Se connecter à {provider.name}
      </Button>
      <p className="text-[10px] text-muted-foreground text-center">
        {t("permissions_demandees_lecture_ecriture_calendrier")}
      </p>
    </div>
  );
}

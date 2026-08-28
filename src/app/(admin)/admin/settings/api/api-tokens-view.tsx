"use client";
// Vue API Tokens — création + révocation + scopes cochables.
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Key, ChevronLeft, Plus, Trash2, Copy, AlertTriangle,
  Ban, Code, ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  createApiTokenAction, revokeApiTokenAction, deleteApiTokenAction, SCOPES,
} from "@/app/actions/api-tokens";

type TokenRow = {
  id: number; name: string; prefix: string;
  scopes: string[];
  lastUsedAt: string | null; lastUsedIp: string | null;
  expiresAt: string | null; revokedAt: string | null;
  createdAt: string;
};

const SCOPE_GROUPS = [
  { label: "Clients", scopes: ["read:clients", "write:clients"] },
  { label: "Devis & Factures", scopes: ["read:quotes", "write:quotes", "read:invoices", "write:invoices"] },
  { label: "Contrats & Mandats", scopes: ["read:contracts", "write:contracts", "read:mandates", "write:mandates"] },
  { label: "Paiements", scopes: ["read:payments", "write:payments"] },
  { label: "Documents", scopes: ["read:documents", "write:documents"] },
  { label: "Catalogues", scopes: ["read:catalogs", "write:catalogs"] },
  { label: "Rapports", scopes: ["read:reports"] },
];

export function ApiTokensView({ tokens }: { tokens: TokenRow[] }) {
  const t = useTranslations("admin.api_tokens");
  const tc = useTranslations("common");
  const router = useRouter();
  const dateTag = useDateLocale();
  const [pending, startTransition] = useTransition();
  const [creating, setCreating] = useState(false);


  const [name, setName] = useState("");
  const [selectedScopes, setSelectedScopes] = useState<Set<string>>(new Set());
  const [expiresInDays, setExpiresInDays] = useState<string>("90");
  const [createdToken, setCreatedToken] = useState<string | null>(null);

  const [confirmRevoke, setConfirmRevoke] = useState<{ id: number; name: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: number; name: string } | null>(null);

  const toggleScope = (s: string) => {
    setSelectedScopes((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });
  };

  const handleCreate = () => {
    startTransition(async () => {
      const r = await createApiTokenAction({
        name,
        scopes: Array.from(selectedScopes),
        expiresInDays: expiresInDays === "never" ? undefined : Number(expiresInDays),
      });
      if (r.success) {
        setCreatedToken(r.data.token);
        toast.success(t("token_cree"));
        router.refresh();
      } else {
        toast.error(r.error);
      }
    });
  };

  const closeCreate = () => {
    setCreating(false);
    setCreatedToken(null);
    setName("");
    setSelectedScopes(new Set());
    setExpiresInDays("90");
  };

  const copyToken = (token: string) => {
    navigator.clipboard.writeText(token);
    toast.success(t("token_copie"));
  };

  const handleRevoke = (id: number) => {
    startTransition(async () => {
      const r = await revokeApiTokenAction({ id });
      if (r.success) { toast.success(t("token_revoque")); router.refresh(); }
      else toast.error(r.error || t("erreur"));
      setConfirmRevoke(null);
    });
  };
  const handleDelete = (id: number) => {
    startTransition(async () => {
      const r = await deleteApiTokenAction({ id });
      if (r.success) { toast.success(t("token_supprime")); router.refresh(); }
      else toast.error(r.error || t("erreur"));
      setConfirmDelete(null);
    });
  };

  const active = tokens.filter((t) => !t.revokedAt && (!t.expiresAt || new Date(t.expiresAt) > new Date()));

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-purple-600 shrink-0">
          <Key className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("tokens_apos_api_personnels")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {active.length} actif{active.length > 1 ? "s" : ""} sur {tokens.length} · pour automatiser ou intégrer le portail
          </p>
        </div>
        <Button onClick={() => setCreating(true)} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
          <Plus className="h-4 w-4 mr-1.5" />{t("nouveau_token")}
        </Button>
      </div>


      <Card className="border-blue-200 bg-blue-50">
        <CardContent className="p-4 flex items-start gap-3">
          <Code className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
          <div className="text-xs">
            <p className="font-semibold text-blue-900 mb-1">{t("utilisation")}</p>
            <p className="text-blue-800 mb-2">{t("api_tokens_view_ajoutez_le_token_en_header_http")}<code className="bg-white px-1 rounded font-mono">{t("authorization_bearer_vnk_pat")}</code>
            </p>
            <p className="text-blue-800">{t("api_tokens_view_endpoint_de_base")}<code className="bg-white px-1 rounded font-mono">https://vnkautomatisation.ca/api</code>
            </p>
          </div>
        </CardContent>
      </Card>


      <Card>
        <div className="divide-y">
          {tokens.length === 0 ? (
            <p className="p-8 text-center text-sm text-muted-foreground">
              {t("aucun_token_cree_creez_integrer")}
            </p>
          ) : (
            tokens.map((token) => {
              const isRevoked = !!token.revokedAt;
              const isExpired = token.expiresAt && new Date(token.expiresAt) < new Date();
              const isInactive = isRevoked || isExpired;
              return (
                <div key={token.id} className={cn("flex items-start gap-4 p-4 hover:bg-muted/30", isInactive && "opacity-60")}>
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white", isInactive ? "bg-gray-400" : "bg-purple-600")}>
                    <Key className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{token.name}</p>
                      {isRevoked && <Badge className="text-[10px] bg-red-600 hover:bg-red-600">{t("revoque")}</Badge>}
                      {isExpired && !isRevoked && <Badge className="text-[10px] bg-gray-500 hover:bg-gray-500">{t("expire")}</Badge>}
                    </div>
                    <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{token.prefix}••••••••</p>
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {token.scopes.map((s) => (
                        <Badge key={s} variant="outline" className="text-[9px] font-mono">{s}</Badge>
                      ))}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                      <span>{tc("created_on", { date: new Date(token.createdAt).toLocaleDateString(dateTag) })}</span>
                      {token.expiresAt && <span>Expire {new Date(token.expiresAt).toLocaleDateString(dateTag)}</span>}
                      {token.lastUsedAt ? (
                        <span>{tc("used_on", { date: new Date(token.lastUsedAt).toLocaleString(dateTag, { dateStyle: "short", timeStyle: "short" }) })}{token.lastUsedIp && ` ${t("depuis_ip", { ip: token.lastUsedIp })}`}</span>
                      ) : (
                        <span>{t("jamais_utilise")}</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    {!isInactive && (
                      <Button size="sm" variant="outline" onClick={() => setConfirmRevoke({ id: token.id, name: token.name })}>
                        <Ban className="h-3.5 w-3.5 mr-1.5" />{t("api_tokens_view_revoquer")}</Button>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setConfirmDelete({ id: token.id, name: token.name })} className="text-red-600">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </Card>


      <Dialog open={creating} onOpenChange={(o) => !o && closeCreate()}>
        <DialogContent className="p-0 gap-0 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500 flex items-center justify-center">
              <Key className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-white text-base">
                {createdToken ? t("token_cree") : t("nouveau_token_api")}
              </DialogTitle>
              <p className="text-xs text-white/70">{t("acces_personnel_apos_api_rest")}</p>
            </div>
          </div>

          {createdToken ? (
            <div className="p-6 space-y-4">
              <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-4">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-sm text-amber-900">{t("token_copier_maintenant")}</p>
                    <p className="text-xs text-amber-800 mt-1">{t("api_tokens_view_ce_token_donne_acces_a_votre_compte")}<strong>{t("il_ne_sera_plus_jamais")}</strong>{t("api_tokens_view_conservez_le_dans_un_gestionnaire_de_mots")}</p>
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("token")}</Label>
                <div className="flex gap-2 mt-1.5">
                  <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded border break-all">{createdToken}</code>
                  <Button onClick={() => copyToken(createdToken)} variant="outline">
                    <Copy className="h-4 w-4 mr-1.5" />{tc("copy")}
                  </Button>
                </div>
              </div>
              <div className="flex justify-end">
                <Button onClick={closeCreate} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                  <ShieldCheck className="h-4 w-4 mr-1.5" />{t("api_tokens_view_j_ai_copie_le_token")}</Button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("nom")}</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ex_integration_zapier_maison")} className="mt-1" />
                </div>
                <div>
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("expiration")}</Label>
                  <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                    <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7">{t("7_jours")}</SelectItem>
                      <SelectItem value="30">{t("30_jours")}</SelectItem>
                      <SelectItem value="90">{t("90_jours_recommande")}</SelectItem>
                      <SelectItem value="180">{t("6_mois")}</SelectItem>
                      <SelectItem value="365">{t("1_an")}</SelectItem>
                      <SelectItem value="never">{t("sans_expiration")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                      {t("permissions_scopes")}
                    </Label>
                    <Badge variant="outline" className="text-[10px]">{selectedScopes.size}/{SCOPES.length}</Badge>
                  </div>
                  <div className="rounded-md border p-3 max-h-[300px] overflow-y-auto">
                    {SCOPE_GROUPS.map((g) => (
                      <div key={g.label} className="mb-3 last:mb-0">
                        <p className="text-[10px] font-bold uppercase tracking-wider text-[#0F2D52] mb-1.5">{g.label}</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1 ml-2">
                          {g.scopes.map((s) => (
                            <label key={s} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1">
                              <Checkbox checked={selectedScopes.has(s)} onCheckedChange={() => toggleScope(s)} />
                              <code className="text-[10px] font-mono">{s}</code>
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
                <Button variant="outline" onClick={closeCreate} disabled={pending}>{tc("cancel")}</Button>
                <Button onClick={handleCreate} disabled={pending || !name.trim() || selectedScopes.size === 0} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                  {pending ? "..." : t("creer_token")}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!confirmRevoke}
        onOpenChange={(o) => !o && setConfirmRevoke(null)}
        title={t("api_tokens_view_revoquer_p0", { p0: (confirmRevoke?.name ?? "") })}
        description={t("token_cessera_immediatement_fonctionner_historique")}
        confirmLabel={t("revoquer")}
        variant="destructive"
        onConfirm={() => confirmRevoke && handleRevoke(confirmRevoke.id)}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={t("api_tokens_view_supprimer_definitivement_p0", { p0: (confirmDelete?.name ?? "") })}
        description={t("historique_sera_perdu_preferez_revocation")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={() => confirmDelete && handleDelete(confirmDelete.id)}
      />
    </div>
  );
}

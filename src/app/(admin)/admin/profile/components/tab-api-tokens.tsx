"use client";
import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  Key, Plus, Copy, Check, Trash2, AlertTriangle, Clock, ShieldCheck,
} from "lucide-react";
import { createApiTokenAction, revokeApiTokenAction } from "@/app/actions/profile";
import type { ApiTokenRow } from "../profile-view";

const SCOPES = [
  { value: "read:clients", labelKey: "lire_clients" },
  { value: "write:clients", labelKey: "modifier_clients" },
  { value: "read:invoices", labelKey: "lire_factures" },
  { value: "write:invoices", labelKey: "modifier_factures" },
  { value: "read:quotes", labelKey: "lire_devis" },
  { value: "write:quotes", labelKey: "modifier_devis" },
  { value: "read:requests", labelKey: "lire_demandes" },
  { value: "write:requests", labelKey: "modifier_demandes" },
  { value: "read:reports", labelKey: "lire_rapports" },
  { value: "admin:full", labelKey: "acces_admin_complet_danger" },
];

export function TabApiTokens({ tokens }: { tokens: ApiTokenRow[] }) {
  const tc = useTranslations("common");
  const t = useTranslations("admin.profile.api_tokens");
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [scopes, setScopes] = useState<string[]>([]);
  const [expiresInDays, setExpiresInDays] = useState<string>("30");
  const [pending, startTransition] = useTransition();
  const [newToken, setNewToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleCreate = () => {
    if (!name.trim()) { toast.error(t("nommez_token")); return; }
    if (scopes.length === 0) { toast.error(t("selectionnez_moins_permission")); return; }
    startTransition(async () => {
      const r = await createApiTokenAction({
        name: name.trim(),
        scopes,
        expiresInDays: expiresInDays === "never" ? null : parseInt(expiresInDays, 10),
      });
      if (r.success && "data" in r) {
        setNewToken(r.data.token);
        toast.success(t("token_cree"));
        setName(""); setScopes([]); setExpiresInDays("30");
      } else if (!r.success) {
        toast.error(r.error);
      }
    });
  };

  const handleRevoke = (id: number) => {
    startTransition(async () => {
      const r = await revokeApiTokenAction(id);
      if (r.success) toast.success(t("token_revoque"));
      else toast.error(r.error);
    });
  };

  const toggleScope = (s: string) => {
    setScopes(scopes.includes(s) ? scopes.filter((x) => x !== s) : [...scopes, s]);
  };

  const copyToken = () => {
    if (!newToken) return;
    navigator.clipboard.writeText(newToken);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const closeNewToken = () => { setNewToken(null); setCreateOpen(false); };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Key className="h-4 w-4" />
                {t("title")}
                <Badge variant="secondary">{tokens.length}</Badge>
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">{t("subtitle")}</p>
            </div>
            <Button size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-3.5 w-3.5" />
              {t("new_token")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {tokens.length === 0 ? (
            <div className="text-center py-8 text-sm text-muted-foreground">
              <Key className="h-8 w-8 mx-auto mb-2 opacity-40" />
              <p>{t("empty_title")}</p>
              <p className="text-[11px] mt-1">{t("empty_hint")}</p>
            </div>
          ) : (
            <ul className="divide-y">
              {tokens.map((tok) => {
                const expired = tok.expiresAt && new Date(tok.expiresAt) < new Date();
                return (
                  <li key={tok.id} className="py-3 flex items-start gap-3">
                    <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      <Key className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-medium truncate">{tok.name}</p>
                        {expired && <Badge variant="destructive" className="text-[10px]">{t("expired")}</Badge>}
                      </div>
                      <p className="text-[11px] font-mono text-muted-foreground mt-0.5">{tok.prefix}…</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {tok.scopes.map((s) => (
                          <Badge key={s} variant="outline" className="text-[10px] font-mono">{s}</Badge>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1 text-[11px] text-muted-foreground">
                        <span>{new Date(tok.createdAt).toLocaleDateString()}</span>
                        {tok.lastUsedAt && <span className="flex items-center gap-1"><Clock className="h-2.5 w-2.5" /> {new Date(tok.lastUsedAt).toLocaleDateString()}</span>}
                        {tok.expiresAt && <span>{new Date(tok.expiresAt).toLocaleDateString()}</span>}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => handleRevoke(tok.id)} disabled={pending} className="text-destructive hover:bg-destructive/10">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>


      <Dialog open={createOpen && !newToken} onOpenChange={(o) => !o && setCreateOpen(false)}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="vnk-gradient text-white p-5">
            <DialogTitle className="text-white">{t("new_token")}</DialogTitle>
            <DialogDescription className="text-white/80 text-sm mt-1">
              {t("created_modal_description")}
            </DialogDescription>
          </div>
          <div className="p-5 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="token-name" className="text-xs">{t("nom_plain")}</Label>
              <Input id="token-name" value={name} onChange={(e) => setName(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("scopes_count", { count: scopes.length })}</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                {SCOPES.map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => toggleScope(s.value)}
                    className={`text-left px-3 py-2 rounded-md border text-xs flex items-center gap-2 transition ${scopes.includes(s.value) ? "border-[#0F2D52] bg-[#0F2D52]/5" : "border-input hover:bg-muted/50"} ${s.value === "admin:full" ? "border-red-300" : ""}`}
                  >
                    <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${scopes.includes(s.value) ? "bg-[#0F2D52] border-[#0F2D52]" : "border-muted-foreground/30"}`}>
                      {scopes.includes(s.value) && <Check className="h-2.5 w-2.5 text-white" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] truncate">{s.value}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{t(s.labelKey)}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{t("expires_in")}</Label>
              <Select value={expiresInDays} onValueChange={setExpiresInDays}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">{t("expires_7")}</SelectItem>
                  <SelectItem value="30">{t("expires_30")}</SelectItem>
                  <SelectItem value="90">{t("expires_90")}</SelectItem>
                  <SelectItem value="365">{t("expires_365")}</SelectItem>
                  <SelectItem value="never">{t("expires_never")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={() => setCreateOpen(false)}>{tc("cancel")}</Button>
            <Button onClick={handleCreate} disabled={pending}>
              {pending ? t("creating") : t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={!!newToken} onOpenChange={(o) => !o && closeNewToken()}>
        <DialogContent className="sm:max-w-lg p-0 overflow-hidden">
          <div className="bg-emerald-600 text-white p-5">
            <DialogTitle className="text-white flex items-center gap-2"><ShieldCheck className="h-5 w-5" /> {t("created_modal_title")}</DialogTitle>
            <DialogDescription className="text-white/85 text-sm mt-1">
              {t("created_modal_description")}
            </DialogDescription>
          </div>
          <div className="p-5 space-y-3">
            <div className="bg-muted rounded-md p-3 font-mono text-xs break-all select-all">
              {newToken}
            </div>
            <div className="bg-amber-50 border border-amber-200 rounded-md p-3 text-xs text-amber-800 flex gap-2">
              <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>{t("store_warning")}</span>
            </div>
          </div>
          <DialogFooter className="px-5 pb-5">
            <Button variant="outline" onClick={copyToken}>
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </Button>
            <Button onClick={closeNewToken}>{t("i_saved")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

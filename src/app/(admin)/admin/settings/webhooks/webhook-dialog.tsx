"use client";
// Dialog création/édition d'un OutgoingWebhook.
// À la création : affiche le secret généré une fois (non récupérable après).
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Webhook, Copy, AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  createWebhookAction, updateWebhookAction, WEBHOOK_EVENTS,
} from "@/app/actions/webhooks";
import type { OutgoingWebhookRow } from "./webhooks-view";

const EVENT_GROUPS = [
  { labelKey: "grp_clients", prefix: "client." },
  { labelKey: "grp_devis", prefix: "quote." },
  { labelKey: "grp_factures", prefix: "invoice." },
  { labelKey: "grp_contrats", prefix: "contract." },
  { labelKey: "grp_paiements", prefix: "payment." },
  { labelKey: "grp_mandats", prefix: "mandate." },
  { labelKey: "grp_rendez_vous", prefix: "appointment." },
];

export function WebhookDialog({
  open, onOpenChange, webhook, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  webhook: OutgoingWebhookRow | null;
  onSaved: (secret?: string) => void;
}) {
  const t = useTranslations("admin.webhooks");
  const tc = useTranslations("common");
  const mode = webhook ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [selectedEvents, setSelectedEvents] = useState<Set<string>>(new Set());
  const [isEnabled, setIsEnabled] = useState(true);
  const [generatedSecret, setGeneratedSecret] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setGeneratedSecret(null);
    if (webhook) {
      setName(webhook.name);
      setUrl(webhook.url);
      setSelectedEvents(new Set(webhook.events));
      setIsEnabled(webhook.isEnabled);
    } else {
      setName(""); setUrl("");
      setSelectedEvents(new Set());
      setIsEnabled(true);
    }
  }, [open, webhook]);

  const toggleEvent = (key: string) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleGroup = (prefix: string, checked: boolean) => {
    setSelectedEvents((prev) => {
      const next = new Set(prev);
      WEBHOOK_EVENTS.filter((e) => e.key.startsWith(prefix)).forEach((e) => {
        if (checked) next.add(e.key);
        else next.delete(e.key);
      });
      return next;
    });
  };

  const handleSave = () => {
    startTransition(async () => {
      const events = Array.from(selectedEvents);
      const payload = { name, url, events, isEnabled };
      if (mode === "create") {
        const r = await createWebhookAction(payload);
        if (r.success) {
          setGeneratedSecret(r.data.secret);
          onSaved(r.data.secret);
        } else {
          toast.error(r.error);
        }
      } else {
        const r = await updateWebhookAction({ id: webhook!.id, ...payload });
        if (r.success) {
          toast.success(t("webhook_enregistre"));
          onSaved();
          onOpenChange(false);
        } else {
          toast.error(r.error);
        }
      }
    });
  };

  const copySecret = () => {
    if (generatedSecret) {
      navigator.clipboard.writeText(generatedSecret);
      toast.success(t("secret_copie"));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-orange-500 flex items-center justify-center">
            <Webhook className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-white text-base">
              {mode === "create" ? t("nouveau_webhook") : webhook?.name}
            </DialogTitle>
            <p className="text-xs text-white/70">{t("webhook_http_sortant_signe_hmac")}</p>
          </div>
          <Switch checked={isEnabled} onCheckedChange={setIsEnabled} aria-label={tc("enabled")} />
        </div>

        {generatedSecret ? (
          <div className="p-6 space-y-4">
            <div className="rounded-md border-l-4 border-amber-500 bg-amber-50 p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                <div>
                  <p className="font-semibold text-sm text-amber-900">{t("secret_copier_maintenant")}</p>
                  <p className="text-xs text-amber-800 mt-1">{t("webhook_dialog_ce_secret_servira_a_verifier_la_signature")}<strong>{t("il_ne_sera_plus_jamais")}</strong>{t("webhook_dialog_si_perdu_il_faudra_le_regenerer")}</p>
                </div>
              </div>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("secret")}</Label>
              <div className="flex gap-2 mt-1.5">
                <code className="flex-1 text-xs font-mono bg-muted px-3 py-2 rounded border break-all">
                  {generatedSecret}
                </code>
                <Button onClick={copySecret} variant="outline">
                  <Copy className="h-4 w-4 mr-1.5" />{tc("copy")}
                </Button>
              </div>
              <p className="text-[10px] text-muted-foreground mt-2">
                Header signature : <code className="bg-muted px-1 rounded">X-VNK-Signature: sha256={"<hmac>"}</code>
              </p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => { setGeneratedSecret(null); onOpenChange(false); }} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                {t("j_apos_ai_copie_secret")}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("nom")}</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("ex_integration_zapier")} className="mt-1" />
              </div>
              <div>
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("url_destination")}</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://hooks.partenaire.com/vnk-events" className="mt-1 font-mono text-sm" />
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                    {t("evenements_envoyer")}
                  </Label>
                  <Badge variant="outline" className="text-[10px]">{tc("selected_m", { count: selectedEvents.size })}</Badge>
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto rounded-md border p-3">
                  {EVENT_GROUPS.map((group) => {
                    const groupEvents = WEBHOOK_EVENTS.filter((e) => e.key.startsWith(group.prefix));
                    const allSelected = groupEvents.every((e) => selectedEvents.has(e.key));
                    const someSelected = groupEvents.some((e) => selectedEvents.has(e.key));
                    return (
                      <div key={group.prefix}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <Checkbox
                            checked={allSelected ? true : someSelected ? "indeterminate" : false}
                            onCheckedChange={(c) => toggleGroup(group.prefix, !!c)}
                          />
                          <p className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">{t(group.labelKey)}</p>
                        </div>
                        <div className="ml-6 grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {groupEvents.map((e) => (
                            <label key={e.key} className="flex items-center gap-2 cursor-pointer hover:bg-muted/40 rounded px-1.5 py-1">
                              <Checkbox checked={selectedEvents.has(e.key)} onCheckedChange={() => toggleEvent(e.key)} />
                              <code className="text-[10px] font-mono text-muted-foreground">{e.key}</code>
                              <span className="text-[10px] text-muted-foreground">— {t(e.labelKey)}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
              <Button onClick={handleSave} disabled={pending || !name.trim() || !url.trim() || selectedEvents.size === 0} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
                {pending ? "..." : mode === "create" ? t("creer") : t("enregistrer")}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

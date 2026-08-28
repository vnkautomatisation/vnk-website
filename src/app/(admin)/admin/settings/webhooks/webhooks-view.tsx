"use client";
// Vue Webhooks — sortants + entrants avec test, replay, rotation.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Webhook, ChevronLeft, Plus, MoreHorizontal, Edit, Trash2,
  Power, Send, RotateCw, Copy, ArrowDownToLine, ArrowUpFromLine,
  CheckCircle2, XCircle, RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { WebhookDialog } from "./webhook-dialog";
import {
  deleteWebhookAction, updateWebhookAction, testWebhookAction,
  rotateWebhookSecretAction, replayIncomingAction, deleteIncomingLogAction,
} from "@/app/actions/webhooks";

export type OutgoingWebhookRow = {
  id: number;
  name: string;
  url: string;
  secret: string;
  events: string[];
  isEnabled: boolean;
  lastFireAt: string | null;
  lastStatus: number | null;
  failCount: number;
  createdAt: string;
};
export type IncomingLogRow = {
  id: number;
  provider: string;
  eventType: string;
  payload: Record<string, unknown>;
  signature: string | null;
  verified: boolean;
  processed: boolean;
  error: string | null;
  receivedAt: string;
};

type Tab = "outgoing" | "incoming";

export function WebhooksView({
  outgoing, incoming,
}: {
  outgoing: OutgoingWebhookRow[];
  incoming: IncomingLogRow[];
}) {
  const t = useTranslations("admin.webhooks");
  const tc = useTranslations("common");
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("outgoing");

  const [webhookDialog, setWebhookDialog] = useState<{ open: boolean; webhook: OutgoingWebhookRow | null }>({ open: false, webhook: null });
  const [confirmDelete, setConfirmDelete] = useState<{ kind: "outgoing" | "incoming"; id: number; label: string } | null>(null);
  const [revealedSecret, setRevealedSecret] = useState<{ id: number; secret: string } | null>(null);
  const [testing, setTesting] = useState<number | null>(null);
  const dateTag = useDateLocale();

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const r = confirmDelete.kind === "outgoing"
      ? await deleteWebhookAction({ id: confirmDelete.id })
      : await deleteIncomingLogAction({ id: confirmDelete.id });
    if (r.success) { toast.success(t("supprime")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
    setConfirmDelete(null);
  };

  const toggleEnabled = async (w: OutgoingWebhookRow) => {
    const r = await updateWebhookAction({
      id: w.id, name: w.name, url: w.url, events: w.events,
      isEnabled: !w.isEnabled,
    });
    if (r.success) { toast.success(w.isEnabled ? t("desactive") : t("active")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  const handleTest = async (w: OutgoingWebhookRow) => {
    setTesting(w.id);
    try {
      const r = await testWebhookAction({ id: w.id });
      if (r.success && "data" in r) {
        if (r.data.status >= 200 && r.data.status < 300) {
          toast.success(`Test OK · ${r.data.status} en ${r.data.ms} ms`);
        } else {
          toast.warning(t("webhooks_view_reponse_p0_en_p1_ms", { p0: r.data.status, p1: r.data.ms }));
        }
        router.refresh();
      } else {
        toast.error(r.success ? t("erreur") : r.error);
      }
    } finally {
      setTesting(null);
    }
  };

  const handleRotateSecret = async (w: OutgoingWebhookRow) => {
    const r = await rotateWebhookSecretAction({ id: w.id });
    if (r.success && "data" in r) {
      setRevealedSecret({ id: w.id, secret: r.data.secret });
      toast.success(t("nouveau_secret_genere"));
      router.refresh();
    } else {
      toast.error(r.success ? t("erreur") : r.error);
    }
  };

  const copySecret = (secret: string) => {
    navigator.clipboard.writeText(secret);
    toast.success(t("secret_copie"));
  };

  const handleReplay = async (log: IncomingLogRow) => {
    const r = await replayIncomingAction({ id: log.id });
    if (r.success) { toast.success(t("marque_retraitement")); router.refresh(); }
    else toast.error(r.error || t("erreur"));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start gap-4">
        <Link href="/admin/settings" className="mt-1 text-muted-foreground hover:text-foreground" aria-label={tc("back")}><ChevronLeft className="h-5 w-5" /></Link>
        <div className="h-12 w-12 rounded-lg flex items-center justify-center text-white bg-orange-600 shrink-0">
          <Webhook className="h-6 w-6" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight">{t("webhooks")}</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            {t("envoyer_evenements_systemes_externes_inspecter")}
          </p>
        </div>
      </div>

      <div className="border-b">
        <div className="flex gap-1">
          <button
            onClick={() => setTab("outgoing")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2",
              tab === "outgoing" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <ArrowUpFromLine className="h-4 w-4" />Sortants
            <Badge variant="secondary" className="text-[10px] ml-1">{outgoing.length}</Badge>
          </button>
          <button
            onClick={() => setTab("incoming")}
            className={cn(
              "px-4 py-2.5 text-sm font-medium border-b-2 -mb-px flex items-center gap-2",
              tab === "incoming" ? "border-[#0F2D52] text-[#0F2D52]" : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            )}
          >
            <ArrowDownToLine className="h-4 w-4" />Entrants
            <Badge variant="secondary" className="text-[10px] ml-1">{incoming.length}</Badge>
          </button>
        </div>
      </div>


      {tab === "outgoing" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              {outgoing.filter((w) => w.isEnabled).length} actif{outgoing.filter((w) => w.isEnabled).length > 1 ? "s" : ""} sur {outgoing.length}
            </p>
            <Button onClick={() => setWebhookDialog({ open: true, webhook: null })} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
              <Plus className="h-4 w-4 mr-1.5" />Nouveau webhook
            </Button>
          </div>
          <Card>
            <div className="divide-y">
              {outgoing.map((w) => (
                <div key={w.id} className={cn("p-4 hover:bg-muted/30", !w.isEnabled && "opacity-60")}>
                  <div className="flex items-start gap-4">
                    <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white", w.failCount > 5 ? "bg-red-600" : w.lastStatus && w.lastStatus >= 200 && w.lastStatus < 300 ? "bg-emerald-600" : "bg-orange-600")}>
                      <ArrowUpFromLine className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-sm">{w.name}</p>
                        {!w.isEnabled && <Badge variant="secondary" className="text-[10px]">{tc("disabled")}</Badge>}
                        {w.lastStatus && w.lastStatus >= 200 && w.lastStatus < 300 ? (
                          <Badge className="text-[10px] bg-emerald-600 hover:bg-emerald-600">
                            <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" />{w.lastStatus}
                          </Badge>
                        ) : w.lastStatus ? (
                          <Badge className="text-[10px] bg-red-600 hover:bg-red-600">
                            <XCircle className="h-2.5 w-2.5 mr-0.5" />{w.lastStatus}
                          </Badge>
                        ) : null}
                        {w.failCount > 0 && <Badge variant="outline" className="text-[10px] text-red-600 border-red-300">{w.failCount} échec{w.failCount > 1 ? "s" : ""}</Badge>}
                      </div>
                      <p className="text-xs text-muted-foreground font-mono mt-0.5 truncate">{w.url}</p>
                      <div className="flex gap-1 mt-1.5 flex-wrap">
                        {w.events.slice(0, 6).map((e) => (
                          <Badge key={e} variant="outline" className="text-[9px] font-mono">{e}</Badge>
                        ))}
                        {w.events.length > 6 && <Badge variant="outline" className="text-[9px]">+{w.events.length - 6}</Badge>}
                      </div>
                      {w.lastFireAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Dernier déclenchement : {new Date(w.lastFireAt).toLocaleString(dateTag, { dateStyle: "short", timeStyle: "short" })}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => handleTest(w)} disabled={testing === w.id} title={t("envoyer_test")}>
                        {testing === w.id ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setWebhookDialog({ open: true, webhook: w })}><Edit className="h-4 w-4 mr-2" />{tc("edit")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggleEnabled(w)}><Power className="h-4 w-4 mr-2" />{w.isEnabled ? t("desactiver") : t("activer")}</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleRotateSecret(w)}><RotateCw className="h-4 w-4 mr-2" />{t("regenerer_secret")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "outgoing", id: w.id, label: w.name })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                  {revealedSecret?.id === w.id && (
                    <div className="mt-3 rounded-md border border-emerald-200 bg-emerald-50 p-3">
                      <p className="text-xs font-semibold text-emerald-900 mb-1.5">{t("nouveau_secret_genere_copier_maintenant")}</p>
                      <div className="flex items-center gap-2">
                        <code className="text-[11px] font-mono bg-white px-2 py-1 rounded border flex-1 break-all">{revealedSecret.secret}</code>
                        <Button size="sm" variant="outline" onClick={() => copySecret(revealedSecret.secret)} title={tc("copy")}>
                          <Copy className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setRevealedSecret(null)}>{tc("close")}</Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
              {outgoing.length === 0 && (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {t("aucun_webhook_sortant_creez_envoyer")}
                </p>
              )}
            </div>
          </Card>
        </div>
      )}


      {tab === "incoming" && (
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {t("derniers_50_webhooks_recus_partenaires")}
          </p>
          <Card>
            <div className="divide-y">
              {incoming.length === 0 ? (
                <p className="p-8 text-center text-sm text-muted-foreground">
                  {t("aucun_webhook_entrant_recu")}
                </p>
              ) : (
                incoming.map((log) => (
                  <div key={log.id} className="p-4 hover:bg-muted/30">
                    <div className="flex items-start gap-4">
                      <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0 text-white", log.error ? "bg-red-600" : log.processed ? "bg-emerald-600" : "bg-amber-600")}>
                        <ArrowDownToLine className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="outline" className="text-[10px] font-semibold">{log.provider}</Badge>
                          <p className="font-mono text-xs">{log.eventType}</p>
                          {log.verified ? (
                            <Badge className="text-[9px] bg-emerald-600 hover:bg-emerald-600">{t("signature_ok")}</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[9px] text-amber-700">{t("non_verifie")}</Badge>
                          )}
                          {log.processed ? (
                            <Badge variant="outline" className="text-[9px]">{t("traite")}</Badge>
                          ) : (
                            <Badge className="text-[9px] bg-amber-500 hover:bg-amber-500">{t("attente")}</Badge>
                          )}
                          {log.error && (
                            <Badge className="text-[9px] bg-red-600 hover:bg-red-600">{t("erreur")}</Badge>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {new Date(log.receivedAt).toLocaleString(dateTag, { dateStyle: "medium", timeStyle: "short" })}
                        </p>
                        {log.error && (
                          <p className="text-xs text-red-600 mt-1 font-mono">{log.error}</p>
                        )}
                        <details className="mt-1.5">
                          <summary className="text-[10px] text-muted-foreground cursor-pointer hover:text-foreground">{t("voir_payload")}</summary>
                          <pre className="mt-1 text-[10px] bg-muted/40 rounded p-2 overflow-x-auto max-w-full font-mono max-h-60">
                            {JSON.stringify(log.payload, null, 2).slice(0, 2000)}
                          </pre>
                        </details>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleReplay(log)}><RefreshCw className="h-4 w-4 mr-2" />{t("re_traiter")}</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem onClick={() => setConfirmDelete({ kind: "incoming", id: log.id, label: log.eventType })} className="text-red-600 focus:text-red-600"><Trash2 className="h-4 w-4 mr-2" />{tc("delete")}</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      <WebhookDialog
        open={webhookDialog.open}
        onOpenChange={(open) => setWebhookDialog({ open, webhook: open ? webhookDialog.webhook : null })}
        webhook={webhookDialog.webhook}
        onSaved={(secret) => {
          if (secret) {

            toast.success(t("webhook_cree_copiez_secret_affiche"));
          }
          router.refresh();
        }}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => !open && setConfirmDelete(null)}
        title={`Supprimer ${confirmDelete?.label} ?`}
        description={t("action_irreversible")}
        confirmLabel={tc("delete")}
        variant="destructive"
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}

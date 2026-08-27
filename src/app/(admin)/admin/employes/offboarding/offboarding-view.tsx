"use client";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Plus, CheckCircle2, Calendar, FileText, AlertTriangle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { confirmDialog } from "@/components/admin/prompt-dialog";
import { startOffboardingAction, toggleOffboardingItemAction, saveExitInterviewAction, markRecordOfEmploymentSentAction, completeOffboardingAction, DEFAULT_CHECKLIST } from "@/app/actions/hr-offboarding";

type ChecklistItem = { key: string; label: string; done: boolean; doneAt: string | null; doneBy: number | null };
type Offboard = {
  id: number; reason: string | null; lastDay: string | null; status: string;
  items: ChecklistItem[]; exitInterview: string | null; exitInterviewAt: string | null;
  recordOfEmploymentSentAt: string | null;
  admin: { id: number; fullName: string | null; email: string; avatarUrl: string | null; isActive: boolean; endDate: string | null };
  successor: { id: number; fullName: string | null; email: string } | null;
};
type Emp = { id: number; fullName: string | null; email: string };

const REASON_KEY: Record<string, string> = {
  resignation: "demission", termination: "congediement", retirement: "retraite", end_contract: "fin_contrat",
};

// Les anciennes lignes ont un label francais fige ; la cle prime quand elle existe.
function stepLabel(
  item: { key: string; labelKey?: string; label?: string },
  t: (k: string) => string
): string {
  const fromSource = DEFAULT_CHECKLIST.find((s) => s.key === item.key)?.labelKey;
  const key = fromSource ?? item.labelKey;
  return key ? t(key) : item.label ?? item.key;
}

export function OffboardingView({ checklists, candidates }: { checklists: Offboard[]; candidates: Emp[] }) {
  const t = useTranslations("admin.offboarding");
  const dateTag = useDateLocale();
  const router = useRouter();
  const [dialog, setDialog] = useState(false);
  const [active, setActive] = useState<Offboard | null>(null);

  const inProgress = checklists.filter((c) => c.status === "active");
  const completed = checklists.filter((c) => c.status === "completed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><LogOut className="h-5 w-5 text-[#0F2D52]" />{t("departs_apos_employes")}</h1>
          <p className="text-sm text-muted-foreground">{t("suivi_departs_checklists_documents_transfert")}</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4 mr-1.5" />{t("demarrer_offboarding")}</Button>
      </div>

      {inProgress.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider">En cours ({inProgress.length})</h2>
          <div className="space-y-2">
            {inProgress.map((c) => {
              const done = c.items.filter((i) => i.done).length;
              const total = c.items.length;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <Card key={c.id} className="p-4 cursor-pointer hover:bg-muted/30 transition" onClick={() => setActive(c)}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold">{c.admin.fullName || c.admin.email}</h3>
                      <p className="text-xs text-muted-foreground">
                        {REASON_KEY[c.reason ?? ""] ? t(REASON_KEY[c.reason ?? ""]) : c.reason} · {t("dernier_jour")} : {c.lastDay ? new Date(c.lastDay).toLocaleDateString(dateTag) : "—"}
                        {c.successor && ` · ${t("successeur")} : ${c.successor.fullName || c.successor.email}`}
                      </p>
                      <div className="mt-2 w-full bg-muted h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{t("items_completes", { done, total, pct })}</p>
                    </div>
                    {c.recordOfEmploymentSentAt && (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 shrink-0">
                        {t("re_envoye")}
                      </Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        </section>
      )}

      {completed.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider">{t("completes")}</h2>
          <Card>
            <div className="divide-y">
              {completed.map((c) => (
                <div key={c.id} className="p-3 flex items-center gap-3 text-sm cursor-pointer hover:bg-muted/30 transition" onClick={() => setActive(c)}>
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="flex-1">{c.admin.fullName || c.admin.email}</span>
                  <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-100">{t("cloture")}</Badge>
                  <span className="text-xs text-muted-foreground">{REASON_KEY[c.reason ?? ""] ? t(REASON_KEY[c.reason ?? ""]) : c.reason}</span>
                  <span className="text-xs text-muted-foreground">{c.lastDay && new Date(c.lastDay).toLocaleDateString(dateTag)}</span>
                </div>
              ))}
            </div>
          </Card>
        </section>
      )}

      <StartDialog open={dialog} candidates={candidates} onClose={() => setDialog(false)} onSaved={() => router.refresh()} />
      <DetailDialog offboard={active} onClose={() => setActive(null)} onChanged={() => router.refresh()} />
    </div>
  );
}

function StartDialog({ open, candidates, onClose, onSaved }: { open: boolean; candidates: Emp[]; onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.offboarding");
  const tc = useTranslations("common");
  const [adminId, setAdminId] = useState("");
  const [reason, setReason] = useState<"resignation" | "termination" | "retirement" | "end_contract">("resignation");
  const [lastDay, setLastDay] = useState(new Date().toISOString().slice(0, 10));
  const [successorId, setSuccessorId] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!adminId) { toast.error(t("employe_requis")); return; }
    setPending(true);
    const r = await startOffboardingAction({
      adminId: Number(adminId), reason, lastDay,
      successorId: successorId ? Number(successorId) : null,
    });
    setPending(false);
    if (r.success) { toast.success(t("offboarding_demarre")); onSaved(); onClose(); setAdminId(""); setSuccessorId(""); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader><DialogTitle className="text-base text-white flex items-center gap-2"><LogOut className="h-4 w-4" />{t("demarrer_offboarding")}</DialogTitle></DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">{t("employe_part")}</Label>
            <Select value={adminId} onValueChange={setAdminId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{candidates.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("motif")}</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as "resignation" | "termination" | "retirement" | "end_contract")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resignation">{t("demission")}</SelectItem>
                  <SelectItem value="termination">{t("congediement")}</SelectItem>
                  <SelectItem value="retirement">{t("retraite")}</SelectItem>
                  <SelectItem value="end_contract">{t("fin_contrat")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">{t("dernier_jour")}</Label>
              <Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">{t("successeur")}</Label>
            <Select value={successorId || "none"} onValueChange={(v) => setSuccessorId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder={tc("none")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("aucun")}</SelectItem>
                {candidates.filter((c) => String(c.id) !== adminId).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : t("demarrer")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ offboard, onClose, onChanged }: { offboard: Offboard | null; onClose: () => void; onChanged: () => void }) {
  const t = useTranslations("admin.offboarding");
  const tc = useTranslations("common");
  const [exitNotes, setExitNotes] = useState(offboard?.exitInterview ?? "");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (offboard) {
      setExitNotes(offboard.exitInterview ?? "");
    }
  }, [offboard]);

  if (!offboard) return null;

  const toggle = async (key: string, done: boolean) => {
    const r = await toggleOffboardingItemAction({ adminId: offboard.admin.id, itemKey: key, done });
    if (r.success) onChanged();
    else toast.error(r.error || "");
  };

  const saveNotes = async () => {
    setPending(true);
    const r = await saveExitInterviewAction({ adminId: offboard.admin.id, notes: exitNotes });
    setPending(false);
    if (r.success) { toast.success(t("sauvegarde")); onChanged(); }
    else toast.error(r.error || "");
  };

  const markRE = async () => {
    const r = await markRecordOfEmploymentSentAction({ adminId: offboard.admin.id });
    if (r.success) { toast.success(t("marque")); onChanged(); }
    else toast.error(r.error || "");
  };

  const completeAndDeactivate = async () => {
    const ok = await confirmDialog({
      title: t("confirmer_cloture"),
      description: t("compte_employe_sera_desactive_sessions"),
      confirmLabel: t("cloturer_desactiver"),
      variant: "destructive",
    });
    if (!ok) return;
    setPending(true);
    const r = await completeOffboardingAction({ id: offboard.id });
    setPending(false);
    if (r.success) { toast.success(t("offboarding_cloture_compte_desactive")); onChanged(); onClose(); }
    else toast.error(r.error || "");
  };

  const allItemsDone = offboard.items.length > 0 && offboard.items.every((i) => i.done);
  const isPastLastDay = offboard.lastDay ? new Date(offboard.lastDay) <= new Date() : false;
  const alreadyCompleted = offboard.status === "completed";
  const canComplete = allItemsDone && isPastLastDay;
  const blockReason = !allItemsDone
    ? t("tous_items_checklist_completes")
    : !isPastLastDay
      ? t("dernier_jour_travail_n_pas")
      : "";

  return (
    <Dialog open={!!offboard} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <span>Offboarding · {offboard.admin.fullName || offboard.admin.email}</span>
              {alreadyCompleted && (
                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-100">{t("cloture")}</Badge>
              )}
            </DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          <section>
            <h3 className="text-sm font-semibold mb-2">Checklist ({offboard.items.filter((i) => i.done).length}/{offboard.items.length})</h3>
            <div className="space-y-1">
              {offboard.items.map((item) => (
                <label key={item.key} className={`flex items-center gap-2 p-2 rounded-md hover:bg-muted/40 cursor-pointer ${item.done ? "bg-emerald-50/50" : ""}`}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={(e) => toggle(item.key, e.target.checked)}
                    className="h-4 w-4 rounded border-input"
                  />
                  <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{stepLabel(item, t)}</span>
                  {item.done && item.doneAt && (
                    <span className="text-[10px] text-muted-foreground">{new Date(item.doneAt).toLocaleDateString("fr-CA")}</span>
                  )}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" />{t("entrevue_depart")}</h3>
            <textarea value={exitNotes} onChange={(e) => setExitNotes(e.target.value)} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" placeholder={t("raison_depart_retours_suggestions")} />
            <Button size="sm" className="mt-2" onClick={saveNotes} disabled={pending}>
              {pending ? "..." : t("enregistrer_entrevue")}
            </Button>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Calendar className="h-4 w-4" />{t("releve_apos_emploi_re")}</h3>
            {offboard.recordOfEmploymentSentAt ? (
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />Envoyé le {new Date(offboard.recordOfEmploymentSentAt).toLocaleDateString("fr-CA")}
              </Badge>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
                <p className="font-medium text-amber-900 mb-2"><AlertTriangle className="h-3.5 w-3.5 inline mr-1.5" />{t("re_doit_etre_transmis_edsc")}</p>
                <Button size="sm" onClick={markRE}>{t("marquer_comme_envoye_edsc")}</Button>
              </div>
            )}
          </section>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 flex flex-col sm:flex-row sm:justify-between gap-2 w-full">
          {!alreadyCompleted ? (
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
              <Button
                onClick={completeAndDeactivate}
                disabled={pending || !canComplete}
                className="bg-red-600 hover:bg-red-700 text-white"
                title={blockReason}
              >
                <Lock className="h-4 w-4 mr-1.5" />
                {pending ? "..." : t("completer_desactiver_compte")}
              </Button>
              {!canComplete && blockReason && (
                <span className="text-[11px] text-amber-700">{blockReason}</span>
              )}
            </div>
          ) : (
            <span className="text-xs text-muted-foreground">{t("compte_desactive_sessions_fermees")}</span>
          )}
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogOut, Plus, CheckCircle2, Calendar, FileText, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { startOffboardingAction, toggleOffboardingItemAction, saveExitInterviewAction, markRecordOfEmploymentSentAction } from "@/app/actions/hr-offboarding";

type ChecklistItem = { key: string; label: string; done: boolean; doneAt: string | null; doneBy: number | null };
type Offboard = {
  id: number; reason: string | null; lastDay: string | null; status: string;
  items: ChecklistItem[]; exitInterview: string | null; exitInterviewAt: string | null;
  recordOfEmploymentSentAt: string | null;
  admin: { id: number; fullName: string | null; email: string; avatarUrl: string | null; isActive: boolean; endDate: string | null };
  successor: { id: number; fullName: string | null; email: string } | null;
};
type Emp = { id: number; fullName: string | null; email: string };

const REASON_LABEL: Record<string, string> = {
  resignation: "Démission", termination: "Congédiement", retirement: "Retraite", end_contract: "Fin de contrat",
};

export function OffboardingView({ checklists, candidates }: { checklists: Offboard[]; candidates: Emp[] }) {
  const router = useRouter();
  const [dialog, setDialog] = useState(false);
  const [active, setActive] = useState<Offboard | null>(null);

  const inProgress = checklists.filter((c) => c.status === "active");
  const completed = checklists.filter((c) => c.status === "completed");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2"><LogOut className="h-5 w-5 text-[#0F2D52]" />Offboarding</h1>
          <p className="text-sm text-muted-foreground">Checklists de départs · Relevé d&apos;emploi · transfert portefeuille.</p>
        </div>
        <Button onClick={() => setDialog(true)}><Plus className="h-4 w-4 mr-1.5" />Démarrer un offboarding</Button>
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
                        {REASON_LABEL[c.reason ?? ""] ?? c.reason} · Dernier jour : {c.lastDay ? new Date(c.lastDay).toLocaleDateString("fr-CA") : "—"}
                        {c.successor && ` · Successeur : ${c.successor.fullName || c.successor.email}`}
                      </p>
                      <div className="mt-2 w-full bg-muted h-1.5 rounded-full overflow-hidden">
                        <div className="h-full bg-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-1">{done} / {total} items complétés · {pct}%</p>
                    </div>
                    {c.recordOfEmploymentSentAt && (
                      <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50 shrink-0">
                        RE envoyé
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
          <h2 className="text-sm font-semibold mb-2 uppercase tracking-wider">Complétés</h2>
          <Card>
            <div className="divide-y">
              {completed.map((c) => (
                <div key={c.id} className="p-3 flex items-center gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  <span className="flex-1">{c.admin.fullName || c.admin.email}</span>
                  <span className="text-xs text-muted-foreground">{REASON_LABEL[c.reason ?? ""]}</span>
                  <span className="text-xs text-muted-foreground">{c.lastDay && new Date(c.lastDay).toLocaleDateString("fr-CA")}</span>
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
  const [adminId, setAdminId] = useState("");
  const [reason, setReason] = useState<"resignation" | "termination" | "retirement" | "end_contract">("resignation");
  const [lastDay, setLastDay] = useState(new Date().toISOString().slice(0, 10));
  const [successorId, setSuccessorId] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!adminId) { toast.error("Employé requis"); return; }
    setPending(true);
    const r = await startOffboardingAction({
      adminId: Number(adminId), reason, lastDay,
      successorId: successorId ? Number(successorId) : null,
    });
    setPending(false);
    if (r.success) { toast.success("Offboarding démarré"); onSaved(); onClose(); setAdminId(""); setSuccessorId(""); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader><DialogTitle className="text-base text-white flex items-center gap-2"><LogOut className="h-4 w-4" />Démarrer un offboarding</DialogTitle></DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Employé qui part *</Label>
            <Select value={adminId} onValueChange={setAdminId}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>{candidates.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Motif *</Label>
              <Select value={reason} onValueChange={(v) => setReason(v as "resignation" | "termination" | "retirement" | "end_contract")}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="resignation">Démission</SelectItem>
                  <SelectItem value="termination">Congédiement</SelectItem>
                  <SelectItem value="retirement">Retraite</SelectItem>
                  <SelectItem value="end_contract">Fin de contrat</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Dernier jour *</Label>
              <Input type="date" value={lastDay} onChange={(e) => setLastDay(e.target.value)} />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Successeur</Label>
            <Select value={successorId || "none"} onValueChange={(v) => setSuccessorId(v === "none" ? "" : v)}>
              <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="Aucun" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— Aucun —</SelectItem>
                {candidates.filter((c) => String(c.id) !== adminId).map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Démarrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DetailDialog({ offboard, onClose, onChanged }: { offboard: Offboard | null; onClose: () => void; onChanged: () => void }) {
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
    if (r.success) { toast.success("Sauvegardé"); onChanged(); }
    else toast.error(r.error || "");
  };

  const markRE = async () => {
    const r = await markRecordOfEmploymentSentAction({ adminId: offboard.admin.id });
    if (r.success) { toast.success("Marqué"); onChanged(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={!!offboard} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white">Offboarding · {offboard.admin.fullName || offboard.admin.email}</DialogTitle>
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
                  <span className={`text-sm flex-1 ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.label}</span>
                  {item.done && item.doneAt && (
                    <span className="text-[10px] text-muted-foreground">{new Date(item.doneAt).toLocaleDateString("fr-CA")}</span>
                  )}
                </label>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><FileText className="h-4 w-4" />Entrevue de départ</h3>
            <textarea value={exitNotes} onChange={(e) => setExitNotes(e.target.value)} rows={5} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y" placeholder="Raison de départ, retours sur l'expérience, suggestions…" />
            <Button size="sm" className="mt-2" onClick={saveNotes} disabled={pending}>
              {pending ? "..." : "Enregistrer entrevue"}
            </Button>
          </section>

          <section>
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Calendar className="h-4 w-4" />Relevé d&apos;emploi (RE)</h3>
            {offboard.recordOfEmploymentSentAt ? (
              <Badge variant="outline" className="text-emerald-700 border-emerald-300 bg-emerald-50">
                <CheckCircle2 className="h-3 w-3 mr-1" />Envoyé le {new Date(offboard.recordOfEmploymentSentAt).toLocaleDateString("fr-CA")}
              </Badge>
            ) : (
              <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-xs">
                <p className="font-medium text-amber-900 mb-2"><AlertTriangle className="h-3.5 w-3.5 inline mr-1.5" />Le RE doit être transmis à EDSC dans les 5 jours suivant le dernier jour de travail.</p>
                <Button size="sm" onClick={markRE}>Marquer comme envoyé à EDSC</Button>
              </div>
            )}
          </section>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

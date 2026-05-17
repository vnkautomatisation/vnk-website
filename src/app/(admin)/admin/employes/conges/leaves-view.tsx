"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { promptDialog } from "@/components/admin/prompt-dialog";
import {
  CalendarDays, Plus, CheckCircle2, XCircle, Ban, Sun, Bandage, Baby, Home,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { createLeaveRequestAction, reviewLeaveRequestAction, cancelLeaveRequestAction } from "@/app/actions/hr-leaves";

type Request = {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
  status: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewer?: { fullName: string | null; email: string } | null;
  admin?: { id: number; fullName: string | null; email: string };
};

const TYPE_META: Record<string, { label: string; icon: typeof Sun; color: string }> = {
  vacation: { label: "Vacances", icon: Sun, color: "bg-cyan-100 text-cyan-700" },
  sick: { label: "Maladie", icon: Bandage, color: "bg-red-100 text-red-700" },
  parental: { label: "Parental", icon: Baby, color: "bg-pink-100 text-pink-700" },
  unpaid: { label: "Sans solde", icon: Home, color: "bg-slate-100 text-slate-700" },
  bereavement: { label: "Décès", icon: Home, color: "bg-gray-100 text-gray-700" },
  other: { label: "Autre", icon: CalendarDays, color: "bg-amber-100 text-amber-700" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approuvée", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Refusée", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-600" },
};

export function LeavesView({
  myRequests, pendingReviews, isReviewer,
}: {
  myRequests: Request[];
  pendingReviews: Request[];
  isReviewer: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"my" | "review">("my");
  const [createOpen, setCreateOpen] = useState(false);

  const TABS: TabItem<"my" | "review">[] = [
    { key: "my", label: "Mes demandes", icon: CalendarDays, count: myRequests.length },
    ...(isReviewer ? [{ key: "review" as const, label: "À approuver", icon: CheckCircle2, count: pendingReviews.length }] : []),
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-[#0F2D52]" />Congés
          </h1>
          <p className="text-sm text-muted-foreground">Demandez et gérez vos vacances, maladies et autres absences.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus className="h-4 w-4 mr-1.5" />Nouvelle demande
        </Button>
      </div>

      <SettingsTabs tabs={TABS} active={tab} onChange={setTab} />

      {tab === "my" && (
        <div className="space-y-2">
          {myRequests.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">Aucune demande.</Card>
          ) : (
            myRequests.map((r) => (
              <RequestCard
                key={r.id} request={r} mine
                onCancel={async () => {
                  const res = await cancelLeaveRequestAction({ id: r.id });
                  if (res.success) { toast.success("Annulée"); router.refresh(); }
                  else toast.error(res.error || "");
                }}
              />
            ))
          )}
        </div>
      )}

      {tab === "review" && isReviewer && (
        <div className="space-y-2">
          {pendingReviews.length === 0 ? (
            <Card className="p-10 text-center text-sm text-muted-foreground">Aucune demande en attente.</Card>
          ) : (
            pendingReviews.map((r) => (
              <RequestCard
                key={r.id} request={r} mine={false}
                onReview={async (decision) => {
                  let notes: string | undefined;
                  if (decision === "rejected") {
                    const n = await promptDialog({
                      title: "Refuser la demande de congé",
                      label: "Motif du refus (optionnel)",
                      placeholder: "Ex : période chargée, équipe sous-effectif…",
                      multiline: true,
                      variant: "destructive",
                      confirmLabel: "Refuser",
                    });
                    if (n === null) return; // annulation
                    notes = n.trim() || undefined;
                  }
                  const res = await reviewLeaveRequestAction({ id: r.id, decision, notes });
                  if (res.success) { toast.success(decision === "approved" ? "Approuvée" : "Refusée"); router.refresh(); }
                  else toast.error(res.error || "");
                }}
              />
            ))
          )}
        </div>
      )}

      <CreateLeaveDialog open={createOpen} onClose={() => setCreateOpen(false)} onSaved={() => router.refresh()} />
    </div>
  );
}

function RequestCard({
  request, mine, onCancel, onReview,
}: {
  request: Request;
  mine: boolean;
  onCancel?: () => void;
  onReview?: (decision: "approved" | "rejected") => void;
}) {
  const t = TYPE_META[request.type] ?? TYPE_META.other;
  const s = STATUS_META[request.status] ?? { label: request.status, color: "bg-gray-100 text-gray-700" };
  const Icon = t.icon;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${t.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{t.label}</h3>
            <Badge className={`text-[10px] ${s.color}`}>{s.label}</Badge>
            {!mine && request.admin && (
              <span className="text-xs text-muted-foreground">· {request.admin.fullName || request.admin.email}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Du <strong>{new Date(request.startDate).toLocaleDateString("fr-CA")}</strong>
            {" au "}
            <strong>{new Date(request.endDate).toLocaleDateString("fr-CA")}</strong>
            {" · "}
            {Number(request.daysCount)} jour{Number(request.daysCount) > 1 ? "s" : ""}
          </p>
          {request.reason && <p className="text-xs italic text-muted-foreground mt-1">« {request.reason} »</p>}
          {request.reviewedAt && request.reviewer && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Décidé par {request.reviewer.fullName || request.reviewer.email}
              {request.reviewNotes && ` — ${request.reviewNotes}`}
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {mine && request.status === "pending" && (
            <Button size="sm" variant="outline" className="h-7 text-xs hover:text-destructive" onClick={onCancel}>
              <Ban className="h-3 w-3 mr-1" />Annuler
            </Button>
          )}
          {!mine && request.status === "pending" && onReview && (
            <>
              <Button size="sm" className="h-7 text-xs" onClick={() => onReview("approved")}>
                <CheckCircle2 className="h-3 w-3 mr-1" />Approuver
              </Button>
              <Button size="sm" variant="outline" className="h-7 text-xs hover:text-destructive" onClick={() => onReview("rejected")}>
                <XCircle className="h-3 w-3 mr-1" />Refuser
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function CreateLeaveDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved: () => void }) {
  const [type, setType] = useState<"vacation" | "sick" | "parental" | "unpaid" | "bereavement" | "other">("vacation");
  const [start, setStart] = useState(new Date().toISOString().slice(0, 10));
  const [end, setEnd] = useState(new Date().toISOString().slice(0, 10));
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setPending(true);
    const r = await createLeaveRequestAction({
      type,
      startDate: start,
      endDate: end,
      reason: reason || null,
    });
    setPending(false);
    if (r.success) { toast.success("Demande envoyée"); onSaved(); onClose(); setReason(""); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <CalendarDays className="h-4 w-4" />Demander un congé
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Sera revue par un superviseur. Notification quand traitée.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as "vacation" | "sick" | "parental" | "unpaid" | "bereavement" | "other")}>
              <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Début</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wider font-semibold">Fin</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Motif (optionnel)</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              placeholder="Contexte, urgence, lien…"
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Envoyer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

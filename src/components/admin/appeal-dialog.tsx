"use client";
// Modaux d'appel sur une attribution de fenêtre de vacances :
//   (a) SubmitAppealDialog : un employé soumet un appel
//   (b) ReviewAppealDialog : un admin revoit un appel pending

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  Megaphone,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { submitAppealAction, reviewAppealAction } from "@/app/actions/hr-vacation-appeals";

const MIN_REASON = 10;
const MAX_REASON = 500;

export function SubmitAppealDialog({
  preference,
  open,
  onClose,
  onSubmitted,
}: {
  preference: {
    id: number;
    rank: number;
    startDate: string;
    endDate: string;
    status: string;
    windowName: string;
  };
  open: boolean;
  onClose: () => void;
  onSubmitted: () => void;
}) {
  const tc = useTranslations("common");
  const [reason, setReason] = useState("");
  const [pending, setPending] = useState(false);

  const reasonOk = reason.trim().length >= MIN_REASON && reason.trim().length <= MAX_REASON;

  const submit = async () => {
    if (!reasonOk) {
      toast.error(`Le motif doit faire entre ${MIN_REASON} et ${MAX_REASON} caractères.`);
      return;
    }
    setPending(true);
    const r = await submitAppealAction({
      preferenceId: preference.id,
      reason: reason.trim(),
    });
    setPending(false);
    if (r.success) {
      toast.success("Appel soumis. Les RH seront notifiés.");
      onSubmitted();
    } else {
      toast.error(r.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-md sm:h-auto sm:max-h-[90vh] sm:rounded-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm sm:text-base text-white flex items-center gap-2 pr-8">
              <Megaphone className="h-4 w-4 shrink-0" />
              <span className="truncate">Faire appel de l&apos;attribution</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs">
              {preference.windowName} — Choix #{preference.rank}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-4 sm:p-5 space-y-3 flex-1 overflow-y-auto">
          <div className="rounded-md border bg-muted/30 p-3 text-xs">
            <p>
              Période concernée :{" "}
              <strong>
                {new Date(preference.startDate).toLocaleDateString("fr-CA")} →{" "}
                {new Date(preference.endDate).toLocaleDateString("fr-CA")}
              </strong>
            </p>
            <p className="text-muted-foreground mt-1">
              Statut actuel : <strong>{preference.status}</strong>
            </p>
          </div>
          <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-900 flex gap-2">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <span>
              Expliquez clairement le motif de votre appel (anciennenté, conflit de garde,
              contrainte familiale, etc.). Les RH étudieront votre demande au cas par cas.
            </span>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Motif de l&apos;appel <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))}
              placeholder="Expliquez en détail pourquoi vous souhaitez contester l'attribution..."
              rows={5}
              className="resize-y"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {reason.trim().length}/{MAX_REASON} caractères (min {MIN_REASON})
            </p>
          </div>
        </div>
        <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={submit}
            disabled={pending || !reasonOk}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Soumettre l'appel"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ReviewAppealDialog({
  appeal,
  open,
  onClose,
  onReviewed,
}: {
  appeal: {
    preferenceId: number;
    employeeName: string;
    reason: string;
    prefDetails: string;
  };
  open: boolean;
  onClose: () => void;
  onReviewed: () => void;
}) {
  const tc = useTranslations("common");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<"approved" | "rejected" | null>(null);

  const review = async (decision: "approved" | "rejected") => {
    if (decision === "rejected" && notes.trim().length < 5) {
      toast.error("Veuillez justifier le refus dans les notes.");
      return;
    }
    setPending(decision);
    const r = await reviewAppealAction({
      preferenceId: appeal.preferenceId,
      decision,
      notes: notes.trim() || undefined,
    });
    setPending(null);
    if (r.success) {
      toast.success(decision === "approved" ? "Appel accordé" : "Appel refusé");
      onReviewed();
    } else {
      toast.error(r.error);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm sm:text-base text-white flex items-center gap-2 pr-8">
              <Megaphone className="h-4 w-4 shrink-0" />
              <span className="truncate">Revoir un appel</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs">
              {appeal.employeeName}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-4 sm:p-5 space-y-3 flex-1 overflow-y-auto">
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Préférence concernée
            </Label>
            <div className="rounded-md border bg-muted/30 p-3 text-xs">{appeal.prefDetails}</div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Motif invoqué par l&apos;employé
            </Label>
            <div className="rounded-md border bg-amber-50 border-amber-200 p-3 text-xs whitespace-pre-wrap text-amber-900">
              {appeal.reason}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">
              Notes administratives (obligatoires en cas de refus)
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value.slice(0, 500))}
              placeholder="Justification de la décision, contexte interne..."
              rows={4}
              className="resize-y"
            />
            <p className="text-[10px] text-muted-foreground text-right">
              {notes.trim().length}/500 caractères
            </p>
          </div>
        </div>
        <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          <Button variant="outline" onClick={onClose} disabled={pending !== null}>
            {tc("cancel")}
          </Button>
          <div className="hidden sm:block flex-1" />
          <Button
            variant="outline"
            onClick={() => review("rejected")}
            disabled={pending !== null}
            className="border-destructive/30 text-destructive hover:bg-destructive/10"
          >
            {pending === "rejected" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Refuser
              </>
            )}
          </Button>
          <Button
            onClick={() => review("approved")}
            disabled={pending !== null}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {pending === "approved" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Approuver
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

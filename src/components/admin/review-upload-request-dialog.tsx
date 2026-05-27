"use client";
// ─────────────────────────────────────────────────────────
// ReviewUploadRequestDialog — l'admin RH valide ou rejette
// un document téléversé par un employé en réponse à une demande.
//
// Affiche : entête (demande + employé + date d'upload),
// preview du fichier (PdfPreviewModal si PDF, sinon image inline),
// 2 actions : Approuver (notes optionnelles + checkbox création doc officiel)
//             Rejeter (motif obligatoire).
// ─────────────────────────────────────────────────────────
import { useState } from "react";
import { toast } from "sonner";
import {
  CheckCircle2,
  XCircle,
  FileText,
  User,
  CalendarClock,
  Loader2,
  Eye,
  Download,
  ShieldCheck,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { FormSection } from "@/components/admin/form-section";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import {
  approveUploadRequestAction,
  rejectUploadRequestAction,
} from "@/app/actions/hr-document-requests";

export type ReviewableRequest = {
  id: number;
  title: string;
  description: string | null;
  category: string;
  isRequired: boolean;
  dueDate: string | null;
  uploadedAt: string | null;
  fileName: string | null;
  fileMimeType: string | null;
  targetAdmin: { id: number; fullName: string | null; email: string };
};

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "-";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" });
}

const CATEGORY_LABELS: Record<string, string> = {
  licence: "Licence / Permis",
  diploma: "Diplôme",
  certification: "Certification",
  id_card: "Carte d'identité",
  passport: "Passeport",
  medical: "Document médical",
  other: "Autre",
};

export function ReviewUploadRequestDialog({
  open,
  onClose,
  onReviewed,
  request,
}: {
  open: boolean;
  onClose: () => void;
  onReviewed: () => void;
  request: ReviewableRequest | null;
}) {
  const [mode, setMode] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");
  const [alsoCreate, setAlsoCreate] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  if (!request) return null;

  const fileUrl = `/api/admin/document-upload-requests/${request.id}/file`;
  const isImage = request.fileMimeType?.startsWith("image/") ?? false;
  const isPdf = request.fileMimeType === "application/pdf";

  const reset = () => {
    setMode("approve");
    setNotes("");
    setAlsoCreate(true);
    setSubmitting(false);
  };

  const handleClose = () => {
    if (submitting) return;
    reset();
    onClose();
  };

  const submit = async () => {
    if (mode === "reject" && !notes.trim()) {
      toast.error("Le motif est requis pour rejeter");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "approve") {
        const r = await approveUploadRequestAction(request.id, {
          notes: notes.trim() || null,
          alsoCreatePersonalDoc: alsoCreate,
        });
        if (r.success) {
          toast.success(
            alsoCreate
              ? "Document approuvé et ajouté au dossier officiel"
              : "Document approuvé",
          );
          onReviewed();
          reset();
          onClose();
        } else {
          toast.error(r.error || "");
        }
      } else {
        const r = await rejectUploadRequestAction(request.id, notes.trim());
        if (r.success) {
          toast.success("Document refusé — l'employé a été notifié");
          onReviewed();
          reset();
          onClose();
        } else {
          toast.error(r.error || "");
        }
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && handleClose()}>
        <DialogContent className="max-w-2xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
          {/* Header navy */}
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <ShieldCheck className="h-4 w-4" />
                Validation du document
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                {request.title} — {CATEGORY_LABELS[request.category] ?? request.category}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 text-white border border-white/30">
                <User className="h-2.5 w-2.5" />
                {request.targetAdmin.fullName ?? request.targetAdmin.email}
              </span>
              {request.uploadedAt && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/15 text-white border border-white/30">
                  <CalendarClock className="h-2.5 w-2.5" />
                  Téléversé le {formatDate(request.uploadedAt)}
                </span>
              )}
              {request.isRequired && (
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-500/20 text-red-100 border border-red-300/40 font-semibold">
                  Obligatoire
                </span>
              )}
            </div>
          </div>

          {/* Body */}
          <div className="p-5 space-y-5 overflow-y-auto flex-1">
            {/* Preview du fichier */}
            <FormSection icon={FileText} title="Fichier téléversé">
              <div className="rounded-md border bg-muted/10 p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      {request.fileName ?? "document"}
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {request.fileMimeType ?? "type inconnu"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isPdf && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewOpen(true)}
                        className="h-8 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Aperçu
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(fileUrl, "_blank", "noopener,noreferrer")}
                      className="h-8 text-xs"
                    >
                      <Download className="h-3.5 w-3.5 mr-1" />
                      Télécharger
                    </Button>
                  </div>
                </div>

                {isImage && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={fileUrl}
                    alt={request.fileName ?? "preview"}
                    className="max-h-96 w-auto mx-auto rounded border bg-white"
                  />
                )}
                {!isImage && !isPdf && (
                  <p className="text-[11px] text-muted-foreground italic">
                    Aperçu non disponible pour ce type de fichier — utilisez Télécharger.
                  </p>
                )}
              </div>
            </FormSection>

            {/* Choix de l'action */}
            <FormSection icon={ShieldCheck} title="Décision">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMode("approve")}
                  className={`rounded-md border p-3 text-left transition ${
                    mode === "approve"
                      ? "border-emerald-500 bg-emerald-50 ring-1 ring-emerald-200"
                      : "border-input bg-card hover:border-emerald-300 hover:bg-emerald-50/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <CheckCircle2
                      className={`h-4 w-4 ${
                        mode === "approve" ? "text-emerald-700" : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-sm font-semibold ${
                        mode === "approve" ? "text-emerald-800" : "text-foreground"
                      }`}
                    >
                      Approuver
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    Le document est conforme — l'ajoute au dossier officiel.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() => setMode("reject")}
                  className={`rounded-md border p-3 text-left transition ${
                    mode === "reject"
                      ? "border-red-500 bg-red-50 ring-1 ring-red-200"
                      : "border-input bg-card hover:border-red-300 hover:bg-red-50/40"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <XCircle
                      className={`h-4 w-4 ${
                        mode === "reject" ? "text-red-700" : "text-muted-foreground"
                      }`}
                    />
                    <span
                      className={`text-sm font-semibold ${
                        mode === "reject" ? "text-red-800" : "text-foreground"
                      }`}
                    >
                      Rejeter
                    </span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
                    L'employé pourra re-téléverser après correction.
                  </p>
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-medium text-muted-foreground">
                  {mode === "approve" ? "Notes (optionnel)" : "Motif du rejet (obligatoire)"}
                </label>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={
                    mode === "approve"
                      ? "Ex : Document conforme, archivé au dossier."
                      : "Ex : Le document est illisible, merci de scanner à nouveau."
                  }
                  rows={3}
                  maxLength={1000}
                  className="text-sm resize-y"
                />
              </div>

              {mode === "approve" && (
                <label className="flex items-start gap-2 p-3 rounded-md border bg-muted/10 cursor-pointer hover:bg-muted/20 transition">
                  <Checkbox
                    checked={alsoCreate}
                    onCheckedChange={(v) => setAlsoCreate(v === true)}
                    className="mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium">
                      Créer un document personnel officiel
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      Ajoute une entrée dans le dossier personnel de l'employé, marquée
                      vérifiée par les RH.
                    </p>
                  </div>
                </label>
              )}
            </FormSection>
          </div>

          {/* Footer sticky */}
          <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
            <Button
              type="button"
              variant="outline"
              onClick={handleClose}
              disabled={submitting}
            >
              Annuler
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={submitting || (mode === "reject" && !notes.trim())}
              className={
                mode === "approve"
                  ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                  : "bg-red-600 hover:bg-red-700 text-white"
              }
            >
              {submitting ? (
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
              ) : mode === "approve" ? (
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              ) : (
                <XCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              {mode === "approve" ? "Approuver" : "Rejeter"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <PdfPreviewModal
        open={previewOpen}
        url={previewOpen ? fileUrl : null}
        title={request.title}
        description={request.fileName ?? undefined}
        downloadFilename={request.fileName ?? `document-${request.id}.pdf`}
        onClose={() => setPreviewOpen(false)}
      />
    </>
  );
}

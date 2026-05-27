"use client";
// ─────────────────────────────────────────────────────────
// SignaturePadDialog — Dialog responsive de signature / accusé
// de lecture d'un document.
//
// Workflow Docusign-like :
//   1. Aperçu "PDF-like" avec variables {{...}} résolues côté serveur
//      (via GET /api/admin/document-templates/[id]/resolved)
//   2. Cases à cocher `- [ ]` interactives via <InteractiveDocumentView>
//   3. Bandeau progression "Vous devez cocher X/Y cases obligatoires"
//   4. Checkbox "J'ai lu" + SignaturePad DÉSACTIVÉS tant que toutes
//      les cases ne sont pas cochées
//   5. États des cases persistés avec la signature (checkboxStates)
//
// Mode "reading_only" (Bug 2) :
//   - Pas de signature pad (juste l'accusé de lecture).
//   - Bouton final : "Confirmer la lecture".
//   - canSubmit ne dépend que de l'accusé + cases cochées.
//   - onSigned reçoit signatureDataUrl = "" (vide).
//
// La signature dataURL + checkboxStates sont renvoyés via
// onSigned(signatureDataUrl, checkboxStates).
// ─────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import {
  FileSignature,
  Loader2,
  Eraser,
  CheckCircle2,
  AlertCircle,
  BookOpen,
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
import { InteractiveDocumentView } from "@/components/admin/interactive-document-view";
import type {
  CheckboxStates,
  SignatureScope,
} from "@/components/admin/interactive-document-view-types";
import { SignaturePad } from "@/app/(admin)/admin/employes/contrats/signature-pad";

export type SignaturePadDialogDoc = {
  /** Identifiant du template (utilisé pour fetch les variables résolues). */
  templateId?: number;
  /** Titre affiché dans le header navy. */
  title: string;
  /** Version (ex: "1.2") affichée discrètement à côté du titre. */
  version?: string;
  /** Corps markdown brut (avec {{vars}} non résolues) — fallback. */
  bodyMarkdown: string;
  /** Si déjà résolu côté parent, on saute le fetch. */
  resolvedMarkdown?: string;
  /** Sous-titre optionnel (catégorie, dueDate…). */
  subtitle?: string;
  /**
   * Defaut "employee_only". Determine quel(s) bloc(s) Signature sont rendus
   * dans l'apercu. Synchronise avec le scope sauvegarde sur le template.
   */
  signatureScope?: SignatureScope;
  /**
   * Mode d'engagement. "reading_only" masque le pad signature (juste accusé
   * de lecture). Defaut "signature" pour compat ascendante.
   */
  acknowledgmentMode?: "reading_only" | "signature";
};

export function SignaturePadDialog({
  open,
  doc,
  onClose,
  onSigned,
  requireAcknowledgment = true,
  acknowledgmentLabel,
}: {
  open: boolean;
  doc: SignaturePadDialogDoc | null;
  onClose: () => void;
  /**
   * Callback déclenché à la soumission.
   * Reçoit le dataURL PNG de la signature (vide en mode reading_only)
   * + l'état des cases cochées.
   */
  onSigned: (
    signatureDataUrl: string,
    checkboxStates: CheckboxStates,
  ) => Promise<void> | void;
  requireAcknowledgment?: boolean;
  acknowledgmentLabel?: string;
}) {
  const [signatureData, setSignatureData] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, setPending] = useState(false);
  // Reset interne au clear : on remonte le pad pour repartir d'un canvas vierge
  const [padKey, setPadKey] = useState(0);

  // ─── État cases à cocher ───
  const [checkboxStates, setCheckboxStates] = useState<CheckboxStates>({});
  const [totalCheckboxes, setTotalCheckboxes] = useState(0);
  const [checkedCount, setCheckedCount] = useState(0);
  const allChecked = totalCheckboxes === 0 || checkedCount === totalCheckboxes;

  // ─── Fetch du markdown résolu côté serveur ───
  const [resolvedMd, setResolvedMd] = useState<string | null>(null);
  const [loadingResolved, setLoadingResolved] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  // Reset état à chaque (ré)ouverture
  useEffect(() => {
    if (open) {
      setSignatureData(null);
      setAcknowledged(false);
      setPending(false);
      setPadKey((k) => k + 1);
      setCheckboxStates({});
      setTotalCheckboxes(0);
      setCheckedCount(0);
      setResolvedMd(null);
      setResolveError(null);
    }
  }, [open, doc?.title]);

  // Fetch resolved markdown quand le dialog s'ouvre
  useEffect(() => {
    if (!open || !doc) return;
    // Si le parent a déjà fourni le markdown résolu, pas de fetch
    if (doc.resolvedMarkdown) {
      setResolvedMd(doc.resolvedMarkdown);
      return;
    }
    if (!doc.templateId) {
      // Pas de templateId => on tombe en mode "markdown brut" avec warning silencieux
      setResolvedMd(doc.bodyMarkdown);
      return;
    }
    let aborted = false;
    setLoadingResolved(true);
    setResolveError(null);
    fetch(`/api/admin/document-templates/${doc.templateId}/resolved`, {
      method: "GET",
      credentials: "include",
    })
      .then(async (r) => {
        if (!r.ok) throw new Error(await r.text().catch(() => "HTTP " + r.status));
        return r.json() as Promise<{ resolvedMarkdown: string }>;
      })
      .then((data) => {
        if (aborted) return;
        setResolvedMd(data.resolvedMarkdown ?? doc.bodyMarkdown);
      })
      .catch((err: unknown) => {
        if (aborted) return;
        console.warn("[SignaturePadDialog] Résolution variables échouée :", err);
        setResolveError("Impossible de résoudre les variables — affichage du modèle brut.");
        setResolvedMd(doc.bodyMarkdown);
      })
      .finally(() => {
        if (!aborted) setLoadingResolved(false);
      });
    return () => {
      aborted = true;
    };
  }, [open, doc]);

  if (!doc) return null;

  const isReadingOnly = doc.acknowledgmentMode === "reading_only";

  // Label par defaut adapte au mode
  const effectiveAckLabel =
    acknowledgmentLabel ??
    (isReadingOnly
      ? "J'ai lu et compris intégralement le document ci-dessus."
      : "J'ai lu intégralement le document ci-dessus et j'accepte ses termes en toute connaissance de cause.");

  const canSubmit = isReadingOnly
    ? // Mode lecture seule : pas besoin de signature pad, juste accusé + cases
      (!requireAcknowledgment || acknowledged) && allChecked && !pending
    : // Mode signature : signatureData + accusé + cases requises
      !!signatureData &&
      (!requireAcknowledgment || acknowledged) &&
      allChecked &&
      !pending;

  const submit = async () => {
    if (isReadingOnly) {
      // signatureData = "" en mode lecture seule
      setPending(true);
      try {
        await onSigned("", checkboxStates);
      } finally {
        setPending(false);
      }
      return;
    }
    if (!signatureData) return;
    setPending(true);
    try {
      await onSigned(signatureData, checkboxStates);
    } finally {
      setPending(false);
    }
  };

  const clear = () => {
    setSignatureData(null);
    setPadKey((k) => k + 1);
  };

  const HeaderIcon = isReadingOnly ? BookOpen : FileSignature;
  const SubmitIcon = isReadingOnly ? BookOpen : FileSignature;
  const submitLabel = isReadingOnly
    ? "Confirmer la lecture"
    : "Confirmer ma signature";

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      {/* Fullscreen mobile, max-w-3xl desktop (plus large pour confort de lecture) */}
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-3xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg">
        {/* Header navy */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-sm sm:text-base flex items-center gap-2 pr-8">
              <HeaderIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{doc.title}</span>
              {doc.version && (
                <span className="text-white/70 text-xs font-normal">v{doc.version}</span>
              )}
            </DialogTitle>
            {doc.subtitle && (
              <DialogDescription className="text-white/80 text-[11px] sm:text-xs truncate">
                {doc.subtitle}
              </DialogDescription>
            )}
          </DialogHeader>
        </div>

        {/* Body : lecture + accusé + pad */}
        <div className="p-4 sm:p-5 space-y-3 overflow-y-auto flex-1 bg-slate-100">
          {/* Aperçu document — feuille A4 sur table */}
          <div className="max-h-[55vh] overflow-y-auto">
            {loadingResolved ? (
              <div className="rounded-md border bg-white p-10 text-center text-sm text-muted-foreground space-y-3">
                <Loader2 className="h-6 w-6 mx-auto animate-spin text-[#0F2D52]" />
                <p>Chargement de l&apos;aperçu…</p>
              </div>
            ) : (
              <InteractiveDocumentView
                bodyMarkdown={doc.bodyMarkdown}
                resolvedMarkdown={resolvedMd ?? undefined}
                title={doc.title}
                version={doc.version}
                signatureScope={
                  isReadingOnly ? "none" : (doc.signatureScope ?? "employee_only")
                }
                onCheckboxChange={(states, meta) => {
                  setCheckboxStates(states);
                  setTotalCheckboxes(meta.totalCount);
                  setCheckedCount(meta.checkedCount);
                }}
              />
            )}
          </div>

          {resolveError && (
            <div className="rounded-md border border-amber-300 bg-amber-50 text-amber-900 text-[11px] px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{resolveError}</span>
            </div>
          )}

          {/* Bandeau progression cases obligatoires */}
          {totalCheckboxes > 0 && (
            <div
              className={`rounded-md border px-3 py-2.5 flex items-center gap-2 text-xs font-semibold ${
                allChecked
                  ? "border-emerald-300 bg-emerald-50 text-emerald-900"
                  : "border-amber-300 bg-amber-50 text-amber-900"
              }`}
            >
              {allChecked ? (
                <CheckCircle2 className="h-4 w-4 text-emerald-700 shrink-0" />
              ) : (
                <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
              )}
              <span className="flex-1">
                {allChecked
                  ? "Toutes les cases obligatoires sont cochées."
                  : `Vous devez compléter ${checkedCount}/${totalCheckboxes} case${
                      totalCheckboxes > 1 ? "s" : ""
                    } obligatoire${totalCheckboxes > 1 ? "s" : ""} avant de ${
                      isReadingOnly ? "confirmer" : "signer"
                    }.`}
              </span>
              <span className="text-[10px] font-bold tabular-nums px-1.5 py-0.5 rounded bg-white/60 border border-current/30">
                {checkedCount}/{totalCheckboxes}
              </span>
            </div>
          )}

          {requireAcknowledgment && (
            <label
              className={`flex items-start gap-2 text-xs p-3 rounded-md border transition ${
                !allChecked
                  ? "bg-muted/10 opacity-50 cursor-not-allowed"
                  : "bg-muted/10 hover:bg-muted/20 cursor-pointer"
              }`}
            >
              <input
                type="checkbox"
                checked={acknowledged}
                disabled={!allChecked}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-input shrink-0 accent-[#0F2D52] disabled:cursor-not-allowed"
              />
              <span>{effectiveAckLabel}</span>
            </label>
          )}

          {/* Pad signature : masque en mode reading_only */}
          {!isReadingOnly && (
            <div className={`space-y-1.5 ${!allChecked ? "opacity-50 pointer-events-none" : ""}`}>
              <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                Votre signature
              </p>
              <SignaturePad key={padKey} onChange={setSignatureData} />
              {!allChecked && (
                <p className="text-[10px] text-amber-700 italic">
                  Cochez toutes les cases obligatoires pour activer la zone de signature.
                </p>
              )}
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          {/* Bouton Effacer : masque en mode reading_only (pas de pad a effacer) */}
          {!isReadingOnly && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={clear}
              disabled={pending || !signatureData}
            >
              <Eraser className="h-3.5 w-3.5 mr-1.5" />
              Effacer
            </Button>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClose}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={submit}
            disabled={!canSubmit}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <SubmitIcon className="h-3.5 w-3.5 mr-1.5" />
            )}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

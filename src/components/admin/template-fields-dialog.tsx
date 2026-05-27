"use client";
// ─────────────────────────────────────────────────────────
// TemplateFieldsDialog — saisie des champs `[CHAMP]` libres
// d'un template AVANT d'envoyer une demande de signature.
//
// Ces champs sont detectes via `detectPlaceholders` (patterns
// `[TEXTE EN MAJUSCULES]`, `[Fait N - desc]`, etc.) et doivent
// etre remplis par le RH au moment ou il cree la demande. Les
// valeurs sont ensuite stockees dans `customFieldValues` de la
// `DocumentSignatureRequest`, puis substituees dans le markdown
// au rendu du PDF / de l'apercu.
//
// Theme VNK : header navy gradient, FormSection, footer sticky.
// Validation : tous les champs sont requis (par defaut).
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { ListChecks, Loader2, Send, Sparkles, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection, Field } from "@/components/admin/form-section";
import { detectPlaceholders } from "@/lib/document-templates/placeholder-detector";

export interface TemplateFieldsDialogProps {
  open: boolean;
  /** Titre du template (affiche dans le header navy). */
  templateTitle: string;
  /** Identifiant du template (pour referencement parent — non utilise ici). */
  templateId?: number;
  /** Markdown brut du template — sert a detecter les `[CHAMP]`. */
  bodyMarkdown: string;
  /** Valeurs deja saisies (mode edition d'une demande existante). */
  initialValues?: Record<string, string>;
  onClose: () => void;
  /** Appele a la confirmation : reçoit `{ [KEY]: value }`. */
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

export function TemplateFieldsDialog({
  open,
  templateTitle,
  templateId: _templateId,
  bodyMarkdown,
  initialValues,
  onClose,
  onSubmit,
}: TemplateFieldsDialogProps) {
  void _templateId;
  const placeholders = useMemo(
    () => detectPlaceholders(bodyMarkdown),
    [bodyMarkdown],
  );

  const [values, setValues] = useState<Record<string, string>>(
    () => initialValues ?? {},
  );
  const [pending, setPending] = useState(false);

  // Reset les valeurs a chaque ouverture (sinon on garde le dernier etat
  // d'une demande precedente avec une cle differente).
  useEffect(() => {
    if (!open) return;
    setValues(initialValues ?? {});
    setPending(false);
  }, [open, initialValues, bodyMarkdown]);

  const allFilled = useMemo(() => {
    if (placeholders.length === 0) return true;
    return placeholders.every((k) => {
      const v = values[k];
      return typeof v === "string" && v.trim().length > 0;
    });
  }, [placeholders, values]);

  const handleSubmit = async () => {
    if (!allFilled || pending) return;
    // Normalise : trim chaque valeur et ne garde que les keys connues
    const cleaned: Record<string, string> = {};
    for (const key of placeholders) {
      const v = values[key];
      cleaned[key] = typeof v === "string" ? v.trim() : "";
    }
    setPending(true);
    try {
      await onSubmit(cleaned);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
        {/* Header navy gradient VNK */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <ListChecks className="h-4 w-4" />
              Completer les champs avant envoi
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {templateTitle} — remplissez les champs ci-dessous. Ils
              remplaceront automatiquement les `[CHAMP]` du document final.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4 overflow-y-auto flex-1">
          {placeholders.length === 0 ? (
            <div className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-4 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="text-[12px] text-emerald-900 leading-snug">
                <p className="font-semibold">
                  Aucun champ libre detecte dans ce template.
                </p>
                <p className="text-emerald-800/80 mt-0.5">
                  Toutes les variables sont resolues automatiquement a partir
                  du profil de l&apos;employe. Vous pouvez continuer directement.
                </p>
              </div>
            </div>
          ) : (
            <FormSection
              icon={ListChecks}
              title={`Champs a completer (${placeholders.length})`}
              description="Ces champs sont detectes dans le markdown du template. Chaque valeur sera substituee automatiquement au moment du rendu du PDF."
            >
              <div className="grid grid-cols-1 gap-3">
                {placeholders.map((key) => (
                  <Field key={key} label={key} required>
                    <Input
                      value={values[key] ?? ""}
                      onChange={(e) =>
                        setValues((prev) => ({ ...prev, [key]: e.target.value }))
                      }
                      placeholder={`Saisir « ${key} »...`}
                      className="text-sm"
                    />
                  </Field>
                ))}
              </div>
            </FormSection>
          )}

          {placeholders.length > 0 && (
            <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
              <Sparkles className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
              <div className="text-[11px] text-amber-900 leading-snug">
                <p>
                  <span className="font-semibold">Astuce :</span> ces champs
                  apparaissent comme <code className="px-1 py-0.5 rounded bg-amber-100 border border-amber-300">[NOM]</code> dans le template.
                  Si vous laissez un champ vide, l&apos;ancre restera visible
                  dans le PDF — ce qui peut etre indesirable pour un document
                  signe.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={pending}
          >
            <X className="h-3.5 w-3.5 mr-1.5" />
            Annuler
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!allFilled || pending}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            Continuer
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

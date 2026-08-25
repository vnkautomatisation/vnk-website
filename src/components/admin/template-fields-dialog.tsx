"use client";
// ─────────────────────────────────────────────────────────
// TemplateFieldsDialog — saisie des champs `[CHAMP]` du template
// AVANT d'envoyer une demande de signature. Pattern epure et pro :
//
//   - Header navy compact avec le titre du template
//   - Section "Obligatoires" en haut (champs requis) + section
//     "Facultatifs" en bas (Fait 2, Fait 3, "si applicable"...)
//   - Date picker natif pour les champs de type "date"
//   - Champs detectes comme "employee" (numero de membre OIQ/CPA...)
//     -> bandeau informatif "rempli par l'employe a la signature"
//   - Auto-cleanup serveur : un champ optionnel laisse vide voit sa
//     ligne entiere supprimee du PDF final (cf. applyPlaceholderValues)
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  FileText,
  Hash,
  ListChecks,
  Loader2,
  MessageSquare,
  Send,
  UserCircle,
  X,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DatePopover } from "@/components/admin/date-popover";
import {
  detectPlaceholdersWithInfo,
  type PlaceholderInfo,
} from "@/lib/document-templates/placeholder-detector";
import { isLongFormTemplate } from "@/lib/document-templates/fill-field-parser";
import { LongFormWizard } from "@/components/admin/long-form-wizard";

export interface TemplateFieldsDialogProps {
  open: boolean;
  templateTitle: string;
  templateId?: number;
  bodyMarkdown: string;
  initialValues?: Record<string, string>;
  onClose: () => void;
  /** Recoit `{ [KEY]: value }` ; les optionnels non remplis = chaine vide ""
   *  (le serveur les substitue par vide ET supprime leur ligne markdown). */
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

// ─── Helpers ──────────────────────────────────────────────────────

function iconFor(type: PlaceholderInfo["type"]) {
  if (type === "date") return CalendarDays;
  if (type === "fact") return FileText;
  if (type === "subject") return MessageSquare;
  if (type === "number") return Hash;
  return FileText;
}

// Convertit la valeur d'un input date YYYY-MM-DD en format FR pour le PDF
function isoToFr(iso: string): string {
  if (!iso) return "";
  // input type=date envoie YYYY-MM-DD
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return iso;
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("fr-CA", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Affiche la valeur stockee dans un format compatible <input type=date> (YYYY-MM-DD)
function frToIso(fr: string): string {
  if (!fr) return "";
  // Deja ISO ?
  if (/^\d{4}-\d{2}-\d{2}$/.test(fr)) return fr;
  // Tentative parse FR : "27 mai 2026"
  const months: Record<string, number> = {
    janvier: 1, février: 2, fevrier: 2, mars: 3, avril: 4, mai: 5,
    juin: 6, juillet: 7, août: 8, aout: 8, septembre: 9, octobre: 10,
    novembre: 11, décembre: 12, decembre: 12,
  };
  const m = fr.toLowerCase().match(/(\d{1,2})\s+([a-zûéè]+)\s+(\d{4})/);
  if (m) {
    const day = Number(m[1]);
    const mon = months[m[2]];
    const yr = Number(m[3]);
    if (mon) {
      return `${yr}-${String(mon).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    }
  }
  return "";
}

// ─── Composant ────────────────────────────────────────────────────

/**
 * Dispatcher : choisit entre LongFormWizard (templates avec 5+ `_____`)
 * et TemplatePlaceholderFieldsDialog (templates avec {{placeholders}}).
 * Garantit un nombre stable de hooks dans chaque branche.
 */
export function TemplateFieldsDialog(props: TemplateFieldsDialogProps) {
  const useLongForm = isLongFormTemplate(props.bodyMarkdown);
  if (useLongForm) {
    return (
      <LongFormWizard
        open={props.open}
        templateTitle={props.templateTitle}
        bodyMarkdown={props.bodyMarkdown}
        initialValues={props.initialValues}
        onClose={props.onClose}
        onSubmit={props.onSubmit}
      />
    );
  }
  return <TemplatePlaceholderFieldsDialog {...props} />;
}

function TemplatePlaceholderFieldsDialog({
  open,
  templateTitle,
  templateId: _templateId,
  bodyMarkdown,
  initialValues,
  onClose,
  onSubmit,
}: TemplateFieldsDialogProps) {
  void _templateId;

  const allPlaceholders = useMemo(
    () => detectPlaceholdersWithInfo(bodyMarkdown),
    [bodyMarkdown],
  );

  // Repartition : champs RH (obligatoires + optionnels) vs employe
  const hrFields = useMemo(
    () => allPlaceholders.filter((p) => p.fillBy === "hr"),
    [allPlaceholders],
  );
  const requiredFields = useMemo(
    () => hrFields.filter((p) => p.required),
    [hrFields],
  );
  const optionalFields = useMemo(
    () => hrFields.filter((p) => !p.required),
    [hrFields],
  );
  const employeeFields = useMemo(
    () => allPlaceholders.filter((p) => p.fillBy === "employee"),
    [allPlaceholders],
  );

  const [values, setValues] = useState<Record<string, string>>(
    () => initialValues ?? {},
  );
  const [pending, setPending] = useState(false);

  // Reset a chaque ouverture
  useEffect(() => {
    if (!open) return;
    setValues(initialValues ?? {});
    setPending(false);
  }, [open, initialValues, bodyMarkdown]);

  // Seuls les champs obligatoires bloquent l'envoi
  const allRequiredFilled = useMemo(() => {
    if (requiredFields.length === 0) return true;
    return requiredFields.every((p) => {
      const v = values[p.key];
      return typeof v === "string" && v.trim().length > 0;
    });
  }, [requiredFields, values]);

  const handleSubmit = async () => {
    if (!allRequiredFilled || pending) return;
    const cleaned: Record<string, string> = {};
    // Champs obligatoires : trim, jamais vide
    for (const p of requiredFields) {
      const raw = values[p.key];
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      // Date FR formatting si type date
      cleaned[p.key] = p.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? isoToFr(trimmed)
        : trimmed;
    }
    // Champs optionnels : envoie aussi les vides en `""` -> serveur strippera
    // la ligne markdown correspondante (Fait 2 non rempli -> ligne retiree)
    for (const p of optionalFields) {
      const raw = values[p.key];
      const trimmed = typeof raw === "string" ? raw.trim() : "";
      cleaned[p.key] = p.type === "date" && /^\d{4}-\d{2}-\d{2}$/.test(trimmed)
        ? isoToFr(trimmed)
        : trimmed; // "" pour les non remplis
    }
    setPending(true);
    try {
      await onSubmit(cleaned);
    } finally {
      setPending(false);
    }
  };

  // ─── Rendu d'un champ (input + label compact, sans verbosite) ───
  const renderField = (p: PlaceholderInfo, opts: { showOptionalBadge: boolean }) => {
    const Icon = iconFor(p.type);
    const isDate = p.type === "date";
    return (
      <div key={p.key} className="space-y-1">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-[#0F2D52]">
          <Icon className="h-3.5 w-3.5 shrink-0" />
          <span className="flex-1 min-w-0 truncate">{p.label}</span>
          {p.required ? (
            <span className="text-red-500 shrink-0">*</span>
          ) : opts.showOptionalBadge ? (
            <span className="text-[9.5px] uppercase tracking-wide text-muted-foreground font-normal shrink-0">
              facultatif
            </span>
          ) : null}
        </label>
        {isDate ? (
          <DatePopover
            value={frToIso(values[p.key] ?? "")}
            onChange={(iso) =>
              setValues((prev) => ({ ...prev, [p.key]: iso }))
            }
            className="w-full"
          />
        ) : p.type === "fact" || p.type === "subject" ? (
          // Textarea auto-extensible pour les champs texte longs (faits,
          // sujets) — le RH peut decrire un fait complet sur plusieurs lignes.
          <Textarea
            value={values[p.key] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [p.key]: e.target.value }))
            }
            placeholder={p.inputPlaceholder}
            rows={p.type === "fact" ? 3 : 2}
            className="text-sm resize-y min-h-[60px]"
          />
        ) : (
          <Input
            value={values[p.key] ?? ""}
            onChange={(e) =>
              setValues((prev) => ({ ...prev, [p.key]: e.target.value }))
            }
            placeholder={p.inputPlaceholder}
            className="text-sm h-9"
          />
        )}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-xl sm:h-auto sm:max-h-[88vh] sm:rounded-lg"
        aria-describedby={undefined}
      >
        {/* Header navy compact */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-3 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-sm text-white flex items-center gap-2 pr-8">
              <ListChecks className="h-4 w-4 shrink-0" />
              <span className="truncate">{templateTitle}</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {hrFields.length === 0 && employeeFields.length === 0 ? (
            <div className="flex items-center gap-2 text-[13px] text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>Aucun champ à compléter.</span>
            </div>
          ) : (
            <>
              {/* ── Section : champs obligatoires ── */}
              {requiredFields.length > 0 && (
                <div className="space-y-3">
                  {requiredFields.length > 0 && (optionalFields.length > 0 || employeeFields.length > 0) && (
                    <p className="text-[10px] uppercase tracking-wider font-semibold text-[#0F2D52]/70">
                      À renseigner
                    </p>
                  )}
                  {requiredFields.map((p) => renderField(p, { showOptionalBadge: false }))}
                </div>
              )}

              {/* ── Section : champs facultatifs ── */}
              {optionalFields.length > 0 && (
                <div className="space-y-3 pt-1">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-slate-500">
                    Facultatif <span className="font-normal normal-case text-slate-400">(laisser vide pour retirer du document)</span>
                  </p>
                  {optionalFields.map((p) => renderField(p, { showOptionalBadge: true }))}
                </div>
              )}

              {/* ── Bandeau : champs remplis par l'employe ── */}
              {employeeFields.length > 0 && (
                <div className="rounded-md border border-[#0F2D52]/15 bg-[#0F2D52]/5 px-3 py-2.5 flex items-start gap-2">
                  <UserCircle className="h-4 w-4 text-[#0F2D52] mt-0.5 shrink-0" />
                  <div className="text-[11.5px] text-[#0F2D52] leading-snug">
                    <span className="font-semibold">
                      {employeeFields.length === 1 ? "1 champ" : `${employeeFields.length} champs`} sera rempli par l&apos;employé
                    </span>
                    <span className="block text-[10.5px] text-[#0F2D52]/75 mt-0.5">
                      {employeeFields.map((p) => p.label).join(" · ")}
                    </span>
                  </div>
                </div>
              )}

              {requiredFields.length === 0 && optionalFields.length === 0 && employeeFields.length > 0 && (
                <div className="flex items-center gap-2 text-[13px] text-emerald-800">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span>Aucun champ à compléter de votre côté.</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer sticky */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2 [&>button]:flex-1 sm:[&>button]:flex-initial">
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
            disabled={!allRequiredFilled || pending}
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

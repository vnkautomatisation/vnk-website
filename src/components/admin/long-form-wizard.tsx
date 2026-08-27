"use client";
// ─────────────────────────────────────────────────────────
// LongFormWizard — wizard generique pour TOUS les templates
// "long form" (evaluations, entretiens annuels, plans de
// developpement, formulaires structures avec beaucoup de
// champs `_____` a remplir).
//
// AUTO-DETECTION : si un template contient 5+ sequences `___`
// (cf. isLongFormTemplate), ce wizard remplace automatiquement
// le TemplateFieldsDialog standard dans le flow d'envoi.
//
// FONCTIONNEMENT :
//   1. parse le bodyMarkdown via parseFillFields()
//   2. groupe les champs par section (H2) + sous-section (H3)
//   3. affiche un formulaire structure avec Textarea/Input par champ
//   4. retourne { fill_0: "...", fill_1: "...", ... } a onSubmit
//
// Les valeurs sont stockees dans customFieldValues du DSR puis
// substituees par applyFillFieldValues() au moment du rendu PDF.
//
// THEME : header navy gradient VNK + FormSection (cf. memoire :
// modaux admin doivent avoir header navy + sections).
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  FileText,
  Loader2,
  Send,
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
  parseFillFields,
  type FillField,
  type FillFieldGroup,
} from "@/lib/document-templates/fill-field-parser";

export interface LongFormWizardProps {
  open: boolean;
  templateTitle: string;
  bodyMarkdown: string;
  initialValues?: Record<string, string>;
  /** Action label (defaut : "Envoyer pour signature"). */
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (values: Record<string, string>) => Promise<void> | void;
}

export function LongFormWizard({
  open,
  templateTitle,
  bodyMarkdown,
  initialValues,
  submitLabel,
  onClose,
  onSubmit,
}: LongFormWizardProps) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const structure = useMemo(() => parseFillFields(bodyMarkdown), [bodyMarkdown]);
  const [values, setValues] = useState<Record<string, string>>(initialValues ?? {});
  const [submitting, setSubmitting] = useState(false);

  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());


  useEffect(() => {
    if (open) {
      setValues(initialValues ?? {});
      setCollapsed(new Set());
      setSubmitting(false);
    }
  }, [open, initialValues]);

  const filledCount = useMemo(
    () => structure.fields.filter((f) => (values[`fill_${f.index}`] ?? "").trim() !== "").length,
    [structure.fields, values],
  );

  const handleField = (field: FillField, value: string) => {
    setValues((prev) => ({ ...prev, [`fill_${field.index}`]: value }));
  };

  const toggleSection = (idx: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {



      const payload: Record<string, string> = {};
      for (const f of structure.fields) {
        payload[`fill_${f.index}`] = (values[`fill_${f.index}`] ?? "").trim();
      }
      await onSubmit(payload);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent
        className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-3xl sm:max-h-[92vh] sm:h-auto sm:rounded-lg"
        aria-describedby={undefined}
      >

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-base flex items-center gap-2">
              <ClipboardList className="h-5 w-5 shrink-0" />
              <span className="truncate">Compléter — {templateTitle}</span>
            </DialogTitle>
            <p className="text-white/80 text-xs mt-1">
              {structure.count} champ{structure.count > 1 ? "s" : ""} à compléter
              {filledCount > 0 && (
                <span className="ml-2">
                  · <span className="font-semibold text-white">{filledCount}</span> rempli
                  {filledCount > 1 ? "s" : ""}
                </span>
              )}
            </p>
          </DialogHeader>
        </div>


        <div className="flex-1 overflow-y-auto bg-muted/20 px-4 sm:px-6 py-4 space-y-4">
          {structure.groups.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
              <p className="text-sm font-medium text-foreground">{t("aucun_champ_detecte")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("template_ne_contient_pas_lignes")}
              </p>
            </div>
          ) : (
            structure.groups.map((group, gIdx) => (
              <SectionCard
                key={gIdx}
                index={gIdx}
                group={group}
                collapsed={collapsed.has(gIdx)}
                onToggle={() => toggleSection(gIdx)}
                values={values}
                onField={handleField}
              />
            ))
          )}

          <div className="rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-[11px] text-blue-900 flex gap-2 items-start">
            <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>{t("long_form_wizard_les_champs_laisses_vides_apparaitront_comme_lignes")}</span>
          </div>
        </div>


        <DialogFooter className="px-4 sm:px-6 py-3 border-t bg-card shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={submitting}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            {submitLabel ?? t("enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Section repliable ────────────────────────────────────
// Exporte pour reutilisation dans document-draft-editor.tsx

export function SectionCard({
  group,
  index,
  collapsed,
  onToggle,
  values,
  onField,
}: {
  group: FillFieldGroup;
  index: number;
  collapsed: boolean;
  onToggle: () => void;
  values: Record<string, string>;
  onField: (field: FillField, value: string) => void;
}) {
  const fieldCount = group.subsections.reduce((acc, s) => acc + s.fields.length, 0);
  const filledInSection = group.subsections.reduce(
    (acc, s) =>
      acc + s.fields.filter((f) => (values[`fill_${f.index}`] ?? "").trim() !== "").length,
    0,
  );
  const sectionTitle = group.section || `Section ${index + 1}`;
  const allFilled = filledInSection === fieldCount && fieldCount > 0;

  return (
    <section className="rounded-md border bg-card shadow-sm">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left hover:bg-muted/40 transition-colors rounded-t-md"
      >
        {collapsed ? (
          <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-[#0F2D52] shrink-0" />
        )}
        <h3 className="flex-1 text-sm font-semibold text-[#0F2D52] truncate">{sectionTitle}</h3>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${
            allFilled
              ? "bg-green-100 text-green-800"
              : filledInSection > 0
                ? "bg-amber-100 text-amber-900"
                : "bg-muted text-muted-foreground"
          }`}
        >
          {filledInSection} / {fieldCount}
        </span>
      </button>
      {!collapsed && (
        <div className="px-4 pb-3 pt-1 space-y-4">
          {group.subsections.map((sub, sIdx) => (
            <SubsectionBlock
              key={sIdx}
              subsection={sub.subsection}
              fields={sub.fields}
              values={values}
              onField={onField}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export function SubsectionBlock({
  subsection,
  fields,
  values,
  onField,
}: {
  subsection: string;
  fields: FillField[];
  values: Record<string, string>;
  onField: (field: FillField, value: string) => void;
}) {
  return (
    <div className="space-y-2">
      {subsection && (
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground border-b border-border/60 pb-1">
          {subsection}
        </div>
      )}
      <div className="space-y-2.5">
        {fields.map((f) => (
          <FieldRow
            key={f.index}
            field={f}
            value={values[`fill_${f.index}`] ?? ""}
            onChange={(v) => onField(f, v)}
          />
        ))}
      </div>
    </div>
  );
}

export function FieldRow({
  field,
  value,
  onChange,
}: {
  field: FillField;
  value: string;
  onChange: (v: string) => void;
}) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");




  const labelLower = field.label.toLowerCase();
  const isDate = /\b(date|jour|annee|année|mois)\b/.test(labelLower);
  const isLong = field.kind === "longtext"
    || /\b(notes?|commentaires?|motifs?|observations?|remarques?|details?|description|plan d'?action|bilan|preciser)\b/i.test(labelLower);



  const displayLabel = (() => {
    const isGeneric = /^(champ|element|bloc libre|objectif)\s*\d*$/i.test(field.label.trim());
    if (!isGeneric) return field.label;
    const ctx = field.subsection || field.section;
    if (!ctx) return field.label;
    return `${ctx} — ${field.label.toLowerCase()}`;
  })();

  return (
    <div className="space-y-1">
      <label className="text-xs font-medium text-foreground/90 flex items-center gap-1.5">
        <span className="truncate">{displayLabel}</span>
        {isDate && (
          <span className="text-[9px] uppercase tracking-wide text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded">
            {tc("date")}
          </span>
        )}
      </label>
      {isDate ? (
        <DatePopover
          value={value || ""}
          onChange={(v) => onChange(v ?? "")}
          placeholder={t("choisir_date")}
        />
      ) : isLong ? (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("saisir_texte_libre")}
          className="text-sm min-h-[72px] resize-y"
        />
      ) : (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("saisir_valeur")}
          className="text-sm h-9"
        />
      )}
    </div>
  );
}

"use client";
// ─────────────────────────────────────────────────────────
// TemplateWizard — assistant multi-etapes pour creer ou editer
// un template de document (legal | contract | policy).
//
// Etapes (mode "create") :
//   1. Demarrage    : choisir un modele bibliotheque OU partir de zero
//   2. Identification : cle, titre, categorie, version
//   3. Public cible : postes, departements, obligatoire
//   4. Contenu + apercu : MarkdownEditor + VariablePicker + TemplatePreview
//
// En mode "edit", on saute directement a l'etape 4 (mais on permet de
// revenir aux etapes 2 et 3 via la barre de progression).
//
// Theme VNK : header navy gradient, FormSection/Field, footer sticky.
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  ArrowLeft,
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  FileText,
  FilePlus,
  Layers,
  Library,
  Lightbulb,
  Loader2,
  Plus,
  Save,
  Tag,
  Upload,
  User,
  Users,
  X,
} from "lucide-react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormSection, Field } from "@/components/admin/form-section";
import { TemplateRichEditor } from "@/components/admin/template-rich-editor";
import { cn } from "@/lib/utils";
import {
  TemplateLibraryBrowser,
  type StarterTemplate,
} from "@/components/admin/template-library-browser";
import { VariablePicker } from "@/components/admin/variable-picker";
import {
  TemplatePreview,
  type PreviewEmployee,
} from "@/components/admin/template-preview";
import { PositionMultiPicker } from "@/components/admin/position-multi-picker";
import { CONTRACT_TYPES } from "@/lib/document-templates/contract-types";
import {
  ImportTemplateDialog,
  type ImportTemplateDialogResult,
} from "@/components/admin/import-template-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export type TemplateWizardType = "legal" | "contract" | "policy";
export type TemplateWizardMode = "create" | "edit";

export type TemplateSignatureScope =
  | "employee_only"
  | "employer_only"
  | "both"
  | "none";

export type TemplateAcknowledgmentMode = "reading_only" | "signature";

export type TemplateWizardInitial = {
  key?: string;
  title: string;
  category?: string;
  version?: string;
  bodyMarkdown: string;
  targetPositions?: string[];
  targetDepartments?: string[];
  isMandatory?: boolean;
  signatureScope?: TemplateSignatureScope;
  acknowledgmentMode?: TemplateAcknowledgmentMode;
};

export type TemplateWizardSavePayload = {
  key?: string;
  title: string;
  category?: string;
  version: string;
  bodyMarkdown: string;
  targetPositions: string[];
  targetDepartments: string[];
  isMandatory?: boolean;
  signatureScope?: TemplateSignatureScope;
  acknowledgmentMode?: TemplateAcknowledgmentMode;
};

type Props = {
  open: boolean;
  onClose: () => void;
  mode: TemplateWizardMode;
  type: TemplateWizardType;
  initial?: TemplateWizardInitial;
  onSave: (data: TemplateWizardSavePayload) => Promise<void>;
  /** Optionnel : employes pre-charges pour l'apercu. */
  previewEmployees?: PreviewEmployee[];
};

const CATEGORY_OPTIONS: Record<TemplateWizardType, { value: string; labelKey: string }[]> = {
  legal: [
    { value: "policy", labelKey: "politique" },
    { value: "nda", labelKey: "accord_confidentialite_nda" },
    { value: "acknowledgment", labelKey: "accuse_reception" },
  ],
  contract: [
    ...CONTRACT_TYPES.map((ct) => ({ value: ct.value, labelKey: ct.labelKey })),
    { value: "autre", labelKey: "autre" },
  ],
  policy: [
    { value: "rh", labelKey: "rh" },
    { value: "ti", labelKey: "ti_securite" },
    { value: "conduct", labelKey: "code_conduite" },
    { value: "harcelement", labelKey: "harcelement" },
    { value: "autre", labelKey: "autre" },
  ],
};

const TYPE_LABELS: Record<TemplateWizardType, { singularKey: string; icon: typeof FileText }> = {
  legal: { singularKey: "document_legal", icon: FileText },
  contract: { singularKey: "modele_contrat", icon: FileText },
  policy: { singularKey: "politique_2", icon: FileText },
};

type WizardStep = 1 | 2 | 3 | 4;

export function TemplateWizard({
  open,
  onClose,
  mode,
  type,
  initial,
  onSave,
  previewEmployees: previewEmployeesProp,
}: Props) {
  const t = useTranslations("admin.library");
  const tc = useTranslations("common");

  const tAll = (key: string) => (key.startsWith("ct_") ? tc(key) : t(key));

  const initialStep: WizardStep = mode === "edit" ? 4 : 1;
  const [step, setStep] = useState<WizardStep>(initialStep);


  const [key, setKey] = useState(initial?.key ?? "");
  const [title, setTitle] = useState(initial?.title ?? "");
  const [category, setCategory] = useState(initial?.category ?? "");
  const [version, setVersion] = useState(initial?.version ?? "1.0");
  const [bodyMarkdown, setBodyMarkdown] = useState(initial?.bodyMarkdown ?? "");
  const [targetPositions, setTargetPositions] = useState<string[]>(
    initial?.targetPositions ?? []
  );
  const [targetDepartments, setTargetDepartments] = useState<string[]>(
    initial?.targetDepartments ?? []
  );
  const [isMandatory, setIsMandatory] = useState<boolean>(
    initial?.isMandatory ?? false
  );
  const [signatureScope, setSignatureScope] = useState<TemplateSignatureScope>(
    initial?.signatureScope ?? (type === "contract" ? "both" : "employee_only"),
  );


  const [acknowledgmentMode, setAcknowledgmentMode] =
    useState<TemplateAcknowledgmentMode>(
      initial?.acknowledgmentMode ??
        (type === "contract" ? "signature" : "reading_only"),
    );
  const [submitting, setSubmitting] = useState(false);


  const [previewEmployees, setPreviewEmployees] = useState<PreviewEmployee[]>(
    previewEmployeesProp ?? []
  );
  const [selectedPreviewId, setSelectedPreviewId] = useState<number | undefined>(
    previewEmployeesProp?.[0]?.id
  );


  const [importOpen, setImportOpen] = useState(false);

  const [variablePickerOpen, setVariablePickerOpen] = useState(false);


  useEffect(() => {
    if (!open) return;
    setStep(mode === "edit" ? 4 : 1);
    setKey(initial?.key ?? "");
    setTitle(initial?.title ?? "");
    setCategory(initial?.category ?? "");
    setVersion(initial?.version ?? "1.0");
    setBodyMarkdown(initial?.bodyMarkdown ?? "");
    setTargetPositions(initial?.targetPositions ?? []);
    setTargetDepartments(initial?.targetDepartments ?? []);
    setIsMandatory(initial?.isMandatory ?? false);
    setSignatureScope(
      initial?.signatureScope ?? (type === "contract" ? "both" : "employee_only"),
    );
    setAcknowledgmentMode(
      initial?.acknowledgmentMode ??
        (type === "contract" ? "signature" : "reading_only"),
    );
    setSubmitting(false);
    setSelectedPreviewId(previewEmployeesProp?.[0]?.id);
  }, [open, mode, initial, previewEmployeesProp, type]);


  useEffect(() => {
    if (!open) return;
    if (previewEmployeesProp && previewEmployeesProp.length > 0) {
      setPreviewEmployees(previewEmployeesProp);
      return;
    }
    if (step !== 4) return;
    let cancelled = false;
    fetch("/api/admin/employees?limit=200", { credentials: "same-origin" })
      .then(async (r) => {
        if (!r.ok) return { items: [] };
        return r.json();
      })
      .then((data: { items?: Array<{ id: number; fullName?: string | null; name?: string | null; position?: string | null; department?: string | null; avatarUrl?: string | null }> }) => {
        if (cancelled) return;
        const items = (data.items ?? []).map((e) => ({
          id: e.id,
          fullName: e.fullName ?? e.name ?? null,
          position: e.position ?? null,
          department: e.department ?? null,
          avatarUrl: e.avatarUrl ?? null,
        }));
        setPreviewEmployees(items);
        if (items.length > 0 && !selectedPreviewId) {
          setSelectedPreviewId(items[0].id);
        }
      })
      .catch(() => {
        if (!cancelled) setPreviewEmployees([]);
      });
    return () => {
      cancelled = true;
    };
  }, [open, step, previewEmployeesProp, selectedPreviewId]);




  const handleInsertVariable = (variable: string) => {
    setBodyMarkdown((b) => {


      if (!b || /[\s\n]$/.test(b)) return b + variable;
      return b + " " + variable;
    });
  };

  const handleSelectStarter = (starter: {
    key?: string;
    name: string;
    bodyMarkdown: string;
    category?: string;
    targetPositions?: string[];
  }) => {
    if (starter.key) setKey(starter.key);
    setTitle(starter.name);
    if (starter.category) setCategory(starter.category);
    setBodyMarkdown(starter.bodyMarkdown);
    if (starter.targetPositions) setTargetPositions(starter.targetPositions);
    setStep(2);
  };

  const handleSkipLibrary = () => {
    setStep(2);
  };

  const handleImported = (data: ImportTemplateDialogResult) => {
    setBodyMarkdown(data.bodyMarkdown);
    if (data.suggestedTitle) setTitle(data.suggestedTitle);

    if (data.suggestedDocumentType && !category) {
      setCategory(data.suggestedDocumentType);
    }
    setImportOpen(false);
    setStep(2);
    toast.success(
      data.acceptedSubstitutions > 0
        ? `Document importe avec ${data.acceptedSubstitutions} champ${data.acceptedSubstitutions > 1 ? "s" : ""} dynamique${data.acceptedSubstitutions > 1 ? "s" : ""}`
        : t("document_importe")
    );
  };

  const canGoNext = useMemo(() => {
    if (step === 2) {

      if (!title.trim()) return false;
      if (type !== "contract" && !key.trim()) return false;
      return true;
    }
    return true;
  }, [step, key, title, type]);

  const canSubmit = useMemo(() => {
    if (submitting) return false;
    if (!title.trim()) return false;
    if (type !== "contract" && !key.trim()) return false;
    if (bodyMarkdown.trim().length < 10) return false;
    return true;
  }, [submitting, title, type, key, bodyMarkdown]);

  const goNext = () => {
    if (step === 1) {

      return;
    }
    if (step < 4) setStep((s) => (s + 1) as WizardStep);
  };

  const goPrev = () => {
    if (mode === "edit") {

      if (step > 2) setStep((s) => (s - 1) as WizardStep);
      return;
    }
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  const submit = async () => {
    if (!canSubmit) {
      toast.error(t("verifiez_titre_cle_contenu_min"));
      return;
    }
    setSubmitting(true);
    try {

      const effectiveScope: TemplateSignatureScope =
        acknowledgmentMode === "reading_only" ? "none" : signatureScope;
      await onSave({
        key: key.trim() || undefined,
        title: title.trim(),
        category: category.trim() || undefined,
        version: version.trim() || "1.0",
        bodyMarkdown,
        targetPositions,
        targetDepartments,
        isMandatory,
        signatureScope: effectiveScope,
        acknowledgmentMode,
      });
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("erreur_lors_enregistrement");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const totalSteps = mode === "edit" ? 3 : 4;
  const currentStepIdx = mode === "edit" ? step - 1 : step;
  const Icon = TYPE_LABELS[type].icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-6xl sm:h-auto sm:max-h-[95vh] sm:rounded-lg">

        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-white flex items-center gap-2 pr-8">
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">
                {mode === "edit" ? t("modifier_prefixe") : t("nouveau_prefixe")}
                {t(TYPE_LABELS[type].singularKey)}
              </span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs">
              {mode === "edit"
                ? t("modifiez_contenu_ciblage_version_pensez")
                : t("suivez_etapes_creer_nouveau_modele")}
            </DialogDescription>
          </DialogHeader>


          <div className="mt-3 flex items-center gap-1.5">
            <StepDots
              currentStep={currentStepIdx}
              totalSteps={totalSteps}
              labels={
                mode === "edit"
                  ? [t("identification"), t("public"), t("contenu")]
                  : [t("demarrage"), t("identification"), t("public"), t("contenu")]
              }
            />
          </div>
        </div>


        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {step === 1 && mode === "create" && (
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5">

              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  {t("comment_souhaitez_vous_demarrer")}
                </h3>
                <p className="text-[11px] text-muted-foreground mb-3">
                  {t("choisissez_option_ci_dessous_puis")}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">

                  <StartOptionCard
                    icon={Library}
                    title={t("modele_bibliotheque")}
                    description={t("partez_modele_vnk_pre_redige")}
                    onClick={() => {

                      const el = document.getElementById("starter-library");
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    badge={t("recommande")}
                  />

                  <StartOptionCard
                    icon={Upload}
                    title={t("importer_document_existant")}
                    description={t("importez_pdf_docx_txt_vnk")}
                    onClick={() => setImportOpen(true)}
                    badge={t("intelligent")}
                  />

                  <StartOptionCard
                    icon={FilePlus}
                    title={t("partir_zero")}
                    description={t("creez_modele_vide_vous_redigerez")}
                    onClick={handleSkipLibrary}
                  />
                </div>
              </div>

              <div id="starter-library" className="border-t pt-4">
                <TemplateLibraryBrowser
                  type={type}
                  onSelect={handleSelectStarter}
                  onSkip={handleSkipLibrary}
                />
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5">
              <FormSection icon={Layers} title={t("identification")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label={t("cle_technique")}
                    required={type !== "contract"}
                    hint={
                      type === "contract"
                        ? t("optionnel_auto_genere")
                        : t("immuable_fois_cree_z_0")
                    }
                  >
                    <Input
                      value={key}
                      onChange={(e) =>
                        setKey(
                          e.target.value
                            .toLowerCase()
                            .replace(/[^a-z0-9_]/g, "_")
                        )
                      }
                      placeholder="harassment_policy"
                      disabled={mode === "edit" && !!initial?.key}
                    />
                  </Field>
                  <Field label={t("version")} required>
                    <Input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0"
                    />
                  </Field>
                </div>
                <Field label={t("titre")} required>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      type === "legal"
                        ? t("politique_confidentialite")
                        : type === "contract"
                          ? t("contrat_cdi_technicien")
                          : t("politique_teletravail")
                    }
                  />
                </Field>
                <Field label={t("categorie")}>
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder={t("choisir_categorie")} />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS[type].map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {tAll(c.labelKey)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FormSection>
            </div>
          )}

          {step === 3 && (
            <div className="p-4 sm:p-5 overflow-y-auto space-y-4 sm:space-y-5">
              <FormSection
                icon={Users}
                title={t("public_cible")}
                description={t("laissez_vide_appliquer_tous_employes")}
              >
                <Field
                  label={t("postes_cibles")}
                  hint={t("selectionnez_postes_existants_creez_nouveau")}
                >
                  <PositionMultiPicker
                    inline
                    value={targetPositions}
                    onChange={setTargetPositions}
                    placeholder={t("choisir_postes")}
                  />
                </Field>
                <Field label={t("departements_cibles")} hint={t("appuyez_entree_ajouter")}>
                  <ChipsInput
                    values={targetDepartments}
                    onChange={setTargetDepartments}
                    placeholder={t("ex_ingenierie")}
                  />
                </Field>
                {type !== "contract" && (
                  <Field label={t("options")}>
                    <label className="flex items-start gap-2 cursor-pointer rounded-md border border-input bg-card px-3 py-2 hover:border-[#0F2D52]/30 transition">
                      <input
                        type="checkbox"
                        checked={isMandatory}
                        onChange={(e) => setIsMandatory(e.target.checked)}
                        className="h-4 w-4 rounded border-input accent-[#0F2D52] mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          {t("document_obligatoire")}
                        </p>
                        <p className="text-[11px] text-muted-foreground">{t("template_wizard_inclus_automatiquement_dans_le_parcours_d_onboarding")}</p>
                      </div>
                    </label>
                  </Field>
                )}

                {type !== "contract" && (
                  <Field
                    label={t("type_engagement")}
                    hint={t("majorite_documents_necessitent_accuse_lecture")}
                  >
                    <div className="space-y-1.5">
                      {(
                        [
                          {
                            v: "reading_only",
                            title: t("lecture_seule_accuse_lecture"),
                            hint: t("recommande_politiques_codes_conduite_communications"),
                          },
                          {
                            v: "signature",
                            title: t("signature_manuscrite"),
                            hint: t("obligatoire_contrats_ententes_legales_engagements"),
                          },
                        ] as const
                      ).map((opt) => {
                        const active = acknowledgmentMode === opt.v;
                        return (
                          <label
                            key={opt.v}
                            className={cn(
                              "flex items-start gap-2 cursor-pointer rounded-md border px-3 py-2 transition",
                              active
                                ? "border-[#0F2D52] bg-[#0F2D52]/5 ring-1 ring-[#0F2D52]/15"
                                : "border-input bg-card hover:border-[#0F2D52]/30",
                            )}
                          >
                            <input
                              type="radio"
                              name="acknowledgment-mode"
                              checked={active}
                              onChange={() => setAcknowledgmentMode(opt.v)}
                              className="h-4 w-4 mt-0.5 accent-[#0F2D52]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {opt.title}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {opt.hint}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                )}

                {(type === "contract" || acknowledgmentMode === "signature") && (
                  <Field
                    label={t("signataires_requis")}
                    hint={t("determine_quels_blocs_signature_apparaitront")}
                  >
                    <div className="space-y-1.5">
                      {(
                        [
                          {
                            v: "employee_only",
                            title: t("employe_seulement"),
                            hint: t("politiques_internes_codes_conduite_accuses"),
                          },
                          {
                            v: "employer_only",
                            title: t("employeur_seulement"),
                            hint: t("lettres_attestations_confirmations_emises_vnk"),
                          },
                          {
                            v: "both",
                            title: t("deux_signatures"),
                            hint: t("contrats_ententes_double_signature"),
                          },
                          {
                            v: "none",
                            title: t("aucune_signature"),
                            hint: t("documents_purement_informatifs_memos_bulletins"),
                          },
                        ] as const
                      ).map((opt) => {
                        const active = signatureScope === opt.v;
                        return (
                          <label
                            key={opt.v}
                            className={cn(
                              "flex items-start gap-2 cursor-pointer rounded-md border px-3 py-2 transition",
                              active
                                ? "border-[#0F2D52] bg-[#0F2D52]/5 ring-1 ring-[#0F2D52]/15"
                                : "border-input bg-card hover:border-[#0F2D52]/30",
                            )}
                          >
                            <input
                              type="radio"
                              name="signature-scope"
                              checked={active}
                              onChange={() => setSignatureScope(opt.v)}
                              className="h-4 w-4 mt-0.5 accent-[#0F2D52]"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-foreground">
                                {opt.title}
                              </p>
                              <p className="text-[11px] text-muted-foreground">
                                {opt.hint}
                              </p>
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </Field>
                )}
              </FormSection>
            </div>
          )}

          {step === 4 && (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0 overflow-hidden">

              <div className="flex flex-col min-h-0 lg:border-r border-b lg:border-b-0">
                <div className="px-4 sm:px-5 py-2 sm:py-3 border-b bg-muted/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-[#0F2D52]" />
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
                      {t("editeur")}
                    </h4>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 min-h-0 overflow-hidden relative">
                  <div className="overflow-y-auto p-3 sm:p-4 min-h-0">
                    <TemplateRichEditor
                      value={bodyMarkdown}
                      onChange={setBodyMarkdown}
                      placeholder={t("commencez_rediger_utilisez_barre_outils")}
                      minHeight="380px"
                    />


                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 leading-snug">
                        <span className="font-semibold">{t("conseil")}</span> {t("champs_dynamiques_apparaissent")} <span className="font-semibold text-blue-900">bleu</span>{t("template_wizard_dans_l_editeur_cliquez_sur_un_champ")}</p>
                    </div>
                  </div>


                  {false && variablePickerOpen && (
                    <div className="absolute inset-y-0 right-0 w-[260px] bg-card border-l shadow-xl z-10 flex flex-col">
                      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
                          {t("tous_champs")}
                        </span>
                        <button
                          type="button"
                          onClick={() => setVariablePickerOpen(false)}
                          className="text-muted-foreground hover:text-foreground transition"
                          aria-label={t("fermer_panneau")}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <div className="flex-1 min-h-0 overflow-hidden">
                        <VariablePicker
                          onInsert={(v) => {
                            handleInsertVariable(v);
                          }}
                          className="border-0 rounded-none h-full"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>


              <div className="flex flex-col min-h-0">
                <div className="px-4 sm:px-5 py-2 sm:py-3 border-b bg-muted/30 shrink-0 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-[#0F2D52]" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
                    {t("apercu_pdf_live")}
                  </h4>
                </div>
                <div className="flex-1 px-3 sm:px-4 py-2 sm:py-3 min-h-0 overflow-hidden">
                  <TemplatePreview
                    bodyMarkdown={bodyMarkdown}
                    selectedEmployeeId={selectedPreviewId}
                    onChangeEmployee={setSelectedPreviewId}
                    employees={previewEmployees}
                    title={title || t("apercu_type", { type: t(TYPE_LABELS[type].singularKey) })}
                    documentType={type}
                    metadata={{ version: version || "1.0" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>


        <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap sm:justify-between">
          <div className="flex items-center gap-2 order-2 sm:order-1 w-full sm:w-auto">
            {((mode === "create" && step > 1) || (mode === "edit" && step > 2)) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={submitting}
                className="gap-1.5 w-full sm:w-auto"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                {t("precedent")}
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2 order-1 sm:order-2 w-full sm:w-auto [&>button]:flex-1 sm:[&>button]:flex-initial">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              {tc("cancel")}
            </Button>
            {step === 1 && mode === "create" ? null : step < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={goNext}
                disabled={!canGoNext}
                className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white gap-1.5"
              >
                {tc("next")}
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={submit}
                disabled={!canSubmit}
                className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white gap-1.5"
              >
                {submitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {mode === "edit" ? t("enregistrer") : t("creer_template")}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>


      <ImportTemplateDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={handleImported}
      />
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────
//             Sous-composant : Card option de demarrage (etape 1)
// ────────────────────────────────────────────────────────────
function StartOptionCard({
  icon: Icon,
  title,
  description,
  onClick,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  onClick: () => void;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-left rounded-md border border-input bg-card p-4 hover:border-[#0F2D52]/40 hover:bg-[#0F2D52]/5 hover:shadow-sm transition focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30 relative"
    >
      {badge && (
        <span className="absolute top-2 right-2 inline-flex items-center rounded-full bg-[#0F2D52]/10 text-[#0F2D52] border border-[#0F2D52]/20 px-1.5 py-0 text-[9px] font-semibold uppercase tracking-wider">
          {badge}
        </span>
      )}
      <div className="flex items-center justify-center w-9 h-9 rounded-md bg-[#0F2D52]/10 text-[#0F2D52] mb-2">
        <Icon className="h-4 w-4" />
      </div>
      <h4 className="text-sm font-semibold text-foreground mb-1">{title}</h4>
      <p className="text-[11px] text-muted-foreground leading-snug">
        {description}
      </p>
    </button>
  );
}

// ────────────────────────────────────────────────────────────
//             Sous-composant : Bouton d'insertion rapide (etape 4)
// ────────────────────────────────────────────────────────────
function QuickInsertButton({
  icon: Icon,
  label,
  onClick,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded border border-input bg-[#0F2D52]/5 hover:bg-[#0F2D52]/10 hover:border-[#0F2D52]/30 px-2 py-1 text-[11px] font-medium text-foreground transition"
      title={`Inserer : ${label}`}
    >
      <Icon className="h-3 w-3 text-[#0F2D52]" />
      {label}
    </button>
  );
}

// ────────────────────────────────────────────────────────────
//             Sous-composant : Stepper visuel (1/4, 2/4...)
// ────────────────────────────────────────────────────────────
function StepDots({
  currentStep,
  totalSteps,
  labels,
}: {
  currentStep: number;
  totalSteps: number;
  labels: string[];
}) {
  return (
    <div className="flex items-center gap-1.5 w-full">
      {Array.from({ length: totalSteps }).map((_, i) => {
        const idx = i + 1;
        const isActive = idx === currentStep;
        const isDone = idx < currentStep;
        return (
          <div key={i} className="flex items-center gap-1.5 flex-1 min-w-0">
            <div
              className={cn(
                "h-6 w-6 rounded-full border flex items-center justify-center text-[10px] font-bold shrink-0 transition",
                isActive && "bg-white text-[#0F2D52] border-white shadow-sm",
                isDone && "bg-emerald-500/90 text-white border-emerald-500/90",
                !isActive && !isDone && "bg-white/10 text-white/60 border-white/20"
              )}
            >
              {isDone ? <Check className="h-3 w-3" /> : idx}
            </div>
            <span
              className={cn(
                "text-[10px] uppercase tracking-wider font-semibold truncate hidden sm:inline",
                isActive ? "text-white" : "text-white/60"
              )}
            >
              {labels[i]}
            </span>
            {i < totalSteps - 1 && (
              <div
                className={cn(
                  "h-px flex-1 mx-1",
                  isDone ? "bg-emerald-500/70" : "bg-white/20"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
//             Sous-composant : Input chips multi-add
// ────────────────────────────────────────────────────────────
function ChipsInput({
  values,
  onChange,
  placeholder,
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
}) {
  const tc = useTranslations("common");
  const [draft, setDraft] = useState("");

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) {
      setDraft("");
      return;
    }
    onChange([...values, v]);
    setDraft("");
  };

  const remove = (idx: number) => {
    onChange(values.filter((_, i) => i !== idx));
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          className="h-9 text-sm flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={add}
          disabled={!draft.trim()}
          className="gap-1.5 shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          {tc("add")}
        </Button>
      </div>
      {values.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {values.map((v, i) => (
            <span
              key={`${v}-${i}`}
              className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] border border-[#0F2D52]/20"
            >
              {v}
              <button
                type="button"
                onClick={() => remove(i)}
                className="hover:text-red-600"
                aria-label={`Retirer ${v}`}
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// Indicateurs reserves pour usage futur (lint silencieux)
export const _TemplateWizardIcons = {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Library,
  Tag,
};

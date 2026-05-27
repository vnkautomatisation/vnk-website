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

const CATEGORY_OPTIONS: Record<TemplateWizardType, { value: string; label: string }[]> = {
  legal: [
    { value: "policy", label: "Politique" },
    { value: "nda", label: "Accord de confidentialite (NDA)" },
    { value: "acknowledgment", label: "Accuse de reception" },
  ],
  contract: [
    ...CONTRACT_TYPES.map((t) => ({ value: t.value, label: t.label })),
    { value: "autre", label: "Autre" },
  ],
  policy: [
    { value: "rh", label: "RH" },
    { value: "ti", label: "TI / Securite" },
    { value: "conduct", label: "Code de conduite" },
    { value: "harcelement", label: "Harcelement" },
    { value: "autre", label: "Autre" },
  ],
};

const TYPE_LABELS: Record<TemplateWizardType, { singular: string; icon: typeof FileText }> = {
  legal: { singular: "document legal", icon: FileText },
  contract: { singular: "modele de contrat", icon: FileText },
  policy: { singular: "politique", icon: FileText },
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
  // En mode edit : on saute directement a etape 4
  const initialStep: WizardStep = mode === "edit" ? 4 : 1;
  const [step, setStep] = useState<WizardStep>(initialStep);

  // Form state
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
  // Acknowledgment mode : reading_only par défaut (majorité des docs)
  // sauf pour les contrats où on force "signature".
  const [acknowledgmentMode, setAcknowledgmentMode] =
    useState<TemplateAcknowledgmentMode>(
      initial?.acknowledgmentMode ??
        (type === "contract" ? "signature" : "reading_only"),
    );
  const [submitting, setSubmitting] = useState(false);

  // Preview state
  const [previewEmployees, setPreviewEmployees] = useState<PreviewEmployee[]>(
    previewEmployeesProp ?? []
  );
  const [selectedPreviewId, setSelectedPreviewId] = useState<number | undefined>(
    previewEmployeesProp?.[0]?.id
  );

  // Import dialog state (etape 1 -> option "Importer un document")
  const [importOpen, setImportOpen] = useState(false);
  // Si true, le picker de variables (panneau lateral) est ouvert en overlay
  const [variablePickerOpen, setVariablePickerOpen] = useState(false);

  // Reset complet a l'ouverture
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

  // Charge les employes pour l'apercu si non fournis (etape 4 atteinte)
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

  // Insertion rapide via les boutons de la toolbar (etape 4).
  // Le RichEditor parse automatiquement les `{{...}}` ajoutes a la
  // chaine markdown et les affiche comme pills.
  const handleInsertVariable = (variable: string) => {
    setBodyMarkdown((b) => {
      // Ajoute un espace separateur si la chaine ne se termine pas
      // deja par un espace ou un saut de ligne.
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
    // Si le type de doc detecte est un type RH/contrat connu, le pousser dans category
    if (data.suggestedDocumentType && !category) {
      setCategory(data.suggestedDocumentType);
    }
    setImportOpen(false);
    setStep(2);
    toast.success(
      data.acceptedSubstitutions > 0
        ? `Document importe avec ${data.acceptedSubstitutions} champ${data.acceptedSubstitutions > 1 ? "s" : ""} dynamique${data.acceptedSubstitutions > 1 ? "s" : ""}`
        : "Document importe"
    );
  };

  const canGoNext = useMemo(() => {
    if (step === 2) {
      // Cle + titre requis (cle facultative en mode legal/contract si auto-genere)
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
      // Skip = bouton dedie. Ne devrait pas etre atteint via "Suivant"
      return;
    }
    if (step < 4) setStep((s) => (s + 1) as WizardStep);
  };

  const goPrev = () => {
    if (mode === "edit") {
      // En mode edit on permet la navigation arriere uniquement entre 2-3-4
      if (step > 2) setStep((s) => (s - 1) as WizardStep);
      return;
    }
    if (step > 1) setStep((s) => (s - 1) as WizardStep);
  };

  const submit = async () => {
    if (!canSubmit) {
      toast.error("Verifiez le titre, la cle et le contenu (min. 10 caracteres)");
      return;
    }
    setSubmitting(true);
    try {
      // Si lecture seule, on force scope = "none" (pas de signature pad cote employe)
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
      const msg = err instanceof Error ? err.message : "Erreur lors de l'enregistrement";
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
      <DialogContent className="max-w-6xl w-[95vw] max-h-[95vh] p-0 overflow-hidden flex flex-col">
        {/* Header navy gradient */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Icon className="h-4 w-4" />
              {mode === "edit" ? "Modifier " : "Nouveau "}
              {TYPE_LABELS[type].singular}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {mode === "edit"
                ? "Modifiez le contenu, le ciblage ou la version. Pensez a incrementer la version si le contenu change significativement."
                : "Suivez les etapes pour creer un nouveau modele reutilisable, avec variables dynamiques et apercu."}
            </DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="mt-3 flex items-center gap-1.5">
            <StepDots
              currentStep={currentStepIdx}
              totalSteps={totalSteps}
              labels={
                mode === "edit"
                  ? ["Identification", "Public", "Contenu"]
                  : ["Demarrage", "Identification", "Public", "Contenu"]
              }
            />
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-0">
          {step === 1 && mode === "create" && (
            <div className="p-5 overflow-y-auto space-y-5">
              {/* 3 options de demarrage */}
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-1">
                  Comment souhaitez-vous demarrer ?
                </h3>
                <p className="text-[11px] text-muted-foreground mb-3">
                  Choisissez une option ci-dessous, puis personnalisez le contenu a l&apos;etape suivante.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Option 1 : Bibliotheque (deroule directement le browser ci-dessous) */}
                  <StartOptionCard
                    icon={Library}
                    title="Modele de bibliotheque"
                    description="Partez d'un modele VNK pre-redige (politique, contrat, NDA…)."
                    onClick={() => {
                      // Scroll vers le browser ci-dessous
                      const el = document.getElementById("starter-library");
                      el?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    badge="Recommande"
                  />
                  {/* Option 2 : Import */}
                  <StartOptionCard
                    icon={Upload}
                    title="Importer un document existant"
                    description="Importez un PDF, DOCX ou TXT — VNK detecte automatiquement les variables (noms, dates, montants)."
                    onClick={() => setImportOpen(true)}
                    badge="Intelligent"
                  />
                  {/* Option 3 : Partir de zero */}
                  <StartOptionCard
                    icon={FilePlus}
                    title="Partir de zero"
                    description="Creez un modele vide. Vous redigerez tout le contenu manuellement."
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
            <div className="p-5 overflow-y-auto space-y-5">
              <FormSection icon={Layers} title="Identification">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field
                    label="Cle technique"
                    required={type !== "contract"}
                    hint={
                      type === "contract"
                        ? "Optionnel (auto-genere)"
                        : "Immuable une fois cree (a-z, 0-9, _)"
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
                  <Field label="Version" required>
                    <Input
                      value={version}
                      onChange={(e) => setVersion(e.target.value)}
                      placeholder="1.0"
                    />
                  </Field>
                </div>
                <Field label="Titre" required>
                  <Input
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder={
                      type === "legal"
                        ? "Politique de confidentialite"
                        : type === "contract"
                          ? "Contrat CDI - Technicien"
                          : "Politique de teletravail"
                    }
                  />
                </Field>
                <Field label="Categorie">
                  <Select
                    value={category}
                    onValueChange={(v) => setCategory(v)}
                  >
                    <SelectTrigger className="h-9 text-sm">
                      <SelectValue placeholder="Choisir une categorie…" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORY_OPTIONS[type].map((c) => (
                        <SelectItem key={c.value} value={c.value}>
                          {c.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FormSection>
            </div>
          )}

          {step === 3 && (
            <div className="p-5 overflow-y-auto space-y-5">
              <FormSection
                icon={Users}
                title="Public cible"
                description="Laissez vide pour appliquer a tous les employes. Sinon, restreignez aux postes / departements listes."
              >
                <Field
                  label="Postes cibles"
                  hint="Selectionnez des postes existants ou creez-en un nouveau pour cibler ce modele."
                >
                  <PositionMultiPicker
                    inline
                    value={targetPositions}
                    onChange={setTargetPositions}
                    placeholder="Choisir des postes..."
                  />
                </Field>
                <Field label="Departements cibles" hint="Appuyez sur Entree pour ajouter">
                  <ChipsInput
                    values={targetDepartments}
                    onChange={setTargetDepartments}
                    placeholder="Ex : Ingenierie"
                  />
                </Field>
                {type !== "contract" && (
                  <Field label="Options">
                    <label className="flex items-start gap-2 cursor-pointer rounded-md border border-input bg-card px-3 py-2 hover:border-[#0F2D52]/30 transition">
                      <input
                        type="checkbox"
                        checked={isMandatory}
                        onChange={(e) => setIsMandatory(e.target.checked)}
                        className="h-4 w-4 rounded border-input accent-[#0F2D52] mt-0.5"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-foreground">
                          Document obligatoire
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Inclus automatiquement dans le parcours d&apos;onboarding
                          des nouveaux employes cibles.
                        </p>
                      </div>
                    </label>
                  </Field>
                )}
                {/* Bug 2 : Type d'engagement (radio AU-DESSUS de signatureScope) */}
                {type !== "contract" && (
                  <Field
                    label="Type d'engagement"
                    hint="La majorité des documents (politiques, codes, communications) ne nécessitent qu'un accusé de lecture. Réservez la signature manuscrite aux contrats légaux."
                  >
                    <div className="space-y-1.5">
                      {(
                        [
                          {
                            v: "reading_only",
                            title: "Lecture seule (accusé de lecture)",
                            hint: "Recommandé pour politiques, codes de conduite, communications RH.",
                          },
                          {
                            v: "signature",
                            title: "Signature manuscrite",
                            hint: "Obligatoire pour contrats, ententes légales et engagements formels.",
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
                {/* SignatureScope : masque quand reading_only (pas besoin de scope si pas de signature) */}
                {(type === "contract" || acknowledgmentMode === "signature") && (
                  <Field
                    label="Signataires requis"
                    hint="Determine quels blocs Signature apparaitront dans le PDF final et dans l'apercu employe."
                  >
                    <div className="space-y-1.5">
                      {(
                        [
                          {
                            v: "employee_only",
                            title: "Employe seulement",
                            hint: "Politiques internes, codes de conduite, accuses de reception.",
                          },
                          {
                            v: "employer_only",
                            title: "Employeur seulement",
                            hint: "Lettres, attestations et confirmations emises par VNK.",
                          },
                          {
                            v: "both",
                            title: "Les deux signatures",
                            hint: "Contrats et ententes a double signature (employe + employeur).",
                          },
                          {
                            v: "none",
                            title: "Aucune signature",
                            hint: "Documents purement informatifs (memos, bulletins internes).",
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
              {/* Colonne editeur */}
              <div className="flex flex-col min-h-0 border-r">
                <div className="px-5 py-3 border-b bg-muted/30 shrink-0">
                  <div className="flex items-center gap-2">
                    <FileText className="h-3.5 w-3.5 text-[#0F2D52]" />
                    <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
                      Editeur
                    </h4>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-1 min-h-0 overflow-hidden relative">
                  <div className="overflow-y-auto p-4 min-h-0">
                    <TemplateRichEditor
                      value={bodyMarkdown}
                      onChange={setBodyMarkdown}
                      placeholder={"Commencez a rediger… Utilisez la barre d'outils ou le bouton « Inserer un champ » pour ajouter des elements dynamiques (nom, date, salaire…)."}
                      minHeight="380px"
                    />

                    {/* Hint pedagogique */}
                    <div className="mt-3 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2">
                      <Lightbulb className="h-3.5 w-3.5 text-amber-600 shrink-0 mt-0.5" />
                      <p className="text-[11px] text-amber-900 leading-snug">
                        <span className="font-semibold">Conseil :</span> les champs dynamiques apparaissent en <span className="font-semibold text-blue-900">bleu</span> dans l&apos;editeur. Cliquez sur un champ pour le remplacer ou le supprimer. Ils seront automatiquement remplaces par les vraies donnees de l&apos;employe lors de l&apos;envoi.
                      </p>
                    </div>
                  </div>

                  {/* Variable picker overlay (dropdown "Plus de champs") - DESACTIVE */}
                  {false && variablePickerOpen && (
                    <div className="absolute inset-y-0 right-0 w-[260px] bg-card border-l shadow-xl z-10 flex flex-col">
                      <div className="px-3 py-2 border-b bg-muted/30 flex items-center justify-between shrink-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
                          Tous les champs
                        </span>
                        <button
                          type="button"
                          onClick={() => setVariablePickerOpen(false)}
                          className="text-muted-foreground hover:text-foreground transition"
                          aria-label="Fermer le panneau"
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

              {/* Colonne apercu PDF live */}
              <div className="flex flex-col min-h-0">
                <div className="px-5 py-3 border-b bg-muted/30 shrink-0 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-[#0F2D52]" />
                  <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
                    Apercu PDF live
                  </h4>
                </div>
                <div className="flex-1 px-4 py-3 min-h-0 overflow-hidden">
                  <TemplatePreview
                    bodyMarkdown={bodyMarkdown}
                    selectedEmployeeId={selectedPreviewId}
                    onChangeEmployee={setSelectedPreviewId}
                    employees={previewEmployees}
                    title={title || `Apercu ${TYPE_LABELS[type].singular}`}
                    documentType={type}
                    metadata={{ version: version || "1.0" }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2 sm:justify-between">
          <div className="flex items-center gap-2">
            {((mode === "create" && step > 1) || (mode === "edit" && step > 2)) && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goPrev}
                disabled={submitting}
                className="gap-1.5"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Precedent
              </Button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={onClose}
              disabled={submitting}
            >
              <X className="h-3.5 w-3.5 mr-1.5" />
              Annuler
            </Button>
            {step === 1 && mode === "create" ? null : step < 4 ? (
              <Button
                type="button"
                size="sm"
                onClick={goNext}
                disabled={!canGoNext}
                className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white gap-1.5"
              >
                Suivant
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
                {mode === "edit" ? "Enregistrer" : "Creer le template"}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>

      {/* Import dialog (option "Importer un document existant" - etape 1) */}
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
          Ajouter
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

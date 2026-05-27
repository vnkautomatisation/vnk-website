"use client";
// ─────────────────────────────────────────────────────────
// ImportTemplateDialog — modal d'import intelligent de
// templates (paste OU upload .txt / .pdf / .docx).
//
// Pipeline :
//   1. Onglet "Coller" ou "Téléverser" -> POST /api/admin/document-templates/import
//   2. Affiche : type detecte, titre suggere, variables detectees
//   3. L'utilisateur coche/decoche les substitutions
//   4. "Importer" -> onImported({ bodyMarkdown, suggestedTitle, ... })
//
// Theme VNK : header navy gradient, FormSection, footer sticky,
// ActionTooltip, lucide-react, FR uniquement.
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  AtSign,
  Building2,
  Calendar,
  CheckCircle2,
  ClipboardPaste,
  DollarSign,
  Eye,
  FileText,
  FileType,
  Hash,
  Loader2,
  MapPin,
  Phone,
  Percent,
  Sparkles,
  Tag,
  Timer,
  Upload,
  User,
  Wand2,
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
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FormSection, Field } from "@/components/admin/form-section";
import { MarkdownView } from "@/components/admin/markdown-view";
import { cn } from "@/lib/utils";
import {
  applySubstitutions,
  type DetectedCategory,
  type DetectedVariable,
} from "@/lib/document-templates/variable-detector";

// ─── Types ────────────────────────────────────────────────

type ImportDocumentType =
  | "contract"
  | "legal"
  | "policy"
  | "letter"
  | "onboarding"
  | "unknown";

type ImportResult = {
  rawText: string;
  markdown: string;
  detectedVariables: DetectedVariable[];
  suggestedDocumentType: ImportDocumentType;
  suggestedTitle: string;
  metadata: {
    sourceFormat: "txt" | "pdf" | "docx" | "paste";
    pageCount?: number;
    wordCount: number;
  };
};

export type ImportTemplateDialogResult = {
  bodyMarkdown: string;
  suggestedTitle: string;
  suggestedDocumentType: Exclude<ImportDocumentType, "unknown">;
  acceptedSubstitutions: number;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onImported: (result: ImportTemplateDialogResult) => void;
};

// ─── Helpers UI ───────────────────────────────────────────

const DOC_TYPE_OPTIONS: { value: Exclude<ImportDocumentType, "unknown">; label: string }[] = [
  { value: "contract", label: "Contrat" },
  { value: "legal", label: "Document légal" },
  { value: "policy", label: "Politique" },
  { value: "letter", label: "Lettre" },
  { value: "onboarding", label: "Accusé de réception / onboarding" },
];

const CATEGORY_LABEL: Record<DetectedCategory, string> = {
  name: "Noms",
  email: "Courriels",
  phone: "Téléphones",
  address: "Adresses",
  salary: "Salaires",
  rate: "Taux horaires",
  date: "Dates",
  duration: "Durées",
  percent: "Pourcentages",
  company: "Entreprises",
  neq: "Numéros NEQ",
  position: "Postes",
  hours: "Heures / semaine",
  other: "Autres",
};

const CATEGORY_ICON: Record<DetectedCategory, React.ComponentType<{ className?: string }>> = {
  name: User,
  email: AtSign,
  phone: Phone,
  address: MapPin,
  salary: DollarSign,
  rate: DollarSign,
  date: Calendar,
  duration: Timer,
  percent: Percent,
  company: Building2,
  neq: Hash,
  position: Tag,
  hours: Timer,
  other: FileType,
};

const ACCEPTED_EXTENSIONS = ".txt,.pdf,.docx";

// Variables connues -> label pour les dropdowns d'alternatives
function variableLabel(key: string): string {
  // Map minimaliste : on prend juste la cle sans accolades
  return key.replace(/[{}]/g, "");
}

// ─── Composant principal ──────────────────────────────────

export function ImportTemplateDialog({ open, onClose, onImported }: Props) {
  const [tab, setTab] = useState<"paste" | "upload">("paste");
  const [pasted, setPasted] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Edition post-analyse
  const [editedTitle, setEditedTitle] = useState("");
  const [editedType, setEditedType] = useState<Exclude<ImportDocumentType, "unknown">>(
    "contract"
  );
  // Map index -> { accepted, chosenVariable }
  const [decisions, setDecisions] = useState<
    Record<number, { accepted: boolean; chosenVariable: string }>
  >({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Reset complet quand le modal s'ouvre/ferme
  useEffect(() => {
    if (!open) return;
    setTab("paste");
    setPasted("");
    setFile(null);
    setAnalyzing(false);
    setResult(null);
    setError(null);
    setEditedTitle("");
    setEditedType("contract");
    setDecisions({});
  }, [open]);

  // Quand un resultat arrive, pre-remplit decisions + titre + type
  useEffect(() => {
    if (!result) return;
    setEditedTitle(result.suggestedTitle);
    setEditedType(
      result.suggestedDocumentType === "unknown"
        ? "contract"
        : result.suggestedDocumentType
    );
    const next: Record<number, { accepted: boolean; chosenVariable: string }> = {};
    result.detectedVariables.forEach((v, idx) => {
      next[idx] = {
        accepted: v.confidence >= 0.8,
        chosenVariable: v.suggestedVariable,
      };
    });
    setDecisions(next);
  }, [result]);

  // ─── Actions ────────────────────────────────────────────

  const handleAnalyze = async () => {
    setError(null);
    setAnalyzing(true);
    try {
      let res: Response;
      if (tab === "paste") {
        if (!pasted.trim() || pasted.trim().length < 20) {
          throw new Error("Collez au moins 20 caractères de texte avant d'analyser.");
        }
        res = await fetch("/api/admin/document-templates/import", {
          method: "POST",
          headers: { "content-type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ text: pasted }),
        });
      } else {
        if (!file) {
          throw new Error("Choisissez un fichier à téléverser.");
        }
        const fd = new FormData();
        fd.append("file", file);
        res = await fetch("/api/admin/document-templates/import", {
          method: "POST",
          credentials: "same-origin",
          body: fd,
        });
      }
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Échec de l'analyse (HTTP ${res.status})`);
      }
      const data = (await res.json()) as ImportResult;
      setResult(data);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erreur lors de l'analyse";
      setError(msg);
      toast.error(msg);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleFilePicked = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 10 * 1024 * 1024) {
      toast.error("Fichier trop volumineux (max 10 Mo).");
      return;
    }
    const ext = f.name.toLowerCase().split(".").pop();
    if (!["txt", "pdf", "docx"].includes(ext ?? "")) {
      toast.error("Format non supporté. Utilisez .txt, .pdf ou .docx.");
      return;
    }
    setFile(f);
  };

  const handleDropFile = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    handleFilePicked(f);
  };

  // ─── Substitutions appliquees ──────────────────────────

  const acceptedSubstitutions = useMemo(() => {
    if (!result) return [];
    return result.detectedVariables
      .map((v, idx) => ({ v, idx }))
      .filter(({ idx }) => decisions[idx]?.accepted)
      .map(({ v, idx }) => ({
        ...v,
        suggestedVariable: decisions[idx]?.chosenVariable ?? v.suggestedVariable,
      }));
  }, [result, decisions]);

  const finalMarkdown = useMemo(() => {
    if (!result) return "";
    if (acceptedSubstitutions.length === 0) return result.markdown;
    // Applique sur le texte cleane (rawText) puis re-structure
    const substituted = applySubstitutions(result.rawText, acceptedSubstitutions);
    // On essaie de garder la structure markdown de result.markdown :
    // pour ca on applique aussi sur le markdown si les positions correspondent
    // mais comme markdown peut differer du rawText (ex: "# titre"),
    // l'approche la plus sure : on substitue dans markdown ET dans rawText
    // pour les detections dont le match exact apparait encore.
    return applyByMatchString(result.markdown, acceptedSubstitutions) || substituted;
  }, [result, acceptedSubstitutions]);

  const previewHighlighted = useMemo(() => {
    // Surligne les variables {{...}} en bleu pour le preview
    return finalMarkdown.replace(
      /\{\{\s*([\w.]+)\s*\}\}/g,
      (m) =>
        `<span class="bg-blue-100 text-blue-800 px-1 rounded font-mono text-[0.85em]">${escapeHtml(
          m
        )}</span>`
    );
  }, [finalMarkdown]);

  const handleImport = () => {
    if (!result) return;
    if (!editedTitle.trim()) {
      toast.error("Le titre est requis.");
      return;
    }
    onImported({
      bodyMarkdown: finalMarkdown,
      suggestedTitle: editedTitle.trim(),
      suggestedDocumentType: editedType,
      acceptedSubstitutions: acceptedSubstitutions.length,
    });
    onClose();
  };

  // ─── Groupement par categorie pour l'UI ─────────────────

  const groupedDetections = useMemo(() => {
    if (!result) return [];
    const groups = new Map<DetectedCategory, { idx: number; v: DetectedVariable }[]>();
    result.detectedVariables.forEach((v, idx) => {
      if (!groups.has(v.category)) groups.set(v.category, []);
      groups.get(v.category)!.push({ idx, v });
    });
    return Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
  }, [result]);

  const hasResult = !!result;
  const totalDetected = result?.detectedVariables.length ?? 0;
  const totalAccepted = Object.values(decisions).filter((d) => d.accepted).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !analyzing && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] max-h-[95vh] p-0 overflow-hidden flex flex-col">
        {/* Header navy gradient */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Wand2 className="h-4 w-4" />
              Importer un document
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Collez un document existant ou téléversez-le. Le système détecte
              automatiquement les valeurs à transformer en variables dynamiques.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto min-h-0">
          {!hasResult ? (
            <div className="p-5">
              <Tabs value={tab} onValueChange={(v) => setTab(v as "paste" | "upload")}>
                <TabsList className="grid grid-cols-2 w-full max-w-md">
                  <TabsTrigger value="paste" className="gap-1.5">
                    <ClipboardPaste className="h-3.5 w-3.5" />
                    Coller du texte
                  </TabsTrigger>
                  <TabsTrigger value="upload" className="gap-1.5">
                    <Upload className="h-3.5 w-3.5" />
                    Téléverser un fichier
                  </TabsTrigger>
                </TabsList>

                <TabsContent value="paste" className="space-y-3">
                  <FormSection
                    icon={ClipboardPaste}
                    title="Coller le contenu"
                    description="Copiez le texte d'un contrat, d'une lettre ou d'une politique existante."
                  >
                    <Textarea
                      value={pasted}
                      onChange={(e) => setPasted(e.target.value)}
                      rows={14}
                      placeholder="Collez ici le texte du document à importer…"
                      className="font-mono text-xs"
                    />
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                      <span>{pasted.length.toLocaleString("fr-CA")} caractères</span>
                      <span>Minimum 20 caractères</span>
                    </div>
                  </FormSection>
                </TabsContent>

                <TabsContent value="upload" className="space-y-3">
                  <FormSection
                    icon={Upload}
                    title="Téléverser un fichier"
                    description="Formats acceptés : .txt, .pdf ou .docx — 10 Mo maximum."
                  >
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept={ACCEPTED_EXTENSIONS}
                      className="sr-only"
                      onChange={(e) => handleFilePicked(e.target.files?.[0] ?? undefined)}
                    />
                    {!file ? (
                      <div
                        onDrop={handleDropFile}
                        onDragOver={(e) => e.preventDefault()}
                        onClick={() => fileInputRef.current?.click()}
                        className="cursor-pointer rounded-md border-2 border-dashed border-input bg-muted/20 hover:bg-muted/40 hover:border-[#0F2D52]/30 transition p-8 flex flex-col items-center gap-2"
                      >
                        <Upload className="h-7 w-7 text-muted-foreground" />
                        <p className="text-sm font-medium">
                          Cliquez ou déposez un fichier ici
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          .txt · .pdf · .docx — max 10 Mo
                        </p>
                      </div>
                    ) : (
                      <div className="flex items-center gap-3 rounded-md border bg-muted/20 px-3 py-2.5">
                        <FileText className="h-5 w-5 text-[#0F2D52]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{file.name}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {(file.size / 1024).toFixed(1)} ko
                          </p>
                        </div>
                        <ActionTooltip label="Retirer le fichier">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => setFile(null)}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </ActionTooltip>
                      </div>
                    )}
                  </FormSection>
                </TabsContent>
              </Tabs>

              {error && (
                <div className="mt-4 flex items-start gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Colonne 1 : metadonnees + variables */}
              <div className="space-y-5 min-w-0">
                <FormSection icon={Sparkles} title="Détection automatique">
                  <Field
                    label="Type de document détecté"
                    hint={
                      result?.suggestedDocumentType === "unknown"
                        ? "Aucun type évident détecté — choisissez manuellement."
                        : undefined
                    }
                  >
                    <Select
                      value={editedType}
                      onValueChange={(v) =>
                        setEditedType(v as Exclude<ImportDocumentType, "unknown">)
                      }
                    >
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {DOC_TYPE_OPTIONS.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Titre suggéré" required>
                    <Input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      placeholder="Titre du modèle"
                    />
                  </Field>
                  <div className="grid grid-cols-3 gap-2 text-[11px]">
                    <Stat
                      icon={FileText}
                      label="Mots"
                      value={result?.metadata.wordCount.toLocaleString("fr-CA") ?? "0"}
                    />
                    <Stat
                      icon={Sparkles}
                      label="Variables"
                      value={String(totalDetected)}
                    />
                    <Stat
                      icon={CheckCircle2}
                      label="Acceptées"
                      value={`${totalAccepted}/${totalDetected}`}
                    />
                  </div>
                </FormSection>

                <FormSection
                  icon={Wand2}
                  title={`Variables détectées (${totalDetected})`}
                  description={
                    totalDetected === 0
                      ? "Aucune valeur remplaçable détectée — le contenu sera importé tel quel."
                      : "Décochez les substitutions que vous ne souhaitez pas appliquer."
                  }
                >
                  {groupedDetections.length === 0 ? (
                    <div className="rounded-md border border-dashed border-input bg-muted/20 p-4 text-center text-xs text-muted-foreground">
                      Aucune détection.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[42vh] overflow-y-auto pr-1">
                      {groupedDetections.map(([cat, items]) => {
                        const Icon = CATEGORY_ICON[cat];
                        return (
                          <div key={cat} className="rounded-md border bg-card">
                            <div className="flex items-center gap-2 border-b bg-muted/30 px-2.5 py-1.5">
                              <Icon className="h-3.5 w-3.5 text-[#0F2D52]" />
                              <span className="text-[11px] font-semibold uppercase tracking-wider text-[#0F2D52]">
                                {CATEGORY_LABEL[cat]} ({items.length})
                              </span>
                            </div>
                            <ul className="divide-y">
                              {items.map(({ idx, v }) => (
                                <DetectionRow
                                  key={idx}
                                  detection={v}
                                  accepted={decisions[idx]?.accepted ?? false}
                                  chosenVariable={
                                    decisions[idx]?.chosenVariable ?? v.suggestedVariable
                                  }
                                  onToggle={(accepted) =>
                                    setDecisions((d) => ({
                                      ...d,
                                      [idx]: {
                                        accepted,
                                        chosenVariable:
                                          d[idx]?.chosenVariable ?? v.suggestedVariable,
                                      },
                                    }))
                                  }
                                  onChangeVariable={(chosenVariable) =>
                                    setDecisions((d) => ({
                                      ...d,
                                      [idx]: {
                                        accepted: d[idx]?.accepted ?? true,
                                        chosenVariable,
                                      },
                                    }))
                                  }
                                />
                              ))}
                            </ul>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </FormSection>
              </div>

              {/* Colonne 2 : preview markdown final */}
              <div className="space-y-3 min-w-0">
                <FormSection
                  icon={Eye}
                  title="Aperçu Markdown final"
                  description="Le contenu importé avec les variables appliquées. Les substitutions sont surlignées en bleu."
                >
                  <div className="rounded-md border bg-card max-h-[60vh] overflow-y-auto p-4">
                    {finalMarkdown.trim() ? (
                      <div
                        className="prose prose-sm max-w-none text-sm leading-relaxed [&_h1]:text-lg [&_h1]:font-bold [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:mt-3 [&_h2]:mb-2 [&_h3]:font-semibold [&_h3]:mt-2 [&_h3]:mb-1 [&_p]:my-2"
                        dangerouslySetInnerHTML={{ __html: renderHighlightedMarkdown(finalMarkdown) }}
                      />
                    ) : (
                      <MarkdownView>{finalMarkdown}</MarkdownView>
                    )}
                  </div>
                </FormSection>
              </div>
            </div>
          )}
        </div>

        {/* Footer sticky */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2 sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            disabled={analyzing}
          >
            Annuler
          </Button>
          <div className="flex items-center gap-2">
            {hasResult && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setResult(null);
                  setDecisions({});
                }}
              >
                Recommencer
              </Button>
            )}
            {!hasResult ? (
              <Button
                type="button"
                size="sm"
                onClick={handleAnalyze}
                disabled={
                  analyzing ||
                  (tab === "paste" ? pasted.trim().length < 20 : !file)
                }
                className="bg-[#0F2D52] hover:bg-[#0F2D52]/90"
              >
                {analyzing ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                    Analyse en cours…
                  </>
                ) : (
                  <>
                    <Sparkles className="h-3.5 w-3.5 mr-1.5" />
                    Analyser
                  </>
                )}
              </Button>
            ) : (
              <Button
                type="button"
                size="sm"
                onClick={handleImport}
                className="bg-[#0F2D52] hover:bg-[#0F2D52]/90"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                Importer dans le modèle
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Sous-composants ──────────────────────────────────────

function Stat({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-1.5 rounded-md border bg-card px-2 py-1.5">
      <Icon className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
      <div className="min-w-0">
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none">
          {label}
        </p>
        <p className="text-xs font-semibold truncate">{value}</p>
      </div>
    </div>
  );
}

function DetectionRow({
  detection,
  accepted,
  chosenVariable,
  onToggle,
  onChangeVariable,
}: {
  detection: DetectedVariable;
  accepted: boolean;
  chosenVariable: string;
  onToggle: (accepted: boolean) => void;
  onChangeVariable: (value: string) => void;
}) {
  const alternatives =
    detection.alternatives && detection.alternatives.length > 0
      ? Array.from(new Set([detection.suggestedVariable, ...detection.alternatives]))
      : [detection.suggestedVariable];

  return (
    <li className="px-2.5 py-2 flex items-start gap-2 text-xs">
      <input
        type="checkbox"
        checked={accepted}
        onChange={(e) => onToggle(e.target.checked)}
        className="h-4 w-4 rounded border-input accent-[#0F2D52] mt-0.5 shrink-0"
        aria-label="Appliquer cette substitution"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2 flex-wrap">
          <code className="bg-yellow-100 text-yellow-900 px-1.5 py-0.5 rounded text-[11px] font-mono break-all">
            {detection.match}
          </code>
          <span className="text-muted-foreground">→</span>
          {alternatives.length === 1 ? (
            <code className="bg-blue-100 text-blue-800 px-1.5 py-0.5 rounded text-[11px] font-mono">
              {chosenVariable}
            </code>
          ) : (
            <Select value={chosenVariable} onValueChange={onChangeVariable}>
              <SelectTrigger className="h-7 text-[11px] w-auto min-w-[220px] gap-1.5">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {alternatives.map((alt) => (
                  <SelectItem key={alt} value={alt} className="font-mono text-[11px]">
                    {variableLabel(alt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span>{detection.variableLabel}</span>
          <span className="opacity-60">·</span>
          <ConfidenceBadge value={detection.confidence} />
        </div>
      </div>
    </li>
  );
}

function ConfidenceBadge({ value }: { value: number }) {
  const pct = Math.round(value * 100);
  const color =
    value >= 0.9
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : value >= 0.75
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-slate-700 bg-slate-50 border-slate-200";
  return (
    <span
      className={cn(
        "inline-flex items-center rounded border px-1 py-0 text-[9px] font-semibold",
        color
      )}
    >
      {pct}%
    </span>
  );
}

// ─── Helpers internes ─────────────────────────────────────

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Substitution par match-string : pour chaque detection, on remplace
 * la 1ere occurrence du texte original par la variable choisie.
 * Plus robuste qu'un slice par position quand le markdown a divergeance
 * structurellement du rawText (ex: "# Titre" ajoute au debut).
 */
function applyByMatchString(
  markdown: string,
  accepted: { match: string; suggestedVariable: string }[],
): string {
  if (!accepted.length) return markdown;
  let out = markdown;
  // On ordonne par longueur de match desc pour eviter qu'un sous-match
  // (ex: "Tremblay") n'avale le superset ("Jean Tremblay")
  const sorted = [...accepted].sort((a, b) => b.match.length - a.match.length);
  for (const a of sorted) {
    if (!a.match) continue;
    const idx = out.indexOf(a.match);
    if (idx === -1) continue;
    out = out.slice(0, idx) + a.suggestedVariable + out.slice(idx + a.match.length);
  }
  return out;
}

/**
 * Rend le markdown final avec les variables {{...}} surlignees en bleu.
 * Reutilise une logique simplifiee identique a MarkdownView mais
 * preserve les <span> de highlight.
 */
function renderHighlightedMarkdown(md: string): string {
  if (!md) return "";
  // Escape d'abord
  let s = escapeHtml(md);
  // Highlight variables (apres escape pour qu'elles ne soient pas reechappees)
  s = s.replace(
    /\{\{\s*([\w.]+)\s*\}\}/g,
    (_m, key: string) =>
      `<span class="bg-blue-100 text-blue-800 px-1 rounded font-mono text-[0.85em]">{{${key}}}</span>`
  );
  // Headings
  s = s.replace(/^### (.+)$/gm, "<h3>$1</h3>");
  s = s.replace(/^## (.+)$/gm, "<h2>$1</h2>");
  s = s.replace(/^# (.+)$/gm, "<h1>$1</h1>");
  // Bold / italic / inline code
  s = s.replace(/`([^`\n]+)`/g, "<code>$1</code>");
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*\n]+)\*/g, "<em>$1</em>");
  s = s.replace(/_([^_\n]+)_/g, "<em>$1</em>");
  // Listes + paragraphes
  const lines = s.split("\n");
  const out: string[] = [];
  let inUl = false;
  let buffer: string[] = [];
  const flush = () => {
    if (buffer.length) {
      out.push(`<p>${buffer.join(" ").trim()}</p>`);
      buffer = [];
    }
  };
  const closeUl = () => {
    if (inUl) {
      out.push("</ul>");
      inUl = false;
    }
  };
  for (const line of lines) {
    const t = line.trim();
    if (!t) {
      flush();
      closeUl();
      continue;
    }
    if (/^<h[1-3]>/.test(t)) {
      flush();
      closeUl();
      out.push(t);
      continue;
    }
    if (/^[-*]\s+/.test(t)) {
      flush();
      if (!inUl) {
        out.push("<ul class='list-disc pl-6'>");
        inUl = true;
      }
      out.push(`<li>${t.replace(/^[-*]\s+/, "")}</li>`);
      continue;
    }
    closeUl();
    buffer.push(t);
  }
  flush();
  closeUl();
  return out.join("\n");
}

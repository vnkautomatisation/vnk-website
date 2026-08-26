"use client";
// =============================================================
// HandbooksAdminView — gestion des cahiers de l'employe (handbook).
//
// Un handbook regroupe N templates legaux ordonnes en un livre signe
// une seule fois par l'employe. UI :
//   - Liste des cahiers en cards (titre, sous-titre, version, scope,
//     nb templates, conformite X/Y signataires)
//   - Bouton "Creer un cahier" -> Dialog (title, subtitle, coverIntro,
//     templates multi-select avec ordre + isRequired + signatureScope)
//   - Action "Modifier" et "Archiver"
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  BookOpen,
  Plus,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Loader2,
  Trash2,
  Pencil,
  X,
  CheckCircle2,
  Users,
  ListChecks,
  Archive,
  FileText,
  Eye,
  Copy,
} from "lucide-react";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FormSection, Field } from "@/components/admin/form-section";
import {
  createHandbookAction,
  updateHandbookAction,
  archiveHandbookAction,
  duplicateHandbookAction,
} from "@/app/actions/hr-document-handbooks";
import { detectPlaceholders } from "@/lib/document-templates/placeholder-detector";

// ---------- Types ------------------------------------------------
type HandbookItem = {
  id: number;
  templateId: number;
  orderIndex: number;
  template: { id: number; title: string; version: string; category: string };
};
type HandbookSignature = {
  id: number;
  adminId: number;
  signedAt: string;
  version: string;
  finalPdfUrl: string | null;
};
type Handbook = {
  id: number;
  key: string;
  title: string;
  subtitle: string | null;
  coverIntro: string | null;
  version: string;
  isActive: boolean;
  isRequired: boolean;
  signatureScope: string;
  createdAt: string;
  updatedAt: string;
  items: HandbookItem[];
  signatures: HandbookSignature[];
  /** Demande 7 : valeurs RH des placeholders [CHAMP] (clef -> valeur). */
  customFieldValues?: Record<string, string> | null;
};
type Template = {
  id: number;
  title: string;
  category: string;
  version: string;
  /** Demande 7 : bodyMarkdown necessaire pour detecter les placeholders. */
  bodyMarkdown?: string;
};
type Employee = { id: number; fullName: string | null; email: string };

type SignatureScope = "employee_only" | "employer_only" | "both" | "none";

const SCOPE_LABEL: Record<SignatureScope, string> = {
  employee_only: "Employe seulement",
  employer_only: "Employeur seulement",
  both: "Employe + Employeur",
  none: "Aucune signature",
};

// =============================================================
//                       MAIN VIEW
// =============================================================
export function HandbooksAdminView({
  handbooks,
  templates,
  employees,
}: {
  handbooks: Handbook[];
  templates: Template[];
  employees: Employee[];
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Handbook | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Handbook | null>(null);
  // Mission 3 : Apercu PDF + Dupliquer
  const [previewHandbook, setPreviewHandbook] = useState<Handbook | null>(null);
  const [duplicateBusyId, setDuplicateBusyId] = useState<number | null>(null);

  const openCreate = () => {
    setEditing(null);
    setEditorOpen(true);
  };
  const openEdit = (h: Handbook) => {
    setEditing(h);
    setEditorOpen(true);
  };
  const openPreview = (h: Handbook) => setPreviewHandbook(h);
  const handleDuplicate = async (h: Handbook) => {
    setDuplicateBusyId(h.id);
    try {
      const r = await duplicateHandbookAction({ id: h.id });
      if (r.success) {
        toast.success("Cahier duplique (archive). Modifiez puis publiez.");
        router.refresh();
      } else {
        toast.error(r.error || "");
      }
    } finally {
      setDuplicateBusyId(null);
    }
  };

  const activeEmployeeCount = employees.length;

  return (
    <div className="space-y-4">
      {/* Header navy gradient VNK */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div
          className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32"
          aria-hidden
        />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <a
              href="/admin/employes/documents"
              className="h-8 w-8 rounded-lg bg-white/10 hover:bg-white/20 transition flex items-center justify-center"
              title="Retour aux documents"
            >
              <ArrowLeft className="h-4 w-4" />
            </a>
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">Cahiers de l&apos;employe</h1>
              <p className="text-xs text-white/80">
                Regroupez plusieurs politiques en un seul cahier que l&apos;employe
                signe en une fois.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Creer un cahier
          </Button>
        </div>
      </div>

      {handbooks.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-semibold">Aucun cahier cree pour l&apos;instant</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            Creez un cahier pour regrouper plusieurs politiques internes en un
            seul document que l&apos;employe signe en une seule fois.
          </p>
          <Button
            size="sm"
            onClick={openCreate}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            Creer mon premier cahier
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {handbooks.map((h) => {
            const signedSet = new Set(h.signatures.map((s) => s.adminId));
            const signedCount = signedSet.size;
            const percent =
              activeEmployeeCount > 0
                ? Math.round((signedCount / activeEmployeeCount) * 100)
                : 0;
            return (
              <Card
                key={h.id}
                className={`p-4 space-y-3 border-l-4 ${
                  !h.isActive
                    ? "border-l-muted opacity-70"
                    : percent === 100
                      ? "border-l-emerald-500"
                      : h.isRequired
                        ? "border-l-amber-500"
                        : "border-l-[#0F2D52]"
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-bold text-[#0F2D52] truncate">
                        {h.title}
                      </h3>
                      {h.isRequired && (
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-red-50 text-red-700 border-red-200"
                        >
                          {tc("required")}
                        </Badge>
                      )}
                      {!h.isActive && (
                        <Badge
                          variant="outline"
                          className="text-[9px] bg-muted text-muted-foreground"
                        >
                          Archive
                        </Badge>
                      )}
                    </div>
                    {h.subtitle && (
                      <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                        {h.subtitle}
                      </p>
                    )}
                  </div>
                  <Badge
                    variant="outline"
                    className="text-[10px] border-[#0F2D52]/30 text-[#0F2D52] shrink-0"
                  >
                    v{h.version}
                  </Badge>
                </div>

                <div className="rounded-md bg-muted/30 p-2.5 space-y-1">
                  {/* Demande 2 : ligne sobre "Manuel de l'employe · vX" au lieu de "N chapitres" en gros. */}
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      Manuel de l&apos;employe
                    </span>
                    <span className="font-medium text-[#0F2D52]">v{h.version}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      Signe par
                    </span>
                    <span
                      className={
                        percent === 100
                          ? "font-semibold text-emerald-700"
                          : "font-semibold text-amber-700"
                      }
                    >
                      {signedCount}/{activeEmployeeCount} ({percent}%)
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground">Signataires</span>
                    <span className="font-medium">
                      {SCOPE_LABEL[(h.signatureScope as SignatureScope) ?? "employee_only"]}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-1 border-t">
                  <ActionTooltip label="Apercu PDF">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7 text-[#0F2D52]"
                      onClick={() => openPreview(h)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </ActionTooltip>
                  <ActionTooltip label={tc("edit")}>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => openEdit(h)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </ActionTooltip>
                  <ActionTooltip label="Dupliquer">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-7 w-7"
                      onClick={() => handleDuplicate(h)}
                      disabled={duplicateBusyId === h.id}
                    >
                      {duplicateBusyId === h.id ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </ActionTooltip>
                  {h.isActive && (
                    <ActionTooltip label="Archiver">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 hover:text-destructive"
                        onClick={() => setConfirmArchive(h)}
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </ActionTooltip>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      <HandbookEditorDialog
        open={editorOpen}
        handbook={editing}
        availableTemplates={templates}
        onClose={() => {
          setEditorOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          router.refresh();
        }}
      />

      <ConfirmDialog
        open={!!confirmArchive}
        onOpenChange={(o) => !o && setConfirmArchive(null)}
        title={`Archiver « ${confirmArchive?.title ?? ""} » ?`}
        description="Le cahier ne sera plus propose aux nouveaux employes. Les signatures deja realisees sont conservees."
        confirmLabel="Archiver"
        variant="destructive"
        onConfirm={async () => {
          if (!confirmArchive) return;
          const r = await archiveHandbookAction({ id: confirmArchive.id });
          if (r.success) {
            toast.success("Cahier archive");
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
          setConfirmArchive(null);
        }}
      />

      {/* Mission 3 : Apercu PDF du cahier complet */}
      <PdfPreviewModal
        open={!!previewHandbook}
        url={previewHandbook ? `/api/admin/document-handbooks/${previewHandbook.id}/preview-pdf` : null}
        title={previewHandbook ? `Apercu : ${previewHandbook.title}` : ""}
        description={previewHandbook ? `v${previewHandbook.version} - Manuel de l'employe VNK` : undefined}
        downloadFilename={previewHandbook ? `${previewHandbook.key}-v${previewHandbook.version}.pdf` : undefined}
        onClose={() => setPreviewHandbook(null)}
      />
    </div>
  );
}

// =============================================================
//   DIALOG : Create / edit handbook
// =============================================================
function HandbookEditorDialog({
  open,
  handbook,
  availableTemplates,
  onClose,
  onSaved,
}: {
  open: boolean;
  handbook: Handbook | null;
  availableTemplates: Template[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const tc = useTranslations("common");
  const mode: "create" | "edit" = handbook ? "edit" : "create";
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverIntro, setCoverIntro] = useState("");
  const [version, setVersion] = useState("1.0");
  const [isRequired, setIsRequired] = useState(false);
  const [signatureScope, setSignatureScope] = useState<SignatureScope>("employee_only");
  const [orderedIds, setOrderedIds] = useState<number[]>([]);
  // Demande 7 : valeurs RH pour les placeholders [CHAMP] des chapitres.
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, string>>({});
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (handbook) {
      setTitle(handbook.title);
      setSubtitle(handbook.subtitle ?? "");
      setCoverIntro(handbook.coverIntro ?? "");
      setVersion(handbook.version);
      setIsRequired(handbook.isRequired);
      setSignatureScope((handbook.signatureScope as SignatureScope) ?? "employee_only");
      setOrderedIds(handbook.items.map((it) => it.templateId));
      setCustomFieldValues((handbook.customFieldValues ?? {}) as Record<string, string>);
    } else {
      setTitle("");
      setSubtitle("");
      setCoverIntro("");
      setVersion("1.0");
      setIsRequired(false);
      setSignatureScope("employee_only");
      setOrderedIds([]);
      setCustomFieldValues({});
    }
    setPending(false);
  }, [open, handbook]);

  const tplMap = useMemo(
    () => new Map(availableTemplates.map((t) => [t.id, t])),
    [availableTemplates],
  );

  const unselectedTemplates = useMemo(
    () => availableTemplates.filter((t) => !orderedIds.includes(t.id)),
    [availableTemplates, orderedIds],
  );

  // Demande 7 : detecte tous les placeholders [CHAMP] dans les chapitres inclus.
  // Dedoublonne par cle pour eviter de demander le meme champ 2x.
  const placeholderKeys = useMemo(() => {
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const id of orderedIds) {
      const t = tplMap.get(id);
      if (!t?.bodyMarkdown) continue;
      for (const k of detectPlaceholders(t.bodyMarkdown)) {
        if (!seen.has(k)) {
          seen.add(k);
          ordered.push(k);
        }
      }
    }
    // Inclut aussi le coverIntro
    if (coverIntro) {
      for (const k of detectPlaceholders(coverIntro)) {
        if (!seen.has(k)) {
          seen.add(k);
          ordered.push(k);
        }
      }
    }
    return ordered;
  }, [orderedIds, tplMap, coverIntro]);

  const missingPlaceholderCount = placeholderKeys.filter(
    (k) => !customFieldValues[k] || !customFieldValues[k].trim(),
  ).length;

  const canSubmit = title.trim().length >= 2 && orderedIds.length > 0 && !pending;

  const move = (idx: number, delta: number) => {
    const next = [...orderedIds];
    const target = idx + delta;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setOrderedIds(next);
  };

  const remove = (id: number) => {
    setOrderedIds((prev) => prev.filter((x) => x !== id));
  };

  const add = (id: number) => {
    setOrderedIds((prev) => (prev.includes(id) ? prev : [...prev, id]));
  };

  const submit = async () => {
    if (!canSubmit) return;
    setPending(true);
    try {
      // Demande 7 : on ne garde que les cles non vides pour eviter de
      // stocker des champs orphelins.
      const cleanedValues: Record<string, string> = {};
      for (const [k, v] of Object.entries(customFieldValues)) {
        const trimmed = (v ?? "").trim();
        if (trimmed) cleanedValues[k] = trimmed;
      }
      const payload = {
        title: title.trim(),
        subtitle: subtitle.trim() || null,
        coverIntro: coverIntro.trim() || null,
        version: version.trim() || "1.0",
        isRequired,
        isActive: true,
        signatureScope,
        templateIds: orderedIds,
        customFieldValues: Object.keys(cleanedValues).length > 0 ? cleanedValues : null,
      };
      const r =
        mode === "edit" && handbook
          ? await updateHandbookAction({ id: handbook.id, ...payload })
          : await createHandbookAction(payload);
      if (!r.success) throw new Error(r.error || "Erreur");
      toast.success(
        mode === "edit" ? "Cahier mis a jour" : "Cahier cree",
      );
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erreur";
      toast.error(msg);
    } finally {
      setPending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !pending && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              {mode === "edit" ? "Modifier le cahier" : "Nouveau cahier"}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Regroupez plusieurs politiques en un seul livre que l&apos;employe
              signera en une seule fois.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <FormSection icon={BookOpen} title="Identite du cahier">
            <Field label="Titre" required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ex : Cahier d'accueil 2026"
              />
            </Field>
            <Field label="Sous-titre" hint="Optionnel — affiche en page de garde">
              <Input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder="Politiques internes et code de conduite"
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Edition / version" required>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0"
                />
              </Field>
              <Field label="Signataires requis" required>
                <Select
                  value={signatureScope}
                  onValueChange={(v) => setSignatureScope(v as SignatureScope)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee_only">Employe seulement</SelectItem>
                    <SelectItem value="employer_only">Employeur seulement</SelectItem>
                    <SelectItem value="both">Employe + Employeur</SelectItem>
                    <SelectItem value="none">Aucune signature</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label="Introduction en page de garde" hint="Markdown supporte (gras, listes...)">
              <Textarea
                value={coverIntro}
                onChange={(e) => setCoverIntro(e.target.value)}
                rows={4}
                placeholder="Bienvenue chez VNK Automatisation. Ce cahier regroupe les politiques internes que vous devez lire et accepter avant votre debut..."
                className="text-sm resize-y"
              />
            </Field>
            <label className="flex items-center gap-3 cursor-pointer pt-2">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  Cahier obligatoire
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Apparait dans la conformite — tout employe actif doit l&apos;avoir signe.
                </p>
              </div>
            </label>
          </FormSection>

          <FormSection
            icon={ListChecks}
            title="Politiques incluses"
            description="Ajoutez les templates legaux ou politiques que le cahier doit contenir. L'ordre determine la sequence dans le PDF final."
          >
            {/* Liste ordonnee */}
            {orderedIds.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                Aucune politique ajoutee. Selectionnez ci-dessous.
              </p>
            ) : (
              <ol className="space-y-1.5">
                {orderedIds.map((id, idx) => {
                  const t = tplMap.get(id);
                  if (!t) return null;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#0F2D52]/10 text-[#0F2D52] text-[11px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{t.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          v{t.version}
                        </p>
                      </div>
                      <ActionTooltip label="Monter">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={idx === 0}
                          onClick={() => move(idx, -1)}
                        >
                          <ArrowUp className="h-3.5 w-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Descendre">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled={idx === orderedIds.length - 1}
                          onClick={() => move(idx, 1)}
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Retirer">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 hover:text-destructive"
                          onClick={() => remove(id)}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </ActionTooltip>
                    </li>
                  );
                })}
              </ol>
            )}

            {/* Ajout d'une politique */}
            {unselectedTemplates.length > 0 && (
              <div className="pt-2">
                <Select
                  value=""
                  onValueChange={(v) => {
                    const id = Number(v);
                    if (Number.isFinite(id)) add(id);
                  }}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Ajouter une politique au cahier..." />
                  </SelectTrigger>
                  <SelectContent>
                    {unselectedTemplates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.title} (v{t.version})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormSection>

          {/* Demande 7 : Champs a completer ([CHAMP] des chapitres) */}
          {placeholderKeys.length > 0 && (
            <FormSection
              icon={Pencil}
              title="Champs a completer"
              description="Ces champs apparaissent entre crochets dans les chapitres et seront remplaces par vos valeurs dans le PDF final."
            >
              {missingPlaceholderCount > 0 && (
                <div className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-[11px] text-amber-900">
                  {missingPlaceholderCount} champ{missingPlaceholderCount > 1 ? "s" : ""} non rempli
                  {missingPlaceholderCount > 1 ? "s" : ""}. Les champs vides resteront entre crochets dans le PDF.
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {placeholderKeys.map((key) => (
                  <Field key={key} label={key}>
                    <Input
                      value={customFieldValues[key] ?? ""}
                      onChange={(e) =>
                        setCustomFieldValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder={`Valeur pour [${key}]`}
                    />
                  </Field>
                ))}
              </div>
            </FormSection>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : mode === "edit" ? (
              <Pencil className="h-3.5 w-3.5 mr-1.5" />
            ) : (
              <Plus className="h-3.5 w-3.5 mr-1.5" />
            )}
            {mode === "edit" ? "Enregistrer" : "Creer le cahier"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Silence lint pour symboles importes mais reserves
export const _HandbooksViewIcons = { CheckCircle2, Trash2, FileText };

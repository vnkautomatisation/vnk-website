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

const SCOPE_KEY: Record<SignatureScope, string> = {
  employee_only: "employe_seulement",
  employer_only: "employeur_seulement",
  both: "employe_employeur",
  none: "aucune_signature",
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
  const t = useTranslations("admin.handbooks");
  const tc = useTranslations("common");
  const router = useRouter();
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<Handbook | null>(null);
  const [confirmArchive, setConfirmArchive] = useState<Handbook | null>(null);

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
        toast.success(t("cahier_duplique_archive_modifiez_puis"));
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
              title={t("retour_documents")}
            >
              <ArrowLeft className="h-4 w-4" />
            </a>
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <BookOpen className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t("cahiers_apos_employe")}</h1>
              <p className="text-xs text-white/80">{t("handbooks_admin_view_regroupez_plusieurs_politiques_en_un_seul_cahier")}</p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={openCreate}
            className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("creer_cahier")}
          </Button>
        </div>
      </div>

      {handbooks.length === 0 ? (
        <Card className="p-10 text-center space-y-3">
          <BookOpen className="h-10 w-10 mx-auto text-muted-foreground/40" />
          <p className="text-sm font-semibold">{t("aucun_cahier_cree_apos_instant")}</p>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">{t("handbooks_admin_view_creez_un_cahier_pour_regrouper_plusieurs_politiques")}</p>
          <Button
            size="sm"
            onClick={openCreate}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" />
            {t("creer_mon_premier_cahier")}
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
                          {t("archive")}
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

                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <BookOpen className="h-3 w-3" />
                      {t("manuel_apos_employe")}
                    </span>
                    <span className="font-medium text-[#0F2D52]">v{h.version}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-muted-foreground inline-flex items-center gap-1.5">
                      <Users className="h-3 w-3" />
                      {t("signe")}
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
                    <span className="text-muted-foreground">{t("signataires")}</span>
                    <span className="font-medium">
                      {t(SCOPE_KEY[(h.signatureScope as SignatureScope) ?? "employee_only"])}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 pt-1 border-t">
                  <ActionTooltip label={t("apercu_pdf")}>
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
                  <ActionTooltip label={t("dupliquer")}>
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
                    <ActionTooltip label={t("archiver")}>
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
        description={t("cahier_ne_sera_plus_propose")}
        confirmLabel={t("archiver")}
        variant="destructive"
        onConfirm={async () => {
          if (!confirmArchive) return;
          const r = await archiveHandbookAction({ id: confirmArchive.id });
          if (r.success) {
            toast.success(t("cahier_archive"));
            router.refresh();
          } else {
            toast.error(r.error || "");
          }
          setConfirmArchive(null);
        }}
      />


      <PdfPreviewModal
        open={!!previewHandbook}
        url={previewHandbook ? `/api/admin/document-handbooks/${previewHandbook.id}/preview-pdf` : null}
        title={previewHandbook ? t("apercu_titre", { title: previewHandbook.title }) : ""}
        description={previewHandbook ? t("handbooks_admin_view_v_p0_manuel_de_l_employe_vnk", { p0: previewHandbook.version }) : undefined}
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
  const t = useTranslations("admin.handbooks");
  const tc = useTranslations("common");
  const mode: "create" | "edit" = handbook ? "edit" : "create";
  const [title, setTitle] = useState("");
  const [subtitle, setSubtitle] = useState("");
  const [coverIntro, setCoverIntro] = useState("");
  const [version, setVersion] = useState("1.0");
  const [isRequired, setIsRequired] = useState(false);
  const [signatureScope, setSignatureScope] = useState<SignatureScope>("employee_only");
  const [orderedIds, setOrderedIds] = useState<number[]>([]);

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
      if (!r.success) throw new Error(r.error || t("erreur"));
      toast.success(
        mode === "edit" ? t("cahier_mis_jour") : t("cahier_cree"),
      );
      onSaved();
      onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("erreur");
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
              {mode === "edit" ? t("modifier_cahier") : t("nouveau_cahier")}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">{t("handbooks_admin_view_regroupez_plusieurs_politiques_en_un_seul_livre")}</DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          <FormSection icon={BookOpen} title={t("identite_cahier")}>
            <Field label={t("titre")} required>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t("ex_cahier_accueil_2026")}
              />
            </Field>
            <Field label={t("sous_titre")} hint={t("optionnel_affiche_page_garde")}>
              <Input
                value={subtitle}
                onChange={(e) => setSubtitle(e.target.value)}
                placeholder={t("politiques_internes_code_conduite")}
              />
            </Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("edition_version")} required>
                <Input
                  value={version}
                  onChange={(e) => setVersion(e.target.value)}
                  placeholder="1.0"
                />
              </Field>
              <Field label={t("signataires_requis")} required>
                <Select
                  value={signatureScope}
                  onValueChange={(v) => setSignatureScope(v as SignatureScope)}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="employee_only">{t("employe_seulement")}</SelectItem>
                    <SelectItem value="employer_only">{t("employeur_seulement")}</SelectItem>
                    <SelectItem value="both">{t("employe_employeur")}</SelectItem>
                    <SelectItem value="none">{t("aucune_signature")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
            <Field label={t("introduction_page_garde")} hint={t("markdown_supporte_gras_listes")}>
              <Textarea
                value={coverIntro}
                onChange={(e) => setCoverIntro(e.target.value)}
                rows={4}
                placeholder={t("bienvenue_chez_vnk_automatisation_cahier")}
                className="text-sm resize-y"
              />
            </Field>
            <label className="flex items-center gap-3 cursor-pointer pt-2">
              <Switch checked={isRequired} onCheckedChange={setIsRequired} />
              <div>
                <p className="text-sm font-medium text-foreground">
                  {t("cahier_obligatoire")}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {t("apparait_conformite_tout_employe_actif")}
                </p>
              </div>
            </label>
          </FormSection>

          <FormSection
            icon={ListChecks}
            title={t("politiques_incluses")}
            description={t("ajoutez_templates_legaux_politiques_cahier")}
          >

            {orderedIds.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                {t("aucune_politique_ajoutee_selectionnez_ci")}
              </p>
            ) : (
              <ol className="space-y-1.5">
                {orderedIds.map((id, idx) => {
                  const tpl = tplMap.get(id);
                  if (!tpl) return null;
                  return (
                    <li
                      key={id}
                      className="flex items-center gap-2 rounded-md border bg-card px-3 py-2"
                    >
                      <span className="inline-flex items-center justify-center w-6 h-6 rounded bg-[#0F2D52]/10 text-[#0F2D52] text-[11px] font-bold">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{tpl.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          v{tpl.version}
                        </p>
                      </div>
                      <ActionTooltip label={t("monter")}>
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
                      <ActionTooltip label={t("descendre")}>
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
                      <ActionTooltip label={t("retirer")}>
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
                    <SelectValue placeholder={t("ajouter_politique_cahier")} />
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


          {placeholderKeys.length > 0 && (
            <FormSection
              icon={Pencil}
              title={t("champs_completer")}
              description={t("champs_apparaissent_entre_crochets_chapitres")}
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
                      placeholder={t("handbooks_admin_view_valeur_pour_p0", { p0: key })}
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
            {mode === "edit" ? t("enregistrer") : t("creer_cahier")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Silence lint pour symboles importes mais reserves
export const _HandbooksViewIcons = { CheckCircle2, Trash2, FileText };

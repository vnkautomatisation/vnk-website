"use client";
// ─────────────────────────────────────────────────────────
// SignatureRequestDialog — un admin RH crée une demande de
// signature ciblée vers Tous / une équipe / des employés précis.
//
// Body : Select template, radio (Tous / Équipe / Individus),
//   - DatePopover dueDate (optionnel),
//   - Textarea reason.
//
// Côté serveur : createSignatureRequestAction (cf
// src/app/actions/hr-signature-requests.ts).
//
// IMPORTANT (Bug 1) : si le template choisi via le Select interne contient
// des `[CHAMP]` libres detectes par detectPlaceholders, on affiche une
// section "Compléter les champs du document" INLINE dans le body. Le
// bouton "Envoyer la demande" reste désactivé tant que tous les
// placeholders ne sont pas remplis (texte non vide après trim).
//
// Si le parent a déjà rempli les valeurs via TemplateFieldsDialog
// (cas du flow depuis la carte template), elles arrivent via la prop
// `customFieldValues` et la section inline est masquée.
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  FileSignature,
  Loader2,
  Send,
  Users,
  User,
  UserCheck,
  Search,
  X,
  CheckSquare,
  Square,
  ListChecks,
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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DatePopover } from "@/components/admin/date-popover";
import { FormSection, Field } from "@/components/admin/form-section";
import { cn } from "@/lib/utils";
import { createSignatureRequestAction } from "@/app/actions/hr-signature-requests";
import { detectPlaceholders } from "@/lib/document-templates/placeholder-detector";

export type SignatureRequestTemplate = {
  id: number;
  title: string;
  version?: string;
  /**
   * Markdown brut du template — si fourni, on détecte les `[CHAMP]` libres
   * et on affiche la section "Compléter les champs" inline. Optionnel pour
   * compat ascendante.
   */
  bodyMarkdown?: string;
  /**
   * Mode d'engagement : "reading_only" = juste accusé de lecture,
   * "signature" = signature manuscrite requise. Influence le copy
   * (titre / description / bouton).
   */
  acknowledgmentMode?: "reading_only" | "signature";
};

export type SignatureRequestTeam = {
  id: number;
  name: string;
};

export type SignatureRequestEmployee = {
  id: number;
  fullName: string | null;
  email: string;
  team?: { id?: number; name: string } | null;
};

type TargetKind = "all" | "team" | "individuals";

export function SignatureRequestDialog({
  open,
  onClose,
  onCreated,
  template,
  availableTemplates = [],
  availableTeams = [],
  availableEmployees = [],
  customFieldValues = null,
}: {
  open: boolean;
  onClose: () => void;

  onCreated: () => void;

  template?: SignatureRequestTemplate | null;

  availableTemplates?: SignatureRequestTemplate[];

  availableTeams?: SignatureRequestTeam[];

  availableEmployees?: SignatureRequestEmployee[];





  customFieldValues?: Record<string, string> | null;
}) {
  const t = useTranslations("admin.hr_documents");
  const tc = useTranslations("common");
  const [templateId, setTemplateId] = useState<number | null>(
    template?.id ?? null
  );
  const [targetKind, setTargetKind] = useState<TargetKind>("all");
  const [teamId, setTeamId] = useState<number | null>(null);
  const [selectedEmpIds, setSelectedEmpIds] = useState<Set<number>>(new Set());
  const [empSearch, setEmpSearch] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);


  const [inlineFieldValues, setInlineFieldValues] = useState<Record<string, string>>(
    {},
  );


  useEffect(() => {
    if (open) {
      setTemplateId(template?.id ?? null);
      setTargetKind("all");
      setTeamId(null);
      setSelectedEmpIds(new Set());
      setEmpSearch("");
      setDueDate("");
      setReason("");
      setSubmitting(false);
      setInlineFieldValues({});
    }
  }, [open, template?.id]);


  useEffect(() => {
    if (!open) return;
    setInlineFieldValues({});
  }, [open, templateId]);

  const filteredEmps = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return availableEmployees;
    return availableEmployees.filter((e) =>
      `${e.fullName ?? ""} ${e.email}`.toLowerCase().includes(q)
    );
  }, [availableEmployees, empSearch]);

  const toggleEmp = (id: number) =>
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllVisible = () => {
    const visibleIds = filteredEmps.map((e) => e.id);
    setSelectedEmpIds((prev) => {
      const next = new Set(prev);
      const allSelected = visibleIds.every((id) => next.has(id));
      if (allSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  };


  const selectedTemplate: SignatureRequestTemplate | null = useMemo(() => {
    if (template) return template;
    if (templateId == null) return null;
    return (
      availableTemplates.find((t) => t.id === templateId) ?? null
    );
  }, [template, templateId, availableTemplates]);




  const acknowledgmentMode: "reading_only" | "signature" =
    selectedTemplate?.acknowledgmentMode ?? "reading_only";


  const copy = useMemo(() => {
    if (acknowledgmentMode === "reading_only") {
      return {
        title: t("demander_accuse_lecture"),
        description:
          t("employes_concernes_devront_confirmer_avoir"),
        button: t("envoyer_lecture"),
        Icon: BookOpen,
      };
    }
    return {
      title: t("demander_signature_3"),
      description:
        t("employes_concernes_devront_signer_document"),
      button: t("envoyer_signature"),
      Icon: FileSignature,
    };
  }, [acknowledgmentMode]);




  const inlinePlaceholders = useMemo(() => {
    if (customFieldValues) return []; // deja rempli en amont
    const md = selectedTemplate?.bodyMarkdown;
    if (!md) return [];
    return detectPlaceholders(md);
  }, [selectedTemplate, customFieldValues]);

  const missingInlineFields = useMemo(() => {
    return inlinePlaceholders.filter((k) => {
      const v = inlineFieldValues[k];
      return !(typeof v === "string" && v.trim().length > 0);
    });
  }, [inlinePlaceholders, inlineFieldValues]);

  const allInlineFilled = missingInlineFields.length === 0;

  const canSubmit = useMemo(() => {
    if (!templateId) return false;
    if (targetKind === "team" && !teamId) return false;
    if (targetKind === "individuals" && selectedEmpIds.size === 0) return false;
    if (!allInlineFilled) return false;
    return !submitting;
  }, [templateId, targetKind, teamId, selectedEmpIds, submitting, allInlineFilled]);

  const submit = async () => {
    if (!templateId) {
      toast.error(t("selectionnez_document"));
      return;
    }
    if (!allInlineFilled) {
      toast.error(
        `Complétez les ${missingInlineFields.length} champ(s) restant(s) avant l'envoi`,
      );
      return;
    }
    let targets:
      | { all: true }
      | { teamId: number }
      | { adminIds: number[] };
    if (targetKind === "all") targets = { all: true };
    else if (targetKind === "team") {
      if (!teamId) {
        toast.error(t("selectionnez_equipe"));
        return;
      }
      targets = { teamId };
    } else {
      if (selectedEmpIds.size === 0) {
        toast.error(t("selectionnez_moins_employe"));
        return;
      }
      targets = { adminIds: Array.from(selectedEmpIds) };
    }




    let finalCustomValues: Record<string, string> | undefined;
    if (customFieldValues && Object.keys(customFieldValues).length > 0) {
      finalCustomValues = customFieldValues;
    } else if (inlinePlaceholders.length > 0) {
      finalCustomValues = {};
      for (const key of inlinePlaceholders) {
        const v = inlineFieldValues[key];
        finalCustomValues[key] = typeof v === "string" ? v.trim() : "";
      }
    }

    setSubmitting(true);
    try {
      const r = await createSignatureRequestAction({
        templateId,
        targets,
        dueDate: dueDate || null,
        reason: reason.trim() || null,
        customFieldValues: finalCustomValues,
      });
      if (r.success) {
        const { createdCount, skipped } = r.data;
        toast.success(
          t("demandes_creees", { count: createdCount }) +
            (skipped > 0 ? ` · ${skipped} ignorée${skipped > 1 ? "s" : ""}` : "")
        );
        onCreated();
        onClose();
      } else {
        toast.error(r.error || t("erreur_lors_creation"));
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : t("erreur_inconnue");
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const HeaderIcon = copy.Icon;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg">

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-white flex items-center gap-2 pr-8">
              <HeaderIcon className="h-4 w-4 shrink-0" />
              <span className="truncate">{copy.title}</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs">
              {copy.description} Une notification sera envoyée dans Mon espace.
            </DialogDescription>
          </DialogHeader>
        </div>


        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">

          {inlinePlaceholders.length > 0 && missingInlineFields.length > 0 && (
            <div className="rounded-md border border-red-200 bg-red-50 text-red-700 px-3 py-2 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <p className="text-xs leading-snug">
                <span className="font-semibold">
                  {missingInlineFields.length} champ{missingInlineFields.length > 1 ? "s" : ""} à compléter
                </span>{" "}
                avant l&apos;envoi : {missingInlineFields.join(", ")}.
              </p>
            </div>
          )}


          {!template && (
            <FormSection icon={FileSignature} title={t("document_envoyer")}>
              <Field label={t("document")} required>
                <Select
                  value={templateId ? String(templateId) : ""}
                  onValueChange={(v) => setTemplateId(Number(v))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={t("choisir_document")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTemplates.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.title}
                        {t.version ? ` (v${t.version})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </FormSection>
          )}

          {template && (
            <div className="rounded-md border bg-[#0F2D52]/5 border-[#0F2D52]/15 px-3 py-2 flex items-center gap-2">
              <HeaderIcon className="h-4 w-4 text-[#0F2D52] shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold truncate">{template.title}</p>
                {template.version && (
                  <p className="text-[11px] text-muted-foreground">
                    Version {template.version}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Section t("completer_champs") — affichee uniquement si :
              - le template a ete choisi via le Select interne (pas template prop)
              - le template a des placeholders detectes
              - le parent n'a PAS fourni customFieldValues (sinon deja rempli) */}
          {inlinePlaceholders.length > 0 && (
            <FormSection
              icon={ListChecks}
              title={`Compléter les champs du document (${inlinePlaceholders.length})`}
              description={t("champs_apparaissent_comme_nom_modele")}
            >
              <div className="grid grid-cols-1 gap-3">
                {inlinePlaceholders.map((key) => (
                  <Field key={key} label={key} required>
                    <Input
                      value={inlineFieldValues[key] ?? ""}
                      onChange={(e) =>
                        setInlineFieldValues((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      placeholder={`Saisir « ${key} »...`}
                      className="text-sm"
                    />
                  </Field>
                ))}
              </div>
            </FormSection>
          )}


          <FormSection icon={Users} title={t("destinataires")}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <TargetCard
                active={targetKind === "all"}
                onClick={() => setTargetKind("all")}
                icon={Users}
                label={t("tout_monde")}
                hint={t("tous_employes_actifs_n_ont")}
              />
              <TargetCard
                active={targetKind === "team"}
                onClick={() => setTargetKind("team")}
                icon={UserCheck}
                label={t("equipe_3")}
                hint={t("tous_membres_actifs_equipe")}
                disabled={availableTeams.length === 0}
              />
              <TargetCard
                active={targetKind === "individuals"}
                onClick={() => setTargetKind("individuals")}
                icon={User}
                label={t("employes_precis")}
                hint={t("selection_manuelle_liste")}
                disabled={availableEmployees.length === 0}
              />
            </div>


            {targetKind === "team" && (
              <Field label={t("equipe_2")} required>
                <Select
                  value={teamId ? String(teamId) : ""}
                  onValueChange={(v) => setTeamId(Number(v))}
                >
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder={t("choisir_equipe")} />
                  </SelectTrigger>
                  <SelectContent>
                    {availableTeams.map((t) => (
                      <SelectItem key={t.id} value={String(t.id)}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            )}

            {targetKind === "individuals" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                  <Input
                    value={empSearch}
                    onChange={(e) => setEmpSearch(e.target.value)}
                    placeholder={t("rechercher_employe")}
                    className="pl-8 h-9 text-sm"
                  />
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>
                    {selectedEmpIds.size} sélectionné
                    {selectedEmpIds.size > 1 ? "s" : ""} ·{" "}
                    {filteredEmps.length} visible
                    {filteredEmps.length > 1 ? "s" : ""}
                  </span>
                  <button
                    type="button"
                    className="text-[#0F2D52] font-semibold hover:underline"
                    onClick={toggleAllVisible}
                  >
                    {filteredEmps.every((e) => selectedEmpIds.has(e.id))
                      ? t("tout_deselectionner")
                      : t("tout_selectionner")}
                  </button>
                </div>
                <div className="rounded-md border max-h-64 overflow-y-auto divide-y">
                  {filteredEmps.map((e) => {
                    const checked = selectedEmpIds.has(e.id);
                    return (
                      <button
                        type="button"
                        key={e.id}
                        onClick={() => toggleEmp(e.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition",
                          checked && "bg-[#0F2D52]/5"
                        )}
                      >
                        {checked ? (
                          <CheckSquare className="h-4 w-4 text-[#0F2D52] shrink-0" />
                        ) : (
                          <Square className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {e.fullName ?? e.email}
                          </p>
                          <p className="text-[11px] text-muted-foreground truncate">
                            {e.team?.name ?? "—"} · {e.email}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                  {filteredEmps.length === 0 && (
                    <p className="px-3 py-6 text-center text-xs text-muted-foreground">
                      {t("aucun_employe_trouve")}
                    </p>
                  )}
                </div>
                {selectedEmpIds.size > 0 && (
                  <SelectedChips
                    employees={availableEmployees}
                    selected={selectedEmpIds}
                    onRemove={(id) =>
                      setSelectedEmpIds((p) => {
                        const n = new Set(p);
                        n.delete(id);
                        return n;
                      })
                    }
                  />
                )}
              </div>
            )}
          </FormSection>


          <FormSection icon={Send} title={t("options")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("echeance")} hint={t("optionnel_utilise_urgence")}>
                <DatePopover value={dueDate} onChange={setDueDate} />
              </Field>
            </div>
            <Field label={t("motif_message_optionnel")}>
              <Textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder={t("ex_mise_jour_annuelle_politique")}
                rows={3}
                maxLength={500}
                className="text-sm"
              />
            </Field>
          </FormSection>
        </div>


        <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            onClick={submit}
            disabled={!canSubmit}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {submitting ? (
              <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
            ) : (
              <Send className="h-3.5 w-3.5 mr-1.5" />
            )}
            {copy.button}
          </Button>
        </DialogFooter>

        {selectedTemplate === null && !template && availableTemplates.length === 0 && (
          <p className="px-5 pb-3 text-[11px] text-amber-700 bg-amber-50 border-t border-amber-200">{t("signature_request_dialog_aucun_document_legal_disponible_creez_en_un")}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function TargetCard({
  active,
  onClick,
  icon: Icon,
  label,
  hint,
  disabled,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Users;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "rounded-md border p-3 text-left transition focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30",
        active
          ? "border-[#0F2D52] bg-[#0F2D52]/5 ring-1 ring-[#0F2D52]/20"
          : "border-input bg-card hover:border-[#0F2D52]/30 hover:bg-muted/30",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      <div className="flex items-center gap-2">
        <Icon
          className={cn(
            "h-4 w-4",
            active ? "text-[#0F2D52]" : "text-muted-foreground"
          )}
        />
        <span
          className={cn(
            "text-sm font-semibold",
            active ? "text-[#0F2D52]" : "text-foreground"
          )}
        >
          {label}
        </span>
      </div>
      <p className="text-[11px] text-muted-foreground mt-1 leading-snug">
        {hint}
      </p>
    </button>
  );
}

function SelectedChips({
  employees,
  selected,
  onRemove,
}: {
  employees: SignatureRequestEmployee[];
  selected: Set<number>;
  onRemove: (id: number) => void;
}) {
  const map = new Map(employees.map((e) => [e.id, e]));
  const items = Array.from(selected)
    .map((id) => map.get(id))
    .filter((e): e is SignatureRequestEmployee => Boolean(e));
  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {items.map((e) => (
        <span
          key={e.id}
          className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] border border-[#0F2D52]/20"
        >
          {e.fullName ?? e.email}
          <button
            type="button"
            onClick={() => onRemove(e.id)}
            className="hover:text-red-600"
            aria-label={`Retirer ${e.fullName ?? e.email}`}
          >
            <X className="h-2.5 w-2.5" />
          </button>
        </span>
      ))}
    </div>
  );
}

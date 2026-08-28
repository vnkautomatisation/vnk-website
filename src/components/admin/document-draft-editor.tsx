"use client";
// ─────────────────────────────────────────────────────────
// DocumentDraftEditor — editeur 2 colonnes pour preparer un
// brouillon de document long (Evaluation 30/60/90, etc.).
//
// Layout :
//   - Header navy gradient : titre template + employe cible + status
//   - Gauche : sections du formulaire (groupees par H2/H3) repliables
//   - Droite : iframe PDF preview live (rafraichi apres chaque autosave)
//   - Footer sticky : indicateur "Sauvegarde X" + Annuler + Envoyer signature
//
// Workflow :
//   1. Charge le brouillon via GET /api/admin/document-drafts/[id]
//   2. Parse le template body via parseFillFields() pour generer le form
//   3. Autosave debounced : 1.5s apres derniere modif -> updateDocumentDraftAction
//   4. Apres save reussi, refresh l'iframe PDF (cache-buster timestamp)
//   5. Bouton "Envoyer pour signature" -> dialog confirm + sendDocumentDraftForSignatureAction
//
// L'editeur est un Dialog plein ecran (overlay) plutot qu'une route
// distincte pour rester dans le contexte de documents-admin-view.
// ─────────────────────────────────────────────────────────
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDateLocale } from "@/lib/i18n-format";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  CheckCircle2,
  FileText,
  Loader2,
  Save,
  Send,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { DatePopover } from "@/components/admin/date-popover";
import {
  parseFillFields,
  type FillField,
} from "@/lib/document-templates/fill-field-parser";
import { SectionCard } from "@/components/admin/long-form-wizard";
import {
  updateDocumentDraftAction,
  markDocumentDraftReadyAction,
  sendDocumentDraftForSignatureAction,
} from "@/app/actions/hr-document-drafts";

export interface DocumentDraftEditorProps {
  open: boolean;
  draftId: number | null;
  onClose: () => void;
  /** Callback quand le brouillon est envoye en signature (pour refresh la liste parent). */
  onSent?: () => void;
}

type DraftData = {
  id: number;
  template: { id: number; title: string; key: string; bodyMarkdown: string };
  target: { id: number; fullName: string | null; avatarUrl: string | null; department: string | null };
  customFieldValues: Record<string, string>;
  status: string;
  notes: string | null;
  scheduledFor: string | null;
  updatedAt: string;
};

export function DocumentDraftEditor({ open, draftId, onClose, onSent }: DocumentDraftEditorProps) {
  const t = useTranslations("admin.hr_documents");
  const tc = useTranslations("common");
  const [draft, setDraft] = useState<DraftData | null>(null);
  const [loading, setLoading] = useState(false);
  const [values, setValues] = useState<Record<string, string>>({});
  const [notes, setNotes] = useState("");
  const [scheduledFor, setScheduledFor] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set());
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [showSendDialog, setShowSendDialog] = useState(false);
  const [pdfStamp, setPdfStamp] = useState<number>(() => Date.now());
  const dateTag = useDateLocale();


  useEffect(() => {
    if (!open || !draftId) return;
    let cancelled = false;
    setLoading(true);
    fetch(`/api/admin/document-drafts/${draftId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d: DraftData & { error?: string }) => {
        if (cancelled) return;
        if (d.error) {
          toast.error(d.error);
          onClose();
          return;
        }
        setDraft(d);
        setValues((d.customFieldValues as Record<string, string>) ?? {});
        setNotes(d.notes ?? "");
        setScheduledFor(d.scheduledFor);
        setSavedAt(new Date(d.updatedAt));
        setCollapsed(new Set());
      })
      .catch((e) => {
        if (!cancelled) {
          toast.error(`Erreur chargement : ${e.message}`);
          onClose();
        }
      })
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [open, draftId, onClose]);


  const structure = useMemo(
    () => (draft ? parseFillFields(draft.template.bodyMarkdown) : null),
    [draft],
  );
  const filledCount = useMemo(
    () => structure
      ? structure.fields.filter((f) => (values[`fill_${f.index}`] ?? "").trim() !== "").length
      : 0,
    [structure, values],
  );


  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);



  const latestRef = useRef({ values, notes, scheduledFor });
  latestRef.current = { values, notes, scheduledFor };
  const persistDraft = useCallback(async (silent: boolean = false) => {
    if (!draft) return;
    setSaving(true);
    try {
      const cur = latestRef.current;
      await updateDocumentDraftAction({
        id: draft.id,
        customFieldValues: cur.values,
        notes: cur.notes || null,
        scheduledFor: cur.scheduledFor || null,
      });
      setSavedAt(new Date());
      setPdfStamp(Date.now()); // refresh PDF iframe
      if (!silent) toast.success(t("brouillon_enregistre"));
    } catch (e) {
      toast.error(`Erreur sauvegarde : ${(e as Error).message}`);
    } finally {
      setSaving(false);
    }
  }, [draft]);

  const scheduleAutosave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => persistDraft(true), 1500);
  }, [persistDraft]);




  const handleClose = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
      void persistDraft(true);
    }
    onClose();
  }, [onClose, persistDraft]);


  useEffect(() => () => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
  }, []);

  const handleField = useCallback((field: FillField, value: string) => {
    setValues((prev) => ({ ...prev, [`fill_${field.index}`]: value }));
    scheduleAutosave();
  }, [scheduleAutosave]);

  const toggleSection = (idx: number) => {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };


  const handleSendForSignature = async (dueDate: string | null, reason: string | null) => {
    if (!draft) return;
    try {


      if (saveTimerRef.current) {
        clearTimeout(saveTimerRef.current);
        saveTimerRef.current = null;
      }
      await persistDraft(true);
      await markDocumentDraftReadyAction(draft.id);
      await sendDocumentDraftForSignatureAction(draft.id, { dueDate, reason });
      toast.success(t("document_envoye_signature"));
      setShowSendDialog(false);
      onSent?.();
      onClose();
    } catch (e) {
      toast.error(`Erreur : ${(e as Error).message}`);
    }
  };





  const pdfUrl = useMemo(() => {
    if (!draft) return null;
    return `/api/admin/document-drafts/${draft.id}/preview-pdf?_t=${pdfStamp}`;
  }, [draft, pdfStamp]);

  if (!open) return null;

  return (
    <>
      <Dialog open={open} onOpenChange={(o) => !o && !saving && handleClose()}>
        <DialogContent
          className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none"
          aria-describedby={undefined}
        >

          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
            <DialogHeader>
              <DialogTitle className="text-white text-sm sm:text-base flex items-center gap-2 pr-8">
                <FileText className="h-4 w-4 shrink-0" />
                <span className="truncate">
                  Preparer — {draft?.template.title ?? "..."}
                </span>
              </DialogTitle>
              {draft && (
                <div className="text-white/80 text-[11px] sm:text-xs flex items-center gap-3 flex-wrap mt-1">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" />{t("document_draft_editor_pour")}<span className="font-medium text-white">{draft.target.fullName ?? "—"}</span>
                  </span>
                  <span>·</span>
                  <span>{filledCount} / {structure?.count ?? 0} champs remplis</span>
                  {savedAt && (
                    <>
                      <span>·</span>
                      <span className="opacity-80">
                        {saving ? t("sauvegarde") : `Sauvegarde a ${formatTime(savedAt, dateTag)}`}
                      </span>
                    </>
                  )}
                </div>
              )}
            </DialogHeader>
          </div>


          {loading || !draft || !structure ? (
            <div className="flex-1 flex items-center justify-center bg-muted/20">
              <Loader2 className="h-6 w-6 animate-spin text-[#0F2D52]" />
            </div>
          ) : (
            <div className="flex-1 grid grid-cols-1 xl:grid-cols-2 overflow-hidden bg-muted/20">

              <div className="overflow-y-auto px-4 sm:px-5 py-4 space-y-4 border-r border-border/60">
                {structure.groups.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-12 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/40 mb-3" />
                    <p className="text-sm font-medium">{t("aucun_champ_completer")}</p>
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


                <section className="rounded-md border bg-card shadow-sm">
                  <div className="px-4 py-2.5 border-b">
                    <h3 className="text-sm font-semibold text-[#0F2D52]">{t("notes_internes_manager")}</h3>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {t("visible_uniquement_toi_pas_inclus")}
                    </p>
                  </div>
                  <div className="px-4 py-3">
                    <Textarea
                      value={notes}
                      onChange={(e) => { setNotes(e.target.value); scheduleAutosave(); }}
                      placeholder={t("ex_rappel_aborder_points_lors")}
                      className="text-sm min-h-[64px]"
                    />
                  </div>
                </section>


                <section className="rounded-md border bg-card shadow-sm">
                  <div className="px-4 py-2.5 border-b">
                    <h3 className="text-sm font-semibold text-[#0F2D52]">Date prevue d'envoi</h3>
                  </div>
                  <div className="px-4 py-3">
                    <DatePopover
                      value={scheduledFor ?? ""}
                      onChange={(d) => { setScheduledFor(d || null); scheduleAutosave(); }}
                      placeholder={tc("optional")}
                    />
                  </div>
                </section>
              </div>


              <div className="hidden xl:flex flex-col bg-card overflow-hidden">
                <div className="px-4 py-2 border-b text-xs text-muted-foreground bg-muted/40 shrink-0">
                  {t("apercu_pdf_direct")}
                </div>
                {pdfUrl ? (
                  <iframe
                    key={pdfStamp}
                    src={pdfUrl}
                    title={t("apercu_pdf")}
                    className="flex-1 w-full border-0 bg-white"
                  />
                ) : (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-5 w-5 animate-spin text-[#0F2D52]" />
                  </div>
                )}
              </div>
            </div>
          )}


          <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-card shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
            <Button variant="outline" size="sm" onClick={handleClose} disabled={saving}>
              {tc("close")}
            </Button>
            <Button variant="outline" size="sm" onClick={() => persistDraft()} disabled={saving}>
              {saving ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1.5" />}
              Sauvegarder
            </Button>
            <Button
              size="sm"
              onClick={() => setShowSendDialog(true)}
              disabled={saving || !draft}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              <Send className="h-3.5 w-3.5 mr-1.5" />
              {t("envoyer_signature")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <SendDraftDialog
        open={showSendDialog}
        targetName={draft?.target.fullName ?? "—"}
        templateTitle={draft?.template.title ?? ""}
        filledCount={filledCount}
        totalCount={structure?.count ?? 0}
        onClose={() => setShowSendDialog(false)}
        onConfirm={handleSendForSignature}
      />
    </>
  );
}

// ─── Dialog confirmation envoi ──────────────────────────────

function SendDraftDialog({
  open, targetName, templateTitle, filledCount, totalCount, onClose, onConfirm,
}: {
  open: boolean;
  targetName: string;
  templateTitle: string;
  filledCount: number;
  totalCount: number;
  onClose: () => void;
  onConfirm: (dueDate: string | null, reason: string | null) => Promise<void>;
}) {
  const t = useTranslations("admin.hr_documents");
  const tc = useTranslations("common");
  const [dueDate, setDueDate] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) { setDueDate(null); setReason(""); setSubmitting(false); }
  }, [open]);

  const handleConfirm = async () => {
    setSubmitting(true);
    try {
      await onConfirm(dueDate, reason || null);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="sm:max-w-lg p-0 overflow-hidden" aria-describedby={undefined}>
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base flex items-center gap-2">
              <Send className="h-4 w-4" />
              {t("envoyer_signature")}
            </DialogTitle>
            <p className="text-white/80 text-xs mt-1">{t("document_draft_editor_le_document_sera_envoye_a")}<span className="font-semibold text-white">{targetName}</span>.
            </p>
          </DialogHeader>
        </div>
        <div className="px-5 py-4 space-y-4">
          <div className="rounded-md border bg-muted/40 px-3 py-2 text-xs">
            <div className="font-medium text-foreground">{templateTitle}</div>
            <div className="text-muted-foreground mt-1 flex items-center gap-1.5">
              <CheckCircle2 className="h-3 w-3 text-green-600" />
              {filledCount} / {totalCount} champs remplis
              {filledCount < totalCount && (
                <span className="ml-1 text-amber-700">· {totalCount - filledCount} restant a la main</span>
              )}
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">{t("date_limite_optionnel")}</label>
            <DatePopover value={dueDate ?? ""} onChange={(d) => setDueDate(d || null)} placeholder={t("aucune")} />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium">{t("message_signataire_optionnel")}</label>
            <Textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("ex_merci_relire_signer_avant")}
              className="text-sm min-h-[60px]"
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={submitting}>
            {tc("cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleConfirm}
            disabled={submitting}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {submitting ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Send className="h-3.5 w-3.5 mr-1.5" />}
            Envoyer maintenant
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Helpers ─────────────────────────────────────────────────

function formatTime(d: Date, tag: string): string {
  return d.toLocaleTimeString(tag, { hour: "2-digit", minute: "2-digit" });
}

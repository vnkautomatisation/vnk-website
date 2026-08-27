"use client";
// ─────────────────────────────────────────────────────────
// RequestDocumentUploadDialog — l'admin RH (ou manager direct)
// crée une demande "Téléverse ton document X" ciblant un employé.
//
// Body : pick employé + titre + description + catégorie + dueDate + isRequired
// Action : createUploadRequestAction → toast → onCreated.
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  FileText,
  Loader2,
  Send,
  Search,
  User,
  CheckSquare,
  Square,
  CalendarClock,
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
import { createUploadRequestAction } from "@/app/actions/hr-document-requests";
import { DOC_REQUEST_CATEGORIES } from "@/lib/document-requests/categories";

export type RequestDocEmployee = {
  id: number;
  fullName: string | null;
  email: string;
  team?: { id?: number; name: string } | null;
};

export function RequestDocumentUploadDialog({
  open,
  onClose,
  onCreated,
  availableEmployees,
  presetEmployeeId,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
  availableEmployees: RequestDocEmployee[];

  presetEmployeeId?: number | null;
}) {
  const t = useTranslations("admin.hr_documents");
  const tc = useTranslations("common");
  const [employeeId, setEmployeeId] = useState<number | null>(presetEmployeeId ?? null);
  const [empSearch, setEmpSearch] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("licence");
  const [dueDate, setDueDate] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);



  useEffect(() => {
    if (titleTouched) return;
    const suggestion = ({
      licence: t("permis_conduire"),
      diploma: t("diplome_officiel"),
      certification: t("certification_professionnelle"),
      id_card: t("carte_identite_recto_verso"),
      passport: t("passeport_page_identite"),
      medical: t("document_medical_attestation"),
      other: "",
    } as Record<string, string>)[category] ?? "";
    setTitle(suggestion);
  }, [category, titleTouched]);

  useEffect(() => {
    if (open) {
      setEmployeeId(presetEmployeeId ?? null);
      setEmpSearch("");
      setTitle("");
      setTitleTouched(false);
      setDescription("");
      setCategory("licence");
      setDueDate("");
      setIsRequired(true);
      setSubmitting(false);
    }
  }, [open, presetEmployeeId]);

  const filteredEmps = useMemo(() => {
    const q = empSearch.trim().toLowerCase();
    if (!q) return availableEmployees;
    return availableEmployees.filter((e) =>
      `${e.fullName ?? ""} ${e.email} ${e.team?.name ?? ""}`.toLowerCase().includes(q),
    );
  }, [availableEmployees, empSearch]);

  const selectedEmp = useMemo(
    () => availableEmployees.find((e) => e.id === employeeId) ?? null,
    [availableEmployees, employeeId],
  );

  const canSubmit = !!employeeId && title.trim().length > 0 && !submitting;

  const submit = async () => {
    if (!employeeId) {
      toast.error(t("selectionnez_employe"));
      return;
    }
    if (!title.trim()) {
      toast.error(t("titre_requis"));
      return;
    }
    setSubmitting(true);
    try {
      const r = await createUploadRequestAction({
        targetAdminId: employeeId,
        title: title.trim(),
        description: description.trim() || null,
        category: category as
          | "licence"
          | "diploma"
          | "certification"
          | "id_card"
          | "passport"
          | "medical"
          | "other",
        dueDate: dueDate || null,
        isRequired,
      });
      if (r.success) {
        toast.success(t("demande_envoyee_employe"));
        onCreated();
        onClose();
      } else {
        toast.error(r.error || t("erreur_lors_creation"));
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur_inconnue"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-lg">

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-white flex items-center gap-2 pr-8">
              <FileText className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("demander_document")}</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs">{t("request_document_upload_l_employe_recevra_une_notification_et_pourra")}</DialogDescription>
          </DialogHeader>
        </div>


        <div className="p-4 sm:p-5 space-y-4 sm:space-y-5 overflow-y-auto flex-1">

          <FormSection icon={User} title={t("employe_concerne")}>
            {selectedEmp && presetEmployeeId ? (
              <div className="rounded-md border bg-[#0F2D52]/5 border-[#0F2D52]/15 px-3 py-2 flex items-center gap-2">
                <User className="h-4 w-4 text-[#0F2D52] shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold truncate">
                    {selectedEmp.fullName ?? selectedEmp.email}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {selectedEmp.team?.name ? `${selectedEmp.team.name} · ` : ""}
                    {selectedEmp.email}
                  </p>
                </div>
              </div>
            ) : (
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
                <div className="rounded-md border max-h-56 overflow-y-auto divide-y">
                  {filteredEmps.map((e) => {
                    const checked = e.id === employeeId;
                    return (
                      <button
                        type="button"
                        key={e.id}
                        onClick={() => setEmployeeId(e.id)}
                        className={cn(
                          "w-full text-left px-3 py-2 flex items-center gap-2 hover:bg-muted/40 transition",
                          checked && "bg-[#0F2D52]/5",
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
              </div>
            )}
          </FormSection>


          <FormSection icon={FileText} title={t("document_demande")}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label={t("categorie")} required>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_REQUEST_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {t(c.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("echeance")} hint={tc("optional")}>
                <DatePopover value={dueDate} onChange={setDueDate} />
              </Field>
            </div>
            <Field label={t("titre")} required hint={t("suggestion_auto_basee_categorie_modifiable")}>
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
                placeholder={t("ex_permis_conduire_classe_5")}
                maxLength={140}
              />
            </Field>
            <Field label={t("instructions")} hint={t("precisions_employe_recto_verso_lisibilite")}>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={t("televerser_scan_recto_verso_lisible")}
                rows={3}
                maxLength={1000}
                className="text-sm resize-y"
              />
            </Field>
            <label className="flex items-start gap-2 p-3 rounded-md border bg-muted/10 cursor-pointer hover:bg-muted/20 transition">
              <input
                type="checkbox"
                checked={isRequired}
                onChange={(e) => setIsRequired(e.target.checked)}
                className="h-4 w-4 mt-0.5 rounded border-input accent-[#0F2D52]"
              />
              <div className="space-y-0.5">
                <p className="text-sm font-medium flex items-center gap-1.5">
                  <CalendarClock className="h-3.5 w-3.5 text-[#0F2D52]" />
                  {t("document_obligatoire")}
                </p>
                <p className="text-[11px] text-muted-foreground">{t("request_document_upload_marque_la_demande_comme_obligatoire_dans_le")}</p>
              </div>
            </label>
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
            Envoyer la demande
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

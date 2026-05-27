"use client";
// ─────────────────────────────────────────────────────────
// RequestDocumentUploadDialog — l'admin RH (ou manager direct)
// crée une demande "Téléverse ton document X" ciblant un employé.
//
// Body : pick employé + titre + description + catégorie + dueDate + isRequired
// Action : createUploadRequestAction → toast → onCreated.
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
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
  /** Pré-sélectionner un employé (depuis une fiche employé). */
  presetEmployeeId?: number | null;
}) {
  const [employeeId, setEmployeeId] = useState<number | null>(presetEmployeeId ?? null);
  const [empSearch, setEmpSearch] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<string>("licence");
  const [dueDate, setDueDate] = useState("");
  const [isRequired, setIsRequired] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Auto-suggère un titre clair en fonction de la catégorie tant que l'utilisateur
  // n'a pas tapé manuellement (titleTouched=false) → évite d'avoir « dsfdgfd » par défaut.
  useEffect(() => {
    if (titleTouched) return;
    const suggestion = ({
      licence: "Permis de conduire",
      diploma: "Diplôme officiel",
      certification: "Certification professionnelle",
      id_card: "Carte d'identité (recto-verso)",
      passport: "Passeport (page identité)",
      medical: "Document médical / Attestation",
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
      toast.error("Sélectionnez un employé");
      return;
    }
    if (!title.trim()) {
      toast.error("Le titre est requis");
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
        toast.success("Demande envoyée à l'employé");
        onCreated();
        onClose();
      } else {
        toast.error(r.error || "Erreur lors de la création");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur inconnue");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-2xl max-h-[92vh] p-0 overflow-hidden flex flex-col">
        {/* Header navy */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Demander un document
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              L'employé recevra une notification et pourra téléverser le document
              demandé depuis Mon espace.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-5 space-y-5 overflow-y-auto flex-1">
          {/* Cible : employé */}
          <FormSection icon={User} title="Employé concerné">
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
                    placeholder="Rechercher un employé…"
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
                      Aucun employé trouvé.
                    </p>
                  )}
                </div>
              </div>
            )}
          </FormSection>

          {/* Contenu de la demande */}
          <FormSection icon={FileText} title="Document demandé">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Field label="Catégorie" required>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DOC_REQUEST_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Échéance" hint="Optionnel">
                <DatePopover value={dueDate} onChange={setDueDate} />
              </Field>
            </div>
            <Field label="Titre" required hint="Suggestion auto basée sur la catégorie — modifiable">
              <Input
                value={title}
                onChange={(e) => { setTitle(e.target.value); setTitleTouched(true); }}
                placeholder="Ex : Permis de conduire classe 5"
                maxLength={140}
              />
            </Field>
            <Field label="Instructions" hint="Précisions pour l'employé (recto-verso, lisibilité…)">
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Téléverser un scan recto-verso lisible (PDF ou image)."
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
                  Document obligatoire
                </p>
                <p className="text-[11px] text-muted-foreground">
                  Marque la demande comme obligatoire dans le bandeau de l'employé.
                </p>
              </div>
            </label>
          </FormSection>
        </div>

        {/* Footer sticky */}
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button
            type="button"
            variant="outline"
            onClick={onClose}
            disabled={submitting}
          >
            Annuler
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

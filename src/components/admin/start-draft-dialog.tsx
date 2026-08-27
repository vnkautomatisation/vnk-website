"use client";
// ─────────────────────────────────────────────────────────
// StartDraftDialog — demarre un nouveau brouillon de document long.
// Demande l'employe cible, cree le brouillon via action serveur, puis
// retourne le draftId via onCreated() pour que le parent ouvre l'editeur.
//
// Utilise depuis documents-admin-view sur le bouton "Preparer le document"
// pour les templates long-form (Evaluation 30/60/90, etc.).
// ─────────────────────────────────────────────────────────
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { ClipboardList, Loader2, Search, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createDocumentDraftAction } from "@/app/actions/hr-document-drafts";

export interface StartDraftDialogProps {
  open: boolean;
  templateId: number | null;
  templateTitle: string;
  onClose: () => void;
  onCreated: (draftId: number) => void;
}

type EmployeeItem = {
  id: number;
  fullName: string | null;
  position: string | null;
  department: string | null;
  avatarUrl: string | null;
};

export function StartDraftDialog({
  open, templateId, templateTitle, onClose, onCreated,
}: StartDraftDialogProps) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);


  useEffect(() => {
    if (!open) return;
    setSearch("");
    setSelectedId(null);
    setCreating(false);
    setLoading(true);
    fetch("/api/admin/employees?limit=500", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: { items: EmployeeItem[] }) => setEmployees(d.items ?? []))
      .catch((e) => toast.error(`Erreur : ${e.message}`))
      .finally(() => setLoading(false));
  }, [open]);

  const filtered = useMemo(() => {
    if (!search.trim()) return employees;
    const q = search.toLowerCase();
    return employees.filter(
      (e) => (e.fullName?.toLowerCase().includes(q) ?? false)
        || (e.position?.toLowerCase().includes(q) ?? false)
        || (e.department?.toLowerCase().includes(q) ?? false),
    );
  }, [employees, search]);

  const handleCreate = async () => {
    if (!templateId || !selectedId) return;
    setCreating(true);
    try {
      const res = await createDocumentDraftAction({
        templateId,
        targetAdminId: selectedId,
      });
      onCreated(res.id);
      onClose();
    } catch (e) {
      toast.error(`Erreur : ${(e as Error).message}`);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !creating && onClose()}>
      <DialogContent className="sm:max-w-xl p-0 overflow-hidden flex flex-col max-h-[85vh]" aria-describedby={undefined}>
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-white text-base flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {t("preparer_document")}
            </DialogTitle>
            <p className="text-white/80 text-xs mt-1 truncate">
              Modele : <span className="font-semibold text-white">{templateTitle}</span>
            </p>
          </DialogHeader>
        </div>

        <div className="px-5 py-3 border-b bg-muted/20 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rechercher_employe")}
              className="pl-8 h-9 text-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-[#0F2D52]" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <User className="h-10 w-10 text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">{t("aucun_employe_trouve")}</p>
            </div>
          ) : (
            <ul className="space-y-1">
              {filtered.map((e) => (
                <li key={e.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(e.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-left transition-colors ${
                      selectedId === e.id
                        ? "bg-[#0F2D52]/10 ring-1 ring-[#0F2D52]/30"
                        : "hover:bg-muted/60"
                    }`}
                  >
                    <div className="w-8 h-8 rounded-full bg-[#0F2D52]/10 flex items-center justify-center text-xs font-semibold text-[#0F2D52] shrink-0">
                      {(e.fullName ?? "?").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground truncate">
                        {e.fullName ?? t("sans_nom")}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate">
                        {[e.position, e.department].filter(Boolean).join(" · ")
                          || <span className="italic">{t("aucun_poste_ni_departement")}</span>}
                      </div>
                    </div>
                    {selectedId === e.id && (
                      <div className="w-2 h-2 rounded-full bg-[#0F2D52]" />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2">
          <Button variant="outline" size="sm" onClick={onClose} disabled={creating}>
            {tc("cancel")}
          </Button>
          <Button
            size="sm"
            onClick={handleCreate}
            disabled={!selectedId || creating}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {creating ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : null}
            Commencer la preparation
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

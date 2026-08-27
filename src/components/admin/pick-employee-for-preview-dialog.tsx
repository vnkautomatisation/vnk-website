"use client";
// =============================================================
// PickEmployeeForPreviewDialog - mini dialog pour selectionner
// un employe de test avant de generer l'apercu PDF d'un template
// standalone (sans contexte d'employe deja choisi).
//
// Convention VNK : header navy gradient + FormSection compact +
// Input recherche + liste scrollable + bouton "Apercu" final.
// =============================================================
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Search, Users, FileText, CheckCircle2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface PickEmployeeOption {
  id: number;
  fullName: string | null;
  position: string | null;
  avatarUrl: string | null;
}

export interface PickEmployeeForPreviewDialogProps {
  open: boolean;
  onClose: () => void;
  onPick: (employeeId: number) => void;
  employees: PickEmployeeOption[];
  /** Titre custom du dialog (defaut : "Choisir un employe pour l'apercu"). */
  title?: string;
  /** Description sous le titre. */
  description?: string;
  /** Texte du bouton final (defaut : "Apercu PDF"). */
  confirmLabel?: string;
}

function initials(name: string | null, fallbackId: number): string {
  const src = (name || "").trim();
  if (!src) return `#${fallbackId}`;
  const parts = src.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return src.slice(0, 2).toUpperCase();
}

export function PickEmployeeForPreviewDialog({
  open,
  onClose,
  onPick,
  employees,
  title,
  description,
  confirmLabel,
}: PickEmployeeForPreviewDialogProps) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);


  useEffect(() => {
    if (open) {
      setSearch("");
      setSelectedId(null);
    }
  }, [open]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return employees;
    return employees.filter((e) =>
      `${e.fullName ?? ""} ${e.position ?? ""}`.toLowerCase().includes(q),
    );
  }, [employees, search]);

  const confirm = () => {
    if (selectedId == null) return;
    onPick(selectedId);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-md sm:h-auto sm:max-h-[80vh] sm:rounded-lg">

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader>
            <DialogTitle className="text-sm sm:text-base text-white flex items-center gap-2 pr-8">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{title ?? t("choisir_employe_apercu")}</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs">
              {description ?? t("selectionnez_employe_resoudre_variables_template")}
            </DialogDescription>
          </DialogHeader>
        </div>


        <div className="p-3 sm:p-4 border-b shrink-0">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("rechercher_nom_poste")}
              className="h-9 text-sm pl-7"
              autoFocus
            />
          </div>
        </div>


        <div className="flex-1 overflow-y-auto p-3 space-y-1.5 min-h-0">
          {filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">
              {t("aucun_employe_trouve")}
            </p>
          ) : (
            filtered.map((e) => {
              const isSelected = selectedId === e.id;
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setSelectedId(e.id)}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2 rounded-md border text-left transition",
                    isSelected
                      ? "border-[#0F2D52] bg-[#0F2D52]/5 ring-2 ring-[#0F2D52]/20"
                      : "border-input hover:bg-muted/40",
                  )}
                >
                  <Avatar className="h-8 w-8 shrink-0">
                    {e.avatarUrl ? (
                      <AvatarImage src={e.avatarUrl} alt={e.fullName ?? ""} />
                    ) : null}
                    <AvatarFallback className="bg-[#0F2D52]/10 text-[#0F2D52] text-[11px]">
                      {initials(e.fullName, e.id)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate">
                      {e.fullName ?? `Employe #${e.id}`}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {e.position ?? t("poste_non_defini")}
                    </p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="h-4 w-4 text-[#0F2D52] shrink-0" />
                  )}
                </button>
              );
            })
          )}
        </div>


        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0 gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {tc("cancel")}
          </Button>
          <Button
            type="button"
            onClick={confirm}
            disabled={selectedId == null}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />
            {confirmLabel ?? t("apercu_pdf")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";
// =============================================================
// PositionMultiPicker - multi-select de postes avec chips et
// creation inline d'un nouveau poste.
//
// Pattern :
//   - Chips affichent les postes selectionnes (X pour retirer)
//   - Popover avec recherche + checkboxes pour selectionner
//     parmi les postes existants
//   - Bouton "+ Nouveau poste" qui ouvre un mini-dialog
//     (nom + departement) -> appelle createPositionInlineAction
//     -> ajoute automatiquement le poste a la selection
//
// Usage :
//   <PositionMultiPicker
//     value={targetPositions}
//     onChange={setTargetPositions}
//     label="Postes lies"
//   />
// =============================================================
import { useState, useEffect, useCallback, useMemo, useTransition } from "react";
import { toast } from "sonner";
import { Plus, X, Briefcase, Search, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { Field } from "@/components/admin/form-section";
import { cn } from "@/lib/utils";
import { createPositionInlineAction } from "@/app/actions/hr-positions";

// ---------- Types ------------------------------------------------
interface PositionItem {
  id: number;
  name: string;
  defaultDepartment: string | null;
  color: string | null;
  isSystem: boolean;
}

interface Props {
  value: string[]; // noms de postes selectionnes
  onChange: (positions: string[]) => void;
  label?: string;
  placeholder?: string;
  hint?: string;
  disabled?: boolean;
  /** Cache le label/wrapper Field (utile si parent gere deja). */
  inline?: boolean;
}

// ---------- Component --------------------------------------------
export function PositionMultiPicker({
  value,
  onChange,
  label = "Postes lies",
  placeholder = "Ajouter un poste...",
  hint,
  disabled,
  inline = false,
}: Props) {
  const [positions, setPositions] = useState<PositionItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [newDialogOpen, setNewDialogOpen] = useState(false);

  // ---- Fetch positions ----------------------------------------
  const fetchPositions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/positions", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { items: PositionItem[] };
      setPositions(data.items ?? []);
    } catch (e) {
      toast.error("Impossible de charger les postes");
      // eslint-disable-next-line no-console
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchPositions();
  }, [fetchPositions]);

  // ---- Helpers ------------------------------------------------
  const valueSet = useMemo(
    () => new Set(value.map((v) => v.toLowerCase())),
    [value],
  );

  const filteredPositions = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return positions;
    return positions.filter((p) =>
      `${p.name} ${p.defaultDepartment ?? ""}`.toLowerCase().includes(q),
    );
  }, [positions, search]);

  const toggle = (name: string) => {
    if (valueSet.has(name.toLowerCase())) {
      onChange(value.filter((v) => v.toLowerCase() !== name.toLowerCase()));
    } else {
      onChange([...value, name]);
    }
  };

  const remove = (name: string) => {
    onChange(value.filter((v) => v.toLowerCase() !== name.toLowerCase()));
  };

  const handleCreated = (newPositionName: string) => {
    if (!valueSet.has(newPositionName.toLowerCase())) {
      onChange([...value, newPositionName]);
    }
    void fetchPositions();
  };

  // ---- Render -------------------------------------------------
  const content = (
    <div className="space-y-2">
      {/* Chips selectionnes */}
      <div
        className={cn(
          "min-h-[40px] rounded-md border bg-background px-2 py-1.5 flex flex-wrap items-center gap-1.5",
          disabled && "opacity-60 pointer-events-none",
        )}
      >
        {value.length === 0 && (
          <span className="text-xs text-muted-foreground px-1">
            Aucun poste selectionne
          </span>
        )}
        {value.map((name) => {
          const pos = positions.find(
            (p) => p.name.toLowerCase() === name.toLowerCase(),
          );
          const color = pos?.color ?? "#6b7280";
          return (
            <Badge
              key={name}
              variant="outline"
              className="text-[11px] gap-1 pl-1.5 pr-0.5 py-0.5"
              style={{ borderColor: color, color }}
            >
              <span
                className="h-1.5 w-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              {name}
              <ActionTooltip label="Retirer">
                <button
                  type="button"
                  onClick={() => remove(name)}
                  className="ml-0.5 h-4 w-4 inline-flex items-center justify-center rounded hover:bg-muted"
                  aria-label={`Retirer ${name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </ActionTooltip>
            </Badge>
          );
        })}
      </div>

      {/* Boutons d'action */}
      <div className="flex flex-wrap items-center gap-2">
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled}
              className="h-8 text-xs"
            >
              <Briefcase className="h-3.5 w-3.5 mr-1.5" />
              {placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-72 p-0" align="start">
            <div className="p-2 border-b">
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Rechercher..."
                  className="h-8 text-xs pl-7"
                />
              </div>
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {loading ? (
                <div className="px-3 py-6 text-center">
                  <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" />
                </div>
              ) : filteredPositions.length === 0 ? (
                <p className="px-3 py-4 text-[11px] text-muted-foreground text-center">
                  Aucun poste trouve
                </p>
              ) : (
                filteredPositions.map((p) => {
                  const selected = valueSet.has(p.name.toLowerCase());
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => toggle(p.name)}
                      className={cn(
                        "w-full flex items-center gap-2 px-3 py-1.5 text-left text-xs hover:bg-muted/60 transition",
                        selected && "bg-muted/40",
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: p.color ?? "#6b7280" }}
                      />
                      <span className="flex-1 truncate">
                        <span className="font-medium">{p.name}</span>
                        {p.defaultDepartment && (
                          <span className="text-muted-foreground ml-1">
                            - {p.defaultDepartment}
                          </span>
                        )}
                      </span>
                      {selected && (
                        <Check className="h-3.5 w-3.5 text-[#0F2D52] shrink-0" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </PopoverContent>
        </Popover>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={disabled}
          onClick={() => setNewDialogOpen(true)}
          className="h-8 text-xs text-[#0F2D52]"
        >
          <Plus className="h-3.5 w-3.5 mr-1" />
          Nouveau poste
        </Button>
      </div>

      <NewPositionDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onCreated={handleCreated}
      />
    </div>
  );

  if (inline) return content;

  return (
    <Field label={label} hint={hint}>
      {content}
    </Field>
  );
}

// ================================================================
// NewPositionDialog - mini dialog inline pour creer un poste
// ================================================================
function NewPositionDialog({
  open,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [defaultDepartment, setDefaultDepartment] = useState("");
  const [description, setDescription] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (open) {
      setName("");
      setDefaultDepartment("");
      setDescription("");
    }
  }, [open]);

  const canSave = name.trim().length >= 2 && !pending;

  const handleSave = () => {
    if (!canSave) return;
    startTransition(async () => {
      try {
        const result = await createPositionInlineAction({
          name: name.trim(),
          defaultDepartment: defaultDepartment.trim() || undefined,
          description: description.trim() || undefined,
        });
        if (result.isExisting) {
          toast.info(`Poste deja existant : ${result.name} (ajoute)`);
        } else {
          toast.success(`Poste cree : ${result.name}`);
        }
        onCreated(result.name);
        onOpenChange(false);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erreur lors de la creation";
        toast.error(msg);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !pending && onOpenChange(o)}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        {/* Header navy gradient VNK */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Nouveau poste
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Cree un poste reutilisable pour les contrats et profils employes.
            </DialogDescription>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-5 space-y-4">
          <Field label="Nom du poste" required>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex : Technicien d'automatisation"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleSave();
                }
              }}
            />
          </Field>

          <Field
            label="Departement (optionnel)"
            hint="Sera propose par defaut a la creation d'un employe avec ce poste."
          >
            <Input
              value={defaultDepartment}
              onChange={(e) => setDefaultDepartment(e.target.value)}
              placeholder="ex : Operations"
            />
          </Field>

          <Field label="Description (optionnel)">
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Courte description du poste"
              maxLength={500}
            />
          </Field>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-5 py-3 flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={pending}
          >
            Annuler
          </Button>
          <Button
            onClick={handleSave}
            disabled={!canSave}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? (
              <>
                <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                Creation...
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5 mr-1.5" />
                Creer le poste
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


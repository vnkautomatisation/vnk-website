"use client";
// Dialog création/édition d'un poste (template de profil employé).
import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Briefcase, Palette } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createPositionAction, updatePositionAction } from "@/app/actions/positions";
import type { PositionRow, RoleRow } from "./team-view";

const COLORS = ["#0F2D52", "#1A5FB4", "#26A269", "#E5A50A", "#613583", "#C01C28", "#6b7280"];

export function PositionDialog({
  open, onOpenChange, position, roles, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  position: PositionRow | null;
  roles: RoleRow[];
  onSaved: () => void;
}) {
  const mode = position ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [defaultRoleId, setDefaultRoleId] = useState<string>("none");
  const [defaultDepartment, setDefaultDepartment] = useState("");
  const [color, setColor] = useState(COLORS[0]);

  useEffect(() => {
    if (open) {
      if (position) {
        setName(position.name);
        setDescription(position.description ?? "");
        setDefaultRoleId(position.defaultRoleId?.toString() ?? "none");
        setDefaultDepartment(position.defaultDepartment ?? "");
        setColor(position.color ?? COLORS[0]);
      } else {
        setName("");
        setDescription("");
        setDefaultRoleId("none");
        setDefaultDepartment("");
        setColor(COLORS[0]);
      }
    }
  }, [open, position]);

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        name,
        description: description || null,
        defaultRoleId: defaultRoleId === "none" ? null : Number(defaultRoleId),
        defaultDepartment: defaultDepartment || null,
        color,
      };
      const result =
        mode === "create"
          ? await createPositionAction(payload)
          : await updatePositionAction({ id: position!.id, ...payload });
      if (result.success) {
        toast.success(mode === "create" ? "Poste créé" : "Poste mis à jour");
        onSaved();
        onOpenChange(false);
      } else {
        toast.error(result.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl overflow-hidden flex flex-col">
        {/* Header VNK navy */}
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color }}>
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? "Nouveau poste" : position?.name}
            </DialogTitle>
            <p className="text-xs text-white/70">
              Un poste pré-remplit le rôle et le département lors de la création d&apos;un utilisateur
            </p>
          </div>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              Nom du poste *
            </Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="ex: Gestionnaire de projet"
              disabled={position?.isSystem}
              className="mt-1"
            />
            {position?.isSystem && (
              <p className="text-[10px] text-amber-700 mt-1">
                Le nom d&apos;un poste système ne peut être modifié
              </p>
            )}
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Responsabilités du poste"
              className="mt-1 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Rôle d&apos;accès par défaut
              </Label>
              <Select value={defaultRoleId} onValueChange={setDefaultRoleId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— Aucun —</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Département par défaut
              </Label>
              <Input
                value={defaultDepartment}
                onChange={(e) => setDefaultDepartment(e.target.value)}
                placeholder="Ventes"
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
              <Palette className="h-3 w-3 inline mr-1" />Couleur
            </Label>
            <div className="flex gap-1.5 mt-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={`h-7 w-7 rounded-md border-2 ${color === c ? "border-foreground" : "border-transparent"}`}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button onClick={handleSave} disabled={pending || !name.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? "Créer le poste" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

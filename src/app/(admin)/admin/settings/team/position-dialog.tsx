"use client";
// Dialog création/édition d'un poste (template de profil employé).
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Briefcase } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/admin/form-section";
import { cn } from "@/lib/utils";
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
  const t = useTranslations("admin.team");
  const tc = useTranslations("common");
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
        toast.success(mode === "create" ? t("poste_cree") : t("poste_mis_jour"));
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

        <div className="bg-gradient-to-br from-[#0F2D52] to-[#1A5FB4] text-white px-6 py-5 flex items-center gap-3.5 shrink-0">
          <div
            className="h-11 w-11 rounded-lg flex items-center justify-center shadow-sm ring-2 ring-white/20"
            style={{ backgroundColor: color }}
          >
            <Briefcase className="h-5 w-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <DialogTitle className="text-white text-base font-semibold leading-tight truncate">
              {mode === "create" ? t("nouveau_poste") : position?.name}
            </DialogTitle>
            <p className="text-xs text-white/75 mt-0.5">
              {t("pre_remplit_role_departement_creation")}
            </p>
          </div>
        </div>


        <div className="p-6 space-y-4">
          <Field
            label={t("nom_poste")}
            required
            hint={position?.isSystem ? t("nom_poste_systeme_ne_peut") : undefined}
          >
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("ex_gestionnaire_projet")}
              disabled={position?.isSystem}
            />
          </Field>

          <Field label={t("description")}>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder={t("responsabilites_poste")}
              className="text-sm"
            />
          </Field>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label={t("role_acces_defaut")}>
              <Select value={defaultRoleId} onValueChange={setDefaultRoleId}>
                <SelectTrigger><SelectValue placeholder={t("choisir")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("aucun_tiret")}</SelectItem>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id.toString()}>
                      <span className="inline-flex items-center gap-2">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: r.color ?? "#0F2D52" }} />
                        {r.name}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={t("departement_defaut")}>
              <Input
                value={defaultDepartment}
                onChange={(e) => setDefaultDepartment(e.target.value)}
                placeholder={t("ventes")}
              />
            </Field>
          </div>

          <Field label={t("couleur")}>
            <div className="flex gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  className={cn(
                    "h-9 w-9 rounded-md border-2 transition-all hover:scale-105",
                    color === c ? "border-foreground shadow-md scale-105" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                  aria-label={c}
                />
              ))}
            </div>
          </Field>
        </div>


        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            {tc("cancel")}
          </Button>
          <Button
            onClick={handleSave}
            disabled={pending || !name.trim()}
            className="bg-[#0F2D52] hover:bg-[#0F2D52]/90 shadow-sm"
          >
            {pending ? "..." : mode === "create" ? t("creer_poste") : t("enregistrer")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

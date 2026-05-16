"use client";
// Dialog création/édition d'une fenêtre de maintenance.
import { useState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Wrench } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { createMaintenanceAction, updateMaintenanceAction } from "@/app/actions/maintenance";
import type { MaintenanceRow } from "./maintenance-view";

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  // YYYY-MM-DDTHH:mm pour datetime-local
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MaintenanceDialog({
  open, onOpenChange, window, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  window: MaintenanceRow | null;
  onSaved: () => void;
}) {
  const mode = window ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [affectsPortal, setAffectsPortal] = useState(true);
  const [affectsAdmin, setAffectsAdmin] = useState(false);
  const [affectsPublic, setAffectsPublic] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (window) {
      setTitle(window.title);
      setDescription(window.description ?? "");
      setStartsAt(toLocalInput(window.startsAt));
      setEndsAt(toLocalInput(window.endsAt));
      setIsActive(window.isActive);
      setAffectsPortal(window.affectsPortal);
      setAffectsAdmin(window.affectsAdmin);
      setAffectsPublic(window.affectsPublic);
    } else {
      const now = new Date();
      const inOneHour = new Date(now.getTime() + 60 * 60 * 1000);
      const inThreeHours = new Date(now.getTime() + 3 * 60 * 60 * 1000);
      setTitle(""); setDescription("");
      setStartsAt(toLocalInput(inOneHour.toISOString()));
      setEndsAt(toLocalInput(inThreeHours.toISOString()));
      setIsActive(true);
      setAffectsPortal(true); setAffectsAdmin(false); setAffectsPublic(false);
    }
  }, [open, window]);

  const handleSave = () => {
    startTransition(async () => {
      const payload = {
        title,
        description: description || null,
        startsAt: new Date(startsAt).toISOString(),
        endsAt: new Date(endsAt).toISOString(),
        isActive, affectsPortal, affectsAdmin, affectsPublic,
      };
      const r = mode === "create"
        ? await createMaintenanceAction(payload)
        : await updateMaintenanceAction({ id: window!.id, ...payload });
      if (r.success) {
        toast.success(mode === "create" ? "Maintenance planifiée" : "Maintenance mise à jour");
        onSaved(); onOpenChange(false);
      } else {
        toast.error(r.error);
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 gap-0 max-w-xl">
        <div className="bg-[#0F2D52] text-white px-6 py-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-white/10 flex items-center justify-center">
            <Wrench className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? "Nouvelle maintenance" : window?.title}
            </DialogTitle>
            <p className="text-xs text-white/70">Fenêtre de maintenance planifiée</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Mise à jour majeure du portail" className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="Détails visibles par les utilisateurs..." className="mt-1 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Début *</Label>
              <Input type="datetime-local" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Fin *</Label>
              <Input type="datetime-local" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="mt-1" />
            </div>
          </div>

          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Zones affectées</Label>
            {[
              { label: "Portail client", get: affectsPortal, set: setAffectsPortal },
              { label: "Interface admin", get: affectsAdmin, set: setAffectsAdmin },
              { label: "Site public", get: affectsPublic, set: setAffectsPublic },
            ].map((z) => (
              <div key={z.label} className="flex items-center justify-between rounded-lg border p-3">
                <p className="text-sm font-medium">{z.label}</p>
                <Switch checked={z.get} onCheckedChange={z.set} />
              </div>
            ))}
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3 bg-muted/20">
            <div>
              <p className="text-sm font-medium">Activer la maintenance</p>
              <p className="text-xs text-muted-foreground">Désactiver pour planifier sans déclencher</p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Annuler</Button>
          <Button onClick={handleSave} disabled={pending || !title.trim() || !startsAt || !endsAt} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? "Planifier" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

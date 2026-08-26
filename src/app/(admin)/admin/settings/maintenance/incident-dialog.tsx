"use client";
// Dialog création/édition d'un IncidentReport.
import { useState, useEffect, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { createIncidentAction, updateIncidentAction } from "@/app/actions/maintenance";
import type { IncidentRow } from "./maintenance-view";

export function IncidentDialog({
  open, onOpenChange, incident, onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  incident: IncidentRow | null;
  onSaved: () => void;
}) {
  const tc = useTranslations("common");
  const mode = incident ? "edit" : "create";
  const [pending, startTransition] = useTransition();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [severity, setSeverity] = useState<"minor" | "major" | "critical">("minor");
  const [status, setStatus] = useState<"investigating" | "identified" | "monitoring" | "resolved">("investigating");
  const [isPublic, setIsPublic] = useState(true);

  useEffect(() => {
    if (!open) return;
    if (incident) {
      setTitle(incident.title);
      setDescription(incident.description);
      setSeverity(incident.severity as typeof severity);
      setStatus(incident.status as typeof status);
      setIsPublic(incident.isPublic);
    } else {
      setTitle(""); setDescription("");
      setSeverity("minor"); setStatus("investigating");
      setIsPublic(true);
    }
  }, [open, incident]);

  const handleSave = () => {
    startTransition(async () => {
      const payload = { title, description, severity, status, isPublic, resolvedAt: null };
      const r = mode === "create"
        ? await createIncidentAction(payload)
        : await updateIncidentAction({ id: incident!.id, ...payload });
      if (r.success) {
        toast.success(mode === "create" ? "Incident créé" : "Incident mis à jour");
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
          <div className="h-10 w-10 rounded-lg bg-red-500 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <DialogTitle className="text-white text-base">
              {mode === "create" ? "Nouvel incident" : incident?.title}
            </DialogTitle>
            <p className="text-xs text-white/70">Suivi d&apos;incident technique</p>
          </div>
        </div>

        <div className="p-6 space-y-4">
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Titre *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Lenteurs sur le portail" className="mt-1" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Description *</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} maxLength={5000} placeholder="Symptômes, impact, mises à jour..." className="mt-1 text-sm" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Sévérité</Label>
              <Select value={severity} onValueChange={(v) => setSeverity(v as typeof severity)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="minor">Mineur</SelectItem>
                  <SelectItem value="major">Majeur</SelectItem>
                  <SelectItem value="critical">Critique</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{tc("status")}</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="investigating">Investigation</SelectItem>
                  <SelectItem value="identified">Identifié</SelectItem>
                  <SelectItem value="monitoring">Surveillance</SelectItem>
                  <SelectItem value="resolved">Résolu</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <p className="text-sm font-medium">Visible publiquement</p>
              <p className="text-xs text-muted-foreground">Affiché sur la page de statut publique</p>
            </div>
            <Switch checked={isPublic} onCheckedChange={setIsPublic} />
          </div>
        </div>

        <div className="border-t bg-muted/30 px-6 py-3 flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={handleSave} disabled={pending || !title.trim() || !description.trim()} className="bg-[#0F2D52] hover:bg-[#0F2D52]/90">
            {pending ? "..." : mode === "create" ? "Créer" : "Enregistrer"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

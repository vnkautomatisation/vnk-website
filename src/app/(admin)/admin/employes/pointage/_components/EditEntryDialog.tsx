"use client";
// EditEntryDialog — modal de modification d'une entree de pointage existante.
// Extrait de timeclock-view.tsx (refactor #11). Logique inchangee.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DurationPicker } from "@/components/admin/time-picker";
import { updateTimeClockAction } from "@/app/actions/hr-timeclock";
import type { Entry } from "../_types";

export function EditEntryDialog({
  entry, isAdminOverride, onClose, onSaved,
}: {
  entry: Entry;
  isAdminOverride: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialDate = useMemo(() => {
    const d = new Date(entry.clockIn);
    const y = d.getFullYear(); const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  }, [entry.clockIn]);
  const initialStartHM = useMemo(() => {
    const d = new Date(entry.clockIn);
    return { h: d.getHours(), m: d.getMinutes() };
  }, [entry.clockIn]);
  const initialDuration = useMemo(() => {
    if (entry.durationMin != null) return entry.durationMin;
    if (entry.clockOut) {
      return Math.floor((new Date(entry.clockOut).getTime() - new Date(entry.clockIn).getTime()) / 60000);
    }
    return 480;
  }, [entry.clockIn, entry.clockOut, entry.durationMin]);

  // Catégories acceptées par updateTimeClockAction. On garde une whitelist
  // locale pour préserver le type du payload (P1-8 : auparavant la catégorie
  // était forcée à "work" lors d'un edit → un congé pouvait basculer en travail).
  type AllowedCat = "work" | "break" | "meeting" | "training" | "sick" | "vacation";
  const ALLOWED_CATS: ReadonlyArray<AllowedCat> = ["work", "break", "meeting", "training", "sick", "vacation"];
  const initialCategory: AllowedCat =
    (ALLOWED_CATS as readonly string[]).includes(entry.category)
      ? (entry.category as AllowedCat)
      : "work";

  const [date, setDate] = useState(initialDate);
  const [durationMin, setDurationMin] = useState(initialDuration);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [category] = useState<AllowedCat>(initialCategory);
  const [pending, setPending] = useState(false);

  const formattedDuration = useMemo(() => {
    const h = Math.floor(durationMin / 60);
    const m = durationMin % 60;
    return `${h}h${m.toString().padStart(2, "0")}`;
  }, [durationMin]);

  const submit = async () => {
    if (durationMin <= 0) { toast.error("La durée doit être supérieure à 0"); return; }
    setPending(true);
    const [y, mo, d] = date.split("-").map(Number);
    const newClockIn = new Date(y, mo - 1, d, initialStartHM.h, initialStartHM.m, 0, 0);
    const newClockOut = new Date(newClockIn.getTime() + durationMin * 60_000);
    const r = await updateTimeClockAction({
      id: entry.id,
      clockIn: newClockIn.toISOString(),
      clockOut: newClockOut.toISOString(),
      category,
      notes: notes || null,
    });
    setPending(false);
    if (r.success) { toast.success("Entrée modifiée"); onSaved(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Pencil className="h-4 w-4" />Modifier l&apos;entrée
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {isAdminOverride
                ? "Override administrateur — sera tracé dans l'audit."
                : "Vous modifiez votre propre entrée de pointage."}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Jour & durée totale</Label>
            <DurationPicker
              date={date}
              durationMin={durationMin}
              onChange={(v) => { setDate(v.date); setDurationMin(v.durationMin); }}
            />
            <p className="text-[11px] text-muted-foreground">
              Total : <span className="font-mono font-bold text-[#0F2D52]">{formattedDuration}</span>
              {" · "}début à {String(initialStartHM.h).padStart(2, "0")}:{String(initialStartHM.m).padStart(2, "0")}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wider font-semibold">Notes (optionnel)</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Détail de la tâche…" />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending}>{pending ? "..." : "Enregistrer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

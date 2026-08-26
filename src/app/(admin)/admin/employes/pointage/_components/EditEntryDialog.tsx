"use client";
// Edit a time entry: start (date + time) and duration are both editable.
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Pencil, Calendar, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { FormSection } from "@/components/admin/form-section";
import { TimePicker, HourMinutePicker } from "@/components/admin/time-picker";
import { updateTimeClockAction } from "@/app/actions/hr-timeclock";
import { entryTiming } from "@/lib/time-entry";
import type { Entry } from "../_types";

function pad(n: number) { return n.toString().padStart(2, "0"); }

export function EditEntryDialog({
  entry, isAdminOverride, onClose, onSaved,
}: {
  entry: Entry;
  isAdminOverride: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const initialStart = useMemo(() => {
    const d = new Date(entry.clockIn);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [entry.clockIn]);
  // TimePicker defaults to the current week; overrides target older entries.
  const minDate = useMemo(() => {
    const d = new Date(entry.clockIn);
    d.setFullYear(d.getFullYear() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, [entry.clockIn]);

  const timing = useMemo(() => entryTiming(entry), [entry]);
  const initialDuration = timing.stored ?? timing.worked ?? 480;

  // Preserve the original category: forcing "work" turned leaves into work.
  type AllowedCat = "work" | "break" | "meeting" | "training" | "sick" | "vacation";
  const ALLOWED_CATS: ReadonlyArray<AllowedCat> = ["work", "break", "meeting", "training", "sick", "vacation"];
  const category: AllowedCat =
    (ALLOWED_CATS as readonly string[]).includes(entry.category)
      ? (entry.category as AllowedCat)
      : "work";

  const initialDurationHM = `${pad(Math.floor(initialDuration / 60))}:${pad(initialDuration % 60)}`;
  const [start, setStart] = useState(initialStart);
  const [durationHM, setDurationHM] = useState(initialDurationHM);
  const [notes, setNotes] = useState(entry.notes ?? "");
  const [pending, setPending] = useState(false);

  const durationMin = useMemo(() => {
    const [h, m] = durationHM.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  }, [durationHM]);

  const startDate = useMemo(() => {
    const [datePart, timePart] = start.split("T");
    const [y, mo, d] = (datePart ?? "").split("-").map(Number);
    const [h, mi] = (timePart ?? "").split(":").map(Number);
    if (!y || !mo || !d) return null;
    return new Date(y, mo - 1, d, h || 0, mi || 0, 0, 0);
  }, [start]);

  // The duration is WORKED time, so the bracket also has to cover the breaks.
  const breakMin = timing.breakMin;
  const endLabel = useMemo(() => {
    if (!startDate || durationMin <= 0) return null;
    const end = new Date(startDate.getTime() + (durationMin + breakMin) * 60_000);
    const sameDay = end.getDate() === startDate.getDate();
    return `${pad(end.getHours())}:${pad(end.getMinutes())}${sameDay ? "" : " (+1 jour)"}`;
  }, [startDate, durationMin, breakMin]);

  const submit = async () => {
    if (!startDate) { toast.error("Date de début invalide"); return; }
    if (durationMin <= 0) { toast.error("La durée doit être supérieure à 0"); return; }
    setPending(true);
    // Leave the punches alone when only the notes changed: recomputing them
    // would shift the real end by the stored rounding.
    const timesUnchanged = start === initialStart && durationHM === initialDurationHM;
    const newClockOut = new Date(startDate.getTime() + (durationMin + breakMin) * 60_000);
    const r = await updateTimeClockAction({
      id: entry.id,
      ...(timesUnchanged ? {} : {
        clockIn: startDate.toISOString(),
        clockOut: newClockOut.toISOString(),
      }),
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
        <div className="p-5 space-y-5">
          <FormSection icon={Calendar} title="Début">
            <TimePicker value={start} onChange={setStart} minDate={minDate} disabled={pending} />
          </FormSection>
          <FormSection icon={Calendar} title="Durée travaillée">
            <HourMinutePicker value={durationHM} onChange={setDurationHM} disabled={pending} />
            <p className="text-[11px] text-muted-foreground">
              {endLabel
                ? <>
                    Fin calculée : <span className="font-mono font-bold text-[#0F2D52]">{endLabel}</span>
                    {breakMin > 0 && <> · pause de {breakMin} min incluse dans la plage</>}
                  </>
                : "Renseignez une durée supérieure à 0."}
            </p>
          </FormSection>
          <FormSection icon={FileText} title="Notes (optionnel)">
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Détail de la tâche…" />
          </FormSection>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending || durationMin <= 0 || !startDate}>
            {pending ? "..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

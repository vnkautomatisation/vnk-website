"use client";
// Edit a time entry: start (date + time) and duration are both editable.
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("admin.timeclock");
  const tc = useTranslations("common");
  const initialStart = useMemo(() => {
    const d = new Date(entry.clockIn);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }, [entry.clockIn]);

  const minDate = useMemo(() => {
    const d = new Date(entry.clockIn);
    d.setFullYear(d.getFullYear() - 1);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, [entry.clockIn]);

  const timing = useMemo(() => entryTiming(entry), [entry]);
  const initialDuration = timing.stored ?? timing.worked ?? 480;


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


  const breakMin = timing.breakMin;
  const endLabel = useMemo(() => {
    if (!startDate || durationMin <= 0) return null;
    const end = new Date(startDate.getTime() + (durationMin + breakMin) * 60_000);
    const sameDay = end.getDate() === startDate.getDate();
    return t("editentrydialog_p0_p1_p2", { p0: pad(end.getHours()), p1: pad(end.getMinutes()), p2: sameDay ? "" : " (+1 jour)" });
  }, [startDate, durationMin, breakMin]);

  const submit = async () => {
    if (!startDate) { toast.error(t("date_debut_invalide")); return; }
    if (durationMin <= 0) { toast.error(t("duree_doit_etre_superieure_0")); return; }
    setPending(true);


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
    if (r.success) { toast.success(t("entree_modifiee")); onSaved(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Pencil className="h-4 w-4" />{t("editentrydialog_modifier_l_entree")}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {isAdminOverride
                ? t("override_administrateur_sera_trace_audit")
                : t("vous_modifiez_propre_entree_pointage")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-5">
          <FormSection icon={Calendar} title={t("debut")}>
            <TimePicker value={start} onChange={setStart} minDate={minDate} disabled={pending} />
          </FormSection>
          <FormSection icon={Calendar} title={t("duree_travaillee")}>
            <HourMinutePicker value={durationHM} onChange={setDurationHM} disabled={pending} />
            <p className="text-[11px] text-muted-foreground">
              {endLabel
                ? <>{t("editentrydialog_fin_calculee")}<span className="font-mono font-bold text-[#0F2D52]">{endLabel}</span>
                    {breakMin > 0 && <> · pause de {breakMin} min incluse dans la plage</>}
                  </>
                : t("renseignez_duree_superieure_0")}
            </p>
          </FormSection>
          <FormSection icon={FileText} title={t("notes_optionnel")}>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder={t("detail_tache")} />
          </FormSection>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending || durationMin <= 0 || !startDate}>
            {pending ? "..." : t("enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

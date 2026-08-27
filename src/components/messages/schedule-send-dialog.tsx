"use client";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Clock } from "lucide-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const QUICK_PRESETS: { labelKey: string; minutesFromNow: number }[] = [
  { labelKey: "preset_dans_1h", minutesFromNow: 60 },
  { labelKey: "preset_demain_9h", minutesFromNow: -1 },
  { labelKey: "preset_lundi_9h", minutesFromNow: -2 },
];

function nextHour9(): Date {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return d;
}
function nextMonday9(): Date {
  const d = new Date();
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : (8 - day);
  d.setDate(d.getDate() + daysUntilMonday);
  d.setHours(9, 0, 0, 0);
  return d;
}

function fmtLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ScheduleSendDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onConfirm: (isoDate: string) => void;
}) {
  const t = useTranslations("admin.messages");
  const [when, setWhen] = useState<string>(fmtLocalInput(new Date(Date.now() + 60 * 60 * 1000)));

  const applyPreset = (p: typeof QUICK_PRESETS[number]) => {
    let d: Date;
    if (p.minutesFromNow === -1) d = nextHour9();
    else if (p.minutesFromNow === -2) d = nextMonday9();
    else d = new Date(Date.now() + p.minutesFromNow * 60 * 1000);
    setWhen(fmtLocalInput(d));
  };

  const handle = () => {
    if (!when) return;
    const d = new Date(when);
    if (d.getTime() < Date.now()) {
      toast.error(t("date_doit_etre_futur"));
      return;
    }
    onConfirm(d.toISOString());
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-white">{t("programmer_apos_envoi")}</DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {t("message_sera_envoye_automatiquement_date")}
              </DialogDescription>
            </div>
          </div>
        </div>
        <div className="px-6 py-5 space-y-3">
          <div className="flex flex-wrap gap-2">
            {QUICK_PRESETS.map((p) => (
              <button
                key={t(p.labelKey)}
                type="button"
                onClick={() => applyPreset(p)}
                className="text-xs px-2.5 py-1 rounded-md border hover:bg-muted transition-colors"
              >
                {t(p.labelKey)}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("date_heure")}</Label>
            <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          </div>
        </div>
        <DialogFooter className="px-6 py-4 border-t bg-card sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t("annuler")}</Button>
          <Button onClick={handle} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">{t("programmer")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

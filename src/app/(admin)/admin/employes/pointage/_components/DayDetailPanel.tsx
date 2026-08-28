"use client";
// DayDetailPanel - audit drill-down of a single day's sub-entries.
import { Clock, Pencil } from "lucide-react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import type { Entry } from "../_types";
import { ApprovedBadge } from "./ApprovedBadge";
import { mergeInfo, MergedBadge } from "./EntryRows";
import { StatBox } from "./StatBox";
import { CAT_LABEL, catLabel, fmtDuration, fmtTime, capFirst, displayNotes } from "./_utils";

export function DayDetailPanel({
  adminName, date, workMin, breakMin, entries, onEdit,
}: {
  adminName: string;
  date: string;
  workMin: number;
  breakMin: number;
  entries: Entry[];
  onEdit: (entry: Entry) => void;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("admin.timeclock");
  const dateTag = useDateLocale();
  const dateLabel = capFirst(new Date(date + "T12:00:00").toLocaleDateString(dateTag, {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }));
  return (
    <>
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5">
        <SheetHeader>
          <SheetTitle className="text-white">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5" />
              <div>
                <p className="text-base">{t("details_journee")}</p>
                <p className="text-xs text-white/70 font-normal">{adminName} · {dateLabel}</p>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatBox label={t("travail_effectif")} value={fmtDuration(workMin)} accent="emerald" />
          <StatBox label={t("pauses")} value={fmtDuration(breakMin)} accent="blue" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52] mb-2">
            Sous-entrées ({entries.length})
          </p>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {entries.map((e) => {
              const cat = CAT_LABEL[e.category] ?? { key: "", color: "bg-gray-100 text-gray-700" };
              const { isMerged, count: mergedCount, gapMin, grossIsCoherent } = mergeInfo(e);
              return (
                <div key={e.id} className="flex items-start gap-2 p-2 text-xs rounded border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono tabular-nums">
                        {fmtTime(e.clockIn)}
                        {e.clockOut
                          ? ` → ${fmtTime(e.clockOut)}`
                          : t("cours_suffixe")}
                      </span>
                      <Badge className={`text-[9px] ${cat.color}`}>{catLabel(t, e.category)}</Badge>
                      {isMerged && <MergedBadge count={mergedCount} gapMin={gapMin} coherent={grossIsCoherent} small />}
                      {e.jobCode && (
                        <ActionTooltip label={e.jobCode.label}>
                          <Badge variant="outline" className="font-mono text-[9px] cursor-help">
                            {e.jobCode.code}
                          </Badge>
                        </ActionTooltip>
                      )}
                      {e.approvedAt && <ApprovedBadge />}
                      {e.submittedAt && !e.approvedAt && (
                        <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 bg-amber-50">
                          {t("attente")}
                        </Badge>
                      )}
                      {!e.submittedAt && !e.approvedAt && e.clockOut && (
                        <Badge variant="outline" className="text-[9px] text-slate-600 border-slate-300 bg-slate-50">
                          {t("brouillon_non_soumis")}
                        </Badge>
                      )}
                    </div>
                    {displayNotes(e.notes) && (
                      <p className="text-[10px] text-muted-foreground italic mt-0.5 break-words">
                        {displayNotes(e.notes)}
                      </p>
                    )}
                  </div>

                  <span className="font-mono tabular-nums font-bold shrink-0">
                    {e.clockOut ? fmtDuration(e.durationMin) : "—"}
                  </span>
                  {!e.payStubId && (
                    <ActionTooltip label={t("modifier_admin_override")}>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => onEdit(e)}
                        aria-label={tc("edit")}
                      >
                        <Pencil className="h-3 w-3" />
                      </Button>
                    </ActionTooltip>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </>
  );
}

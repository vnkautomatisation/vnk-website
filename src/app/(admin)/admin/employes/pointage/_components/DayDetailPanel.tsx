"use client";
// DayDetailPanel — drill-down audit des sous-entrees d'un jour.
// Extrait de timeclock-view.tsx (refactor #87). Purement presentationnel.
import { Clock, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import type { Entry } from "../_types";
import { formatShiftDuration } from "../_types";
import { ApprovedBadge } from "./ApprovedBadge";
import { StatBox } from "./StatBox";
import { CAT_LABEL, fmtDuration } from "./_utils";

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
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
  return (
    <>
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5">
        <SheetHeader>
          <SheetTitle className="text-white">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5" />
              <div>
                <p className="text-base">Détails de la journée</p>
                <p className="text-xs text-white/70 font-normal capitalize">{adminName} · {dateLabel}</p>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>
      </div>
      <div className="p-5 space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <StatBox label="Travail effectif" value={fmtDuration(workMin)} accent="emerald" />
          <StatBox label="Pauses" value={fmtDuration(breakMin)} accent="blue" />
        </div>
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52] mb-2">
            Sous-entrées ({entries.length})
          </p>
          <div className="space-y-1 max-h-[500px] overflow-y-auto">
            {entries.map((e) => {
              const cat = CAT_LABEL[e.category] ?? { label: e.category, color: "bg-gray-100 text-gray-700" };
              return (
                <div key={e.id} className="flex items-start gap-2 p-2 text-xs rounded border">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-mono tabular-nums">
                        {new Date(e.clockIn).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
                        {e.clockOut
                          ? ` → ${new Date(e.clockOut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`
                          : " · en cours"}
                      </span>
                      <Badge className={`text-[9px] ${cat.color}`}>{cat.label}</Badge>
                      {e.jobCode && (
                        <ActionTooltip label={e.jobCode.label}>
                          <Badge variant="outline" className="font-mono text-[9px] cursor-help">
                            {e.jobCode.code}
                          </Badge>
                        </ActionTooltip>
                      )}
                      {e.approvedAt && <ApprovedBadge />}
                      {e.submittedAt && !e.approvedAt && (
                        <Badge variant="outline" className="text-[9px] text-blue-700 border-blue-300 bg-blue-50">
                          En attente
                        </Badge>
                      )}
                    </div>
                    {e.notes && (
                      <p className="text-[10px] text-muted-foreground italic mt-0.5 break-words">
                        {e.notes}
                      </p>
                    )}
                  </div>
                  <span className="font-mono tabular-nums font-bold shrink-0">
                    {formatShiftDuration(e.clockIn, e.clockOut)}
                  </span>
                  {!e.payStubId && (
                    <ActionTooltip label="Modifier (admin override)">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6 shrink-0"
                        onClick={() => onEdit(e)}
                        aria-label="Modifier"
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

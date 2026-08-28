"use client";
// Reusable entry rows. Pure presentation: props + callbacks.
import {
  Clock, CheckCircle2, XCircle, Pencil, Trash2, Lock, Unlock, RotateCcw,
  ChevronRight, AlertCircle, FileText, Send, MapPin,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { Badge } from "@/components/ui/badge";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { confirmDialog } from "@/components/admin/prompt-dialog";
import type { Entry } from "../_types";
import { formatShiftDuration } from "../_types";
import { ApprovedBadge } from "./ApprovedBadge";
import { HistoryPopover } from "./HistoryPopover";
import { entryTiming, type TimingInput } from "@/lib/time-entry";
import { CAT_LABEL, catLabel, fmtDuration, fmtTime, capFirst, displayNotes } from "./_utils";

// A merge is truthful only when gross - breaks = worked. Legacy merges
// bridged unrecorded gaps.
export function mergeInfo(entry: TimingInput) {
  const t = entryTiming(entry);
  return { isMerged: t.isMerged, count: t.mergedCount, gapMin: t.mergedGapMin, grossIsCoherent: t.isCoherent };
}

export function MergedBadge({ count, gapMin, coherent, small = false }: { count: number; gapMin: number; coherent: boolean; small?: boolean }) {
  const t = useTranslations("admin.timeclock");
  const label = coherent
    ? t("entryrows_p0_pointages_fusionnes_la_plage_va_du_premier", { p0: count, p1: gapMin > 0 ? `, et les ${gapMin} min d'écart entre eux sont comptées en pause` : "" })
    : t("fusion_ancienne_temps_non_comptabilise");
  return (
    <ActionTooltip label={label}>
      <Badge variant="outline" className={`${small ? "text-[9px]" : "text-[10px]"} text-violet-700 border-violet-300 bg-violet-50 cursor-help`}>
        {count > 0 ? t("entryrows_fusion_de_p0", { p0: count }) : t("fusion")}
      </Badge>
    </ActionTooltip>
  );
}

// PanelEntryRow: one entry inside EmployeeWeekPanel (admin review).
export function PanelEntryRow({
  entry, pending, onApprove, onReject, onUnapprove,
}: {
  entry: Entry;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onUnapprove: () => void;
}) {
  const t = useTranslations("admin.timeclock");
  const dateTag = useDateLocale();
  const cat = CAT_LABEL[entry.category] ?? { key: "", color: "bg-gray-100 text-gray-700" };
  const start = new Date(entry.clockIn);
  const { isMerged, count: mergedCount, gapMin: mergedGapMin, grossIsCoherent } = mergeInfo(entry);
  const isApproved = !!entry.approvedAt;
  const isSubmitted = !!entry.submittedAt;

  const isPending = !isApproved && !!entry.clockOut && isSubmitted;
  const isDraft = !isApproved && !!entry.clockOut && !isSubmitted;
  const isOpen = !entry.clockOut;
  const isPaid = !!entry.payStubId;



  const rejectEvent = (entry.history ?? []).find((h) => h.event === "rejected");
  const isRejected =
    !isApproved && !isSubmitted
    && (rejectEvent != null || (entry.notes ?? "").startsWith("[REJET"));
  const rejectReason = rejectEvent?.reason
    ?? (isRejected ? (entry.notes ?? "").split("\n")[0].replace(/^\[REJET[^\]]+\]\s*/, "") : "");

  return (
    <div className="p-2.5 hover:bg-muted/30">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono tabular-nums">
              {fmtTime(start)}
              {entry.clockOut
                ? ` → ${fmtTime(entry.clockOut)}`
                : t("cours_suffixe")}
            </span>
            <Badge className={`text-[9px] ${cat.color}`}>{catLabel(t, entry.category)}</Badge>
            {isMerged && <MergedBadge count={mergedCount} gapMin={mergedGapMin} coherent={grossIsCoherent} small />}
            {entry.jobCode && (
              <ActionTooltip label={entry.jobCode.label}>
                <Badge variant="outline" className="font-mono text-[9px] cursor-help">
                  {entry.jobCode.code}
                </Badge>
              </ActionTooltip>
            )}
            {isApproved && <ApprovedBadge />}
            {isPending && (
              <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 bg-amber-50">
                {t("attente")}
              </Badge>
            )}
            {isDraft && !isRejected && (
              <Badge variant="outline" className="text-[9px] text-slate-600 border-slate-300 bg-slate-50">
                {t("brouillon_non_soumis")}
              </Badge>
            )}
            {isRejected && !isApproved && (
              <ActionTooltip label={entry.notes ?? ""}>
                <Badge variant="outline" className="text-[9px] text-red-700 border-red-300 bg-red-50 cursor-help">
                  <XCircle className="h-2.5 w-2.5 mr-1" />Rejete
                </Badge>
              </ActionTooltip>
            )}
            {isPaid && (
              <Badge variant="outline" className="text-[9px] text-violet-700 border-violet-300 bg-violet-50">
                {t("bulletin")}
              </Badge>
            )}
            {isOpen && (
              <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50">
                {t("ouvert")}
              </Badge>
            )}
          </div>
          {isRejected && rejectReason && (
            <p className="text-[10px] text-red-700 italic mt-0.5">
              Raison : {rejectReason}
            </p>
          )}
          {entry.notes && !isRejected && (
            <p className="text-[10px] text-muted-foreground italic mt-0.5 truncate">{displayNotes(entry.notes)}</p>
          )}
          {isApproved && entry.approver && entry.approvedBy !== entry.adminId && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Approuve par {entry.approver.fullName || entry.approver.email}
              {entry.approvedAt && t("entryrows_le_p0", { p0: new Date(entry.approvedAt).toLocaleDateString(dateTag) })}
            </p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-xs font-bold tabular-nums">
            {entry.durationMin != null
              ? fmtDuration(entry.durationMin)
              : formatShiftDuration(entry.clockIn, entry.clockOut)}
          </p>
          {(entry.totalBreakMin > 0 || (entry.durationMin != null && entry.clockOut)) && (
            <p className="text-[9px] text-muted-foreground tabular-nums">
              {entry.clockOut && grossIsCoherent && <span>brut {formatShiftDuration(entry.clockIn, entry.clockOut)}</span>}
              {entry.totalBreakMin > 0 && (
              <span className="text-amber-700"> · pause {fmtDuration(entry.totalBreakMin)}</span>
            )}
            {(entry.paidBreakMin ?? 0) > 0 && (
              <span className="text-sky-700"> · {t("pause_payee_duree", { duration: fmtDuration(entry.paidBreakMin ?? 0) })}</span>
            )}
            </p>
          )}
        </div>
      </div>
      {!isPaid && !isOpen && (
        <div className="flex items-center gap-1 mt-1.5 justify-end">
          {(entry.history?.length ?? 0) > 0 && <HistoryPopover history={entry.history} />}
          {isPending && (
            <>
              <ActionTooltip label={t("approuver")}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={onApprove}
                  className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />Approuver
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("rejeter_raison")}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={onReject}
                  className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-3 w-3 mr-1" />Rejeter
                </Button>
              </ActionTooltip>
            </>
          )}
          {isRejected && !isApproved && (
            <p className="text-[10px] text-muted-foreground italic">
              {t("attente_re_soumission_apos_employe")}
            </p>
          )}
          {isApproved && (
            <ActionTooltip label={t("annuler_approbation")}>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={onUnapprove}
                className="h-7 text-xs text-muted-foreground hover:text-[#0F2D52]"
              >
                <RotateCcw className="h-3 w-3 mr-1" />Annuler approbation
              </Button>
            </ActionTooltip>
          )}
        </div>
      )}
      {isPaid && (
        <p className="text-[10px] text-muted-foreground italic mt-1 text-right">
          {t("verrouille_deja_bulletin_paie")}
        </p>
      )}
    </div>
  );
}

// CompactEntryRow: compact line inside an expanded day (employee view).
export function CompactEntryRow({
  entry, canEdit, isLocked, onEdit, onDelete, onRequestUnlock,
}: {
  entry: Entry;
  canEdit?: boolean;
  isLocked?: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onRequestUnlock?: () => void;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("admin.timeclock");
  const cat = CAT_LABEL[entry.category] ?? { key: "", color: "bg-gray-100 text-gray-700" };
  const start = new Date(entry.clockIn);
  const { isMerged, count: mergedCount, gapMin: mergedGapMin, grossIsCoherent } = mergeInfo(entry);
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono tabular-nums">
            {fmtTime(start)}
            {entry.clockOut
              ? ` → ${fmtTime(entry.clockOut)}`
              : t("cours_suffixe")}
          </span>
          <Badge className={`text-[10px] ${cat.color}`}>{catLabel(t, entry.category)}</Badge>
          {isMerged && <MergedBadge count={mergedCount} gapMin={mergedGapMin} coherent={grossIsCoherent} />}
          {entry.jobCode && (
            <ActionTooltip label={entry.jobCode.label}>
              <Badge variant="outline" className="font-mono text-[10px] cursor-help">
                {entry.jobCode.code}
              </Badge>
            </ActionTooltip>
          )}
          {entry.source === "kiosk" && (
            <Badge variant="outline" className="text-[10px] text-slate-600 border-slate-300 bg-slate-50">
              {t("kiosque")}
            </Badge>
          )}
          {typeof entry.clockInLat === "number" && typeof entry.clockInLng === "number" && (
            <ActionTooltip
              label={t("entryrows_position_au_punch_p0_p1_ouvrir_dans_google", { p0: entry.clockInLat.toFixed(5), p1: entry.clockInLng.toFixed(5) })}
            >
              <a
                href={`https://www.google.com/maps?q=${entry.clockInLat},${entry.clockInLng}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-slate-400 hover:text-[#0F2D52]"
                aria-label={t("position_gps_punch")}
              >
                <MapPin className="h-3.5 w-3.5" />
              </a>
            </ActionTooltip>
          )}
          {entry.approvedAt && <ApprovedBadge />}
          {entry.submittedAt && !entry.approvedAt && (
            <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50">
              <Clock className="h-2.5 w-2.5 mr-1" />{t("entryrows_en_attente_d_approbation")}</Badge>
          )}

          {!entry.submittedAt && !entry.approvedAt
            && ((entry.history ?? []).some((h) => h.event === "rejected") || (entry.notes ?? "").startsWith("[REJET")) && (
            <ActionTooltip
              label={(entry.history ?? []).find((h) => h.event === "rejected")?.reason ?? entry.notes ?? t("pointage_rejete")}
            >
              <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50 cursor-help">
                <XCircle className="h-2.5 w-2.5 mr-1" />{t("entryrows_rejete")}</Badge>
            </ActionTooltip>
          )}
          {entry.payStubId && (
            <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">
              {t("bulletin")}
            </Badge>
          )}
        </div>
        {displayNotes(entry.notes) && <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">{displayNotes(entry.notes)}</p>}
        {entry.approvedAt && entry.approver && entry.approvedBy !== entry.adminId && (
          <p className="text-[10px] text-muted-foreground">
            Approuvé par {entry.approver.fullName || entry.approver.email}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">

        <p className="font-mono text-sm font-bold tabular-nums">
          {entry.durationMin != null
            ? fmtDuration(entry.durationMin)
            : formatShiftDuration(entry.clockIn, entry.clockOut)}
        </p>

        {(entry.totalBreakMin > 0 || (entry.durationMin != null && entry.clockOut)) && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {entry.clockOut && grossIsCoherent && (
              <span>brut {formatShiftDuration(entry.clockIn, entry.clockOut)}</span>
            )}
            {entry.totalBreakMin > 0 && (
              <span className="text-amber-700"> · pause {fmtDuration(entry.totalBreakMin)}</span>
            )}
            {(entry.paidBreakMin ?? 0) > 0 && (
              <span className="text-sky-700"> · {t("pause_payee_duree", { duration: fmtDuration(entry.paidBreakMin ?? 0) })}</span>
            )}
          </p>
        )}
      </div>
      {isLocked && !entry.approvedAt && (
        <>
          <ActionTooltip label={t("heures_soumises_verrouillees")}>
            <span className="flex items-center justify-center h-7 w-7 shrink-0 text-muted-foreground cursor-help">
              <Lock className="h-3.5 w-3.5" />
            </span>
          </ActionTooltip>
          {onRequestUnlock && (
            <ActionTooltip label={t("demander_modification")}>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-[#0F2D52]"
                onClick={onRequestUnlock}
                aria-label={t("demander_modification")}
              >
                <Unlock className="h-3.5 w-3.5" />
              </Button>
            </ActionTooltip>
          )}
        </>
      )}
      {!isLocked && canEdit && onEdit && (
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onEdit} aria-label={tc("edit")}>
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {!isLocked && !entry.approvedAt && !entry.payStubId && (
        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive shrink-0" onClick={onDelete} aria-label={tc("delete")}>
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// EntryRow: full row for the detailed admin review view.
export function EntryRow({
  entry, showAdmin, isReviewer, selected, onSelect, onApprove, onReject, onClickName, onEdit, holidayName,
}: {
  entry: Entry;
  showAdmin: boolean;
  isReviewer?: boolean;
  selected?: boolean;
  onSelect?: (v: boolean) => void;
  onApprove?: () => void;
  onReject?: () => void;
  onClickName?: () => void;
  onEdit?: () => void;
  holidayName?: string;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("admin.timeclock");
  const dateTag = useDateLocale();
  const cat = CAT_LABEL[entry.category] ?? { key: "", color: "bg-gray-100 text-gray-700" };
  const date = new Date(entry.clockIn);
  const { isMerged, count: mergedCount, gapMin: mergedGapMin, grossIsCoherent } = mergeInfo(entry);
  return (
    <div className="flex items-center gap-3 p-3 hover:bg-muted/30">
      {isReviewer && !entry.approvedAt && (
        <input
          type="checkbox"
          checked={!!selected}
          onChange={(e) => onSelect?.(e.target.checked)}
          className="h-4 w-4 rounded border-input"
        />
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          {showAdmin && entry.admin && (
            <button
              type="button"
              onClick={onClickName}
              className="text-sm font-medium hover:underline text-left"
            >
              {entry.admin.fullName || entry.admin.email}
            </button>
          )}
          <Badge className={`text-[10px] ${cat.color}`}>{catLabel(t, entry.category)}</Badge>
          {isMerged && <MergedBadge count={mergedCount} gapMin={mergedGapMin} coherent={grossIsCoherent} />}
          {entry.jobCode && (
            <ActionTooltip label={entry.jobCode.label}>
              <Badge variant="outline" className="font-mono text-[10px] cursor-help">
                {entry.jobCode.code}
              </Badge>
            </ActionTooltip>
          )}
          {holidayName && (
            <Badge className="text-[10px] bg-cyan-100 text-cyan-800 border-cyan-300">
              Férié — {holidayName}
            </Badge>
          )}
          {entry.approvedAt && <ApprovedBadge />}
          {entry.submittedAt && !entry.approvedAt && (
            <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50">
              <Clock className="h-2.5 w-2.5 mr-1" />{t("entryrows_en_attente_d_approbation")}</Badge>
          )}
          {entry.payStubId && (
            <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">
              {t("bulletin")}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {date.toLocaleDateString(dateTag, { weekday: "short", day: "numeric", month: "short" })}
          {" · "}
          {fmtTime(date)}
          {entry.clockOut ? ` → ${fmtTime(entry.clockOut)}` : t("cours_suffixe")}
        </p>
        {displayNotes(entry.notes) && <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">{displayNotes(entry.notes)}</p>}
        {entry.approvedAt && entry.approver && entry.approvedBy !== entry.adminId && (
          <p className="text-[10px] text-muted-foreground">
            Approuvé par {entry.approver.fullName || entry.approver.email}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-sm font-bold tabular-nums">
          {entry.durationMin != null
            ? fmtDuration(entry.durationMin)
            : formatShiftDuration(entry.clockIn, entry.clockOut)}
        </p>
        {(entry.totalBreakMin > 0 || (entry.durationMin != null && entry.clockOut)) && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {entry.clockOut && grossIsCoherent && (
              <span>brut {formatShiftDuration(entry.clockIn, entry.clockOut)}</span>
            )}
            {entry.totalBreakMin > 0 && (
              <span className="text-amber-700"> · pause {fmtDuration(entry.totalBreakMin)}</span>
            )}
            {(entry.paidBreakMin ?? 0) > 0 && (
              <span className="text-sky-700"> · {t("pause_payee_duree", { duration: fmtDuration(entry.paidBreakMin ?? 0) })}</span>
            )}
          </p>
        )}
        <div className="flex gap-1 mt-1 justify-end">
          {isReviewer && onEdit && !entry.payStubId && (
            <ActionTooltip label={t("modifier_admin")}>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={async () => {
                  if (entry.approvedAt) {
                    const ok = await confirmDialog({
                      title: t("modifier_entree_approuvee"),
                      description: t("entree_approuvee_modifier_va_annuler"),
                      confirmLabel: t("continuer"),
                      variant: "destructive",
                    });
                    if (!ok) return;
                  }
                  onEdit();
                }}
                aria-label={tc("edit")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </ActionTooltip>
          )}
          {isReviewer && entry.submittedAt && !entry.approvedAt && entry.clockOut && (
            <>
              <ActionTooltip label={t("approuver")}>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600" onClick={onApprove} aria-label={t("approuver")}>
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("rejeter")}>
                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={onReject} aria-label={t("rejeter")}>
                  <XCircle className="h-3.5 w-3.5" />
                </Button>
              </ActionTooltip>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// DayAggregateRow: one aggregated (employee, day) line for the admin review.
export function DayAggregateRow({
  adminName, date, workMin, meetingMin, trainingMin, totalMin, status, hasPending,
  pendingIds, allPendingSelected, holidayName,
  onSelectAll, onClickName, onShowDetails, onApprove, onReject,
}: {
  adminName: string;
  date: string;
  workMin: number;
  meetingMin: number;
  trainingMin: number;
  totalMin: number;
  status: "approved" | "submitted" | "pending" | "rejected" | "mixed";
  hasPending: boolean;
  pendingIds: number[];
  allPendingSelected: boolean;
  holidayName?: string;
  onSelectAll: (v: boolean) => void;
  onClickName: () => void;
  onShowDetails: () => void;
  onApprove: () => void;
  onReject: () => void;
}) {
  const t = useTranslations("admin.timeclock");
  const dateTag = useDateLocale();
  void totalMin; // kept in the signature for compatibility, never rendered
  const dateLabel = capFirst(new Date(date + "T12:00:00").toLocaleDateString(dateTag, {
    weekday: "short", day: "numeric", month: "short",
  }));
  const initials = adminName.slice(0, 2).toUpperCase();

  const pureWorkMin = Math.max(0, workMin - meetingMin - trainingMin);

  const statusBadge = (() => {
    switch (status) {
      case "approved":
        return <ApprovedBadge strong />;
      case "submitted":
        return (
          <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50">
            <Send className="h-2.5 w-2.5 mr-1" />Soumis
          </Badge>
        );
      case "rejected":
        return (
          <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50">
            <XCircle className="h-2.5 w-2.5 mr-1" />{t("entryrows_rejete")}</Badge>
        );
      case "pending":
        return (
          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
            <AlertCircle className="h-2.5 w-2.5 mr-1" />En attente
          </Badge>
        );
      case "mixed":
        return (
          <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">
            {t("mixte")}
          </Badge>
        );
    }
  })();

  return (
    <div
      className="flex items-center gap-3 p-3 hover:bg-[#0F2D52]/5 cursor-pointer transition-colors"
      onClick={onClickName}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onClickName();
        }
      }}
      aria-label={t("entryrows_ouvrir_le_panneau_pour_p0_p1", { p0: adminName, p1: dateLabel })}
    >
      {hasPending && (
        <input
          type="checkbox"
          checked={allPendingSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-input"
          aria-label={t("selectionner_toutes_entrees_attente_jour")}
          title={`Selectionner ${pendingIds.length} entree(s) en attente`}
        />
      )}
      <div
        className="h-8 w-8 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center text-[11px] font-bold shrink-0"
        aria-hidden
      >
        {initials}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium">{adminName}</span>
          <span className="text-xs text-muted-foreground">{dateLabel}</span>
          {holidayName && (
            <Badge className="text-[10px] bg-cyan-100 text-cyan-800 border-cyan-300">
              Ferie - {holidayName}
            </Badge>
          )}
          {statusBadge}
        </div>
        <p className="text-[11px] text-muted-foreground mt-0.5">
          <span className="text-emerald-700 font-semibold">Travail {fmtDuration(pureWorkMin)}</span>
          {meetingMin > 0 && <> - <span className="text-violet-700">Reunion {fmtDuration(meetingMin)}</span></>}
          {trainingMin > 0 && <> - <span className="text-amber-700">Formation {fmtDuration(trainingMin)}</span></>}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-sm font-bold tabular-nums text-[#0F2D52]">{fmtDuration(workMin)}</p>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">{t("travail_effectif")}</p>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <ActionTooltip label={t("voir_details_audit")}>
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onShowDetails}
          aria-label={t("voir_details")}
        >
          <FileText className="h-3.5 w-3.5" />
        </Button>
        </ActionTooltip>
        {hasPending && (
          <>
            <ActionTooltip label={`Approuver ${pendingIds.length} entree(s)`}>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-emerald-600"
              onClick={onApprove}
              aria-label={t("approuver")}
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
            </Button>
            </ActionTooltip>
            <ActionTooltip label={`Rejeter ${pendingIds.length} entree(s)`}>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-red-600"
              onClick={onReject}
              aria-label={t("rejeter")}
            >
              <XCircle className="h-3.5 w-3.5" />
            </Button>
            </ActionTooltip>
          </>
        )}
        <ChevronRight className="h-4 w-4 text-muted-foreground ml-0.5" aria-hidden />
      </div>
    </div>
  );
}

// PanelEntryRow plus the history and edit buttons.
// Used by DayMultiEmployeePanel (admin reviewer).
export function PanelEntryRowWithHistory({
  entry, pending, onApprove, onReject, onUnapprove, onEdit,
}: {
  entry: Entry;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onUnapprove: () => void;
  onEdit?: () => void;
}) {
  const tc = useTranslations("common");
  const t = useTranslations("admin.timeclock");
  const cat = CAT_LABEL[entry.category] ?? { key: "", color: "bg-gray-100 text-gray-700" };
  const start = new Date(entry.clockIn);
  const { isMerged, count: mergedCount, gapMin: mergedGapMin, grossIsCoherent } = mergeInfo(entry);
  const isApproved = !!entry.approvedAt;

  const isPending = !isApproved && !!entry.clockOut && !!entry.submittedAt;
  const isDraft = !isApproved && !!entry.clockOut && !entry.submittedAt;
  const isOpen = !entry.clockOut;
  const isPaid = !!entry.payStubId;
  const hasHistory = (entry.history?.length ?? 0) > 0;

  return (
    <div className="p-2.5 hover:bg-muted/30">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono tabular-nums">
              {fmtTime(start)}
              {entry.clockOut
                ? ` → ${fmtTime(entry.clockOut)}`
                : t("cours_suffixe")}
            </span>
            <Badge className={`text-[9px] ${cat.color}`}>{catLabel(t, entry.category)}</Badge>
            {isMerged && <MergedBadge count={mergedCount} gapMin={mergedGapMin} coherent={grossIsCoherent} small />}
            {entry.jobCode && (
              <ActionTooltip label={entry.jobCode.label}>
                <Badge variant="outline" className="font-mono text-[9px] cursor-help">
                  {entry.jobCode.code}
                </Badge>
              </ActionTooltip>
            )}
            {isApproved && <ApprovedBadge />}
            {isDraft && (
              <Badge variant="outline" className="text-[9px] text-slate-600 border-slate-300 bg-slate-50">
                {t("brouillon_non_soumis")}
              </Badge>
            )}
            {isPending && (
              <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 bg-amber-50">
                {t("attente")}
              </Badge>
            )}
            {isPaid && (
              <Badge variant="outline" className="text-[9px] text-violet-700 border-violet-300 bg-violet-50">
                {t("bulletin")}
              </Badge>
            )}
            {isOpen && (
              <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50">
                {t("ouvert")}
              </Badge>
            )}
          </div>
          {displayNotes(entry.notes) && (
            <p className="text-[10px] text-muted-foreground italic mt-0.5 truncate">{displayNotes(entry.notes)}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-xs font-bold tabular-nums">
            {entry.durationMin != null
              ? fmtDuration(entry.durationMin)
              : formatShiftDuration(entry.clockIn, entry.clockOut)}
          </p>
          {/* Same breakdown as the week panel: without it a merged row cannot
              be checked against its own bracket. */}
          {entry.clockOut && grossIsCoherent && (
            <p className="text-[10px] text-muted-foreground tabular-nums">
              brut {formatShiftDuration(entry.clockIn, entry.clockOut)}
              {(entry.totalBreakMin ?? 0) > 0 && (
                <> · <span className="text-amber-700">pause {fmtDuration(entry.totalBreakMin)}</span></>
              )}
            </p>
          )}
        </div>
      </div>
      {!isPaid && !isOpen && (
        <div className="flex items-center gap-1 mt-1.5 justify-end">
          {hasHistory && <HistoryPopover history={entry.history} />}
          {isPending && (
            <>
              <ActionTooltip label={t("approuver")}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={onApprove}
                  className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                >
                  <CheckCircle2 className="h-3 w-3 mr-1" />Approuver
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("rejeter_raison")}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={pending}
                  onClick={onReject}
                  className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                >
                  <XCircle className="h-3 w-3 mr-1" />Rejeter
                </Button>
              </ActionTooltip>
            </>
          )}
          {isApproved && (
            <ActionTooltip label={t("annuler_approbation")}>
              <Button
                size="sm"
                variant="ghost"
                disabled={pending}
                onClick={onUnapprove}
                className="h-7 text-xs text-muted-foreground hover:text-[#0F2D52]"
              >
                <RotateCcw className="h-3 w-3 mr-1" />Annuler approbation
              </Button>
            </ActionTooltip>
          )}
          {onEdit && (
            <ActionTooltip label={t("modifier_admin_override")}>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={pending}
                onClick={onEdit}
                aria-label={tc("edit")}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </ActionTooltip>
          )}
        </div>
      )}
      {isPaid && hasHistory && (
        <div className="flex items-center gap-1 mt-1 justify-end">
          <HistoryPopover history={entry.history} />
          <span className="text-[10px] text-muted-foreground italic">
            {t("verrouille_deja_bulletin_paie_2")}
          </span>
        </div>
      )}
    </div>
  );
}

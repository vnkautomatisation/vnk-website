"use client";
// Rangees d'entries reutilisables — extraites de timeclock-view.tsx (refactor #87).
// Chaque ligne est presentation pure : props + callbacks, aucune logique business.
import {
  Clock, CheckCircle2, XCircle, Pencil, Trash2, Lock, Unlock, RotateCcw,
  ChevronRight, AlertCircle, FileText, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { confirmDialog } from "@/components/admin/prompt-dialog";
import type { Entry } from "../_types";
import { formatShiftDuration } from "../_types";
import { ApprovedBadge } from "./ApprovedBadge";
import { HistoryPopover } from "./HistoryPopover";
import { CAT_LABEL, fmtDuration } from "./_utils";

// ─────────────────────────────────────────────────────────────────────────────
// PanelEntryRow — ligne d'entry dans l'EmployeeWeekPanel (revue admin).
// ─────────────────────────────────────────────────────────────────────────────
export function PanelEntryRow({
  entry, pending, onApprove, onReject, onUnapprove,
}: {
  entry: Entry;
  pending: boolean;
  onApprove: () => void;
  onReject: () => void;
  onUnapprove: () => void;
}) {
  const cat = CAT_LABEL[entry.category] ?? { label: entry.category, color: "bg-gray-100 text-gray-700" };
  const start = new Date(entry.clockIn);
  const isApproved = !!entry.approvedAt;
  const isPending = !isApproved && !!entry.clockOut;
  const isOpen = !entry.clockOut;
  const isPaid = !!entry.payStubId;
  // TODO: utiliser TimeClockHistory (event="rejected") plutôt que parser les notes.
  // Le préfixe [REJET ...] est un fallback legacy depuis l'époque où on stockait
  // le statut de rejet dans le texte libre. À supprimer une fois l'historique
  // structuré 100% en place côté UI.
  const isRejected = (entry.notes ?? "").startsWith("[REJET");
  const rejectReason = isRejected ? (entry.notes ?? "").split("\n")[0].replace(/^\[REJET[^\]]+\]\s*/, "") : "";

  return (
    <div className="p-2.5 hover:bg-muted/30">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono tabular-nums">
              {start.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
              {entry.clockOut
                ? ` → ${new Date(entry.clockOut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`
                : " · en cours"}
            </span>
            <Badge className={`text-[9px] ${cat.color}`}>{cat.label}</Badge>
            {entry.jobCode && (
              <ActionTooltip label={entry.jobCode.label}>
                <Badge variant="outline" className="font-mono text-[9px] cursor-help">
                  {entry.jobCode.code}
                </Badge>
              </ActionTooltip>
            )}
            {isApproved && <ApprovedBadge />}
            {isPending && !isRejected && (
              <Badge variant="outline" className="text-[9px] text-amber-700 border-amber-300 bg-amber-50">
                En attente
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
                Sur bulletin
              </Badge>
            )}
            {isOpen && (
              <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50">
                Ouvert
              </Badge>
            )}
          </div>
          {isRejected && rejectReason && (
            <p className="text-[10px] text-red-700 italic mt-0.5">
              Raison : {rejectReason}
            </p>
          )}
          {entry.notes && !isRejected && (
            <p className="text-[10px] text-muted-foreground italic mt-0.5 truncate">{entry.notes}</p>
          )}
          {isApproved && entry.approver && entry.approvedBy !== entry.adminId && (
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Approuve par {entry.approver.fullName || entry.approver.email}
              {entry.approvedAt && ` le ${new Date(entry.approvedAt).toLocaleDateString("fr-CA")}`}
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
              {entry.clockOut && <span>brut {formatShiftDuration(entry.clockIn, entry.clockOut)}</span>}
              {entry.totalBreakMin > 0 && (
                <span className="text-amber-700"> · pause {fmtDuration(entry.totalBreakMin)}</span>
              )}
            </p>
          )}
        </div>
      </div>
      {/* Actions inline */}
      {!isPaid && !isOpen && (
        <div className="flex items-center gap-1 mt-1.5 justify-end">
          {(entry.history?.length ?? 0) > 0 && <HistoryPopover history={entry.history} />}
          {isPending && (
            <>
              <ActionTooltip label="Approuver">
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
              <ActionTooltip label="Rejeter (avec raison)">
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
            <ActionTooltip label="Approuver quand meme">
              <Button
                size="sm"
                variant="outline"
                disabled={pending}
                onClick={onApprove}
                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />Approuver quand meme
              </Button>
            </ActionTooltip>
          )}
          {isApproved && (
            <ActionTooltip label="Annuler l'approbation">
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
          Verrouille : deja sur un bulletin de paie
        </p>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CompactEntryRow — ligne compacte utilisee dans un jour deplie (vue employe).
// ─────────────────────────────────────────────────────────────────────────────
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
  const cat = CAT_LABEL[entry.category] ?? { label: entry.category, color: "bg-gray-100 text-gray-700" };
  const start = new Date(entry.clockIn);
  return (
    <div className="flex items-center gap-3 px-3 py-2 hover:bg-muted/30">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-mono tabular-nums">
            {start.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
            {entry.clockOut
              ? ` → ${new Date(entry.clockOut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`
              : " · en cours"}
          </span>
          <Badge className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>
          {entry.jobCode && (
            <ActionTooltip label={entry.jobCode.label}>
              <Badge variant="outline" className="font-mono text-[10px] cursor-help">
                {entry.jobCode.code}
              </Badge>
            </ActionTooltip>
          )}
          {entry.approvedAt && <ApprovedBadge />}
          {entry.submittedAt && !entry.approvedAt && (
            <Badge variant="outline" className="text-[10px] text-blue-700 border-blue-300 bg-blue-50">
              <Clock className="h-2.5 w-2.5 mr-1" />En attente d&apos;approbation
            </Badge>
          )}
          {/* TODO: utiliser TimeClockHistory (event="rejected") plutôt que parser les notes. */}
          {(entry.notes ?? "").startsWith("[REJET") && !entry.submittedAt && !entry.approvedAt && (
            <ActionTooltip label={entry.notes ?? ""}>
              <Badge variant="outline" className="text-[10px] text-red-700 border-red-300 bg-red-50 cursor-help">
                <XCircle className="h-2.5 w-2.5 mr-1" />Rejeté
              </Badge>
            </ActionTooltip>
          )}
          {entry.payStubId && (
            <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">
              Sur bulletin
            </Badge>
          )}
        </div>
        {entry.notes && <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">{entry.notes}</p>}
        {entry.approvedAt && entry.approver && entry.approvedBy !== entry.adminId && (
          <p className="text-[10px] text-muted-foreground">
            Approuvé par {entry.approver.fullName || entry.approver.email}
          </p>
        )}
      </div>
      <div className="text-right shrink-0">
        {/* Duree NETTE (travail reel apres deduction des pauses) */}
        <p className="font-mono text-sm font-bold tabular-nums">
          {entry.durationMin != null
            ? fmtDuration(entry.durationMin)
            : formatShiftDuration(entry.clockIn, entry.clockOut)}
        </p>
        {/* Detail brut + pause si applicable, pour transparence */}
        {(entry.totalBreakMin > 0 || (entry.durationMin != null && entry.clockOut)) && (
          <p className="text-[10px] text-muted-foreground tabular-nums">
            {entry.clockOut && (
              <span>brut {formatShiftDuration(entry.clockIn, entry.clockOut)}</span>
            )}
            {entry.totalBreakMin > 0 && (
              <span className="text-amber-700"> · pause {fmtDuration(entry.totalBreakMin)}</span>
            )}
          </p>
        )}
      </div>
      {isLocked && !entry.approvedAt && (
        <>
          <ActionTooltip label="Heures soumises et verrouillées">
            <span className="flex items-center justify-center h-7 w-7 shrink-0 text-muted-foreground cursor-help">
              <Lock className="h-3.5 w-3.5" />
            </span>
          </ActionTooltip>
          {onRequestUnlock && (
            <ActionTooltip label="Demander modification">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 shrink-0 text-[#0F2D52]"
                onClick={onRequestUnlock}
                aria-label="Demander modification"
              >
                <Unlock className="h-3.5 w-3.5" />
              </Button>
            </ActionTooltip>
          )}
        </>
      )}
      {!isLocked && canEdit && onEdit && (
        <Button size="icon" variant="ghost" className="h-7 w-7 shrink-0" onClick={onEdit} aria-label="Modifier">
          <Pencil className="h-3.5 w-3.5" />
        </Button>
      )}
      {!isLocked && !entry.approvedAt && !entry.payStubId && (
        <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-destructive shrink-0" onClick={onDelete} aria-label="Supprimer">
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// EntryRow — ligne complete (vue revue admin, format detaillé).
// Garde : peu utilisee actuellement mais conservee pour compatibilite.
// ─────────────────────────────────────────────────────────────────────────────
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
  const cat = CAT_LABEL[entry.category] ?? { label: entry.category, color: "bg-gray-100 text-gray-700" };
  const date = new Date(entry.clockIn);
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
          <Badge className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>
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
              <Clock className="h-2.5 w-2.5 mr-1" />En attente d&apos;approbation
            </Badge>
          )}
          {entry.payStubId && (
            <Badge variant="outline" className="text-[10px] text-violet-700 border-violet-300 bg-violet-50">
              Sur bulletin
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          {date.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" })}
          {" · "}
          {date.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
          {entry.clockOut ? ` → ${new Date(entry.clockOut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}` : " · en cours"}
        </p>
        {entry.notes && <p className="text-[11px] text-muted-foreground italic mt-0.5 truncate">{entry.notes}</p>}
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
            {entry.clockOut && (
              <span>brut {formatShiftDuration(entry.clockIn, entry.clockOut)}</span>
            )}
            {entry.totalBreakMin > 0 && (
              <span className="text-amber-700"> · pause {fmtDuration(entry.totalBreakMin)}</span>
            )}
          </p>
        )}
        <div className="flex gap-1 mt-1 justify-end">
          {isReviewer && onEdit && !entry.payStubId && (
            <ActionTooltip label="Modifier (admin)">
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6"
                onClick={async () => {
                  if (entry.approvedAt) {
                    const ok = await confirmDialog({
                      title: "Modifier une entrée approuvée",
                      description: "Cette entrée est approuvée — modifier va annuler l'approbation.",
                      confirmLabel: "Continuer",
                      variant: "destructive",
                    });
                    if (!ok) return;
                  }
                  onEdit();
                }}
                aria-label="Modifier"
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
            </ActionTooltip>
          )}
          {isReviewer && !entry.approvedAt && entry.clockOut && (
            <>
              <ActionTooltip label="Approuver">
                <Button size="icon" variant="ghost" className="h-6 w-6 text-emerald-600" onClick={onApprove} aria-label="Approuver">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Rejeter">
                <Button size="icon" variant="ghost" className="h-6 w-6 text-red-600" onClick={onReject} aria-label="Rejeter">
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

// ─────────────────────────────────────────────────────────────────────────────
// DayAggregateRow — ligne agregee (employe, jour) pour la revue admin.
// ─────────────────────────────────────────────────────────────────────────────
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
  void totalMin; // conserve dans la signature pour compatibilite (non utilise visuellement)
  const dateLabel = new Date(date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "short", day: "numeric", month: "short",
  });
  const initials = adminName.slice(0, 2).toUpperCase();
  // Travail "pur" = work uniquement (sans réunion ni formation)
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
            <XCircle className="h-2.5 w-2.5 mr-1" />Rejeté
          </Badge>
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
            Mixte
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
      aria-label={`Ouvrir le panneau pour ${adminName} - ${dateLabel}`}
    >
      {hasPending && (
        <input
          type="checkbox"
          checked={allPendingSelected}
          onChange={(e) => onSelectAll(e.target.checked)}
          onClick={(e) => e.stopPropagation()}
          className="h-4 w-4 rounded border-input"
          aria-label="Selectionner toutes les entrees en attente du jour"
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
          <span className="text-xs text-muted-foreground capitalize">{dateLabel}</span>
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
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Travail effectif</p>
      </div>
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        <ActionTooltip label="Voir details (audit)">
        <Button
          size="icon"
          variant="ghost"
          className="h-7 w-7"
          onClick={onShowDetails}
          aria-label="Voir details"
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
              aria-label="Approuver"
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
              aria-label="Rejeter"
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

// ─────────────────────────────────────────────────────────────────────────────
// PanelEntryRowWithHistory — PanelEntryRow + bouton Historique + bouton Modifier.
// Utilisée dans DayMultiEmployeePanel (admin reviewer).
// ─────────────────────────────────────────────────────────────────────────────
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
  const cat = CAT_LABEL[entry.category] ?? { label: entry.category, color: "bg-gray-100 text-gray-700" };
  const start = new Date(entry.clockIn);
  const isApproved = !!entry.approvedAt;
  const isPending = !isApproved && !!entry.clockOut;
  const isOpen = !entry.clockOut;
  const isPaid = !!entry.payStubId;
  const hasHistory = (entry.history?.length ?? 0) > 0;

  return (
    <div className="p-2.5 hover:bg-muted/30">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-xs font-mono tabular-nums">
              {start.toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}
              {entry.clockOut
                ? ` → ${new Date(entry.clockOut).toLocaleTimeString("fr-CA", { hour: "2-digit", minute: "2-digit" })}`
                : " · en cours"}
            </span>
            <Badge className={`text-[9px] ${cat.color}`}>{cat.label}</Badge>
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
                En attente
              </Badge>
            )}
            {isPaid && (
              <Badge variant="outline" className="text-[9px] text-violet-700 border-violet-300 bg-violet-50">
                Sur bulletin
              </Badge>
            )}
            {isOpen && (
              <Badge variant="outline" className="text-[9px] border-blue-300 text-blue-700 bg-blue-50">
                Ouvert
              </Badge>
            )}
          </div>
          {entry.notes && (
            <p className="text-[10px] text-muted-foreground italic mt-0.5 truncate">{entry.notes}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-mono text-xs font-bold tabular-nums">
            {entry.durationMin != null
              ? fmtDuration(entry.durationMin)
              : formatShiftDuration(entry.clockIn, entry.clockOut)}
          </p>
        </div>
      </div>
      {/* Actions inline + historique */}
      {!isPaid && !isOpen && (
        <div className="flex items-center gap-1 mt-1.5 justify-end">
          {hasHistory && <HistoryPopover history={entry.history} />}
          {isPending && (
            <>
              <ActionTooltip label="Approuver">
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
              <ActionTooltip label="Rejeter (avec raison)">
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
            <ActionTooltip label="Annuler l'approbation">
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
            <ActionTooltip label="Modifier (admin override)">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7"
                disabled={pending}
                onClick={onEdit}
                aria-label="Modifier"
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
            Verrouillé : déjà sur un bulletin de paie
          </span>
        </div>
      )}
    </div>
  );
}

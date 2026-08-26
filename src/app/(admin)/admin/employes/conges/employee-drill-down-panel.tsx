"use client";
// Sheet latéral : drill-down sur les demandes d'un employé.
// Sections (haut → bas) :
//  1. Header navy : identité (nom, titre, équipe)
//  2. Solde & Politique : KPIs + change-policy + ajustement manuel + blocage/déblocage
//  3. Barre d'actions globales : rapport annuel, export PDF, conflits équipe, notifier
//  4. Liste des demandes : ICS / PDF / Historique / Plus (convertir, dupliquer, justificatif, annuler/supprimer)
//  5. Footer : créer une demande
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sun, Bandage, Baby, Home, CalendarDays, Loader2,
  CheckCircle2, XCircle, Pencil, Trash2, RotateCcw, Plus, Mail, Briefcase,
  SlidersHorizontal, History, FileText, Download, Users, Ban, ShieldCheck,
  MoreHorizontal, RefreshCw, Copy, Paperclip, Minus,
} from "lucide-react";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { promptDialog, confirmDialog } from "@/components/admin/prompt-dialog";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  reviewLeaveRequestAction, adminCancelApprovedLeaveAction, adminDeleteLeaveAction,
  unapproveLeaveAction, convertLeaveTypeAction, duplicateLeaveAction,
  adjustLeaveBalanceAction, assignLeavePolicyAction,
  blockEmployeeLeaveAction, unblockEmployeeLeaveAction,
  notifyEmployeeDirectAction,
  cancelLeaveRequestAction,
} from "@/app/actions/hr-leaves";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { AuditActionBadge, AuditChangesDisplay } from "@/components/admin/audit-changes-display";
import { AddToCalendarMenu } from "@/components/admin/add-to-calendar-menu";

const TYPE_META: Record<string, { label: string; icon: typeof Sun; color: string }> = {
  vacation: { label: "Vacances", icon: Sun, color: "bg-cyan-100 text-cyan-700" },
  sick: { label: "Maladie", icon: Bandage, color: "bg-red-100 text-red-700" },
  parental: { label: "Parental", icon: Baby, color: "bg-pink-100 text-pink-700" },
  unpaid: { label: "Sans solde", icon: Home, color: "bg-slate-100 text-slate-700" },
  bereavement: { label: "Décès", icon: Home, color: "bg-gray-100 text-gray-700" },
  other: { label: "Autre", icon: CalendarDays, color: "bg-amber-100 text-amber-700" },
};
const STATUS_META: Record<string, { label: string; color: string }> = {
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700" },
  approved: { label: "Approuvée", color: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Refusée", color: "bg-red-100 text-red-700" },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-600" },
};
const typeMeta = (t: string) => TYPE_META[t] ?? TYPE_META.other;
const statusMeta = (s: string) => STATUS_META[s] ?? { label: s, color: "bg-gray-100 text-gray-700" };
const TYPE_KEYS = Object.keys(TYPE_META);

type Employee = {
  id: number;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  title: string | null;
  department: string | null;
  isActive: boolean;
  leavePolicyId: number | null;
  leaveBlockedUntil: string | null;
  leaveBlockedReason: string | null;
  team: { id: number; name: string; color: string | null } | null;
};

type Balance = {
  vacationDaysRemaining: number;
  vacationDaysTaken: number;
  vacationDaysPlanned: number;
  accruedDays?: number;
  policyName?: string;
};

type LeaveRow = {
  id: number;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  halfDay: string | null;
  reason: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  attachmentUrl: string | null;
  attachmentName: string | null;
  createdAt: string;
  reviewer: { id: number; fullName: string | null; email: string } | null;
  isLockedByPaid: boolean;
};

type Policy = { id: number; name: string; isDefault?: boolean };

function fmtShort(s: string) {
  return new Date(s).toLocaleDateString("fr-CA", { day: "2-digit", month: "short" });
}
function fmtDate(s: string) {
  return new Date(s).toLocaleDateString("fr-CA");
}

export function EmployeeDrillDownPanel({
  employeeId,
  open,
  onClose,
  onEditRequest,
  onCreateForEmployee,
}: {
  employeeId: number | null;
  open: boolean;
  onClose: () => void;
  onEditRequest: (req: LeaveRow, employee: Employee) => void;
  onCreateForEmployee: (employee: Employee) => void;
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [balance, setBalance] = useState<Balance | null>(null);
  const [requests, setRequests] = useState<LeaveRow[]>([]);
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [policies, setPolicies] = useState<Policy[]>([]);

  // Dialog states
  const [policyDialogOpen, setPolicyDialogOpen] = useState(false);
  const [adjustDialogOpen, setAdjustDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [notifyDialogOpen, setNotifyDialogOpen] = useState(false);
  const [annualDialogOpen, setAnnualDialogOpen] = useState(false);
  const [conflictsDialogOpen, setConflictsDialogOpen] = useState(false);
  const [convertDialogReq, setConvertDialogReq] = useState<LeaveRow | null>(null);
  const [duplicateDialogReq, setDuplicateDialogReq] = useState<LeaveRow | null>(null);
  const [historyDialogReq, setHistoryDialogReq] = useState<LeaveRow | null>(null);
  // Aperçu PDF (preview modal) — convention VNK : jamais window.open direct pour les PDFs
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; description?: string; filename?: string } | null>(null);

  useEffect(() => {
    if (!open || !employeeId) return;
    let cancelled = false;
    setLoading(true);
    Promise.all([
      fetch(`/api/admin/leaves/employee/${employeeId}`).then((r) => r.ok ? r.json() : Promise.reject(r)),
      fetch(`/api/admin/leaves/policies`).then((r) => r.ok ? r.json() : { policies: [] }).catch(() => ({ policies: [] })),
    ])
      .then(([data, polData]) => {
        if (cancelled) return;
        setEmployee(data.employee);
        setBalance(data.balance);
        setRequests(data.requests);
        setPolicies(polData.policies ?? []);
      })
      .catch(() => {
        if (!cancelled) toast.error("Impossible de charger les détails employé");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, employeeId]);

  const markBusy = (id: number, on: boolean) =>
    setBusyIds((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  const refresh = useCallback(async () => {
    if (!employeeId) return;
    const res = await fetch(`/api/admin/leaves/employee/${employeeId}`);
    if (res.ok) {
      const data = await res.json();
      setEmployee(data.employee);
      setBalance(data.balance);
      setRequests(data.requests);
    }
    router.refresh();
  }, [employeeId, router]);

  const onApprove = async (r: LeaveRow) => {
    markBusy(r.id, true);
    const res = await reviewLeaveRequestAction({ id: r.id, decision: "approved" });
    markBusy(r.id, false);
    if (res.success) { toast.success("Approuvée"); refresh(); }
    else toast.error(res.error || "Erreur");
  };
  const onReject = async (r: LeaveRow) => {
    const notes = await promptDialog({
      title: "Refuser la demande",
      label: "Motif du refus (optionnel)",
      multiline: true,
      variant: "destructive",
      confirmLabel: "Refuser",
    });
    if (notes === null) return;
    markBusy(r.id, true);
    const res = await reviewLeaveRequestAction({ id: r.id, decision: "rejected", notes: notes.trim() || undefined });
    markBusy(r.id, false);
    if (res.success) { toast.success("Refusée"); refresh(); }
    else toast.error(res.error || "Erreur");
  };
  // TÂCHE 4 (P1-8) : annuler une demande PENDING au nom de l'employé
  const onCancelPending = async (r: LeaveRow) => {
    const reason = await promptDialog({
      title: "Annuler cette demande au nom de l'employé",
      description: "L'employé sera notifié de l'annulation.",
      label: "Raison (requise)",
      multiline: true,
      variant: "destructive",
      required: true,
      confirmLabel: "Annuler la demande",
    });
    if (!reason) return;
    markBusy(r.id, true);
    const res = await cancelLeaveRequestAction({
      id: r.id,
      reason: `Annulé par l'administrateur : ${reason}`,
    });
    markBusy(r.id, false);
    if (res.success) { toast.success("Demande annulée"); refresh(); }
    else toast.error(res.error || "Erreur");
  };

  const onCancelApproved = async (r: LeaveRow) => {
    const reason = await promptDialog({
      title: "Annuler ce congé approuvé",
      description: "L'employé sera notifié. Les TimeClock auto-créés seront supprimés.",
      label: "Raison (requise)",
      multiline: true,
      variant: "destructive",
      required: true,
      confirmLabel: "Annuler le congé",
    });
    if (!reason) return;
    markBusy(r.id, true);
    const res = await adminCancelApprovedLeaveAction({ id: r.id, reason });
    markBusy(r.id, false);
    if (res.success) { toast.success("Congé annulé"); refresh(); }
    else toast.error(res.error || "Erreur");
  };
  const onDelete = async (r: LeaveRow) => {
    const ok = await confirmDialog({
      title: "Supprimer définitivement",
      description: "Cette action est irréversible. La demande sera supprimée et l'employé notifié.",
      variant: "destructive",
      confirmLabel: "Supprimer",
    });
    if (!ok) return;
    markBusy(r.id, true);
    const res = await adminDeleteLeaveAction({ id: r.id });
    markBusy(r.id, false);
    if (res.success) { toast.success("Supprimée"); refresh(); }
    else toast.error(res.error || "Erreur");
  };
  const onUnapprove = async (r: LeaveRow) => {
    const reason = await promptDialog({
      title: "Retirer l'approbation",
      description: "La demande repasse en attente. L'employé sera notifié.",
      label: "Raison (requise)",
      multiline: true,
      required: true,
      variant: "destructive",
      confirmLabel: "Retirer l'approbation",
    });
    if (!reason) return;
    markBusy(r.id, true);
    const res = await unapproveLeaveAction({ id: r.id, reason });
    markBusy(r.id, false);
    if (res.success) { toast.success("Approbation retirée"); refresh(); }
    else toast.error(res.error || "Erreur");
  };

  // Conflits équipe : récupère les pairs absents sur les périodes des demandes futures de l'employé
  const [conflicts, setConflicts] = useState<Array<{ requestId: number; period: string; peers: Array<{ id: number; name: string; period: string; type: string }> }>>([]);
  const loadConflicts = useCallback(async () => {
    if (!employeeId) return;
    setConflicts([]);
    const now = new Date(); now.setHours(0, 0, 0, 0);
    const future = requests.filter((r) => (r.status === "approved" || r.status === "pending") && new Date(r.endDate) >= now);
    if (future.length === 0) return;
    // Borne large : +90 jours
    const horizon = new Date(now); horizon.setDate(horizon.getDate() + 90);
    try {
      const url = `/api/admin/leaves/calendar?employeeId=${employeeId}&from=${now.toISOString().slice(0, 10)}&to=${horizon.toISOString().slice(0, 10)}`;
      const res = await fetch(url);
      if (!res.ok) return;
      const data = await res.json();
      const absences: Array<{ id: number; adminId: number; fullName: string; type: string; startDate: string; endDate: string; status: string }> = data.absences || [];
      const peers = absences.filter((l) => l.adminId !== employeeId && l.status === "approved");
      const out: typeof conflicts = [];
      for (const r of future) {
        const rs = new Date(r.startDate).getTime();
        const re = new Date(r.endDate).getTime();
        const matches = peers
          .filter((p) => new Date(p.startDate).getTime() <= re && new Date(p.endDate).getTime() >= rs)
          .map((p) => ({
            id: p.adminId,
            name: p.fullName,
            period: `${fmtShort(p.startDate)} → ${fmtShort(p.endDate)}`,
            type: p.type,
          }));
        if (matches.length > 0) {
          out.push({
            requestId: r.id,
            period: `${fmtShort(r.startDate)} → ${fmtShort(r.endDate)}`,
            peers: matches,
          });
        }
      }
      setConflicts(out);
    } catch {
      toast.error("Impossible de charger les conflits");
    }
  }, [employeeId, requests]);

  useEffect(() => {
    if (conflictsDialogOpen) loadConflicts();
  }, [conflictsDialogOpen, loadConflicts]);

  const isBlocked = !!(employee?.leaveBlockedUntil && new Date(employee.leaveBlockedUntil).getTime() > Date.now());

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent side="right" className="p-0 w-full sm:max-w-2xl flex flex-col">
        {/* Header navy */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <SheetHeader>
            <SheetTitle className="text-white text-base">
              {employee?.fullName || employee?.email || "Chargement…"}
            </SheetTitle>
          </SheetHeader>
          {employee && (
            <div className="mt-2 flex items-center gap-2 flex-wrap text-xs text-white/85">
              {employee.title && (
                <span className="flex items-center gap-1"><Briefcase className="h-3 w-3" />{employee.title}</span>
              )}
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{employee.email}</span>
              {employee.team && (
                <span
                  className="px-1.5 py-0.5 rounded text-[10px] bg-white/20"
                  style={employee.team.color ? { backgroundColor: `${employee.team.color}55` } : undefined}
                >
                  {employee.team.name}
                </span>
              )}
              {!employee.isActive && (
                <Badge className="bg-red-500 text-white text-[10px]">{tc("inactive")}</Badge>
              )}
            </div>
          )}
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {/* Bloc Solde & Politique */}
            {employee && (
              <div className="p-4 border-b bg-muted/20 space-y-3">
                {/* Bandeau blocage */}
                {isBlocked && employee.leaveBlockedUntil && (
                  <div className="rounded-md border border-red-200 bg-red-50 p-3 flex items-start justify-between gap-3">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      <Ban className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-red-700">
                          Soumissions bloquées jusqu&apos;au {fmtDate(employee.leaveBlockedUntil)}
                        </p>
                        {employee.leaveBlockedReason && (
                          <p className="text-[11px] text-red-700/80 mt-0.5">{employee.leaveBlockedReason}</p>
                        )}
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px] border-red-300 text-red-700 hover:bg-red-100"
                      onClick={async () => {
                        const ok = await confirmDialog({
                          title: "Débloquer les soumissions ?",
                          confirmLabel: "Débloquer",
                        });
                        if (!ok) return;
                        const res = await unblockEmployeeLeaveAction({ employeeId: employee.id });
                        if (res.success) { toast.success("Débloqué"); refresh(); }
                        else toast.error(res.error || "Erreur");
                      }}
                    >
                      Débloquer
                    </Button>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {balance && (
                    <>
                      <KpiBox label="Restant" value={balance.vacationDaysRemaining} unit="j" tone={balance.vacationDaysRemaining <= 2 ? "danger" : "success"} />
                      <KpiBox label="Pris" value={balance.vacationDaysTaken} unit="j" tone="muted" />
                      <KpiBox label="Planifiés" value={balance.vacationDaysPlanned} unit="j" tone="muted" />
                    </>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="rounded-md border bg-background p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Politique</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5 truncate">
                        {balance?.policyName || "Défaut"}
                      </p>
                    </div>
                    <ActionTooltip label="Changer la politique">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setPolicyDialogOpen(true)}>
                        <SlidersHorizontal className="h-3 w-3 mr-1" />Changer
                      </Button>
                    </ActionTooltip>
                  </div>
                  <div className="rounded-md border bg-background p-3 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Accumulés</p>
                      <p className="text-sm font-semibold text-foreground mt-0.5">
                        {balance?.accruedDays ?? 0} j
                      </p>
                    </div>
                    <ActionTooltip label="Ajuster manuellement le solde">
                      <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setAdjustDialogOpen(true)}>
                        <Plus className="h-3 w-3 mr-0.5" /><Minus className="h-3 w-3 mr-1" />Ajuster
                      </Button>
                    </ActionTooltip>
                  </div>
                </div>

                {!isBlocked && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px] text-red-600 border-red-200 hover:bg-red-50"
                    onClick={() => setBlockDialogOpen(true)}
                  >
                    <Ban className="h-3 w-3 mr-1" />Bloquer les soumissions
                  </Button>
                )}
              </div>
            )}

            {/* Barre d'actions globales */}
            {employee && (
              <div className="px-4 py-2 border-b bg-background flex items-center gap-1.5 flex-wrap">
                <ActionTooltip label="Rapport annuel (résumé écran)">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setAnnualDialogOpen(true)}>
                    <FileText className="h-3 w-3 mr-1" />Rapport annuel
                  </Button>
                </ActionTooltip>
                <ActionTooltip label="Aperçu du relevé annuel en PDF">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-[11px]"
                    onClick={() => setPdfPreview({
                      url: `/api/admin/leaves/employee/${employee.id}/annual-report-pdf`,
                      title: `Relevé annuel — ${employee.fullName || employee.email}`,
                      description: "Période courante (1er mai → 30 avril)",
                      filename: `releve-annuel-${employee.id}.pdf`,
                    })}
                  >
                    <Download className="h-3 w-3 mr-1" />Aperçu PDF
                  </Button>
                </ActionTooltip>
                <ActionTooltip label="Conflits avec les pairs (à venir)">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setConflictsDialogOpen(true)}>
                    <Users className="h-3 w-3 mr-1" />Conflits équipe
                  </Button>
                </ActionTooltip>
                <ActionTooltip label="Envoyer une notification à l'employé">
                  <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setNotifyDialogOpen(true)}>
                    <Mail className="h-3 w-3 mr-1" />Notifier
                  </Button>
                </ActionTooltip>
              </div>
            )}

            {/* Liste des demandes */}
            <div className="p-4 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52]">
                  Historique demandes ({requests.length})
                </h3>
              </div>

              {requests.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  Aucune demande pour cet employé.
                </div>
              ) : (
                requests.map((r) => {
                  const meta = typeMeta(r.type);
                  const sMeta = statusMeta(r.status);
                  const Icon = meta.icon;
                  const sameDay = r.startDate === r.endDate;
                  const busy = busyIds.has(r.id);
                  return (
                    <div key={r.id} className="rounded-md border bg-background p-3 hover:bg-muted/10">
                      <div className="flex items-start gap-3">
                        <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${meta.color}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className="text-[10px]">{meta.label}</Badge>
                            <Badge className={`text-[10px] ${sMeta.color}`}>{sMeta.label}</Badge>
                            {r.halfDay && <Badge variant="outline" className="text-[10px]">½ {r.halfDay}</Badge>}
                            {r.isLockedByPaid && (
                              <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300">
                                Période payée
                              </Badge>
                            )}
                            {r.attachmentUrl && (
                              <Badge variant="outline" className="text-[10px] text-[#0F2D52] border-[#0F2D52]/30 inline-flex items-center gap-0.5">
                                <Paperclip className="h-2.5 w-2.5" />Justif.
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {sameDay
                              ? `Le ${fmtShort(r.startDate)}`
                              : `Du ${fmtShort(r.startDate)} au ${fmtShort(r.endDate)}`}
                            {" · "}
                            <strong className="text-foreground tabular-nums">{r.daysCount}</strong> j
                          </p>
                          {r.reason && <p className="text-[11px] italic text-muted-foreground mt-1 line-clamp-2">« {r.reason} »</p>}
                          {r.reviewNotes && r.status !== "pending" && (
                            <p className="text-[11px] text-muted-foreground mt-1">
                              <strong>Note revue :</strong> {r.reviewNotes}
                            </p>
                          )}
                        </div>
                      </div>
                      {/* Actions */}
                      <div className="mt-2 flex flex-wrap gap-1.5 justify-end">
                        {r.status === "pending" && (
                          <>
                            <ActionTooltip label="Approuver">
                              <Button
                                size="sm" variant="outline" disabled={busy}
                                className="h-7 text-[11px] text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                                onClick={() => onApprove(r)}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />{busy ? "..." : "Approuver"}
                              </Button>
                            </ActionTooltip>
                            <ActionTooltip label="Refuser">
                              <Button
                                size="sm" variant="outline" disabled={busy}
                                className="h-7 text-[11px] text-red-600 border-red-200 hover:bg-red-50"
                                onClick={() => onReject(r)}
                              >
                                <XCircle className="h-3 w-3 mr-1" />Refuser
                              </Button>
                            </ActionTooltip>
                            {/* TÂCHE 4 (P1-8) : annuler au nom de l'employé */}
                            <ActionTooltip label="Annuler cette demande au nom de l'employé">
                              <Button
                                size="sm" variant="outline" disabled={busy}
                                className="h-7 text-[11px] text-red-700 border-red-200 hover:bg-red-50"
                                onClick={() => onCancelPending(r)}
                              >
                                <Ban className="h-3 w-3 mr-1" />{tc("cancel")}
                              </Button>
                            </ActionTooltip>
                          </>
                        )}
                        {!r.isLockedByPaid && (
                          <ActionTooltip label="Modifier (admin)">
                            <Button
                              size="sm" variant="outline" disabled={busy}
                              className="h-7 text-[11px]"
                              onClick={() => employee && onEditRequest(r, employee)}
                            >
                              <Pencil className="h-3 w-3 mr-1" />{tc("edit")}
                            </Button>
                          </ActionTooltip>
                        )}
                        <ActionTooltip label="Historique des modifications">
                          <Button
                            size="sm" variant="outline"
                            className="h-7 text-[11px]"
                            onClick={() => setHistoryDialogReq(r)}
                          >
                            <History className="h-3 w-3 mr-1" />Historique
                          </Button>
                        </ActionTooltip>
                        {r.status === "approved" && (
                          <>
                            <AddToCalendarMenu
                              event={{
                                leaveId: r.id,
                                title: `Congé : ${TYPE_META[r.type]?.label ?? "Congé"} — ${employee?.fullName || employee?.email || ""}`.trim(),
                                startDate: r.startDate,
                                endDate: r.endDate,
                                description: r.reason || undefined,
                              }}
                              triggerLabel="Calendrier"
                            />
                            <ActionTooltip label="Aperçu de la lettre de confirmation PDF">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-[11px]"
                                onClick={() => setPdfPreview({
                                  url: `/api/admin/leaves/${r.id}/pdf-letter`,
                                  title: `Lettre de confirmation — Demande #${r.id}`,
                                  description: employee ? `${employee.fullName || employee.email}` : undefined,
                                  filename: `lettre-conge-${r.id}.pdf`,
                                })}
                              >
                                <FileText className="h-3 w-3 mr-1" />PDF
                              </Button>
                            </ActionTooltip>
                          </>
                        )}
                        {/* Menu Plus */}
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={busy}>
                              <MoreHorizontal className="h-3.5 w-3.5" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-56">
                            {r.status === "approved" && !r.isLockedByPaid && (
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onUnapprove(r); }}>
                                <RefreshCw className="h-3.5 w-3.5 mr-2" />Retirer l&apos;approbation
                              </DropdownMenuItem>
                            )}
                            {!r.isLockedByPaid && (
                              <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setConvertDialogReq(r); }}>
                                <RotateCcw className="h-3.5 w-3.5 mr-2" />Convertir le type
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setDuplicateDialogReq(r); }}>
                              <Copy className="h-3.5 w-3.5 mr-2" />Dupliquer
                            </DropdownMenuItem>
                            <AttachmentMenuItem r={r} onUploaded={refresh} />
                            {r.status === "approved" && !r.isLockedByPaid && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onCancelApproved(r); }} className="text-amber-700 focus:text-amber-700">
                                  <Ban className="h-3.5 w-3.5 mr-2" />Annuler le congé
                                </DropdownMenuItem>
                              </>
                            )}
                            {!r.isLockedByPaid && (
                              <>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDelete(r); }} className="text-red-600 focus:text-red-700">
                                  <Trash2 className="h-3.5 w-3.5 mr-2" />{tc("delete")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* Footer sticky : créer pour... */}
        {employee && (
          <div className="px-5 py-3 border-t bg-muted/30 shrink-0 flex items-center justify-between gap-2">
            <p className="text-xs text-muted-foreground">
              {employee.fullName || employee.email}
            </p>
            <Button
              size="sm"
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => onCreateForEmployee(employee)}
              disabled={isBlocked}
              title={isBlocked ? "Soumissions bloquées" : undefined}
            >
              <Plus className="h-3 w-3 mr-1" />Créer une demande
            </Button>
          </div>
        )}

        {/* ─── DIALOGS ─── */}
        {employee && (
          <>
            <PolicyDialog
              open={policyDialogOpen}
              onClose={() => setPolicyDialogOpen(false)}
              policies={policies}
              currentId={employee.leavePolicyId}
              employeeId={employee.id}
              onSaved={refresh}
            />
            <AdjustBalanceDialog
              open={adjustDialogOpen}
              onClose={() => setAdjustDialogOpen(false)}
              employeeId={employee.id}
              onSaved={refresh}
            />
            <BlockDialog
              open={blockDialogOpen}
              onClose={() => setBlockDialogOpen(false)}
              employeeId={employee.id}
              onSaved={refresh}
            />
            <NotifyDialog
              open={notifyDialogOpen}
              onClose={() => setNotifyDialogOpen(false)}
              employeeId={employee.id}
              employeeName={employee.fullName || employee.email}
            />
            <AnnualReportDialog
              open={annualDialogOpen}
              onClose={() => setAnnualDialogOpen(false)}
              employee={employee}
              balance={balance}
              requests={requests}
              onPdfPreview={() => setPdfPreview({
                url: `/api/admin/leaves/employee/${employee.id}/annual-report-pdf`,
                title: `Relevé annuel — ${employee.fullName || employee.email}`,
                description: "Période courante (1er mai → 30 avril)",
                filename: `releve-annuel-${employee.id}.pdf`,
              })}
            />
            <ConflictsDialog
              open={conflictsDialogOpen}
              onClose={() => setConflictsDialogOpen(false)}
              conflicts={conflicts}
            />
            <ConvertTypeDialog
              req={convertDialogReq}
              onClose={() => setConvertDialogReq(null)}
              onSaved={refresh}
            />
            <DuplicateDialog
              req={duplicateDialogReq}
              onClose={() => setDuplicateDialogReq(null)}
              onSaved={refresh}
            />
            <HistoryDialog
              req={historyDialogReq}
              onClose={() => setHistoryDialogReq(null)}
            />
          </>
        )}

        {/* Modal global d'aperçu PDF (convention VNK : jamais window.open direct) */}
        <PdfPreviewModal
          open={!!pdfPreview}
          url={pdfPreview?.url ?? null}
          title={pdfPreview?.title ?? ""}
          description={pdfPreview?.description}
          downloadFilename={pdfPreview?.filename}
          onClose={() => setPdfPreview(null)}
        />
      </SheetContent>
    </Sheet>
  );
}

function KpiBox({
  label, value, unit, tone,
}: { label: string; value: number; unit?: string; tone?: "success" | "danger" | "muted" }) {
  const toneCls =
    tone === "success" ? "text-emerald-700" :
    tone === "danger" ? "text-red-600" :
    "text-foreground";
  return (
    <div className="rounded-md bg-background border p-2">
      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{label}</p>
      <p className={`text-base font-bold tabular-nums ${toneCls}`}>
        {value}
        {unit && <span className="text-[10px] text-muted-foreground ml-0.5">{unit}</span>}
      </p>
    </div>
  );
}

// ─── DropdownMenuItem custom pour upload (déclenche un input file caché) ──
function AttachmentMenuItem({ r, onUploaded }: { r: LeaveRow; onUploaded: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/leaves/${r.id}/attachment`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Échec de l'upload");
      toast.success("Justificatif joint");
      onUploaded();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur upload");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept=".pdf,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
      />
      {r.attachmentUrl && (
        <DropdownMenuItem asChild>
          <a href={r.attachmentUrl} target="_blank" rel="noreferrer">
            <Paperclip className="h-3.5 w-3.5 mr-2" />Voir justificatif
          </a>
        </DropdownMenuItem>
      )}
      <DropdownMenuItem
        disabled={uploading}
        onSelect={(e) => { e.preventDefault(); inputRef.current?.click(); }}
      >
        <Paperclip className="h-3.5 w-3.5 mr-2" />
        {r.attachmentUrl ? "Remplacer le justificatif" : "Uploader un justificatif"}
      </DropdownMenuItem>
    </>
  );
}

// ─── DIALOGS ───

function PolicyDialog({
  open, onClose, policies, currentId, employeeId, onSaved,
}: {
  open: boolean; onClose: () => void;
  policies: Policy[]; currentId: number | null;
  employeeId: number; onSaved: () => void;
}) {
  const tc = useTranslations("common");
  const [val, setVal] = useState<string>(currentId !== null ? String(currentId) : "__null__");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setVal(currentId !== null ? String(currentId) : "__null__"); }, [currentId, open]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-md">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Changer la politique</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              La politique régit les règles de calcul (taux, carry-over, quotas).
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Politique</Label>
          <Select value={val} onValueChange={setVal}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="__null__">— Politique par défaut —</SelectItem>
              {policies.map((p) => (
                <SelectItem key={p.id} value={String(p.id)}>
                  {p.name}{p.isDefault ? " (défaut)" : ""}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={busy}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={async () => {
              setBusy(true);
              const policyId = val === "__null__" ? null : Number(val);
              const res = await assignLeavePolicyAction({ employeeId, policyId });
              setBusy(false);
              if (res.success) { toast.success("Politique mise à jour"); onSaved(); onClose(); }
              else toast.error(res.error || "Erreur");
            }}
          >
            {busy ? "..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AdjustBalanceDialog({
  open, onClose, employeeId, onSaved,
}: { open: boolean; onClose: () => void; employeeId: number; onSaved: () => void; }) {
  const tc = useTranslations("common");
  const [delta, setDelta] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setDelta(""); setReason(""); } }, [open]);
  const num = Number(delta);
  const valid = !isNaN(num) && num !== 0 && reason.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-md">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Ajuster le solde manuellement</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Delta en jours (positif ou négatif) appliqué à la période de référence courante.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Delta (jours)</Label>
            <Input type="number" step="0.5" value={delta} onChange={(e) => setDelta(e.target.value)} placeholder="Ex : +2 ou -1" />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Raison</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30"
              placeholder="Ex : correction historique, bonus, etc."
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={!valid || busy}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={async () => {
              setBusy(true);
              const res = await adjustLeaveBalanceAction({ employeeId, deltaDays: num, reason: reason.trim() });
              setBusy(false);
              if (res.success) { toast.success("Solde ajusté"); onSaved(); onClose(); }
              else toast.error(res.error || "Erreur");
            }}
          >
            {busy ? "..." : "Appliquer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BlockDialog({
  open, onClose, employeeId, onSaved,
}: { open: boolean; onClose: () => void; employeeId: number; onSaved: () => void; }) {
  const tc = useTranslations("common");
  const [until, setUntil] = useState<string>("");
  const [reason, setReason] = useState<string>("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setUntil(""); setReason(""); } }, [open]);
  const valid = until && reason.trim().length >= 3;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-md">
        <div className="bg-gradient-to-br from-red-700 to-red-900 text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Bloquer les soumissions</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              L&apos;employé ne pourra plus soumettre de nouvelles demandes jusqu&apos;à la date choisie.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Bloquer jusqu&apos;au</Label>
            <Input type="date" value={until} onChange={(e) => setUntil(e.target.value)} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Raison</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30"
              placeholder="Ex : période critique, sanction disciplinaire, etc."
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={!valid || busy}
            variant="destructive"
            onClick={async () => {
              setBusy(true);
              const res = await blockEmployeeLeaveAction({ employeeId, until, reason: reason.trim() });
              setBusy(false);
              if (res.success) { toast.success("Soumissions bloquées"); onSaved(); onClose(); }
              else toast.error(res.error || "Erreur");
            }}
          >
            {busy ? "..." : "Bloquer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function NotifyDialog({
  open, onClose, employeeId, employeeName,
}: { open: boolean; onClose: () => void; employeeId: number; employeeName: string; }) {
  const tc = useTranslations("common");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) { setSubject(""); setBody(""); setLink(""); } }, [open]);
  const valid = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-md">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Notifier {employeeName}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Un message in-app sera créé dans son centre de notifications.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Sujet</Label>
            <Input value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={200} />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Message</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              maxLength={1000}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30"
            />
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Lien (optionnel)</Label>
            <Input value={link} onChange={(e) => setLink(e.target.value)} placeholder="/admin/..." />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={!valid || busy}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={async () => {
              setBusy(true);
              const res = await notifyEmployeeDirectAction({
                employeeId,
                subject: subject.trim(),
                body: body.trim(),
                link: link.trim() || undefined,
              });
              setBusy(false);
              if (res.success) { toast.success("Notification envoyée"); onClose(); }
              else toast.error(res.error || "Erreur");
            }}
          >
            {busy ? "..." : "Envoyer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AnnualReportDialog({
  open, onClose, employee, balance, requests, onPdfPreview,
}: {
  open: boolean; onClose: () => void;
  employee: Employee;
  balance: Balance | null;
  requests: LeaveRow[];
  onPdfPreview: () => void;
}) {
  const tc = useTranslations("common");
  // Filtre sur l'année courante de référence (1er mai → 30 avril)
  const now = new Date();
  const refYear = now.getMonth() + 1 >= 5 ? now.getFullYear() : now.getFullYear() - 1;
  const periodStart = new Date(refYear, 4, 1);
  const periodEnd = new Date(refYear + 1, 3, 30);
  const inPeriod = requests.filter((r) => {
    const s = new Date(r.startDate).getTime();
    const e = new Date(r.endDate).getTime();
    return s <= periodEnd.getTime() && e >= periodStart.getTime();
  });
  const byType = new Map<string, { days: number; count: number }>();
  for (const r of inPeriod) {
    if (r.status !== "approved") continue;
    const cur = byType.get(r.type) ?? { days: 0, count: 0 };
    cur.days += r.daysCount; cur.count += 1;
    byType.set(r.type, cur);
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">
              Rapport annuel — {employee.fullName || employee.email}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Période {periodStart.toLocaleDateString("fr-CA")} → {periodEnd.toLocaleDateString("fr-CA")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {balance && (
            <div className="grid grid-cols-4 gap-2">
              <KpiBox label="Restant" value={balance.vacationDaysRemaining} unit="j" tone="success" />
              <KpiBox label="Pris" value={balance.vacationDaysTaken} unit="j" tone="muted" />
              <KpiBox label="Planifiés" value={balance.vacationDaysPlanned} unit="j" tone="muted" />
              <KpiBox label="Accumulés" value={balance.accruedDays ?? 0} unit="j" tone="muted" />
            </div>
          )}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52] mb-2">Totaux par type (approuvés)</h4>
            {byType.size === 0 ? (
              <p className="text-xs text-muted-foreground italic">Aucune demande approuvée sur la période.</p>
            ) : (
              <div className="space-y-1.5">
                {Array.from(byType.entries()).map(([t, v]) => {
                  const m = typeMeta(t);
                  const Icon = m.icon;
                  return (
                    <div key={t} className="flex items-center justify-between rounded-md border bg-background p-2">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <Icon className="h-3.5 w-3.5 text-[#0F2D52]" />{m.label}
                      </span>
                      <span className="text-sm tabular-nums">
                        <strong>{v.days}</strong> j <span className="text-muted-foreground">({v.count} demande{v.count > 1 ? "s" : ""})</span>
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
          <Button
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={onPdfPreview}
          >
            <FileText className="h-3.5 w-3.5 mr-1.5" />Aperçu PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConflictsDialog({
  open, onClose, conflicts,
}: {
  open: boolean; onClose: () => void;
  conflicts: Array<{ requestId: number; period: string; peers: Array<{ id: number; name: string; period: string; type: string }> }>;
}) {
  const tc = useTranslations("common");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Conflits avec les pairs</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Demandes à venir qui chevauchent celles des collègues du même scope.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 max-h-[60vh] overflow-y-auto">
          {conflicts.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucun conflit détecté.</p>
          ) : (
            conflicts.map((c) => (
              <div key={c.requestId} className="rounded-md border bg-background p-3">
                <p className="text-xs font-semibold text-[#0F2D52]">Demande #{c.requestId} — {c.period}</p>
                <ul className="mt-1.5 space-y-1">
                  {c.peers.map((p, i) => (
                    <li key={i} className="text-xs text-muted-foreground">
                      <ShieldCheck className="inline h-3 w-3 mr-1 text-amber-600" />
                      <strong className="text-foreground">{p.name}</strong> · {typeMeta(p.type).label} · {p.period}
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ConvertTypeDialog({
  req, onClose, onSaved,
}: { req: LeaveRow | null; onClose: () => void; onSaved: () => void; }) {
  const tc = useTranslations("common");
  const [newType, setNewType] = useState<string>("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (req) { setNewType(""); setReason(""); } }, [req]);
  if (!req) return null;
  const valid = newType && newType !== req.type && reason.trim().length >= 3;
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-md">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Convertir le type</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Demande #{req.id} — type actuel : {typeMeta(req.type).label}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Nouveau type</Label>
            <Select value={newType} onValueChange={setNewType}>
              <SelectTrigger><SelectValue placeholder="Choisir un type" /></SelectTrigger>
              <SelectContent>
                {TYPE_KEYS.filter((k) => k !== req.type).map((k) => (
                  <SelectItem key={k} value={k}>{typeMeta(k).label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Raison</Label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[#0F2D52]/30"
            />
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={!valid || busy}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={async () => {
              setBusy(true);
              const res = await convertLeaveTypeAction({ id: req.id, newType, reason: reason.trim() });
              setBusy(false);
              if (res.success) { toast.success("Type converti"); onSaved(); onClose(); }
              else toast.error(res.error || "Erreur");
            }}
          >
            {busy ? "..." : "Convertir"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DuplicateDialog({
  req, onClose, onSaved,
}: { req: LeaveRow | null; onClose: () => void; onSaved: () => void; }) {
  const tc = useTranslations("common");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (req) {
      // Pré-rempli : +30j
      const s = new Date(req.startDate); s.setDate(s.getDate() + 30);
      const e = new Date(req.endDate); e.setDate(e.getDate() + 30);
      setStart(s.toISOString().slice(0, 10));
      setEnd(e.toISOString().slice(0, 10));
    }
  }, [req]);
  if (!req) return null;
  const valid = start && end;
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-md">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Dupliquer la demande</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Crée une nouvelle demande {typeMeta(req.type).label} sur de nouvelles dates (en attente).
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Début</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">Fin</Label>
              <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </div>
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={!valid || busy}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={async () => {
              setBusy(true);
              const res = await duplicateLeaveAction({ id: req.id, newStartDate: start, newEndDate: end });
              setBusy(false);
              if (res.success) { toast.success("Demande dupliquée"); onSaved(); onClose(); }
              else toast.error(res.error || "Erreur");
            }}
          >
            {busy ? "..." : "Dupliquer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type AuditEntry = {
  id: number;
  action: string;
  createdAt: string;
  changes: Record<string, unknown> | null;
  actor: { id: number; fullName: string | null; email: string } | null;
};

function HistoryDialog({
  req, onClose,
}: { req: LeaveRow | null; onClose: () => void; }) {
  const tc = useTranslations("common");
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!req) return;
    setLoading(true);
    fetch(`/api/admin/leaves/${req.id}/history`)
      .then((r) => r.ok ? r.json() : { logs: [] })
      .then((d) => setLogs(d.logs || []))
      .catch(() => toast.error("Impossible de charger l'historique"))
      .finally(() => setLoading(false));
  }, [req]);
  if (!req) return null;
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Historique — Demande #{req.id}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Journal d&apos;audit complet (création, modifications, décisions).
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">Aucune entrée d&apos;audit.</p>
          ) : (
            <ol className="space-y-2">
              {logs.map((l) => (
                <li key={l.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <AuditActionBadge action={l.action} />
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(l.createdAt).toLocaleString("fr-CA")}
                    </span>
                  </div>
                  <p className="text-xs text-foreground mt-1">
                    Par <strong>{l.actor ? (l.actor.fullName || l.actor.email) : "Système"}</strong>
                  </p>
                  <AuditChangesDisplay changes={l.changes} />
                </li>
              ))}
            </ol>
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

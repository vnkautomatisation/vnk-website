"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { promptDialog } from "@/components/admin/prompt-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import {
  CalendarDays, Plus, CheckCircle2, XCircle, Ban, Sun, Bandage, Baby, Home,
  Edit2, Users, Download, FileText, Inbox, History, MoreHorizontal, Copy, Paperclip, Loader2, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { LeaveRequestCalendar, type LeaveType } from "@/components/admin/leave-request-calendar";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  createLeaveRequestAction, reviewLeaveRequestAction, cancelLeaveRequestAction,
  updateLeaveRequestAction, bulkReviewLeavesAction, duplicateLeaveAction,
  delegateLeaveApprovalAction,
} from "@/app/actions/hr-leaves";
import { VacationWindowBanner, type OpenWindow } from "@/components/admin/vacation-window-banner";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { AuditActionBadge, AuditChangesDisplay } from "@/components/admin/audit-changes-display";
import { AddToCalendarMenu } from "@/components/admin/add-to-calendar-menu";
import { DelegationBanner } from "@/components/admin/delegation-banner";
import { TeamLeavesHeatmap } from "@/components/admin/team-leaves-heatmap";
import { RequestConflictsDialog } from "@/components/admin/request-conflicts-dialog";
import { formatLeaveRange } from "@/lib/utils/format-date";

type Request = {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
  status: string;
  halfDay: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  attachmentUrl?: string | null;
  attachmentName?: string | null;
  reviewer?: { fullName: string | null; email: string } | null;
  admin?: { id: number; fullName: string | null; email: string; avatarUrl?: string | null };
};

const TYPE_META: Record<string, { labelKey: string; icon: typeof Sun; color: string }> = {
  vacation: { labelKey: "type_vacation", icon: Sun, color: "bg-cyan-100 text-cyan-700" },
  sick: { labelKey: "type_sick", icon: Bandage, color: "bg-red-100 text-red-700" },
  parental: { labelKey: "type_parental", icon: Baby, color: "bg-pink-100 text-pink-700" },
  unpaid: { labelKey: "type_unpaid", icon: Home, color: "bg-slate-100 text-slate-700" },
  bereavement: { labelKey: "type_bereavement", icon: Home, color: "bg-gray-100 text-gray-700" },
  other: { labelKey: "type_other", icon: CalendarDays, color: "bg-amber-100 text-amber-700" },
};

const STATUS_META: Record<string, { labelKey: string; color: string }> = {
  pending: { labelKey: "status_pending", color: "bg-amber-100 text-amber-700" },
  approved: { labelKey: "status_approved", color: "bg-emerald-100 text-emerald-700" },
  rejected: { labelKey: "status_rejected", color: "bg-red-100 text-red-700" },
  cancelled: { labelKey: "status_cancelled", color: "bg-gray-100 text-gray-600" },
};

type LeaveBalance = {
  vacationDaysTotal: number;
  vacationDaysTaken: number;
  vacationDaysPlanned: number;
  vacationDaysRemaining: number;
  sickDaysTaken: number;
  accruedDays?: number;
  carriedOverDays?: number;
  policyName?: string;
};

export function LeavesView({
  myRequests, pendingReviews, teamLeavesUpcoming, isReviewer, balance, teamScopeCount,
  myAdminId, myBlock, openWindows,
}: {
  myRequests: Request[];
  pendingReviews: Request[];
  teamLeavesUpcoming?: Request[];
  isReviewer: boolean;
  balance?: LeaveBalance;
  /** Nombre de pairs visibles dans le scope — pour empty state intelligent du tab Équipe. */
  teamScopeCount?: number;
  /** ID de l'admin connecté (employé courant). Sert pour les exports PDF persos. */
  myAdminId?: number;
  /** Blocage admin sur les soumissions (si pertinent). */
  myBlock?: { until: string; reason: string | null } | null;
  /** Fenêtres de vacances pertinentes (open ou contenant mes préférences). Mon espace uniquement. */
  openWindows?: OpenWindow[];
}) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const router = useRouter();
  const dateTag = useDateLocale();
  const { confirm, ConfirmModal } = useConfirm();
  const [tab, setTab] = useState<"my" | "review" | "team">("my");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Request | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  // Dialogs Mon espace
  const [annualOpen, setAnnualOpen] = useState(false);
  const [delegateOpen, setDelegateOpen] = useState(false);
  const [historyReq, setHistoryReq] = useState<Request | null>(null);
  const [duplicateReq, setDuplicateReq] = useState<Request | null>(null);
  // TÂCHE 8 : voir conflits equipe sur une demande perso
  const [conflictsLeave, setConflictsLeave] = useState<Request | null>(null);
  // Aperçu PDF (preview modal) — convention VNK : jamais window.open direct pour les PDFs
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; description?: string; filename?: string } | null>(null);
  // Loading states par requete pour eviter double-clicks
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const markBusy = (id: number, on: boolean) => {
    setBusyIds((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });
  };

  // Filtres reviewer
  const [filterType, setFilterType] = useState<string>("all");
  const filteredReviews = useMemo(
    () => pendingReviews.filter((r) => filterType === "all" || r.type === filterType),
    [pendingReviews, filterType],
  );

  const TABS: TabItem<"my" | "review" | "team">[] = [
    { key: "my", label: t("mes_demandes"), icon: CalendarDays, count: myRequests.length },
    ...(isReviewer ? [{ key: "review" as const, label: t("approuver"), icon: CheckCircle2, count: pendingReviews.length }] : []),
    { key: "team", label: t("equipe_4_sem"), icon: Users, count: teamLeavesUpcoming?.length ?? 0 },
  ];

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const bulkAction = async (decision: "approved" | "rejected") => {
    if (selectedIds.size === 0 || bulkBusy) return;
    let notes: string | undefined;
    if (decision === "rejected") {
      const n = await promptDialog({
        title: `Refuser ${selectedIds.size} demande${selectedIds.size > 1 ? "s" : ""}`,
        label: t("motif_refus_optionnel"),
        multiline: true,
        variant: "destructive",
        confirmLabel: t("refuser"),
      });
      if (n === null) return;
      notes = n.trim() || undefined;
    }
    setBulkBusy(true);
    const res = await bulkReviewLeavesAction({ ids: Array.from(selectedIds), decision, notes });
    setBulkBusy(false);
    if (res.success) {
      toast.success(t("traitees", { count: res.data.processed }) + (res.data.skipped > 0 ? t("ignorees_suffixe", { count: res.data.skipped }) : ""));
      // TÂCHE 21 : detail erreurs si présentes
      if (res.data.errors && res.data.errors.length > 0) {
        const sample = res.data.errors.slice(0, 3).map((e) => `#${e.id}: ${e.reason}`).join(" — ");
        const more = res.data.errors.length > 3 ? ` (+${res.data.errors.length - 3} autres)` : "";
        toast.warning(`Detail erreurs : ${sample}${more}`, { duration: 6000 });
      }
      setSelectedIds(new Set());
      router.refresh();
    } else toast.error(res.error || t("erreur_lors_traitement"));
  };

  const isBlocked = !!myBlock;
  const blockMsg = myBlock
    ? t("leaves_view_vos_soumissions_de_conges_sont_bloquees_jusqu_au", { p0: new Date(myBlock.until).toLocaleDateString(dateTag), p1: myBlock.reason ? ` — ${myBlock.reason}` : "" })
    : "";

  return (
    <div className="space-y-4">
      {/* Header navy gradient — cohérent avec le thème VNK admin */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <CalendarDays className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t("conges")}</h1>
              <p className="text-xs text-white/80">
                {t("demandez_gerez_vacances_maladies_autres")}
              </p>
            </div>
          </div>
          <ActionTooltip label={isBlocked ? blockMsg : t("creer_nouvelle_demande_conge")}>
            <Button
              size="sm"
              onClick={() => setCreateOpen(true)}
              disabled={isBlocked}
              className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 shrink-0 font-semibold"
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />{t("nouvelle_demande")}
            </Button>
          </ActionTooltip>
        </div>
      </div>

      {/* TÂCHE 3 (P1-13) : bandeau délégation (auto-fetch, ne rend rien si rien à montrer) */}
      <DelegationBanner />

      {/* Bandeau blocage si applicable */}
      {isBlocked && myBlock && (
        <Card className="p-3 border-red-200 bg-red-50">
          <div className="flex items-start gap-2">
            <Ban className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
            <p className="text-xs text-red-700">{blockMsg}</p>
          </div>
        </Card>
      )}

      {/* Fenêtres de vacances pertinentes (Mon espace uniquement) — intégrées dans le flux Congés */}
      {openWindows && openWindows.length > 0 && (
        <VacationWindowBanner windows={openWindows} />
      )}

      {/* Mon solde — KPI cards colorées au lieu d'un bloc plat (cohérent thème VNK) */}
      {balance && (
        <div className="space-y-2">
          <div className="flex items-center justify-between flex-wrap gap-2 px-0.5">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52] flex items-center gap-1.5">
              <Sun className="h-3.5 w-3.5" />{t("leaves_view_mon_solde_de_conges")}</h3>
            {balance.policyName && (
              <span className="text-[10px] text-muted-foreground italic">
                Politique : <strong className="text-foreground not-italic">{balance.policyName}</strong>
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <BalanceKpiCard
              label={t("jours_dispo")} value={balance.vacationDaysRemaining} icon={Sun}
              accent={balance.vacationDaysRemaining <= 2 ? "danger" : "success"}
            />
            <BalanceKpiCard label={t("jours_pris")} value={balance.vacationDaysTaken} icon={CheckCircle2} accent="muted" />
            <BalanceKpiCard label={t("jours_planifies")} value={balance.vacationDaysPlanned} icon={CalendarDays} accent="info" />
            <BalanceKpiCard label={t("jours_maladie")} value={balance.sickDaysTaken} icon={Bandage} accent="warning" />
          </div>
          {balance.accruedDays !== undefined && (
            <p className="text-[10px] text-muted-foreground px-0.5">{t("leaves_view_accumule")}<strong className="text-foreground">{balance.accruedDays} j</strong>
              {balance.carriedOverDays ? <> {t("reporte")} <strong className="text-foreground">{balance.carriedOverDays} j</strong></> : null}
            </p>
          )}
        </div>
      )}

      {/* Barre d'actions globales employé */}
      {myAdminId && (
        <div className="flex items-center gap-1.5 flex-wrap">
          <ActionTooltip label={t("voir_rapport_annuel_ecran")}>
            <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setAnnualOpen(true)}>
              <FileText className="h-3 w-3 mr-1" />Rapport annuel
            </Button>
          </ActionTooltip>
          <ActionTooltip label={t("apercu_mon_releve_annuel_pdf")}>
            <Button
              size="sm"
              variant="outline"
              className="h-7 text-[11px]"
              onClick={() => setPdfPreview({
                url: `/api/admin/leaves/employee/${myAdminId}/annual-report-pdf`,
                title: t("releve_annuel_conges"),
                description: t("recapitulatif_periode_courante_1er_mai"),
                filename: `releve-annuel-conges.pdf`,
              })}
            >
              <Download className="h-3 w-3 mr-1" />{t("leaves_view_apercu_pdf")}</Button>
          </ActionTooltip>
          {/* TÂCHE 7 : export CSV perso */}
          <ActionTooltip label={t("telecharger_toutes_mes_demandes_format")}>
            <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
              <a href={`/api/admin/leaves/employee/${myAdminId}/export/csv`} download>
                <Download className="h-3 w-3 mr-1" />{t("leaves_view_exporter_mes_conges_csv")}</a>
            </Button>
          </ActionTooltip>
          {isReviewer && (
            <>
              <ActionTooltip label={t("deleguer_mes_approbations_autre_admin")}>
                <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => setDelegateOpen(true)}>
                  <Shield className="h-3 w-3 mr-1" />{t("leaves_view_configurer_delegation")}</Button>
              </ActionTooltip>
              {/* TÂCHE 18 : symetrique du lien admin-side */}
              <ActionTooltip label={t("aller_espace_gestion_conges_equipe")}>
                <Button asChild size="sm" variant="outline" className="h-7 text-[11px]">
                  <Link href="/admin/employes/conges">
                    <Users className="h-3 w-3 mr-1" />{t("leaves_view_voir_gestion_equipe")}</Link>
                </Button>
              </ActionTooltip>
            </>
          )}
        </div>
      )}

      {/* Tabs dans le flow normal (pattern Finance) */}
      <SettingsTabs tabs={TABS} active={tab} onChange={(k) => { setTab(k); setSelectedIds(new Set()); }} />

      {tab === "my" && (
        <div className="space-y-2">
          {myRequests.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-[#0F2D52]/10 flex items-center justify-center mb-3">
                <FileText className="h-6 w-6 text-[#0F2D52]" />
              </div>
              <p className="text-sm font-medium text-foreground">{t("aucune_demande_moment")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("cliquez_nouvelle_demande_planifier_prochaines")}
              </p>
              <Button
                onClick={() => setCreateOpen(true)}
                className="mt-4 bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              >
                <Plus className="h-4 w-4 mr-1.5" />{t("leaves_view_demander_un_conge")}</Button>
            </Card>
          ) : (
            myRequests.map((r) => (
              <RequestCard
                key={r.id} request={r} mine
                busy={busyIds.has(r.id)}
                onCancel={async () => {
                  // TÂCHE 5 (P1-9) + TÂCHE 6 (P1-7) : motif optionnel pour pending, requis pour approved
                  const isApproved = r.status === "approved";
                  if (isApproved) {
                    const ok = await confirm({
                      title: t("annuler_conge_approuve"),
                      description: t("action_irreversible_notifiera_superviseur"),
                      variant: "destructive",
                      confirmLabel: t("continuer"),
                      cancelLabel: t("garder"),
                    });
                    if (!ok) return;
                  }
                  const reason = await promptDialog({
                    title: isApproved ? t("annuler_conge_approuve") : t("annuler_demande"),
                    label: isApproved ? t("raison_annulation_requise") : t("raison_annulation_optionnelle"),
                    multiline: true,
                    variant: "destructive",
                    confirmLabel: t("annuler_demande"),
                    required: isApproved,
                  });
                  if (reason === null) return;
                  markBusy(r.id, true);
                  const res = await cancelLeaveRequestAction({ id: r.id, reason: reason.trim() || undefined });
                  markBusy(r.id, false);
                  if (res.success) { toast.success(t("demande_annulee")); router.refresh(); }
                  else toast.error(res.error || t("erreur_lors_annulation"));
                }}
                onEdit={() => setEditing(r)}
                onHistory={() => setHistoryReq(r)}
                onDuplicate={() => setDuplicateReq(r)}
                onConflicts={() => setConflictsLeave(r)}
                onAttachmentChange={() => router.refresh()}
                onPdfPreview={() => setPdfPreview({
                  url: `/api/admin/leaves/${r.id}/pdf-letter`,
                  title: t("leaves_view_lettre_de_confirmation_demande_p0", { p0: r.id }),
                  description: `${TYPE_META[r.type] ? t(TYPE_META[r.type].labelKey) : r.type} ${formatLeaveRange(r.startDate, r.endDate, dateTag)}`,
                  filename: `lettre-conge-${r.id}.pdf`,
                })}
              />
            ))
          )}
        </div>
      )}

      {tab === "review" && isReviewer && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t("filtrer_type")}</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{tc("all")}</SelectItem>
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{t(v.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {filteredReviews.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="mx-auto h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                <CheckCircle2 className="h-6 w-6 text-emerald-700" />
              </div>
              <p className="text-sm font-medium text-foreground">{t("tout_traite")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {pendingReviews.length > 0
                  ? t("aucune_demande_ne_correspond_filtre")
                  : t("aucune_demande_attente_approbation")}
              </p>
            </Card>
          ) : (
            <>
              {selectedIds.size > 0 && (
                <Card className="p-3 sticky top-[176px] lg:top-[140px] z-10 bg-[#0F2D52] text-white border-0 flex items-center justify-between gap-2 shadow-md flex-wrap">
                  <span className="text-sm font-medium">{selectedIds.size} selectionnee{selectedIds.size > 1 ? "s" : ""}</span>
                  <div className="flex gap-2">
                    <Button size="sm" variant="outline" disabled={bulkBusy} className="h-8 text-xs bg-white/10 hover:bg-white/20 text-white border-white/30" onClick={() => setSelectedIds(new Set())}>{t("deselectionner")}</Button>
                    <Button size="sm" variant="outline" disabled={bulkBusy} className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90" onClick={() => bulkAction("approved")}>
                      <CheckCircle2 className="h-3 w-3 mr-1" />{bulkBusy ? "..." : t("approuver_selection")}
                    </Button>
                    <Button size="sm" variant="outline" disabled={bulkBusy} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0" onClick={() => bulkAction("rejected")}>
                      <XCircle className="h-3 w-3 mr-1" />{bulkBusy ? "..." : t("refuser_selection")}
                    </Button>
                  </div>
                </Card>
              )}
              {filteredReviews.map((r) => (
                <RequestCard
                  key={r.id} request={r} mine={false}
                  selectable
                  selected={selectedIds.has(r.id)}
                  onToggleSelect={() => toggleSelect(r.id)}
                  busy={busyIds.has(r.id)}
                  onReview={async (decision) => {
                    let notes: string | undefined;
                    if (decision === "rejected") {
                      const n = await promptDialog({
                        title: t("refuser_demande_conge"),
                        label: t("motif_refus_optionnel"),
                        placeholder: t("ex_periode_chargee_equipe_sous"),
                        multiline: true,
                        variant: "destructive",
                        confirmLabel: t("refuser"),
                      });
                      if (n === null) return;
                      notes = n.trim() || undefined;
                    }
                    markBusy(r.id, true);
                    const res = await reviewLeaveRequestAction({ id: r.id, decision, notes });
                    markBusy(r.id, false);
                    if (res.success) { toast.success(decision === "approved" ? t("approuvee") : t("refusee")); router.refresh(); }
                    else toast.error(res.error || t("erreur_lors_traitement"));
                  }}
                />
              ))}
            </>
          )}
        </div>
      )}

      {tab === "team" && (
        <div className="space-y-4">
          {/* R4 : heatmap permanente complète (live fetch /api/admin/leaves/calendar) */}
          <TeamLeavesHeatmap teamScopeCount={teamScopeCount} />
          <TeamCalendar leaves={teamLeavesUpcoming ?? []} teamScopeCount={teamScopeCount} />
        </div>
      )}

      <LeaveRequestCalendar
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        balance={balance}
        mode="create"
        onSubmit={async (payload) => {
          const r = await createLeaveRequestAction(payload);
          if (r.success) {
            toast.success(r.data?.warning ? `Demande envoyee. ${r.data.warning}` : t("demande_envoyee"));
            setCreateOpen(false);
            router.refresh();
          } else {
            toast.error(r.error || t("erreur_lors_creation"));
            throw new Error(r.error || "");
          }
        }}
      />

      {/* Modal d'edition : reutilise LeaveRequestCalendar en mode edit */}
      {editing && (
        <LeaveRequestCalendar
          open
          mode="edit"
          balance={balance}
          initialValues={{
            type: editing.type as LeaveType,
            startDate: editing.startDate.slice(0, 10),
            endDate: editing.endDate.slice(0, 10),
            halfDay: editing.halfDay as "AM" | "PM" | null,
            reason: editing.reason,
          }}
          onClose={() => setEditing(null)}
          onSubmit={async (payload) => {
            const r = await updateLeaveRequestAction({
              id: editing.id,
              type: payload.type,
              startDate: payload.startDate,
              endDate: payload.endDate,
              halfDay: payload.halfDay,
              reason: payload.reason,
            });
            if (r.success) {
              toast.success(t("demande_mise_jour"));
              setEditing(null);
              router.refresh();
            } else {
              toast.error(r.error || t("erreur_lors_mise_jour"));
              throw new Error(r.error || "");
            }
          }}
        />
      )}

      {/* Dialogs Mon espace */}
      {myAdminId && (
        <AnnualSelfDialog
          open={annualOpen}
          onClose={() => setAnnualOpen(false)}
          requests={myRequests}
          balance={balance}
          myAdminId={myAdminId}
          onPdfPreview={() => setPdfPreview({
            url: `/api/admin/leaves/employee/${myAdminId}/annual-report-pdf`,
            title: t("releve_annuel_conges"),
            description: t("recapitulatif_periode_courante_1er_mai"),
            filename: `releve-annuel-conges.pdf`,
          })}
        />
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
      {isReviewer && (
        <DelegateDialog
          open={delegateOpen}
          onClose={() => setDelegateOpen(false)}
        />
      )}
      <SelfHistoryDialog req={historyReq} onClose={() => setHistoryReq(null)} />
      <SelfDuplicateDialog
        req={duplicateReq}
        onClose={() => setDuplicateReq(null)}
        onDone={() => { setDuplicateReq(null); router.refresh(); }}
      />

      {/* TÂCHE 8 : voir conflits equipe sur une demande perso */}
      {conflictsLeave && (
        <RequestConflictsDialog
          open
          leaveId={conflictsLeave.id}
          leaveLabel={`${TYPE_META[conflictsLeave.type] ? t(TYPE_META[conflictsLeave.type].labelKey) : conflictsLeave.type} — ${formatLeaveRange(conflictsLeave.startDate, conflictsLeave.endDate, dateTag)}`}
          onClose={() => setConflictsLeave(null)}
        />
      )}

      {ConfirmModal}
    </div>
  );
}

function RequestCard({
  request, mine, onCancel, onReview, onEdit, selectable, selected, onToggleSelect, busy,
  onHistory, onDuplicate, onAttachmentChange, onPdfPreview, onConflicts,
}: {
  request: Request;
  mine: boolean;
  onCancel?: () => void;
  onReview?: (decision: "approved" | "rejected") => void;
  onEdit?: () => void;
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  busy?: boolean;
  onHistory?: () => void;
  onDuplicate?: () => void;
  onAttachmentChange?: () => void;
  onPdfPreview?: () => void;
  onConflicts?: () => void;
}) {
  const t = useTranslations("admin.leaves");
  const dateTag = useDateLocale();
  const tc = useTranslations("common");
  const meta = TYPE_META[request.type] ?? TYPE_META.other;
  const s = STATUS_META[request.status] ?? { label: request.status, color: "bg-gray-100 text-gray-700" };
  const Icon = meta.icon;
  const halfLabel = request.halfDay === "AM" ? t("demi_matin") : request.halfDay === "PM" ? t("demi_apres_midi") : null;
  return (
    <Card className="p-4">
      <div className="flex items-start gap-3">
        {selectable && onToggleSelect && (
          <ActionTooltip label={selected ? t("deselectionner") : t("selectionner_action_groupee")}>
            <div className="pt-1.5">
              <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={t("selectionner")} />
            </div>
          </ActionTooltip>
        )}
        <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${meta.color}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{t(meta.labelKey)}</h3>
            <Badge className={`text-[10px] ${s.color}`}>{t(s.labelKey)}</Badge>
            {halfLabel && <Badge variant="outline" className="text-[10px]">{halfLabel}</Badge>}
            {!mine && request.admin && (
              <span className="text-xs text-muted-foreground">· {request.admin.fullName || request.admin.email}</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            <strong>{formatLeaveRange(request.startDate, request.endDate, dateTag)}</strong>
            {" · "}
            {Number(request.daysCount)} jour{Number(request.daysCount) > 1 ? "s" : ""}
          </p>
          {request.reason && <p className="text-xs italic text-muted-foreground mt-1">« {request.reason} »</p>}
          {request.reviewedAt && request.reviewer && (
            <p className="text-[11px] text-muted-foreground mt-1">
              Décidé par {request.reviewer.fullName || request.reviewer.email}
              {request.reviewNotes && ` — ${request.reviewNotes}`}
            </p>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          {mine && request.status === "pending" && (
            <>
              {onEdit && (
                <ActionTooltip label={t("modifier_demande_calendrier")}>
                  <Button size="sm" variant="outline" disabled={busy} className="h-7 text-xs" onClick={onEdit}>
                    <Edit2 className="h-3 w-3 mr-1" />{tc("edit")}
                  </Button>
                </ActionTooltip>
              )}
              <ActionTooltip label={t("annuler_demande")}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={onCancel}
                >
                  <Ban className="h-3 w-3 mr-1" />{busy ? "..." : t("annuler")}
                </Button>
              </ActionTooltip>
            </>
          )}
          {mine && request.status === "approved" && (
            <>
              <AddToCalendarMenu
                event={{
                  leaveId: request.id,
                  title: t("leaves_view_conge_p0", { p0: TYPE_META[request.type] ? t(TYPE_META[request.type].labelKey) : t("conge") }),
                  startDate: request.startDate,
                  endDate: request.endDate,
                  description: request.reason || undefined,
                }}
              />
              <ActionTooltip label={t("apercu_lettre_confirmation_pdf")}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs"
                  onClick={onPdfPreview}
                >
                  <FileText className="h-3 w-3 mr-1" />PDF
                </Button>
              </ActionTooltip>
              {/* TÂCHE 6 (P1-7) : annuler un congé approuvé (motif requis) */}
              <ActionTooltip label={t("annuler_conge_approuve_motif_requis")}>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                  onClick={onCancel}
                >
                  <Ban className="h-3 w-3 mr-1" />{busy ? "..." : t("annuler")}
                </Button>
              </ActionTooltip>
            </>
          )}
          {/* TÂCHE 9 (P2-7) : menu Plus toujours visible pour mine (history sur refused/cancelled aussi) */}
          {mine && (
            <RequestCardMineMenu
              request={request}
              onHistory={onHistory}
              onDuplicate={onDuplicate}
              onAttachmentChange={onAttachmentChange}
              onConflicts={onConflicts}
            />
          )}
          {!mine && request.status === "pending" && onReview && (
            <>
              <Button
                size="sm"
                disabled={busy}
                className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                onClick={() => onReview("approved")}
              >
                <CheckCircle2 className="h-3 w-3 mr-1" />{busy ? "..." : t("approuver")}
              </Button>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                className="h-7 text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700"
                onClick={() => onReview("rejected")}
              >
                <XCircle className="h-3 w-3 mr-1" />{busy ? "..." : t("refuser")}
              </Button>
            </>
          )}
        </div>
      </div>
    </Card>
  );
}

function TeamCalendar({ leaves, teamScopeCount }: { leaves: Request[]; teamScopeCount?: number }) {
  const t = useTranslations("admin.leaves");
  // 28 jours rolling
  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, []);
  const inRange = (d: Date, s: string, e: string) => {
    const dt = d.getTime();
    return dt >= new Date(s.slice(0, 10)).getTime() && dt <= new Date(e.slice(0, 10)).getTime();
  };
  const today = new Date(); today.setHours(0, 0, 0, 0);

  if (leaves.length === 0) {
    // Empty state intelligent : distingue "pas de pairs visibles" vs "aucune absence"
    const noPeers = teamScopeCount === 0;
    return (
      <Card className="p-10 text-center">
        <div className={`mx-auto h-12 w-12 rounded-full flex items-center justify-center mb-3 ${noPeers ? "bg-amber-100" : "bg-emerald-100"}`}>
          {noPeers
            ? <Inbox className="h-6 w-6 text-amber-700" />
            : <Users className="h-6 w-6 text-emerald-700" />}
        </div>
        {noPeers ? (
          <>
            <p className="text-sm font-medium text-foreground">{t("aucun_collegue_apos_equipe_afficher")}</p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {t("vous_n_apos_avez_pas")}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm font-medium text-foreground">{t("aucune_absence_prevue_chez_collegues")}</p>
            <p className="text-xs text-muted-foreground mt-1">
              Periode ideale pour planifier vos vacances : aucun conflit d&apos;equipe sur les 4 prochaines semaines
              {typeof teamScopeCount === "number" && teamScopeCount > 0 ? ` (${teamScopeCount} collegue${teamScopeCount > 1 ? "s" : ""} visible${teamScopeCount > 1 ? "s" : ""}).` : "."}
            </p>
          </>
        )}
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      <Card className="overflow-x-auto">
        <div className="grid" style={{ gridTemplateColumns: `auto repeat(28, 1fr)`, minWidth: 800 }}>
          <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-muted/30 border-b border-r sticky left-0 z-10">
            {t("employe")}
          </div>
          {days.map((d, i) => {
            const isWeekend = d.getDay() === 0 || d.getDay() === 6;
            const isToday = d.getTime() === today.getTime();
            return (
              <div key={i} className={`px-1 py-2 text-[10px] text-center border-b ${isWeekend ? "bg-slate-50/50 text-muted-foreground/60" : ""} ${isToday ? "bg-[#0F2D52]/10 font-bold" : ""}`}>
                {d.getDate()}
              </div>
            );
          })}
          {/* Une ligne par employé */}
          {Object.entries(leaves.reduce((acc, l) => {
            const key = String(l.admin?.id ?? 0);
            acc[key] = acc[key] || { admin: l.admin!, list: [] };
            acc[key].list.push(l);
            return acc;
          }, {} as Record<string, { admin: NonNullable<Request["admin"]>; list: Request[] }>))
            .map(([key, group]) => (
              <ContentRow key={key} group={group} days={days} inRange={inRange} />
            ))}
        </div>
      </Card>
      <p className="text-[11px] text-muted-foreground">{t("28_jours_partir_apos_aujourd")}</p>
    </div>
  );
}

function ContentRow({ group, days, inRange }: {
  group: { admin: NonNullable<Request["admin"]>; list: Request[] };
  days: Date[];
  inRange: (d: Date, s: string, e: string) => boolean;
}) {
  const t = useTranslations("admin.leaves");
  const dateTag = useDateLocale();
  return (
    <>
      <div className="px-3 py-2 text-xs border-r bg-background sticky left-0 z-10 truncate">
        {group.admin.fullName || group.admin.email}
      </div>
      {days.map((d, i) => {
        const leaveOnDay = group.list.find((l) => inRange(d, l.startDate, l.endDate));
        const meta = leaveOnDay ? (TYPE_META[leaveOnDay.type] ?? TYPE_META.other) : null;
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        // TÂCHE 2 (P0-2) : différencier pending visuellement (hachuré) sans révéler le motif
        const isPending = leaveOnDay?.status === "pending";
        const tooltip = leaveOnDay
          ? `${meta ? t(meta.labelKey) : ""}${isPending ? t("attente_approbation") : ""} — ${formatLeaveRange(leaveOnDay.startDate, leaveOnDay.endDate, dateTag)}`
          : "";
        const style: React.CSSProperties | undefined = isPending
          ? {
              backgroundImage:
                "repeating-linear-gradient(45deg, rgba(245, 158, 11, 0.45) 0 3px, transparent 3px 6px)",
              backgroundColor: "rgb(255 251 235)",
            }
          : undefined;
        return (
          <ActionTooltip key={i} label={tooltip}>
            <div
              className={`h-7 border-b border-r ${isWeekend ? "bg-slate-50/50" : ""} ${leaveOnDay && !isPending ? meta?.color.split(" ")[0] : ""}`}
              style={style}
            />
          </ActionTooltip>
        );
      })}
    </>
  );
}

// ─── DropdownMenu "Plus" pour Mes demandes (mine) ──
function RequestCardMineMenu({
  request, onHistory, onDuplicate, onAttachmentChange, onConflicts,
}: {
  request: Request;
  onHistory?: () => void;
  onDuplicate?: () => void;
  onAttachmentChange?: () => void;
  onConflicts?: () => void;
}) {
  const t = useTranslations("admin.leaves");
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const handleFile = async (file: File | null) => {
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/admin/leaves/${request.id}/attachment`, { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || t("echec_upload"));
      toast.success(t("justificatif_joint"));
      onAttachmentChange?.();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : t("erreur_upload"));
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="outline" className="h-7 w-7 p-0" disabled={uploading}>
            <MoreHorizontal className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {/* TÂCHE 9 : Historique toujours dispo (meme refused/cancelled) */}
          {onHistory && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onHistory(); }}>
              <History className="h-3.5 w-3.5 mr-2" />Historique
            </DropdownMenuItem>
          )}
          {/* TÂCHE 8 : voir conflits equipe */}
          {onConflicts && (request.status === "pending" || request.status === "approved") && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onConflicts(); }}>
              <Users className="h-3.5 w-3.5 mr-2" />{t("leaves_view_voir_conflits_equipe")}</DropdownMenuItem>
          )}
          {onDuplicate && (
            <DropdownMenuItem onSelect={(e) => { e.preventDefault(); onDuplicate(); }}>
              <Copy className="h-3.5 w-3.5 mr-2" />Dupliquer
            </DropdownMenuItem>
          )}
          {request.attachmentUrl && (
            <DropdownMenuItem asChild>
              <a href={request.attachmentUrl} target="_blank" rel="noreferrer">
                <Paperclip className="h-3.5 w-3.5 mr-2" />Voir justificatif
              </a>
            </DropdownMenuItem>
          )}
          {/* Upload uniquement si pas annulee/refusee */}
          {(request.status === "pending" || request.status === "approved") && (
            <DropdownMenuItem
              disabled={uploading}
              onSelect={(e) => { e.preventDefault(); inputRef.current?.click(); }}
            >
              <Paperclip className="h-3.5 w-3.5 mr-2" />
              {request.attachmentUrl ? t("remplacer_justificatif") : t("uploader_justificatif")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

// ─── Dialog : rapport annuel perso ──
function AnnualSelfDialog({
  open, onClose, requests, balance, myAdminId, onPdfPreview,
}: {
  open: boolean; onClose: () => void;
  requests: Request[]; balance?: LeaveBalance; myAdminId: number;
  onPdfPreview: () => void;
}) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();
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
    cur.days += Number(r.daysCount); cur.count += 1;
    byType.set(r.type, cur);
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">{t("mon_rapport_annuel")}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Période {periodStart.toLocaleDateString(dateTag)} → {periodEnd.toLocaleDateString(dateTag)}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 max-h-[60vh] overflow-y-auto">
          {balance && (
            <div className="grid grid-cols-4 gap-2">
              <div className="rounded-md border bg-background p-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{t("restant")}</p>
                <p className="text-base font-bold tabular-nums text-emerald-700">{balance.vacationDaysRemaining}<span className="text-[10px] text-muted-foreground ml-0.5">j</span></p>
              </div>
              <div className="rounded-md border bg-background p-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{t("pris")}</p>
                <p className="text-base font-bold tabular-nums">{balance.vacationDaysTaken}<span className="text-[10px] text-muted-foreground ml-0.5">j</span></p>
              </div>
              <div className="rounded-md border bg-background p-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{t("planifies")}</p>
                <p className="text-base font-bold tabular-nums">{balance.vacationDaysPlanned}<span className="text-[10px] text-muted-foreground ml-0.5">j</span></p>
              </div>
              <div className="rounded-md border bg-background p-2">
                <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">{t("accumules")}</p>
                <p className="text-base font-bold tabular-nums">{balance.accruedDays ?? 0}<span className="text-[10px] text-muted-foreground ml-0.5">j</span></p>
              </div>
            </div>
          )}
          <div>
            <h4 className="text-[11px] font-bold uppercase tracking-wider text-[#0F2D52] mb-2">{t("totaux_type_approuves")}</h4>
            {byType.size === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t("aucune_demande_approuvee_periode")}</p>
            ) : (
              <div className="space-y-1.5">
                {Array.from(byType.entries()).map(([leaveType, v]) => {
                  const m = TYPE_META[leaveType] ?? TYPE_META.other;
                  const Icon = m.icon;
                  return (
                    <div key={leaveType} className="flex items-center justify-between rounded-md border bg-background p-2">
                      <span className="inline-flex items-center gap-2 text-sm">
                        <Icon className="h-3.5 w-3.5 text-[#0F2D52]" />{t(m.labelKey)}
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
            <FileText className="h-3.5 w-3.5 mr-1.5" />{t("leaves_view_apercu_pdf")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog : déléguer mes approbations ──
type DelegateAdmin = { id: number; fullName: string | null; email: string };
function DelegateDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const [admins, setAdmins] = useState<DelegateAdmin[]>([]);
  const [selected, setSelected] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    fetch("/api/admin/leaves/reviewers")
      .then((r) => r.ok ? r.json() : { employees: [] })
      .then((d) => setAdmins(d.employees ?? []))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-md">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">{t("deleguer_mes_approbations")}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("choisissez_collegue_pourra_approuver_conges")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t("delegue")}</Label>
          {loading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />{tc("loading")}
            </div>
          ) : (
            <Select value={selected} onValueChange={setSelected}>
              <SelectTrigger><SelectValue placeholder={t("choisir_admin")} /></SelectTrigger>
              <SelectContent>
                {admins.map((a) => (
                  <SelectItem key={a.id} value={String(a.id)}>
                    {a.fullName || a.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 gap-2">
          <Button
            variant="outline"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const res = await delegateLeaveApprovalAction({ delegateId: null });
              setBusy(false);
              if (res.success) { toast.success(t("delegation_retiree")); onClose(); }
              else toast.error(res.error || t("erreur"));
            }}
          >
            {t("retirer")}
          </Button>
          <Button variant="outline" onClick={onClose}>{tc("cancel")}</Button>
          <Button
            disabled={!selected || busy}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={async () => {
              setBusy(true);
              const res = await delegateLeaveApprovalAction({ delegateId: Number(selected) });
              setBusy(false);
              if (res.success) { toast.success(t("delegation_activee")); onClose(); }
              else toast.error(res.error || t("erreur"));
            }}
          >
            {busy ? "..." : t("deleguer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Dialog Historique (lecture seule) ──
type AuditEntry = {
  id: number; action: string; createdAt: string;
  changes: Record<string, unknown> | null;
  actor: { id: number; fullName: string | null; email: string } | null;
};
function SelfHistoryDialog({ req, onClose }: { req: Request | null; onClose: () => void }) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const [logs, setLogs] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const dateTag = useDateLocale();
  useEffect(() => {
    if (!req) return;
    setLoading(true);
    fetch(`/api/admin/leaves/${req.id}/history`)
      .then((r) => r.ok ? r.json() : { logs: [] })
      .then((d) => setLogs(d.logs || []))
      .catch(() => toast.error(t("impossible_charger_historique")))
      .finally(() => setLoading(false));
  }, [req]);
  if (!req) return null;
  return (
    <Dialog open={!!req} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden max-w-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader>
            <DialogTitle className="text-white text-base">Historique — Demande #{req.id}</DialogTitle>
          </DialogHeader>
        </div>
        <div className="p-5 max-h-[60vh] overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : logs.length === 0 ? (
            <p className="text-xs text-muted-foreground italic text-center py-4">{t("aucune_entree_apos_audit")}</p>
          ) : (
            <ol className="space-y-2">
              {logs.map((l) => (
                <li key={l.id} className="rounded-md border bg-background p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <AuditActionBadge action={l.action} />
                    <span className="text-[10px] text-muted-foreground tabular-nums">
                      {new Date(l.createdAt).toLocaleString(dateTag)}
                    </span>
                  </div>
                  <p className="text-xs text-foreground mt-1">{t("leaves_view_par")}<strong>{l.actor ? (l.actor.fullName || l.actor.email) : t("systeme")}</strong>
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

// ─── Dialog Dupliquer (employé) ──
function SelfDuplicateDialog({
  req, onClose, onDone,
}: { req: Request | null; onClose: () => void; onDone: () => void }) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (req) {
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
            <DialogTitle className="text-white text-base">{t("dupliquer_demande")}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Crée une nouvelle demande {TYPE_META[req.type] ? t(TYPE_META[req.type].labelKey) : req.type} sur de nouvelles dates (statut : en attente).
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t("debut")}</Label>
              <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </div>
            <div>
              <Label className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">{t("fin")}</Label>
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
              if (res.success) { toast.success(t("demande_dupliquee")); onDone(); }
              else toast.error(res.error || t("erreur"));
            }}
          >
            {busy ? "..." : t("dupliquer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Carte KPI solde (thème VNK cohérent) ─────────────────────────
function BalanceKpiCard({
  label, value, icon: Icon, accent,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  accent: "success" | "danger" | "info" | "warning" | "muted";
}) {
  const map = {
    success: { bg: "bg-emerald-50", border: "border-emerald-200", icon: "text-emerald-600", value: "text-emerald-800" },
    danger: { bg: "bg-red-50", border: "border-red-200", icon: "text-red-600", value: "text-red-800" },
    info: { bg: "bg-sky-50", border: "border-sky-200", icon: "text-sky-600", value: "text-sky-800" },
    warning: { bg: "bg-amber-50", border: "border-amber-200", icon: "text-amber-700", value: "text-amber-800" },
    muted: { bg: "bg-card", border: "border-border", icon: "text-muted-foreground", value: "text-foreground" },
  };
  const c = map[accent];
  return (
    <div className={`rounded-lg border p-3 ${c.bg} ${c.border}`}>
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground">{label}</span>
        <Icon className={`h-3.5 w-3.5 ${c.icon}`} />
      </div>
      <p className={`text-2xl font-bold tabular-nums ${c.value}`}>{value}<span className="text-xs text-muted-foreground ml-0.5 font-normal">j</span></p>
    </div>
  );
}

"use client";
// Vue admin /employes/conges — centre de gestion superviseur PRO.
// Palette restreinte : navy #0F2D52 + amber (alerte) + red (danger) + emerald (succes).
// Plus de cards multi-couleurs, tableaux pour les listes, actions inline partout.
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays, CheckCircle2, XCircle, Users, BarChart3, LayoutDashboard,
  AlertTriangle, ShieldCheck, CalendarRange, ExternalLink,
  Sun, Bandage, Baby, Home, ClipboardList, TrendingUp, UserCheck,
  Search, Filter, Eye, Plus, ChevronLeft, ChevronRight,
  TrendingDown, Minus, Building2, Download, MoreHorizontal,
  Megaphone, UserCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, CartesianGrid, Legend,
} from "recharts";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { promptDialog } from "@/components/admin/prompt-dialog";
import { LeaveRequestCalendar, type LeaveType } from "@/components/admin/leave-request-calendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { EmployeeDrillDownPanel } from "./employee-drill-down-panel";
import {
  reviewLeaveRequestAction, bulkReviewLeavesAction, createLeaveForEmployeeAction,
  adminUpdateLeaveRequestAction, createMandatoryClosureAction,
} from "@/app/actions/hr-leaves";
import { DatePopover } from "@/components/admin/date-popover";
import { FormSection, Field } from "@/components/admin/form-section";
import { DialogFooter } from "@/components/ui/dialog";
import { ReviewAppealDialog } from "@/components/admin/appeal-dialog";
import { TeamLeavesHeatmap } from "@/components/admin/team-leaves-heatmap";
import { InlineLoader } from "@/components/admin/page-loader";

// ─── Types partagés ───────────────────────────────────────────────
type Request = {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string | null;
  status: string;
  halfDay: string | null;
  createdAt?: string;
  reviewedAt: string | null;
  reviewNotes: string | null;
  reviewer?: { fullName: string | null; email: string } | null;
  admin?: {
    id: number;
    fullName: string | null;
    email: string;
    avatarUrl?: string | null;
    team?: { id: number; name: string; color: string | null } | null;
  };
};

type UpcomingLeave = {
  id: number;
  type: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  halfDay: string | null;
  admin?: { id: number; fullName: string | null; email: string; avatarUrl?: string | null };
};

type EmployeeRow = {
  id: number;
  fullName: string | null;
  email: string;
  avatarUrl?: string | null;
  title: string | null;
  department: string | null;
  team: { id: number; name: string; color: string | null } | null;
  vacationDaysRemaining: number;
  vacationDaysTaken: number;
  vacationDaysPlanned: number;
  pendingApprovedDays: number;
  pendingRequestsCount: number;
  lastRequest: {
    type: string;
    status: string;
    startDate: string;
    endDate: string;
    createdAt: string;
  } | null;
  hasPending: boolean;
  isAbsentToday: boolean;
};

type KPIs = {
  pendingCount: number;
  absentToday: number;
  activeScopeCount: number;
  absentDaysThisWeek: number;
  absenteeismRate: number;
  totalRemainingDays: number;
  conflictDays: number;
};

type ScopeInfo = {
  isHr: boolean;
  isFounder: boolean;
  allowedAdminCount: number | null;
  myTeams: Array<{ id: number; name: string; color: string | null }>;
};

type TeamStat = { id: number; name: string; color: string | null; days: number; employees: number };
type MonthStat = { key: string; label: string; rate: number; days: number };
type ForecastWeek = { key: string; label: string; absents: number; days: number };
type HeatmapDay = { date: string; count: number; ids: number[] };

type ActiveWindow = {
  id: number;
  name: string;
  status: string;
  openingDate: string;
  closingDate: string;
  coversFrom: string;
  coversTo: string;
  preferencesCount: number;
  submittedAdmins: number;
  pendingAppealsCount: number;
};

type PendingPagination = { page: number; pages: number; pageSize: number; total: number };

// ─── Constantes UX ────────────────────────────────────────────────
const NAVY = "#0F2D52";
const NAVY_HOVER = "#1a3a66";

// Types de conge — palette restreinte (uniquement teintes pour barres calendrier)
const TYPE_META: Record<string, { labelKey: string; icon: typeof Sun; bar: string; barDark: string }> = {
  vacation:    { labelKey: "type_vacation",   icon: Sun,          bar: "#bcd2eb", barDark: "#3b6fb0" },
  sick:        { labelKey: "type_sick",    icon: Bandage,      bar: "#f8c8c8", barDark: "#c44545" },
  parental:    { labelKey: "type_parental",   icon: Baby,         bar: "#e0d4f0", barDark: "#7a5dab" },
  unpaid:      { labelKey: "type_unpaid", icon: Home,         bar: "#dde1e7", barDark: "#5a6678" },
  bereavement: { labelKey: "type_bereavement",      icon: Home,         bar: "#d4d4d4", barDark: "#525252" },
  other:       { labelKey: "type_other",      icon: CalendarDays, bar: "#f5e0b8", barDark: "#a07729" },
};
function typeMeta(t: string) {
  return TYPE_META[t] ?? TYPE_META.other;
}

const STATUS_META: Record<string, { labelKey: string; cls: string }> = {
  pending:   { labelKey: "status_pending", cls: "bg-amber-50 text-amber-800 border border-amber-200" },
  approved:  { labelKey: "status_approved", cls: "bg-emerald-50 text-emerald-800 border border-emerald-200" },
  rejected:  { labelKey: "status_rejected",   cls: "bg-red-50 text-red-800 border border-red-200" },
  cancelled: { labelKey: "status_cancelled",   cls: "bg-slate-100 text-slate-700 border border-slate-200" },
};

function fmtDate(s: string): string {
  return new Date(s).toLocaleDateString("fr-CA", { day: "2-digit", month: "short" });
}
function fmtDateLong(s: string): string {
  return new Date(s).toLocaleDateString("fr-CA", { weekday: "short", day: "2-digit", month: "short", year: "numeric" });
}
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type TabKey = "overview" | "review" | "calendar" | "by-employee" | "analytics";

// ─── Composant principal ──────────────────────────────────────────
export function LeavesAdminView({
  scope, isReviewer, kpis,
  pendingReviews, pendingPagination, teamLeavesUpcoming, upcomingNext30,
  employees, absencesByType, nowIso,
  trailing12Months, prevMonthAbsenteeismRate, teamStats, next8WeeksForecast,
  heatmapDays, activeWindows, activePendingAppealsTotal,
}: {
  scope: ScopeInfo;
  isReviewer: boolean;
  kpis: KPIs;
  pendingReviews: Request[];
  pendingPagination?: PendingPagination;
  teamLeavesUpcoming: UpcomingLeave[];
  upcomingNext30: UpcomingLeave[];
  employees: EmployeeRow[];
  absencesByType: Array<{ type: string; daysCount: number; requestsCount: number }>;
  trailing12Months: MonthStat[];
  prevMonthAbsenteeismRate: number;
  teamStats: TeamStat[];
  next8WeeksForecast: ForecastWeek[];
  heatmapDays: HeatmapDay[];
  nowIso: string;
  activeWindows?: ActiveWindow[];
  activePendingAppealsTotal?: number;
}) {
  const t = useTranslations("admin.leaves");
  const [tab, setTab] = useState<TabKey>("overview");
  const [createForOpen, setCreateForOpen] = useState(false);
  const [createForEmp, setCreateForEmp] = useState<EmployeeRow | null>(null);
  const [drillEmployeeId, setDrillEmployeeId] = useState<number | null>(null);
  const [closureOpen, setClosureOpen] = useState(false);
  const [peekDialogOpen, setPeekDialogOpen] = useState(false);
  const [appealsWindow, setAppealsWindow] = useState<ActiveWindow | null>(null);



  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  const [editingRequest, setEditingRequest] = useState<{
    employee: { id: number; fullName: string | null; email: string };
    request: { id: number; type: string; startDate: string; endDate: string; halfDay: string | null; reason: string | null };
  } | null>(null);
  const router = useRouter();


  const reviewBadge = kpis.pendingCount + (activePendingAppealsTotal ?? 0);
  const baseTabs: TabItem<TabKey>[] = [
    { key: "overview", label: t("vue_ensemble"), icon: LayoutDashboard },
    ...(isReviewer ? [{ key: "review" as const, label: t("approuver_action"), icon: CheckCircle2, count: reviewBadge }] : []),
    { key: "calendar", label: t("calendrier_equipe"), icon: CalendarRange },
    { key: "by-employee", label: t("employe_2"), icon: Users, count: employees.length },
    { key: "analytics", label: t("analytics"), icon: BarChart3 },
  ];


  const openCreateForEmployee = (emp: EmployeeRow) => {
    setCreateForEmp(emp);
    setCreateForOpen(false);
  };

  return (
    <div className="space-y-4">

      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold flex items-center gap-2">{t("gestion_conges")}</h1>
              <p className="text-xs text-white/80">
                Vue d&apos;ensemble equipe ·{" "}
                {scope.isFounder
                  ? t("tous_employes")
                  : scope.isHr
                    ? `${kpis.activeScopeCount} employes (RH)`
                    : `${kpis.activeScopeCount} subordonne${kpis.activeScopeCount > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs bg-white/15 hover:bg-white/25 text-white border-white/20"
              onClick={() => setCreateForOpen(true)}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />{t("creer_pour")}
            </Button>
            {isReviewer && (
              <ActionTooltip label={t("fermeture_obligatoire_entreprise_ex_noel")}>
                <Button
                  variant="secondary"
                  size="sm"
                  className="hidden md:inline-flex h-8 text-xs bg-white/15 hover:bg-white/25 text-white border-white/20"
                  onClick={() => setClosureOpen(true)}
                >
                  <Building2 className="h-3.5 w-3.5 mr-1.5" />Fermeture
                </Button>
              </ActionTooltip>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs bg-white/15 hover:bg-white/25 text-white border-white/20"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 mr-1.5" />{t("leaves_admin_view_plus")}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/admin/mon-espace/conges">
                    <UserCircle className="h-3.5 w-3.5 mr-2" />Voir mon espace conges
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPeekDialogOpen(true); }}>
                  <Users className="h-3.5 w-3.5 mr-2" />Voir equipe (6 mois)
                </DropdownMenuItem>
                {isReviewer && (
                  <DropdownMenuItem className="md:hidden" onClick={() => setClosureOpen(true)}>
                    <Building2 className="h-3.5 w-3.5 mr-2" />Fermeture entreprise
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/admin/employes/conges/politiques">
                    <ShieldCheck className="h-3.5 w-3.5 mr-2" />Politiques
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/employes/conges/fenetres">
                    <CalendarRange className="h-3.5 w-3.5 mr-2" />Fenetres
                  </Link>
                </DropdownMenuItem>
                {isReviewer && (
                  <DropdownMenuItem asChild>
                    <a href="/api/admin/leaves/export/csv" download>
                      <Download className="h-3.5 w-3.5 mr-2" />Exporter CSV
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Mini-barre + tabs sticky.
          - Au repos (pas scrolled) : invisibles, juste les tabs visibles normalement
          - Au scroll : mini-barre apparait + tabs restent visibles
          Mobile : full width (-mx-4 sm:-mx-5)
          Desktop : aligne contenu (pas de -mx) + top-[64px] (sub-header lg:hidden)

          FIX GAP MOBILE : on colle le sticky a top-[92px] (= 108 - 16) au lieu
          de top-[108px], et on compense par pt-4 (16px) interne. Resultat :
          la border-box (donc le bg-background) du wrapper commence visuellement
          16px AU-DESSUS du bas du sub-header, chevauchant la zone [92, 108].
          z-20 < z-[25] du sub-header → ce chevauchement passe DERRIERE le
          sub-header (invisible), MAIS elimine tout gap sub-pixel possible.
          Sans ce chevauchement, un gap de 1-2px peut apparaitre entre les
          deux sticky a cause du space-y-4 (mt-16) qui pousse le wrapper en
          flux + d'eventuels arrondis sub-pixel mobile. */}
      <div
        className={cn(


          "sticky top-[92px] pt-4 lg:top-[64px] lg:pt-0 z-20 bg-background -mx-4 sm:-mx-5 lg:mx-0 transition-shadow",
          scrolled ? "shadow-sm border-b" : "border-b border-transparent",
        )}
      >

        <div
          className={cn(
            "px-4 sm:px-5 lg:px-4 items-center gap-3 flex-wrap py-2",
            scrolled ? "flex" : "hidden",
          )}
        >
          <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">{t("gestion_conges")}</span>
            <span className="sm:hidden">{t("conges")}</span>
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => setCreateForOpen(true)}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">{t("creer")}</span>
              <span className="sm:hidden">{t("creer_2")}</span>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem asChild>
                  <Link href="/admin/mon-espace/conges">
                    <UserCircle className="h-3.5 w-3.5 mr-2" />Voir mon espace conges
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setPeekDialogOpen(true); }}>
                  <Users className="h-3.5 w-3.5 mr-2" />Voir equipe (6 mois)
                </DropdownMenuItem>
                {isReviewer && (
                  <DropdownMenuItem onClick={() => setClosureOpen(true)}>
                    <Building2 className="h-3.5 w-3.5 mr-2" />Fermeture entreprise
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link href="/admin/employes/conges/politiques">
                    <ShieldCheck className="h-3.5 w-3.5 mr-2" />Politiques
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/admin/employes/conges/fenetres">
                    <CalendarRange className="h-3.5 w-3.5 mr-2" />Fenetres
                  </Link>
                </DropdownMenuItem>
                {isReviewer && (
                  <DropdownMenuItem asChild>
                    <a href="/api/admin/leaves/export/csv" download>
                      <Download className="h-3.5 w-3.5 mr-2" />Exporter CSV
                    </a>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>


        <div className="px-4 sm:px-5 lg:px-4">
          <SettingsTabs tabs={baseTabs} active={tab} onChange={setTab} />
        </div>
      </div>

      {tab === "overview" && (
        <OverviewTab
          kpis={kpis}
          upcomingNext30={upcomingNext30}
          heatmapDays={heatmapDays}
          prevMonthRate={prevMonthAbsenteeismRate}
          isReviewer={isReviewer}
          onJumpReview={() => setTab("review")}
          onJumpCalendar={() => setTab("calendar")}
          onOpenDrill={(id) => setDrillEmployeeId(id)}
          activeWindows={activeWindows ?? []}
          onOpenAppeals={(w) => setAppealsWindow(w)}
        />
      )}

      {tab === "review" && isReviewer && (
        <div className="space-y-4">
          <PendingPreferencesBanner activeWindows={activeWindows ?? []} />
          <ReviewTab
            pendingReviews={pendingReviews}
            pagination={pendingPagination}
            onOpenDrill={(id) => setDrillEmployeeId(id)}
          />
        </div>
      )}

      {tab === "calendar" && (
        <div className="space-y-4">
          <PendingPreferencesBanner activeWindows={activeWindows ?? []} />
          <CalendarTab
            leaves={teamLeavesUpcoming}
            employees={employees}
            nowIso={nowIso}
            onClickLeave={(l) => l.admin?.id && setDrillEmployeeId(l.admin.id)}
            onClickEmptyCell={(empId, dateIso) => {
              const emp = employees.find((e) => e.id === empId);
              if (emp) {

                setCreateForEmp({ ...emp, __initDate: dateIso } as EmployeeRow & { __initDate: string });
              }
            }}
          />
        </div>
      )}

      {tab === "by-employee" && (
        <ByEmployeeTab
          employees={employees}
          onOpenDrill={(id) => setDrillEmployeeId(id)}
          onCreateForEmp={openCreateForEmployee}
        />
      )}

      {tab === "analytics" && (
        <AnalyticsTab
          absencesByType={absencesByType}
          employees={employees}
          kpis={kpis}
          trailing12Months={trailing12Months}
          prevMonthRate={prevMonthAbsenteeismRate}
          teamStats={teamStats}
          next8WeeksForecast={next8WeeksForecast}
        />
      )}


      <Dialog open={createForOpen && !createForEmp} onOpenChange={(o) => { if (!o) setCreateForOpen(false); }}>
        <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-white flex items-center gap-2">
                <UserCheck className="h-4 w-4" />{t("leaves_admin_view_creer_un_conge_pour_un_employe")}</DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Recherchez l&apos;employe concerne. {employees.length > 50 && <span>{employees.length} employes dans votre scope.</span>}
              </DialogDescription>
            </DialogHeader>
          </div>
          <EmployeePicker
            employees={employees}
            onPick={(emp) => setCreateForEmp(emp)}
          />
        </DialogContent>
      </Dialog>


      {createForEmp && (
        <LeaveRequestCalendar
          open={true}
          onClose={() => { setCreateForEmp(null); setCreateForOpen(false); }}
          onSubmit={async (payload) => {
            const r = await createLeaveForEmployeeAction({
              employeeId: createForEmp.id,
              type: payload.type,
              startDate: payload.startDate,
              endDate: payload.endDate,
              halfDay: payload.halfDay,
              reason: payload.reason,
              autoApprove: payload.autoApprove,
            });
            if (r.success) {
              toast.success(r.data.status === "approved"
                ? `Conge cree et approuve pour ${createForEmp.fullName || createForEmp.email}`
                : `Demande creee pour ${createForEmp.fullName || createForEmp.email} (en attente)`);
              if (r.data.warning) toast.warning(r.data.warning);
              setCreateForEmp(null);
              setCreateForOpen(false);
              router.refresh();
            } else {
              toast.error(r.error);
              throw new Error(r.error);
            }
          }}
          mode="create"
          adminMode={true}
          monthsVisible={2}
          canAutoApprove={isReviewer}
          employeeIdOverride={createForEmp.id}
          employeeName={createForEmp.fullName || createForEmp.email}
          initialValues={
            (createForEmp as EmployeeRow & { __initDate?: string }).__initDate
              ? {
                  startDate: (createForEmp as EmployeeRow & { __initDate?: string }).__initDate,
                  endDate: (createForEmp as EmployeeRow & { __initDate?: string }).__initDate,
                  type: "vacation",
                  reason: "",
                  halfDay: null,
                }
              : undefined
          }
        />
      )}


      <EmployeeDrillDownPanel
        employeeId={drillEmployeeId}
        open={drillEmployeeId !== null}
        onClose={() => setDrillEmployeeId(null)}
        onEditRequest={(req, emp) => {
          setEditingRequest({
            employee: { id: emp.id, fullName: emp.fullName, email: emp.email },
            request: {
              id: req.id,
              type: req.type,
              startDate: req.startDate.slice(0, 10),
              endDate: req.endDate.slice(0, 10),
              halfDay: req.halfDay,
              reason: req.reason,
            },
          });
        }}
        onCreateForEmployee={(emp) => {

          const full = employees.find((e) => e.id === emp.id);
          if (full) setCreateForEmp(full);
        }}
      />


      {closureOpen && (
        <MandatoryClosureDialog
          employees={employees}
          onClose={() => setClosureOpen(false)}
          onDone={() => { setClosureOpen(false); router.refresh(); }}
        />
      )}


      {editingRequest && (
        <LeaveRequestCalendar
          open={true}
          onClose={() => setEditingRequest(null)}
          mode="edit"
          adminMode={true}
          monthsVisible={2}
          canAutoApprove={isReviewer}
          employeeIdOverride={editingRequest.employee.id}
          employeeName={editingRequest.employee.fullName || editingRequest.employee.email}
          initialValues={{
            type: editingRequest.request.type as LeaveType,
            startDate: editingRequest.request.startDate,
            endDate: editingRequest.request.endDate,
            halfDay: editingRequest.request.halfDay as "AM" | "PM" | null,
            reason: editingRequest.request.reason,
          }}
          onSubmit={async (payload) => {
            const r = await adminUpdateLeaveRequestAction({
              id: editingRequest.request.id,
              type: payload.type,
              startDate: payload.startDate,
              endDate: payload.endDate,
              halfDay: payload.halfDay,
              reason: payload.reason,
            });
            if (r.success) {
              toast.success(t("demande_mise_jour"));
              setEditingRequest(null);
              router.refresh();
            } else {
              toast.error(r.error);
              throw new Error(r.error);
            }
          }}
        />
      )}


      {peekDialogOpen && (
        <TeamOverviewDialog
          onClose={() => setPeekDialogOpen(false)}
        />
      )}


      {appealsWindow && (
        <WindowAppealsDialog
          window={appealsWindow}
          onClose={() => setAppealsWindow(null)}
          onChanged={() => router.refresh()}
        />
      )}
    </div>
  );
}

// ─── Picker employe scalable (recherche debounce + filtres + scroll infini) ───
function EmployeePicker({
  employees, onPick,
}: { employees: EmployeeRow[]; onPick: (emp: EmployeeRow) => void }) {
  const t = useTranslations("admin.leaves");
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "remaining" | "recent">("name");
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollRef = useRef<HTMLDivElement>(null);


  useEffect(() => {
    const t = setTimeout(() => setSearch(rawSearch), 300);
    return () => clearTimeout(t);
  }, [rawSearch]);

  const teams = useMemo(() => {
    const map = new Map<number, { id: number; name: string; color: string | null }>();
    for (const e of employees) {
      if (e.team && !map.has(e.team.id)) map.set(e.team.id, e.team);
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const filtered = useMemo(() => {
    let arr = employees.slice();
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((e) =>
        (e.fullName || e.email).toLowerCase().includes(q)
        || (e.email).toLowerCase().includes(q)
        || (e.team?.name || "").toLowerCase().includes(q),
      );
    }
    if (teamFilter !== "all") {
      const id = teamFilter === "none" ? null : Number(teamFilter);
      arr = arr.filter((e) => (e.team?.id ?? null) === id);
    }
    arr.sort((a, b) => {
      if (sortBy === "remaining") return b.vacationDaysRemaining - a.vacationDaysRemaining;
      if (sortBy === "recent") {
        const at = a.lastRequest?.createdAt ? new Date(a.lastRequest.createdAt).getTime() : 0;
        const bt = b.lastRequest?.createdAt ? new Date(b.lastRequest.createdAt).getTime() : 0;
        return bt - at;
      }
      return (a.fullName || a.email).localeCompare(b.fullName || b.email);
    });
    return arr;
  }, [employees, search, teamFilter, sortBy]);


  useEffect(() => { setVisibleCount(20); }, [search, teamFilter, sortBy]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <>

      <div className="px-4 py-3 border-b bg-muted/30 shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            placeholder={t("rechercher_nom_email_equipe")}
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-7 w-36 text-[11px]"><SelectValue placeholder={t("equipe")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toutes_equipes")}</SelectItem>
              <SelectItem value="none">{t("sans_equipe")}</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-7 w-40 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">{t("tri_nom")}</SelectItem>
              <SelectItem value="remaining">{t("tri_solde_restant")}</SelectItem>
              <SelectItem value="recent">{t("tri_derniere_demande")}</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-[10px] text-muted-foreground ml-auto">
            {filtered.length} / {employees.length}
          </span>
        </div>
        {employees.length > 100 && search.length === 0 && (
          <div className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
            Vous avez acces a {employees.length} employes — affinez la recherche.
          </div>
        )}
      </div>

      <div ref={scrollRef} className="overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-12">
            {search ? t("aucun_employe_ne_correspond_recherche") : t("aucun_employe_scope")}
          </p>
        ) : (
          <>
            <ul className="divide-y">
              {visible.map((emp) => {
                const balanceCls =
                  emp.vacationDaysRemaining < 2 ? "text-red-700 bg-red-50 border-red-200"
                  : emp.vacationDaysRemaining < 5 ? "text-amber-700 bg-amber-50 border-amber-200"
                  : "text-emerald-700 bg-emerald-50 border-emerald-200";
                return (
                  <li key={emp.id}>
                    <button
                      type="button"
                      onClick={() => onPick(emp)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-[#0F2D52]/5 transition text-left"
                    >
                      <div className="h-9 w-9 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center text-xs font-bold shrink-0">
                        {(emp.fullName || emp.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.fullName || emp.email}</p>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {emp.team?.name ?? t("sans_equipe")}
                          {emp.title && <> · {emp.title}</>}
                        </p>
                      </div>
                      <div className={`text-[10px] font-bold tabular-nums px-2 py-0.5 rounded border ${balanceCls} shrink-0`}>
                        {emp.vacationDaysRemaining}j
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
            {visibleCount < filtered.length && (
              <div className="p-3 text-center border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setVisibleCount((v) => v + 20)}
                >
                  Charger 20 de plus ({filtered.length - visibleCount} restants)
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}

// ─── Tab 1 : Vue d'ensemble PRO ───────────────────────────────────
function OverviewTab({
  kpis, upcomingNext30, heatmapDays, prevMonthRate, isReviewer,
  onJumpReview, onJumpCalendar, onOpenDrill, activeWindows, onOpenAppeals,
}: {
  kpis: KPIs;
  upcomingNext30: UpcomingLeave[];
  heatmapDays: HeatmapDay[];
  prevMonthRate: number;
  isReviewer: boolean;
  onJumpReview: () => void;
  onJumpCalendar: () => void;
  onOpenDrill: (id: number) => void;
  activeWindows: ActiveWindow[];
  onOpenAppeals: (w: ActiveWindow) => void;
}) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const absentTodayRatio = kpis.activeScopeCount > 0
    ? Math.round((kpis.absentToday / kpis.activeScopeCount) * 100)
    : 0;

  const rateDelta = +(kpis.absenteeismRate - prevMonthRate).toFixed(1);

  return (
    <div className="space-y-4">

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <ExecKpi
          icon={ClipboardList}
          label={t("approuver_action")}
          value={kpis.pendingCount}
          tone={kpis.pendingCount > 0 ? "warning" : "neutral"}
          sub={kpis.pendingCount > 0 ? t("demandes_attente") : t("aucune_attente")}
          onClick={isReviewer ? onJumpReview : undefined}
        />
        <ExecKpi
          icon={UserCheck}
          label={t("absents_aujourd_hui")}
          value={`${kpis.absentToday}${kpis.activeScopeCount > 0 ? ` / ${kpis.activeScopeCount}` : ""}`}
          tone={absentTodayRatio > 30 ? "danger" : "neutral"}
          sub={`${absentTodayRatio}% du scope`}
        />
        <ExecKpi
          icon={CalendarDays}
          label={t("jours_personne_semaine")}
          value={kpis.absentDaysThisWeek}
          tone="neutral"
          sub={t("cumul_absences_ouvrees")}
        />
        <ExecKpi
          icon={TrendingUp}
          label={t("taux_absenteisme_mois")}
          value={`${kpis.absenteeismRate}%`}
          tone={kpis.absenteeismRate > 10 ? "danger" : kpis.absenteeismRate > 5 ? "warning" : "neutral"}
          sub={
            rateDelta === 0
              ? t("identique_mois_dernier")
              : rateDelta > 0
                ? `+${rateDelta}% vs mois precedent`
                : `${rateDelta}% vs mois precedent`
          }
          deltaDir={rateDelta > 0 ? "up" : rateDelta < 0 ? "down" : "flat"}
        />
        <ExecKpi
          icon={Sun}
          label={t("solde_total_equipe")}
          value={kpis.totalRemainingDays.toFixed(1)}
          tone="neutral"
          sub={t("jours_dispo_cumules")}
        />
        <ExecKpi
          icon={AlertTriangle}
          label={t("conflits_detectes")}
          value={kpis.conflictDays}
          tone={kpis.conflictDays > 0 ? "danger" : "neutral"}
          sub={kpis.conflictDays > 0 ? t("jours_30_absent") : t("aucun_conflit")}
          onClick={onJumpCalendar}
        />
      </div>

      {/* P0-1 : Fenêtres de sélection actives + appels pending
          REMONTÉ EN HAUT car c'est une action prioritaire (admin doit voir tout de suite
          les préférences soumises en attente d'attribution). Border navy + ring pour attirer l'œil. */}
      {activeWindows.length > 0 && (
        <Card className="overflow-hidden border-l-4 border-l-[#0F2D52] shadow-sm">
          <div className="px-4 py-3 border-b bg-[#0F2D52]/5 flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-bold flex items-center gap-2 text-[#0F2D52]">
              <CalendarRange className="h-4 w-4" />
              Fenêtres de vacances actives ({activeWindows.length})
              {activeWindows.some((w) => w.submittedAdmins > 0) && (
                <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold normal-case">
                  {activeWindows.reduce((s, w) => s + w.submittedAdmins, 0)} préférence{activeWindows.reduce((s, w) => s + w.submittedAdmins, 0) > 1 ? "s" : ""} soumise{activeWindows.reduce((s, w) => s + w.submittedAdmins, 0) > 1 ? "s" : ""}
                </span>
              )}
            </h3>
            <Link
              href="/admin/employes/conges/fenetres"
              className="text-xs text-[#0F2D52] hover:underline flex items-center gap-1 font-semibold"
            >{t("leaves_admin_view_gerer_toutes_les_fenetres")}<ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y">
            {activeWindows.map((w) => {
              const statusMeta: Record<string, { label: string; cls: string }> = {
                open: { label: t("ouverte"), cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                closed: { label: t("fermee"), cls: "bg-amber-50 text-amber-800 border-amber-200" },
                in_review: { label: t("revue"), cls: "bg-[#0F2D52]/10 text-[#0F2D52] border-[#0F2D52]/20" },
              };
              const sm = statusMeta[w.status] ?? { label: w.status, cls: "bg-slate-100 text-slate-700 border-slate-200" };
              return (
                <li key={w.id} className="px-4 py-3 flex items-center gap-3 flex-wrap hover:bg-muted/20">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-foreground truncate">{w.name}</p>
                      <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-semibold ${sm.cls}`}>
                        {sm.label}
                      </span>
                      {w.submittedAdmins > 0 && (
                        <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-800 border-emerald-200">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {w.submittedAdmins} soumission{w.submittedAdmins > 1 ? "s" : ""}
                        </span>
                      )}
                      {w.pendingAppealsCount > 0 && (
                        <ActionTooltip label={t("examiner_appels_attente")}>
                          <button
                            type="button"
                            onClick={() => onOpenAppeals(w)}
                            className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100"
                          >
                            <Megaphone className="h-2.5 w-2.5" />
                            {w.pendingAppealsCount} appel{w.pendingAppealsCount > 1 ? "s" : ""}
                          </button>
                        </ActionTooltip>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      Clôture le{" "}
                      <strong className="text-foreground tabular-nums">{new Date(w.closingDate).toLocaleDateString("fr-CA")}</strong>
                    </p>
                  </div>
                  <ActionTooltip label={t("voir_preferences_soumises_actions")}>
                    <Link
                      href={`/admin/employes/conges/fenetres#window-${w.id}`}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#0F2D52] text-[#0F2D52] hover:bg-[#0F2D52] hover:text-white transition-colors shrink-0 font-semibold"
                    >
                      <Eye className="h-3 w-3" />{t("leaves_admin_view_voir_preferences")}</Link>
                  </ActionTooltip>
                </li>
              );
            })}
          </ul>
        </Card>
      )}


      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <CalendarDays className="h-4 w-4" />Prochaines absences (30 jours)
          </h3>
          <button type="button" onClick={onJumpCalendar} className="text-xs text-[#0F2D52] hover:underline flex items-center gap-1">
            {t("voir_calendrier")} <ExternalLink className="h-3 w-3" />
          </button>
        </div>
        {upcomingNext30.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <CalendarDays className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-foreground">{t("equipe_complet")}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("aucune_absence_approuvee_30_prochains")}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">{tc("date")}</th>
                <th className="px-4 py-2 text-left font-semibold">{t("employe")}</th>
                <th className="px-4 py-2 text-left font-semibold">{t("type")}</th>
                <th className="px-4 py-2 text-right font-semibold">{t("duree")}</th>
                <th className="px-4 py-2 text-right font-semibold w-12"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {upcomingNext30.map((l) => {
                const sameDay = l.startDate.slice(0, 10) === l.endDate.slice(0, 10);
                const meta = typeMeta(l.type);
                return (
                  <tr key={l.id} className="hover:bg-muted/20">
                    <td className="px-4 py-2 text-xs tabular-nums">
                      {sameDay ? fmtDateLong(l.startDate) : `${fmtDate(l.startDate)} → ${fmtDate(l.endDate)}`}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        className="text-sm text-[#0F2D52] hover:underline"
                        onClick={() => l.admin?.id && onOpenDrill(l.admin.id)}
                      >
                        {l.admin?.fullName || l.admin?.email}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <span className="inline-flex items-center gap-1.5 text-xs">
                        <span className="h-2 w-2 rounded-sm" style={{ background: meta.barDark }} />
                        {t(meta.labelKey)}
                        {l.halfDay && <span className="text-muted-foreground">· ½ {l.halfDay === "AM" ? "matin" : "PM"}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">{Number(l.daysCount)}j</td>
                    <td className="px-4 py-2 text-right">
                      <ActionTooltip label={t("voir_details_employe")}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => l.admin?.id && onOpenDrill(l.admin.id)}
                        >
                          <Eye className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </ActionTooltip>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          </div>
        )}
      </Card>


      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <CalendarRange className="h-4 w-4" />{t("leaves_admin_view_densite_d_absents_4_semaines")}</h3>
          <button type="button" onClick={onJumpCalendar} className="text-xs text-[#0F2D52] hover:underline flex items-center gap-1">
            Vue complete <ExternalLink className="h-3 w-3" />
          </button>
        </div>
        <Heatmap days={heatmapDays} onClickDay={() => onJumpCalendar()} />
      </Card>
    </div>
  );
}

// ─── KPI executive ────────────────────────────────────────────────
function ExecKpi({
  icon: Icon, label, value, tone, sub, onClick, deltaDir,
}: {
  icon: typeof Sun;
  label: string;
  value: number | string;
  tone: "neutral" | "warning" | "danger";
  sub?: string;
  onClick?: () => void;
  deltaDir?: "up" | "down" | "flat";
}) {
  const valueCls =
    tone === "danger" ? "text-red-700"
    : tone === "warning" ? "text-amber-700"
    : "text-[#0F2D52]";
  const DeltaIcon = deltaDir === "up" ? TrendingUp : deltaDir === "down" ? TrendingDown : Minus;
  const deltaCls =
    deltaDir === "up" ? "text-red-600"
    : deltaDir === "down" ? "text-emerald-700"
    : "text-muted-foreground";

  const inner = (
    <div className="rounded-lg border bg-card p-3.5 transition hover:ring-2 hover:ring-[#0F2D52]/20 hover:shadow-sm h-full flex flex-col">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="h-7 w-7 rounded-md bg-[#0F2D52]/10 flex items-center justify-center">
          <Icon className="h-4 w-4 text-[#0F2D52]" />
        </div>
      </div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className={`text-2xl font-bold tabular-nums tracking-tight mt-0.5 ${valueCls}`}>
        {value}
      </p>
      {sub && (
        <p className="text-[10px] text-muted-foreground mt-1 flex items-center gap-1">
          {deltaDir && <DeltaIcon className={`h-3 w-3 ${deltaCls}`} />}
          <span className="truncate">{sub}</span>
        </p>
      )}
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left">
        {inner}
      </button>
    );
  }
  return inner;
}

// ─── Heatmap mensuelle compacte ──────────────────────────────────
function Heatmap({ days, onClickDay }: { days: HeatmapDay[]; onClickDay?: (date: string) => void }) {
  const t = useTranslations("admin.leaves");
  if (days.length === 0) {
    return <div className="p-6 text-center text-xs text-muted-foreground">{t("aucune_donnee")}</div>;
  }



  const weeks: Array<Array<HeatmapDay | null>> = [];
  let currentWeek: Array<HeatmapDay | null> = [];

  if (days.length > 0) {
    const first = new Date(days[0].date);
    const pad = first.getDay(); // 0 = dimanche
    for (let i = 0; i < pad; i++) currentWeek.push(null);
  }
  for (const d of days) {
    currentWeek.push(d);
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
  }
  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  const maxCount = Math.max(1, ...days.map((d) => d.count));
  const dowLabels = ["D", "L", "M", "M", "J", "V", "S"]; // dimanche-first
  const todayKey = isoDay(new Date());



  return (
    <div className="px-4 py-3 max-h-[260px]">
      <div className="grid gap-0.5" style={{ gridTemplateColumns: "16px repeat(7, 1fr)" }}>
        <div />
        {dowLabels.map((l, i) => (
          <div key={i} className="text-center text-[9px] text-muted-foreground font-semibold uppercase tracking-wider">
            {l}
          </div>
        ))}
        {weeks.map((w, wi) => (
          <React.Fragment key={`w-${wi}`}>
            <div className="text-[8px] text-muted-foreground tabular-nums pr-0.5 self-center text-right">
              S{wi + 1}
            </div>
            {w.map((d, di) => {
              if (!d) return <div key={`${wi}-${di}`} className="h-7" />;
              const intensity = d.count / maxCount;

              const dotSize = d.count === 0
                ? 0
                : intensity < 0.34 ? 4
                : intensity < 0.67 ? 6
                : 8;
              const isToday = d.date === todayKey;
              const day = new Date(d.date).getDate();
              return (
                <ActionTooltip
                  key={`${wi}-${di}`}
                  label={`${new Date(d.date).toLocaleDateString("fr-CA", { weekday: "long", day: "2-digit", month: "short" })} — ${d.count} absent${d.count > 1 ? "s" : ""}`}
                >
                  <button
                    type="button"
                    onClick={() => onClickDay?.(d.date)}
                    className={`h-7 rounded-sm text-[10px] font-medium tabular-nums flex flex-col items-center justify-center gap-0.5 transition border ${
                      isToday
                        ? "ring-1 ring-[#0F2D52] border-[#0F2D52]/40 bg-[#0F2D52]/5 text-[#0F2D52] font-bold"
                        : d.count > 0
                          ? "border-[#0F2D52]/20 hover:bg-[#0F2D52]/10 text-foreground"
                          : "border-transparent hover:bg-slate-100 text-muted-foreground"
                    }`}
                  >
                    <span className="leading-none">{day}</span>
                    {dotSize > 0 && (
                      <span
                        className="rounded-full bg-[#0F2D52]"
                        style={{ width: dotSize, height: 3 }}
                        aria-hidden
                      />
                    )}
                  </button>
                </ActionTooltip>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2 justify-end text-[9px] text-muted-foreground">
        <span>{t("densite")}</span>
        <span className="flex items-center gap-1">
          <span className="rounded-full bg-[#0F2D52]" style={{ width: 4, height: 3 }} />faible
        </span>
        <span className="flex items-center gap-1">
          <span className="rounded-full bg-[#0F2D52]" style={{ width: 6, height: 3 }} />moy
        </span>
        <span className="flex items-center gap-1">
          <span className="rounded-full bg-[#0F2D52]" style={{ width: 8, height: 3 }} />haute
        </span>
      </div>
    </div>
  );
}

// ─── Tab 2 : A approuver (bulk + filtres) — palette assainie ──────
function ReviewTab({
  pendingReviews, pagination, onOpenDrill,
}: {
  pendingReviews: Request[];
  pagination?: PendingPagination;
  onOpenDrill: (id: number) => void;
}) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const router = useRouter();
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [filterType, setFilterType] = useState<string>("all");
  const [filterEmployee, setFilterEmployee] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [busyIds, setBusyIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const markBusy = (id: number, on: boolean) =>
    setBusyIds((p) => { const n = new Set(p); if (on) n.add(id); else n.delete(id); return n; });

  const employees = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of pendingReviews) {
      if (r.admin?.id != null) map.set(r.admin.id, r.admin.fullName || r.admin.email);
    }
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [pendingReviews]);

  const filtered = useMemo(() => {
    return pendingReviews.filter((r) => {
      if (filterType !== "all" && r.type !== filterType) return false;
      if (filterEmployee !== "all" && String(r.admin?.id ?? "") !== filterEmployee) return false;
      if (search) {
        const q = search.toLowerCase();
        const name = (r.admin?.fullName || r.admin?.email || "").toLowerCase();
        if (!name.includes(q)) return false;
      }
      return true;
    });
  }, [pendingReviews, filterType, filterEmployee, search]);

  const toggleSelect = (id: number) =>
    setSelectedIds((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const selectAll = () => setSelectedIds(new Set(filtered.map((r) => r.id)));
  const clearSelection = () => setSelectedIds(new Set());

  const bulk = async (decision: "approved" | "rejected") => {
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

      const baseMsg = `${res.data.processed} traitee${res.data.processed > 1 ? "s" : ""}${res.data.skipped > 0 ? ` · ${res.data.skipped} ignoree${res.data.skipped > 1 ? "s" : ""}` : ""}`;
      toast.success(baseMsg);
      if (res.data.errors && res.data.errors.length > 0) {
        const sample = res.data.errors.slice(0, 3).map((e) => `#${e.id}: ${e.reason}`).join(" — ");
        const more = res.data.errors.length > 3 ? ` (+${res.data.errors.length - 3} autres)` : "";
        toast.warning(`Detail erreurs : ${sample}${more}`, { duration: 6000 });
      }
      clearSelection();
      router.refresh();
    } else toast.error(res.error || t("erreur_lors_traitement"));
  };

  const reviewOne = async (id: number, decision: "approved" | "rejected") => {
    if (busyIds.has(id)) return;
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
    markBusy(id, true);
    const res = await reviewLeaveRequestAction({ id, decision, notes });
    markBusy(id, false);
    if (res.success) { toast.success(decision === "approved" ? t("approuvee") : t("refusee")); router.refresh(); }
    else toast.error(res.error || t("erreur_lors_traitement"));
  };

  return (
    <div className="space-y-3">

      <Card className="p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("rechercher_employe")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder={t("type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tous_types")}</SelectItem>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{t(v.labelKey)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder={t("employe")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tous_employes")}</SelectItem>
              {employees.map(([id, name]) => (
                <SelectItem key={id} value={String(id)}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </Card>

      {filtered.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-3">
            <CheckCircle2 className="h-6 w-6 text-emerald-700" />
          </div>
          <p className="text-sm font-medium">{t("aucune_demande_attente")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pendingReviews.length > 0 ? t("aucune_demande_ne_correspond_filtres") : t("toutes_demandes_ont_ete_traitees")}
          </p>
        </Card>
      ) : (
        <>
          {/* Barre bulk sticky — sous le mini-header + tabs sticky.
              Mobile : top-[176px] (108 + ~68 mini-header tabs). Desktop : top-[140px]. */}
          {selectedIds.size > 0 && (
            <Card className="p-3 sticky top-[176px] lg:top-[140px] z-10 bg-[#0F2D52] text-white border-0 flex items-center justify-between gap-2 shadow-md flex-wrap">
              <span className="text-sm font-medium">
                {selectedIds.size} selectionnee{selectedIds.size > 1 ? "s" : ""}
                {selectedIds.size < filtered.length && (
                  <button onClick={selectAll} className="ml-2 text-xs underline opacity-80 hover:opacity-100">
                    Tout selectionner ({filtered.length})
                  </button>
                )}
              </span>
              <div className="flex gap-2 flex-wrap">
                <Button size="sm" variant="outline" disabled={bulkBusy} className="h-8 text-xs bg-white/10 hover:bg-white/20 text-white border-white/30" onClick={clearSelection}>
                  {t("deselectionner")}
                </Button>
                <Button size="sm" variant="outline" disabled={bulkBusy} className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90" onClick={() => bulk("approved")}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />{bulkBusy ? "..." : t("approuver_selection")}
                </Button>
                <Button size="sm" variant="outline" disabled={bulkBusy} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0" onClick={() => bulk("rejected")}>
                  <XCircle className="h-3 w-3 mr-1" />{bulkBusy ? "..." : t("refuser_selection")}
                </Button>
              </div>
            </Card>
          )}

          {selectedIds.size === 0 && filtered.length > 1 && (
            <div className="flex justify-end">
              <button onClick={selectAll} className="text-xs text-[#0F2D52] hover:underline">
                Tout selectionner ({filtered.length})
              </button>
            </div>
          )}

          <div className="space-y-2">
            {filtered.map((r) => (
              <PendingRow
                key={r.id}
                request={r}
                selected={selectedIds.has(r.id)}
                onToggleSelect={() => toggleSelect(r.id)}
                onReview={(d) => reviewOne(r.id, d)}
                busy={busyIds.has(r.id)}
                onOpenDrill={() => r.admin?.id && onOpenDrill(r.admin.id)}
              />
            ))}
          </div>


          {pagination && pagination.pages > 1 && (
            <Card className="p-3 flex items-center justify-between gap-2 flex-wrap">
              <span className="text-xs text-muted-foreground tabular-nums">
                Affichage {(pagination.page - 1) * pagination.pageSize + 1}–{Math.min(pagination.page * pagination.pageSize, pagination.total)} sur {pagination.total} demandes en attente
              </span>
              <div className="flex gap-1">
                {pagination.page > 1 ? (
                  <Link
                    href={`/admin/employes/conges?page=${pagination.page - 1}`}
                    className="inline-flex items-center h-7 px-2 text-xs border rounded hover:bg-muted/30"
                  >
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />Precedent
                  </Link>
                ) : (
                  <span className="inline-flex items-center h-7 px-2 text-xs border rounded text-muted-foreground opacity-50">
                    <ChevronLeft className="h-3.5 w-3.5 mr-1" />Precedent
                  </span>
                )}
                <span className="inline-flex items-center px-2 py-1 text-xs tabular-nums">
                  Page {pagination.page} / {pagination.pages}
                </span>
                {pagination.page < pagination.pages ? (
                  <Link
                    href={`/admin/employes/conges?page=${pagination.page + 1}`}
                    className="inline-flex items-center h-7 px-2 text-xs border rounded hover:bg-muted/30"
                  >
                    {tc("next")}<ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center h-7 px-2 text-xs border rounded text-muted-foreground opacity-50">
                    {tc("next")}<ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </span>
                )}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function PendingRow({
  request, selected, onToggleSelect, onReview, busy, onOpenDrill,
}: {
  request: Request;
  selected: boolean;
  onToggleSelect: () => void;
  onReview: (decision: "approved" | "rejected") => void;
  busy?: boolean;
  onOpenDrill?: () => void;
}) {
  const t = useTranslations("admin.leaves");
  const meta = typeMeta(request.type);
  const Icon = meta.icon;
  const halfLabel = request.halfDay === "AM" ? t("1_2_matin") : request.halfDay === "PM" ? t("1_2_apres_midi") : null;
  const team = request.admin?.team;
  const sameDay = request.startDate.slice(0, 10) === request.endDate.slice(0, 10);

  return (
    <Card className="p-3 sm:p-4 hover:ring-1 hover:ring-[#0F2D52]/20 transition">
      <div className="flex items-start gap-3">
        <ActionTooltip label={selected ? t("deselectionner") : t("selectionner_bulk_action")}>
          <div className="pt-1.5">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label={t("selectionner")} />
          </div>
        </ActionTooltip>
        <div className="h-10 w-10 rounded-lg flex items-center justify-center shrink-0 bg-[#0F2D52]/10 text-[#0F2D52]">
          <Icon className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onOpenDrill}
              className="text-sm font-semibold text-[#0F2D52] hover:underline"
            >
              {request.admin?.fullName || request.admin?.email}
            </button>
            <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-200">
              <span className="h-1.5 w-1.5 rounded-sm" style={{ background: meta.barDark }} />
              {t(meta.labelKey)}
            </span>
            {team && (
              <span
                className="text-[10px] px-1.5 py-0.5 rounded border"
                style={team.color
                  ? { backgroundColor: `${team.color}15`, color: team.color, borderColor: `${team.color}40` }
                  : { backgroundColor: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" }}
              >
                {team.name}
              </span>
            )}
            {halfLabel && <Badge variant="outline" className="text-[10px]">{halfLabel}</Badge>}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {sameDay
              ? <>{t("le")} <strong className="text-foreground">{fmtDateLong(request.startDate)}</strong></>
              : <>{t("du")} <strong className="text-foreground">{fmtDate(request.startDate)}</strong> au <strong className="text-foreground">{fmtDate(request.endDate)}</strong></>
            }
            {" · "}
            <strong className="tabular-nums text-foreground">{Number(request.daysCount)}</strong> jour{Number(request.daysCount) > 1 ? "s" : ""}
          </p>
          {request.reason && <p className="text-xs italic text-muted-foreground mt-1">« {request.reason} »</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <ActionTooltip label={t("voir_details_employe")}>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 w-7 p-0"
              onClick={onOpenDrill}
            >
              <Eye className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </ActionTooltip>
          <Button
            size="sm"
            disabled={busy}
            className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            onClick={() => onReview("approved")}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />{busy ? "..." : t("approuver_action")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
            onClick={() => onReview("rejected")}
          >
            <XCircle className="h-3 w-3 mr-1" />{busy ? "..." : t("refuser")}
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Tab 3 : Calendrier equipe PRO avec actions inline ────────────
function CalendarTab({
  leaves, employees, nowIso, onClickLeave, onClickEmptyCell,
}: {
  leaves: UpcomingLeave[];
  employees: EmployeeRow[];
  nowIso: string;
  onClickLeave: (leave: UpcomingLeave) => void;
  onClickEmptyCell: (empId: number, dateIso: string) => void;
}) {
  const t = useTranslations("admin.leaves");
  const today = useMemo(() => { const d = new Date(nowIso); d.setHours(0, 0, 0, 0); return d; }, [nowIso]);
  const [offset, setOffset] = useState(0); // jours d'offset
  const [filterType, setFilterType] = useState<string>("all");
  const [filterTeam, setFilterTeam] = useState<string>("all");
  const [filterEmp, setFilterEmp] = useState<string>("all");

  const startDate = useMemo(() => {
    const d = new Date(today); d.setDate(d.getDate() + offset);
    return d;
  }, [today, offset]);

  const days = useMemo(() => {
    const out: Date[] = [];
    for (let i = 0; i < 28; i++) {
      const d = new Date(startDate); d.setDate(d.getDate() + i);
      out.push(d);
    }
    return out;
  }, [startDate]);

  const teams = useMemo(() => {
    const map = new Map<number, { id: number; name: string; color: string | null }>();
    for (const e of employees) if (e.team && !map.has(e.team.id)) map.set(e.team.id, e.team);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);


  const visibleEmployees = useMemo(() => {
    return employees.filter((e) => {
      if (filterTeam !== "all") {
        const id = filterTeam === "none" ? null : Number(filterTeam);
        if ((e.team?.id ?? null) !== id) return false;
      }
      if (filterEmp !== "all" && String(e.id) !== filterEmp) return false;
      return true;
    }).sort((a, b) => (a.fullName || a.email).localeCompare(b.fullName || b.email));
  }, [employees, filterTeam, filterEmp]);

  const filteredLeaves = useMemo(() => {
    return leaves.filter((l) => {
      if (filterType !== "all" && l.type !== filterType) return false;
      if (l.admin?.id && !visibleEmployees.some((e) => e.id === l.admin?.id)) return false;
      return true;
    });
  }, [leaves, filterType, visibleEmployees]);


  const leavesByEmp = useMemo(() => {
    const m = new Map<number, UpcomingLeave[]>();
    for (const l of filteredLeaves) {
      if (!l.admin?.id) continue;
      if (!m.has(l.admin.id)) m.set(l.admin.id, []);
      m.get(l.admin.id)!.push(l);
    }
    return m;
  }, [filteredLeaves]);


  const dayCounts = useMemo(() => {
    return days.map((d) => {
      const set = new Set<number>();
      for (const l of filteredLeaves) {
        if (!l.admin?.id) continue;
        const ls = new Date(l.startDate.slice(0, 10)).getTime();
        const le = new Date(l.endDate.slice(0, 10)).getTime();
        if (d.getTime() >= ls && d.getTime() <= le) set.add(l.admin.id);
      }
      return set.size;
    });
  }, [days, filteredLeaves]);

  const periodLabel = `${startDate.toLocaleDateString("fr-CA", { day: "2-digit", month: "short" })} → ${days[days.length - 1].toLocaleDateString("fr-CA", { day: "2-digit", month: "short", year: "numeric" })}`;

  return (
    <div className="space-y-3">

      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <ActionTooltip label={t("2_semaines_avant")}>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setOffset((o) => Math.max(-180, o - 14))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </ActionTooltip>
            <Button variant={offset === 0 ? "default" : "outline"} size="sm" className={`h-8 text-xs ${offset === 0 ? "bg-[#0F2D52] hover:bg-[#1a3a66]" : ""}`} onClick={() => setOffset(0)}>
              {t("aujourd_apos_hui")}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOffset((o) => o + 7)}>
              {t("1_sem")}
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOffset((o) => o + 30)}>
              {t("1_mois")}
            </Button>
            <ActionTooltip label={t("2_semaines_apres")}>
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setOffset((o) => Math.min(365, o + 14))}>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </ActionTooltip>
            <span className="text-xs text-muted-foreground ml-2 hidden md:inline tabular-nums">
              {periodLabel}
            </span>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder={t("type")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tous_types")}</SelectItem>
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{t(v.labelKey)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder={t("equipe")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toutes_equipes")}</SelectItem>
                <SelectItem value="none">{t("sans_equipe")}</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEmp} onValueChange={setFilterEmp}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder={t("employe")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("tous_employes")}</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>


      {visibleEmployees.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium">{t("aucun_employe_filtre")}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {t("ajustez_filtres_voir_employes")}
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `220px repeat(28, minmax(28px, 1fr))`, minWidth: 1100 }}>

            <div className="px-3 py-2 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground bg-[#0F2D52]/5 border-b border-r sticky left-0 z-20">
              Employe ({visibleEmployees.length})
            </div>
            {days.map((d, i) => {
              const isWeekend = d.getDay() === 0 || d.getDay() === 6;
              const isToday = d.getTime() === today.getTime();
              const isMonday = d.getDay() === 1;
              const count = dayCounts[i];
              const highRatio = visibleEmployees.length > 0 && count / visibleEmployees.length > 0.3;
              const dayLetter = ["D", "L", "M", "M", "J", "V", "S"][d.getDay()];

              let headerBg = "bg-muted/30";
              if (isWeekend) headerBg = "bg-slate-100 text-slate-500";
              return (
                <ActionTooltip key={i} label={`${d.toLocaleDateString("fr-CA", { weekday: "long", day: "2-digit", month: "short" })} — ${count} absent${count > 1 ? "s" : ""}`}>
                  <div className={`px-0.5 py-1.5 text-center border-b border-r ${headerBg} ${isToday ? "ring-1 ring-[#0F2D52] ring-inset" : ""} ${isMonday && !isToday ? "border-l-2 border-l-[#0F2D52]/30" : ""}`}>
                    <div className={`text-[10px] tabular-nums font-semibold ${isToday ? "text-[#0F2D52]" : ""}`}>{d.getDate()}</div>
                    <div className="text-[8px] uppercase tracking-wider opacity-70 leading-none">{dayLetter}</div>
                    {count > 0 && (
                      <div className={`text-[8px] font-bold mt-0.5 leading-none ${highRatio ? "text-red-700" : "text-[#0F2D52]"}`}>
                        {count}
                      </div>
                    )}
                  </div>
                </ActionTooltip>
              );
            })}


            {visibleEmployees.map((emp) => (
              <GanttRow
                key={emp.id}
                emp={emp}
                leaves={leavesByEmp.get(emp.id) ?? []}
                days={days}
                today={today}
                onClickLeave={onClickLeave}
                onClickEmptyCell={onClickEmptyCell}
              />
            ))}
          </div>
        </Card>
      )}


      <div className="flex items-center justify-between flex-wrap gap-3 text-[10px] text-muted-foreground px-1">
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
          {Object.entries(TYPE_META).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm border" style={{ backgroundColor: v.bar, borderColor: v.barDark }} />
              {t(v.labelKey)}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
            {t("weekend")}
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm ring-2 ring-[#0F2D52] bg-white" />
            {t("aujourd_apos_hui")}
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          {t("cliquez_cellule_vide_creer_conge")}
        </p>
      </div>
    </div>
  );
}

function GanttRow({
  emp, leaves, days, today, onClickLeave, onClickEmptyCell,
}: {
  emp: EmployeeRow;
  leaves: UpcomingLeave[];
  days: Date[];
  today: Date;
  onClickLeave: (leave: UpcomingLeave) => void;
  onClickEmptyCell: (empId: number, dateIso: string) => void;
}) {
  const t = useTranslations("admin.leaves");
  return (
    <>
      <div className="px-3 py-2 text-xs border-r border-b bg-background sticky left-0 z-10 truncate flex items-center gap-2">
        <div className="h-6 w-6 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center text-[9px] font-bold shrink-0">
          {(emp.fullName || emp.email).slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium leading-tight">{emp.fullName || emp.email}</p>
          {emp.team && (
            <p className="text-[9px] truncate text-muted-foreground leading-tight" style={emp.team.color ? { color: emp.team.color } : undefined}>
              {emp.team.name}
            </p>
          )}
        </div>
      </div>
      {days.map((d, i) => {
        const dIso = isoDay(d);
        const leaveOnDay = leaves.find((l) => {
          const ls = l.startDate.slice(0, 10);
          const le = l.endDate.slice(0, 10);
          return dIso >= ls && dIso <= le;
        });
        const isWeekend = d.getDay() === 0 || d.getDay() === 6;
        const isToday = d.getTime() === today.getTime();
        const isMonday = d.getDay() === 1;
        const meta = leaveOnDay ? typeMeta(leaveOnDay.type) : null;


        const isStart = leaveOnDay && dIso === leaveOnDay.startDate.slice(0, 10);

        const tooltipLabel = leaveOnDay && meta
          ? `${t(meta.labelKey)} : ${fmtDate(leaveOnDay.startDate)} → ${fmtDate(leaveOnDay.endDate)}${leaveOnDay.halfDay ? ` (½ ${leaveOnDay.halfDay})` : ""} — Cliquer pour détails`
          : `Cliquer pour créer un congé le ${d.toLocaleDateString("fr-CA", { weekday: "long", day: "2-digit", month: "short" })}`;


        let cellStyle: React.CSSProperties = {};
        let cellBg = "";
        if (!leaveOnDay && isWeekend) cellBg = "bg-slate-100";
        if (leaveOnDay && meta) {
          cellStyle = {
            backgroundColor: meta.bar,
            borderLeftWidth: isStart ? "2px" : "0",
            borderLeftColor: meta.barDark,
          };
        }

        const ringCls = isToday
          ? leaveOnDay
            ? "ring-2 ring-amber-400 ring-inset"
            : "ring-2 ring-[#0F2D52] ring-inset"
          : "";

        return (
          <ActionTooltip key={i} label={tooltipLabel}>
            <div
              className={`relative h-9 border-b border-r ${cellBg} ${ringCls} ${isMonday && !isToday ? "border-l-2 border-l-[#0F2D52]/30" : ""} ${leaveOnDay ? "cursor-pointer hover:brightness-95" : "cursor-cell hover:bg-[#0F2D52]/5"} transition`}
              style={cellStyle}
              onClick={() => {
                if (leaveOnDay) onClickLeave(leaveOnDay);
                else onClickEmptyCell(emp.id, dIso);
              }}
            />
          </ActionTooltip>
        );
      })}
    </>
  );
}

// ─── Tab 4 : Par employe — tableau pro avec actions ──────────────
function ByEmployeeTab({
  employees, onOpenDrill, onCreateForEmp,
}: {
  employees: EmployeeRow[];
  onOpenDrill: (id: number) => void;
  onCreateForEmp: (emp: EmployeeRow) => void;
}) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "remaining" | "taken" | "pending">("name");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [filterPending, setFilterPending] = useState(false);
  const [filterLowBalance, setFilterLowBalance] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 25;

  const teams = useMemo(() => {
    const map = new Map<number, { id: number; name: string; color: string | null }>();
    for (const e of employees) if (e.team && !map.has(e.team.id)) map.set(e.team.id, e.team);
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [employees]);

  const filtered = useMemo(() => {
    let arr = employees.slice();
    if (search) {
      const q = search.toLowerCase();
      arr = arr.filter((e) => (e.fullName || e.email).toLowerCase().includes(q) || (e.team?.name || "").toLowerCase().includes(q));
    }
    if (teamFilter !== "all") {
      const id = teamFilter === "none" ? null : Number(teamFilter);
      arr = arr.filter((e) => (e.team?.id ?? null) === id);
    }
    if (filterPending) arr = arr.filter((e) => e.pendingRequestsCount > 0);
    if (filterLowBalance) arr = arr.filter((e) => e.vacationDaysRemaining < 2);
    arr.sort((a, b) => {
      if (sortBy === "name") return (a.fullName || a.email).localeCompare(b.fullName || b.email);
      if (sortBy === "remaining") return b.vacationDaysRemaining - a.vacationDaysRemaining;
      if (sortBy === "taken") return b.vacationDaysTaken - a.vacationDaysTaken;
      if (sortBy === "pending") return b.pendingRequestsCount - a.pendingRequestsCount;
      return 0;
    });
    return arr;
  }, [employees, search, teamFilter, sortBy, filterPending, filterLowBalance]);


  useEffect(() => { setPage(1); }, [search, teamFilter, sortBy, filterPending, filterLowBalance]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={t("rechercher")} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" />
        </div>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder={t("equipe")} /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("toutes_equipes")}</SelectItem>
            <SelectItem value="none">{t("sans_equipe")}</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">{t("trier_nom")}</SelectItem>
            <SelectItem value="remaining">{t("solde_restant")}</SelectItem>
            <SelectItem value="taken">{t("jours_pris")}</SelectItem>
            <SelectItem value="pending">{t("demandes_attente")}</SelectItem>
          </SelectContent>
        </Select>
        <Label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <Checkbox checked={filterPending} onCheckedChange={(v) => setFilterPending(!!v)} />
          {t("demandes_attente_2")}
        </Label>
        <Label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <Checkbox checked={filterLowBalance} onCheckedChange={(v) => setFilterLowBalance(!!v)} />
          {t("solde_lt_2j")}
        </Label>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0F2D52]/5 text-[10px] uppercase tracking-wider text-[#0F2D52]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">{t("employe")}</th>
              <th className="px-3 py-2 text-left font-semibold hidden sm:table-cell">{t("equipe")}</th>
              <th className="px-3 py-2 text-right font-semibold">{t("solde_dispo")}</th>
              <th className="px-3 py-2 text-right font-semibold hidden md:table-cell">{t("pris")}</th>
              <th className="px-3 py-2 text-right font-semibold hidden md:table-cell">{t("planifies")}</th>
              <th className="px-3 py-2 text-center font-semibold">{t("attente")}</th>
              <th className="px-3 py-2 text-left font-semibold hidden lg:table-cell">{t("derniere_demande")}</th>
              <th className="px-3 py-2 text-right font-semibold">{tc("actions")}</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center">
                  <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Users className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">{t("aucun_employe")}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{t("ajustez_filtres_videz_recherche")}</p>
                </td>
              </tr>
            ) : (
              paged.map((emp) => (
                <tr
                  key={emp.id}
                  className="hover:bg-[#0F2D52]/5 cursor-pointer transition"
                  onClick={() => onOpenDrill(emp.id)}
                >
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <div className="h-7 w-7 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center text-[10px] font-bold shrink-0">
                        {(emp.fullName || emp.email).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium truncate">{emp.fullName || emp.email}</p>
                        {emp.title && <p className="text-[10px] text-muted-foreground truncate">{emp.title}</p>}
                      </div>
                      {emp.isAbsentToday && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-[#0F2D52]/10 text-[#0F2D52] font-semibold">ABS</span>
                      )}
                    </div>
                  </td>
                  <td className="px-3 py-2 hidden sm:table-cell">
                    {emp.team ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded border"
                        style={emp.team.color
                          ? { backgroundColor: `${emp.team.color}15`, color: emp.team.color, borderColor: `${emp.team.color}40` }
                          : { backgroundColor: "#f1f5f9", color: "#64748b", borderColor: "#e2e8f0" }}
                      >
                        {emp.team.name}
                      </span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums">
                    <span className={`font-bold ${emp.vacationDaysRemaining < 2 ? "text-red-700" : emp.vacationDaysRemaining < 5 ? "text-amber-700" : "text-emerald-700"}`}>
                      {emp.vacationDaysRemaining}
                    </span>
                    <span className="text-muted-foreground text-[10px] ml-0.5">j</span>
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground hidden md:table-cell">
                    {emp.vacationDaysTaken}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs text-muted-foreground hidden md:table-cell">
                    {emp.vacationDaysPlanned}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {emp.pendingRequestsCount > 0 ? (
                      <span className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-semibold tabular-nums">{emp.pendingRequestsCount}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-3 py-2 hidden lg:table-cell">
                    {emp.lastRequest ? (
                      <div className="text-[11px]">
                        <span className={`inline-block text-[9px] px-1 py-0.5 rounded ${STATUS_META[emp.lastRequest.status]?.cls ?? ""}`}>
                          {STATUS_META[emp.lastRequest.status] ? t(STATUS_META[emp.lastRequest.status].labelKey) : emp.lastRequest.status}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          {t(typeMeta(emp.lastRequest.type).labelKey)} · {fmtDate(emp.lastRequest.startDate)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">{t("aucune")}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <ActionTooltip label={t("voir_details")}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onOpenDrill(emp.id)}
                        >
                          <Eye className="h-3.5 w-3.5 text-[#0F2D52]" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label={t("creer_demande_cet_employe")}>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onCreateForEmp(emp)}
                        >
                          <Plus className="h-3.5 w-3.5 text-[#0F2D52]" />
                        </Button>
                      </ActionTooltip>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {totalPages > 1 && (
          <div className="flex items-center justify-between px-3 py-2 border-t bg-muted/20 text-xs">
            <span className="text-muted-foreground tabular-nums">
              {(page - 1) * pageSize + 1}–{Math.min(page * pageSize, filtered.length)} sur {filtered.length}
            </span>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <span className="px-2 py-1 tabular-nums">{page} / {totalPages}</span>
              <Button variant="outline" size="sm" className="h-7 text-xs" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}

// ─── Tab 5 : Analytics PRO avec recharts ─────────────────────────
function AnalyticsTab({
  absencesByType, employees, kpis, trailing12Months, prevMonthRate,
  teamStats, next8WeeksForecast,
}: {
  absencesByType: Array<{ type: string; daysCount: number; requestsCount: number }>;
  employees: EmployeeRow[];
  kpis: KPIs;
  trailing12Months: MonthStat[];
  prevMonthRate: number;
  teamStats: TeamStat[];
  next8WeeksForecast: ForecastWeek[];
}) {
  const t = useTranslations("admin.leaves");
  const totalDays = absencesByType.reduce((s, t) => s + t.daysCount, 0);
  const topRemaining = employees.slice().sort((a, b) => b.vacationDaysRemaining - a.vacationDaysRemaining).slice(0, 5);
  const lowRemaining = employees.slice().filter((e) => e.vacationDaysRemaining > 0).sort((a, b) => a.vacationDaysRemaining - b.vacationDaysRemaining).slice(0, 5);
  const maxRemaining = Math.max(1, ...topRemaining.map((e) => e.vacationDaysRemaining), ...lowRemaining.map((e) => e.vacationDaysRemaining));

  const rateDelta = +(kpis.absenteeismRate - prevMonthRate).toFixed(1);


  const donutPalette = ["#0F2D52", "#3b6fb0", "#7ea0c4", "#bcd2eb", "#d97706", "#dc2626"];
  const donutData = absencesByType
    .filter((row) => row.daysCount > 0)
    .sort((a, b) => b.daysCount - a.daysCount)
    .map((row, i) => ({ name: t(typeMeta(row.type).labelKey), value: row.daysCount, fill: donutPalette[i % donutPalette.length] }));

  return (
    <div className="space-y-3 min-w-0">

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ExecKpi
          icon={TrendingUp}
          label={t("taux_absent_mois")}
          value={`${kpis.absenteeismRate}%`}
          tone={kpis.absenteeismRate > 10 ? "danger" : kpis.absenteeismRate > 5 ? "warning" : "neutral"}
          sub={`Mois precedent : ${prevMonthRate}%`}
          deltaDir={rateDelta > 0 ? "up" : rateDelta < 0 ? "down" : "flat"}
        />
        <ExecKpi
          icon={CalendarDays}
          label={t("jours_pris_annee")}
          value={totalDays}
          tone="neutral"
          sub={`${absencesByType.reduce((s, t) => s + t.requestsCount, 0)} demandes`}
        />
        <ExecKpi
          icon={Sun}
          label={t("solde_total")}
          value={kpis.totalRemainingDays.toFixed(1)}
          tone="neutral"
          sub={t("jours_dispo_equipe")}
        />
        <ExecKpi
          icon={AlertTriangle}
          label={t("conflits_mois")}
          value={kpis.conflictDays}
          tone={kpis.conflictDays > 0 ? "danger" : "neutral"}
          sub={t("jours_30_absent")}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-3 min-w-0">

        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <TrendingUp className="h-4 w-4" />{t("leaves_admin_view_taux_d_absenteisme_12_mois_glissants")}</h3>
          {trailing12Months.length === 0 || trailing12Months.every((m) => m.rate === 0) ? (
            <EmptyChart text={t("aucune_donnee_suffisante")} />
          ) : (
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trailing12Months} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} unit="%" />
                  <RTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }}
                    formatter={(v) => [`${v}%`, t("taux")] as [string, string]}
                  />
                  <Line type="monotone" dataKey="rate" stroke={NAVY} strokeWidth={2} dot={{ fill: NAVY, r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>


        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <BarChart3 className="h-4 w-4" />{t("leaves_admin_view_repartition_par_type_annee")}</h3>
          {donutData.length === 0 ? (
            <EmptyChart text={t("aucune_absence_approuvee_annee")} />
          ) : (
            <div className="h-56 flex items-center gap-4 min-w-0">
              <div className="flex-1 h-full min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      innerRadius={45}
                      outerRadius={75}
                      paddingAngle={2}
                    >
                      {donutData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <RTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} formatter={(v) => [`${v}j`, ""] as [string, string]} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="text-[11px] space-y-1 shrink-0 max-w-[40%]">
                {donutData.map((d) => (
                  <li key={d.name} className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-sm shrink-0" style={{ background: d.fill }} />
                    <span className="truncate">{d.name}</span>
                    <span className="ml-auto tabular-nums font-medium text-muted-foreground">{d.value}j</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </Card>


        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <Users className="h-4 w-4" />{t("leaves_admin_view_jours_pris_par_equipe_12_mois")}</h3>
          {teamStats.length === 0 ? (
            <EmptyChart text={t("aucune_equipe_absences")} />
          ) : (
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={teamStats.slice(0, 5)} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} interval={0} angle={-12} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                  <RTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v, _n, item) => {
                      const emp = (item as unknown as { payload?: { employees?: number } } | undefined)?.payload?.employees ?? 0;
                      return [`${v}j (${emp} emp.)`, t("jours_pris")] as [string, string];
                    }}
                  />
                  <Bar dataKey="days" fill={NAVY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>


        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <CalendarRange className="h-4 w-4" />Prevision 8 prochaines semaines
          </h3>
          {next8WeeksForecast.every((w) => w.absents === 0) ? (
            <EmptyChart text={t("aucune_absence_planifiee")} />
          ) : (
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={next8WeeksForecast} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} allowDecimals={false} />
                  <RTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v, n) => [v, n === "absents" ? t("absents") : t("jours")] as [string | number, string]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="absents" stroke={NAVY} strokeWidth={2} dot={{ fill: NAVY, r: 3 }} name="Employes absents" />
                  <Line type="monotone" dataKey="days" stroke="#d97706" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: "#d97706", r: 3 }} name={t("jours_personne")} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>


        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <Sun className="h-4 w-4" />{t("leaves_admin_view_top_5_plus_de_jours_disponibles")}</h3>
          {topRemaining.length === 0 ? (
            <EmptyChart text={t("aucune_donnee")} />
          ) : (
            <ul className="space-y-2">
              {topRemaining.map((emp) => (
                <li key={emp.id} className="text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="truncate font-medium">{emp.fullName || emp.email}</span>
                    <strong className="tabular-nums text-emerald-700 ml-2">{emp.vacationDaysRemaining}j</strong>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                    <div className="h-full bg-emerald-600" style={{ width: `${(emp.vacationDaysRemaining / maxRemaining) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>


        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <AlertTriangle className="h-4 w-4 text-amber-600" />{t("leaves_admin_view_top_5_solde_le_plus_bas")}</h3>
          {lowRemaining.length === 0 ? (
            <EmptyChart text={t("aucune_donnee")} />
          ) : (
            <ul className="space-y-2">
              {lowRemaining.map((emp) => (
                <li key={emp.id} className="text-xs">
                  <div className="flex items-center justify-between mb-0.5">
                    <span className="truncate font-medium">{emp.fullName || emp.email}</span>
                    <strong className={`tabular-nums ml-2 ${emp.vacationDaysRemaining < 2 ? "text-red-700" : "text-amber-700"}`}>
                      {emp.vacationDaysRemaining}j
                    </strong>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded overflow-hidden">
                    <div className={`h-full ${emp.vacationDaysRemaining < 2 ? "bg-red-600" : "bg-amber-500"}`} style={{ width: `${(emp.vacationDaysRemaining / maxRemaining) * 100}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function EmptyChart({ text }: { text: string }) {
  return (
    <div className="h-56 flex flex-col items-center justify-center text-center gap-2">
      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center">
        <BarChart3 className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-xs text-muted-foreground">{text}</p>
    </div>
  );
}

// ─── Modal "Fermeture entreprise" (vacances obligatoires) ───────
function MandatoryClosureDialog({
  employees, onClose, onDone,
}: {
  employees: EmployeeRow[];
  onClose: () => void;
  onDone: () => void;
}) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState(t("fermeture_annuelle_fetes"));
  const [type, setType] = useState<"vacation" | "unpaid" | "other">("other");
  const [excludedIds, setExcludedIds] = useState<Set<number>>(new Set());
  const [pending, setPending] = useState(false);
  const [search, setSearch] = useState("");

  const filteredEmployees = useMemo(() => {
    if (!search) return employees;
    const q = search.toLowerCase();
    return employees.filter((e) =>
      (e.fullName || e.email).toLowerCase().includes(q)
      || (e.team?.name || "").toLowerCase().includes(q),
    );
  }, [employees, search]);

  const toggleExclude = (id: number) =>
    setExcludedIds((p) => {
      const n = new Set(p);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const targetCount = employees.length - excludedIds.size;

  const submit = async () => {
    if (!startDate || !endDate || !reason.trim()) {
      toast.error(t("date_debut_date_fin_raison"));
      return;
    }
    setPending(true);
    const r = await createMandatoryClosureAction({
      startDate,
      endDate,
      type,
      reason: reason.trim(),
      excludedAdminIds: Array.from(excludedIds),
    });
    setPending(false);
    if (r.success) {
      toast.success(`${r.data.created} conge${r.data.created > 1 ? "s" : ""} cree${r.data.created > 1 ? "s" : ""}${r.data.skipped > 0 ? ` · ${r.data.skipped} ignore${r.data.skipped > 1 ? "s" : ""} (conflits)` : ""}`);
      if (r.data.conflicts.length > 0) {
        toast.warning(`Conflits : ${r.data.conflicts.slice(0, 3).map((c) => c.reason).join(" · ")}${r.data.conflicts.length > 3 ? "..." : ""}`);
      }
      onDone();
    } else {
      toast.error(r.error);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Building2 className="h-4 w-4" />{t("leaves_admin_view_fermeture_obligatoire_d_entreprise")}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("cree_conge_approuve_tous_employes")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <FormSection icon={CalendarRange} title={t("periode")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("du")} required>
                <DatePopover value={startDate} onChange={setStartDate} />
              </Field>
              <Field label={t("au")} required>
                <DatePopover value={endDate} onChange={setEndDate} min={startDate} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={ClipboardList} title={t("type_raison")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("type")}>
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="other">{t("autre_non_deduit_solde")}</SelectItem>
                    <SelectItem value="vacation">{t("vacances_deduit_solde")}</SelectItem>
                    <SelectItem value="unpaid">{t("sans_solde")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label={t("raison_visible_employes")} required>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder={t("fermeture_annuelle_fetes")} maxLength={300} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={Users} title={`Employes vises (${targetCount}/${employees.length})`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder={t("rechercher_exempter")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-8 text-xs"
                />
                {excludedIds.size > 0 && (
                  <button
                    type="button"
                    onClick={() => setExcludedIds(new Set())}
                    className="text-[11px] text-[#0F2D52] hover:underline shrink-0"
                  >
                    Reset ({excludedIds.size})
                  </button>
                )}
              </div>
              <div className="max-h-48 overflow-y-auto border rounded">
                <ul className="divide-y">
                  {filteredEmployees.map((emp) => {
                    const excluded = excludedIds.has(emp.id);
                    return (
                      <li key={emp.id} className="px-3 py-1.5 flex items-center gap-2 hover:bg-muted/30">
                        <Checkbox
                          checked={!excluded}
                          onCheckedChange={() => toggleExclude(emp.id)}
                        />
                        <span className={`text-xs flex-1 ${excluded ? "line-through text-muted-foreground" : ""}`}>
                          {emp.fullName || emp.email}
                          {emp.team && <span className="text-[10px] text-muted-foreground ml-2">{emp.team.name}</span>}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </div>
              <p className="text-[10px] text-muted-foreground">
                {t("decochez_employes_essentiels_doivent_rester")}
              </p>
            </div>
          </FormSection>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
            <strong>{t("attention")}</strong> {t("cree_immediatement_conges_approuves")} <strong>{targetCount}</strong> employe{targetCount > 1 ? "s" : ""}. Les conflits existants (autres demandes sur la meme periode) seront ignores.
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending || targetCount === 0} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            <Building2 className="h-4 w-4 mr-1.5" />{pending ? t("creation") : `Creer pour ${targetCount} employe${targetCount > 1 ? "s" : ""}`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── TÂCHE 14.2 : Modal de revision des appels d'une fenetre allocated ─────
type AppealItem = {
  preferenceId: number;
  adminId: number;
  employee: { id: number; fullName: string | null; email: string; avatarUrl?: string | null } | null;
  rank: number;
  startDate: string;
  endDate: string;
  daysCount: number;
  preferenceStatus: string;
  appealStatus: string | null;
  appealReason: string | null;
  appealedAt: string | null;
  appealReviewedAt: string | null;
  appealReviewNotes: string | null;
  appealReviewer: { id: number; fullName: string | null; email: string } | null;
};

function WindowAppealsDialog({
  window: w,
  onClose,
  onChanged,
}: {
  window: ActiveWindow;
  onClose: () => void;
  onChanged: () => void;
}) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<AppealItem | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/vacation-windows/${w.id}/appeals?status=${filter}`)
      .then((r) => (r.ok ? r.json() : { appeals: [] }))
      .then((d) => setAppeals(d.appeals ?? []))
      .catch(() => toast.error(t("impossible_charger_appels")))
      .finally(() => setLoading(false));
  }, [w.id, filter]);

  useEffect(() => { load(); }, [load]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Megaphone className="h-4 w-4" />Appels d&apos;attribution — {w.name}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("examiner_appels_soumis_employes_fenetre")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filter} onValueChange={(v) => setFilter(v as "pending" | "all")}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t("attente_uniquement")}</SelectItem>
                <SelectItem value="all">{t("tous_appels")}</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground ml-auto">
              {appeals.length} appel{appeals.length > 1 ? "s" : ""}
            </span>
          </div>
          {loading ? (
            <InlineLoader label={t("chargement_appels")} />
          ) : appeals.length === 0 ? (
            <div className="rounded-md border bg-muted/10 p-6 text-center">
              <Megaphone className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">{filter === "pending" ? t("aucun_appel_attente") : t("aucun_appel")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {filter === "pending"
                  ? t("aucun_employe_n_soumis_appel")
                  : t("fenetre_n_recu_aucun_appel")}
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-md border bg-background">
              {appeals.map((a) => {
                const statusMeta: Record<string, { label: string; cls: string }> = {
                  pending: { label: t("attente"), cls: "bg-amber-50 text-amber-800 border-amber-200" },
                  approved: { label: t("accorde"), cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                  rejected: { label: t("refuse"), cls: "bg-red-50 text-red-800 border-red-200" },
                };
                const sm = statusMeta[a.appealStatus ?? "pending"] ?? statusMeta.pending;
                return (
                  <li key={a.preferenceId} className="px-3 py-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#0F2D52] truncate">
                            {a.employee?.fullName || a.employee?.email || t("employe_inconnu")}
                          </p>
                          <span className={`inline-flex items-center text-[10px] px-1.5 py-0.5 rounded border font-semibold ${sm.cls}`}>
                            {sm.label}
                          </span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded border bg-slate-50 text-slate-700 border-slate-200">
                            Rang #{a.rank} ({a.preferenceStatus})
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5 tabular-nums">
                          {new Date(a.startDate).toLocaleDateString("fr-CA")} → {new Date(a.endDate).toLocaleDateString("fr-CA")} ({a.daysCount}j)
                        </p>
                      </div>
                      {a.appealStatus === "pending" && (
                        <Button
                          size="sm"
                          className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white shrink-0"
                          onClick={() => setReviewTarget(a)}
                        >
                          {t("examiner")}
                        </Button>
                      )}
                    </div>
                    {a.appealReason && (
                      <div className="rounded-md border bg-amber-50/40 border-amber-200 p-2 text-[11px] text-amber-900 whitespace-pre-wrap">
                        <strong className="block text-[10px] uppercase tracking-wider font-bold mb-0.5">{t("motif")}</strong>
                        {a.appealReason}
                      </div>
                    )}
                    {a.appealReviewNotes && a.appealStatus !== "pending" && (
                      <p className="text-[11px] text-muted-foreground italic">
                        Decision : « {a.appealReviewNotes} »
                        {a.appealReviewer && <span> — {a.appealReviewer.fullName || a.appealReviewer.email}</span>}
                      </p>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
      {reviewTarget && (
        <ReviewAppealDialog
          open
          onClose={() => setReviewTarget(null)}
          appeal={{
            preferenceId: reviewTarget.preferenceId,
            employeeName: reviewTarget.employee?.fullName || reviewTarget.employee?.email || t("employe"),
            reason: reviewTarget.appealReason || t("aucun_motif_fourni"),
            prefDetails: `Rang #${reviewTarget.rank} (${reviewTarget.preferenceStatus}) — ${new Date(reviewTarget.startDate).toLocaleDateString("fr-CA")} → ${new Date(reviewTarget.endDate).toLocaleDateString("fr-CA")} (${reviewTarget.daysCount}j)`,
          }}
          onReviewed={() => {
            setReviewTarget(null);
            load();
            onChanged();
          }}
        />
      )}
    </Dialog>
  );
}

// ─── TÂCHE 17 (P2-8) : "Voir equipe" — heatmap glissante reutilisable ─────
function TeamOverviewDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations("admin.leaves");
  const tc = useTranslations("common");
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Users className="h-4 w-4" />Vue equipe — 4 prochaines semaines
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("heatmap_absences_approuvees_attente_perimetre")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          <TeamLeavesHeatmap />
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Bandeau "Préférences vacances à traiter" ──────────────────────────
// Affiché en TOP des tabs "À approuver" et "Calendrier équipe" pour signaler
// les préférences de vacances soumises sur fenêtres actives (qui ne sont pas
// des LeaveRequest et n'apparaissent donc pas dans les listes classiques).
// Lien direct vers la fenêtre concernée pour agir immédiatement.
function PendingPreferencesBanner({ activeWindows }: { activeWindows: ActiveWindow[] }) {
  const t = useTranslations("admin.leaves");
  const windowsWithSubs = activeWindows.filter((w) => w.submittedAdmins > 0);
  if (windowsWithSubs.length === 0) return null;
  const totalSubs = windowsWithSubs.reduce((s, w) => s + w.submittedAdmins, 0);
  return (
    <Card className="overflow-hidden border-l-4 border-l-amber-500 shadow-sm">
      <div className="px-4 py-3 bg-amber-50/60 border-b border-amber-200 flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <CalendarRange className="h-4 w-4 text-amber-700 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-bold text-amber-900">
              {totalSubs} préférence{totalSubs > 1 ? "s" : ""} de vacances à traiter
            </p>
            <p className="text-[11px] text-amber-800/80 truncate">
              {t("sur_fenetres_actives_attribuer", { count: windowsWithSubs.length })}
            </p>
          </div>
        </div>
        <Link
          href="/admin/employes/conges/fenetres"
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-amber-500 bg-amber-500 text-white hover:bg-amber-600 font-semibold shrink-0"
        >
          <Eye className="h-3.5 w-3.5" />{t("leaves_admin_view_gerer_les_preferences")}</Link>
      </div>
      <ul className="divide-y divide-amber-100">
        {windowsWithSubs.map((w) => (
          <li key={w.id} className="px-4 py-2 flex items-center justify-between gap-3 flex-wrap text-xs">
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-semibold text-foreground truncate">{w.name}</span>
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold bg-emerald-50 text-emerald-800 border-emerald-200">
                <CheckCircle2 className="h-2.5 w-2.5" />{w.submittedAdmins} soumis
              </span>
              <span className="text-muted-foreground">
                Clôture {new Date(w.closingDate).toLocaleDateString("fr-CA")}
              </span>
            </div>
            <Link
              href={`/admin/employes/conges/fenetres#window-${w.id}`}
              className="text-amber-800 hover:underline font-semibold shrink-0"
            >
              {t("voir")}
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Conserve les constantes pour rester compatible avec tout import externe
export { NAVY, NAVY_HOVER };

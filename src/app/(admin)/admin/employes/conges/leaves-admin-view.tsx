"use client";
// Vue admin /employes/conges — centre de gestion superviseur PRO.
// Palette restreinte : navy #0F2D52 + amber (alerte) + red (danger) + emerald (succes).
// Plus de cards multi-couleurs, tableaux pour les listes, actions inline partout.
import React, { useEffect, useMemo, useRef, useState } from "react";
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
const TYPE_META: Record<string, { label: string; icon: typeof Sun; bar: string; barDark: string }> = {
  vacation:    { label: "Vacances",   icon: Sun,          bar: "#bcd2eb", barDark: "#3b6fb0" },
  sick:        { label: "Maladie",    icon: Bandage,      bar: "#f8c8c8", barDark: "#c44545" },
  parental:    { label: "Parental",   icon: Baby,         bar: "#e0d4f0", barDark: "#7a5dab" },
  unpaid:      { label: "Sans solde", icon: Home,         bar: "#dde1e7", barDark: "#5a6678" },
  bereavement: { label: "Deces",      icon: Home,         bar: "#d4d4d4", barDark: "#525252" },
  other:       { label: "Autre",      icon: CalendarDays, bar: "#f5e0b8", barDark: "#a07729" },
};
function typeMeta(t: string) {
  return TYPE_META[t] ?? TYPE_META.other;
}

const STATUS_META: Record<string, { label: string; cls: string }> = {
  pending:   { label: "En attente", cls: "bg-amber-50 text-amber-800 border border-amber-200" },
  approved:  { label: "Approuvee", cls: "bg-emerald-50 text-emerald-800 border border-emerald-200" },
  rejected:  { label: "Refusee",   cls: "bg-red-50 text-red-800 border border-red-200" },
  cancelled: { label: "Annulee",   cls: "bg-slate-100 text-slate-700 border border-slate-200" },
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
  const [tab, setTab] = useState<TabKey>("overview");
  const [createForOpen, setCreateForOpen] = useState(false);
  const [createForEmp, setCreateForEmp] = useState<EmployeeRow | null>(null);
  const [drillEmployeeId, setDrillEmployeeId] = useState<number | null>(null);
  const [closureOpen, setClosureOpen] = useState(false);
  const [peekDialogOpen, setPeekDialogOpen] = useState(false);
  const [appealsWindow, setAppealsWindow] = useState<ActiveWindow | null>(null);
  // Sticky compress-on-scroll : sentinel + IntersectionObserver (pattern Finance).
  // rootMargin -64px top compense le topbar sticky (h-[64px], z-30) : le sentinel est
  // considéré "out" dès qu'il passe SOUS le topbar, pas seulement hors viewport.
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
  // Mode edit d'une demande existante (depuis drill-down)
  const [editingRequest, setEditingRequest] = useState<{
    employee: { id: number; fullName: string | null; email: string };
    request: { id: number; type: string; startDate: string; endDate: string; halfDay: string | null; reason: string | null };
  } | null>(null);
  const router = useRouter();

  // P2-3 : badge "A approuver" inclut les appels pending sur fenetres allocated
  const reviewBadge = kpis.pendingCount + (activePendingAppealsTotal ?? 0);
  const baseTabs: TabItem<TabKey>[] = [
    { key: "overview", label: "Vue d'ensemble", icon: LayoutDashboard },
    ...(isReviewer ? [{ key: "review" as const, label: "A approuver", icon: CheckCircle2, count: reviewBadge }] : []),
    { key: "calendar", label: "Calendrier equipe", icon: CalendarRange },
    { key: "by-employee", label: "Par employe", icon: Users, count: employees.length },
    { key: "analytics", label: "Analytics", icon: BarChart3 },
  ];

  // Helper : ouvrir le modal de creation pour un employe specifique
  const openCreateForEmployee = (emp: EmployeeRow) => {
    setCreateForEmp(emp);
    setCreateForOpen(false);
  };

  return (
    <div className="space-y-4">
      {/* Header navy gradient — scroll naturellement (pattern Finance hero non-sticky) */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <ShieldCheck className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold flex items-center gap-2">Gestion des conges</h1>
              <p className="text-xs text-white/80">
                Vue d&apos;ensemble equipe ·{" "}
                {scope.isFounder
                  ? "Tous les employes"
                  : scope.isHr
                    ? `${kpis.activeScopeCount} employes (RH)`
                    : `${kpis.activeScopeCount} subordonne${kpis.activeScopeCount > 1 ? "s" : ""}`}
              </p>
            </div>
          </div>
          {/* Actions header : 2 boutons principaux visibles, le reste dans dropdown "Plus" */}
          <div className="flex gap-2 flex-wrap shrink-0">
            <Button
              variant="secondary"
              size="sm"
              className="h-8 text-xs bg-white/15 hover:bg-white/25 text-white border-white/20"
              onClick={() => setCreateForOpen(true)}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />Creer pour…
            </Button>
            {isReviewer && (
              <ActionTooltip label="Fermeture obligatoire d'entreprise (ex : Noel) — cree un conge approuve pour tous">
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
            {/* Overflow menu : Politiques, Fenetres, CSV — toujours dispo, mobile-friendly */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary"
                  size="sm"
                  className="h-8 text-xs bg-white/15 hover:bg-white/25 text-white border-white/20"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 mr-1.5" />Plus
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

      {/* Sentinel : detecte la sortie du hero pour activer la mini-barre sticky */}
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
          // Sticky aligne sur le contenu (pas de -mx). Mobile : extension -mx-4 sm:-mx-5
          // pour pleine largeur (sub-header etend aussi). Desktop : reste aligne contenu.
          "sticky top-[92px] pt-4 lg:top-[64px] lg:pt-0 z-20 bg-background -mx-4 sm:-mx-5 lg:mx-0 transition-shadow",
          scrolled ? "shadow-sm border-b" : "border-b border-transparent",
        )}
      >
        {/* Mini-barre compacte : visible uniquement au scroll (display switch, pas transition) */}
        <div
          className={cn(
            "px-4 sm:px-5 lg:px-4 items-center gap-3 flex-wrap py-2",
            scrolled ? "flex" : "hidden",
          )}
        >
          <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 shrink-0">
            <ShieldCheck className="h-4 w-4" />
            <span className="hidden sm:inline">Gestion des conges</span>
            <span className="sm:hidden">Conges</span>
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => setCreateForOpen(true)}
            >
              <UserCheck className="h-3.5 w-3.5 mr-1.5" />
              <span className="hidden sm:inline">Creer pour…</span>
              <span className="sm:hidden">Creer</span>
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

        {/* Tabs : toujours sticky avec le mini-header */}
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
                // Stocker la date pre-remplie via createForEmp avec init dates
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

      {/* ─── Modal "Creer pour..." — Etape 1 : selectionner l'employe (scalable) ───── */}
      <Dialog open={createForOpen && !createForEmp} onOpenChange={(o) => { if (!o) setCreateForOpen(false); }}>
        <DialogContent className="max-w-xl p-0 overflow-hidden flex flex-col max-h-[85vh]">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-white flex items-center gap-2">
                <UserCheck className="h-4 w-4" />Creer un conge pour un employe
              </DialogTitle>
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

      {/* ─── Modal "Creer pour..." — Etape 2 : calendrier admin pour l'employe ───── */}
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

      {/* ─── Drill-down panel employe ───── */}
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
          // emp ici n'est pas un EmployeeRow complet ; on retombe sur l'id pour retrouver
          const full = employees.find((e) => e.id === emp.id);
          if (full) setCreateForEmp(full);
        }}
      />

      {/* ─── Modal "Fermeture entreprise" ───── */}
      {closureOpen && (
        <MandatoryClosureDialog
          employees={employees}
          onClose={() => setClosureOpen(false)}
          onDone={() => { setClosureOpen(false); router.refresh(); }}
        />
      )}

      {/* ─── Modal d'edition d'une demande pending ───── */}
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
              toast.success("Demande mise a jour");
              setEditingRequest(null);
              router.refresh();
            } else {
              toast.error(r.error);
              throw new Error(r.error);
            }
          }}
        />
      )}

      {/* TÂCHE 17 (P2-8) : "Voir equipe" — calendrier 6 mois global */}
      {peekDialogOpen && (
        <TeamOverviewDialog
          onClose={() => setPeekDialogOpen(false)}
        />
      )}

      {/* TÂCHE 14.2 : reviser les appels d'une fenetre allocated */}
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
  const [rawSearch, setRawSearch] = useState("");
  const [search, setSearch] = useState("");
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"name" | "remaining" | "recent">("name");
  const [visibleCount, setVisibleCount] = useState(20);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Debounce 300ms
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

  // Reset visible count quand les filtres changent
  useEffect(() => { setVisibleCount(20); }, [search, teamFilter, sortBy]);

  const visible = filtered.slice(0, visibleCount);

  return (
    <>
      {/* Toolbar filtres */}
      <div className="px-4 py-3 border-b bg-muted/30 shrink-0 space-y-2">
        <div className="flex items-center gap-2">
          <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          <Input
            autoFocus
            placeholder="Rechercher nom, email ou equipe…"
            value={rawSearch}
            onChange={(e) => setRawSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={teamFilter} onValueChange={setTeamFilter}>
            <SelectTrigger className="h-7 w-36 text-[11px]"><SelectValue placeholder="Equipe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes equipes</SelectItem>
              <SelectItem value="none">Sans equipe</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
            <SelectTrigger className="h-7 w-40 text-[11px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="name">Tri : Nom</SelectItem>
              <SelectItem value="remaining">Tri : Solde restant</SelectItem>
              <SelectItem value="recent">Tri : Derniere demande</SelectItem>
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
      {/* Liste */}
      <div ref={scrollRef} className="overflow-y-auto flex-1">
        {filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground italic text-center py-12">
            {search ? "Aucun employe ne correspond a la recherche." : "Aucun employe dans votre scope."}
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
                          {emp.team?.name ?? "Sans equipe"}
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
  const absentTodayRatio = kpis.activeScopeCount > 0
    ? Math.round((kpis.absentToday / kpis.activeScopeCount) * 100)
    : 0;

  const rateDelta = +(kpis.absenteeismRate - prevMonthRate).toFixed(1);

  return (
    <div className="space-y-4">
      {/* KPIs executive — palette restreinte */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <ExecKpi
          icon={ClipboardList}
          label="A approuver"
          value={kpis.pendingCount}
          tone={kpis.pendingCount > 0 ? "warning" : "neutral"}
          sub={kpis.pendingCount > 0 ? "Demandes en attente" : "Aucune en attente"}
          onClick={isReviewer ? onJumpReview : undefined}
        />
        <ExecKpi
          icon={UserCheck}
          label="Absents aujourd'hui"
          value={`${kpis.absentToday}${kpis.activeScopeCount > 0 ? ` / ${kpis.activeScopeCount}` : ""}`}
          tone={absentTodayRatio > 30 ? "danger" : "neutral"}
          sub={`${absentTodayRatio}% du scope`}
        />
        <ExecKpi
          icon={CalendarDays}
          label="Jours-personne semaine"
          value={kpis.absentDaysThisWeek}
          tone="neutral"
          sub="Cumul absences ouvrees"
        />
        <ExecKpi
          icon={TrendingUp}
          label="Taux absenteisme (mois)"
          value={`${kpis.absenteeismRate}%`}
          tone={kpis.absenteeismRate > 10 ? "danger" : kpis.absenteeismRate > 5 ? "warning" : "neutral"}
          sub={
            rateDelta === 0
              ? "Identique au mois dernier"
              : rateDelta > 0
                ? `+${rateDelta}% vs mois precedent`
                : `${rateDelta}% vs mois precedent`
          }
          deltaDir={rateDelta > 0 ? "up" : rateDelta < 0 ? "down" : "flat"}
        />
        <ExecKpi
          icon={Sun}
          label="Solde total equipe"
          value={kpis.totalRemainingDays.toFixed(1)}
          tone="neutral"
          sub="Jours dispo cumules"
        />
        <ExecKpi
          icon={AlertTriangle}
          label="Conflits detectes"
          value={kpis.conflictDays}
          tone={kpis.conflictDays > 0 ? "danger" : "neutral"}
          sub={kpis.conflictDays > 0 ? "Jours > 30% absent" : "Aucun conflit"}
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
            >
              Gérer toutes les fenêtres <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
          <ul className="divide-y">
            {activeWindows.map((w) => {
              const statusMeta: Record<string, { label: string; cls: string }> = {
                open: { label: "Ouverte", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                closed: { label: "Fermée", cls: "bg-amber-50 text-amber-800 border-amber-200" },
                in_review: { label: "En revue", cls: "bg-[#0F2D52]/10 text-[#0F2D52] border-[#0F2D52]/20" },
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
                        <ActionTooltip label="Examiner les appels en attente">
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
                  <ActionTooltip label="Voir préférences soumises + actions">
                    <Link
                      href={`/admin/employes/conges/fenetres#window-${w.id}`}
                      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded border border-[#0F2D52] text-[#0F2D52] hover:bg-[#0F2D52] hover:text-white transition-colors shrink-0 font-semibold"
                    >
                      <Eye className="h-3 w-3" />Voir préférences
                    </Link>
                  </ActionTooltip>
                </li>
              );
            })}
          </ul>
        </Card>
      )}

      {/* Tableau prochaines absences */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <CalendarDays className="h-4 w-4" />Prochaines absences (30 jours)
          </h3>
          <button type="button" onClick={onJumpCalendar} className="text-xs text-[#0F2D52] hover:underline flex items-center gap-1">
            Voir calendrier <ExternalLink className="h-3 w-3" />
          </button>
        </div>
        {upcomingNext30.length === 0 ? (
          <div className="p-10 text-center">
            <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
              <CalendarDays className="h-5 w-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-foreground">Equipe au complet</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Aucune absence approuvee dans les 30 prochains jours.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted/20 text-[10px] uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">Date</th>
                <th className="px-4 py-2 text-left font-semibold">Employe</th>
                <th className="px-4 py-2 text-left font-semibold">Type</th>
                <th className="px-4 py-2 text-right font-semibold">Duree</th>
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
                        {meta.label}
                        {l.halfDay && <span className="text-muted-foreground">· ½ {l.halfDay === "AM" ? "matin" : "PM"}</span>}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right text-xs tabular-nums">{Number(l.daysCount)}j</td>
                    <td className="px-4 py-2 text-right">
                      <ActionTooltip label="Voir details employe">
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

      {/* Heatmap 4 semaines */}
      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b bg-muted/30 flex items-center justify-between">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <CalendarRange className="h-4 w-4" />Densite d&apos;absents (4 semaines)
          </h3>
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
  if (days.length === 0) {
    return <div className="p-6 text-center text-xs text-muted-foreground">Aucune donnee.</div>;
  }

  // Organise les jours en semaines (commencant dimanche — convention projet)
  // On affiche 4 lignes (semaines) x 7 colonnes (jours)
  const weeks: Array<Array<HeatmapDay | null>> = [];
  let currentWeek: Array<HeatmapDay | null> = [];
  // Padding pour aligner sur dimanche
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

  // Mini calendar compact : ~250px max, cellules carrees fixees a 28px de cote.
  // Chaque case = numero du jour + petite pastille de densite (pas un gros bloc plein).
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
              // Pastille de densite : taille proportionnelle a l'intensite (navy uni)
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
        <span>Densite :</span>
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
        label: "Motif du refus (optionnel)",
        multiline: true,
        variant: "destructive",
        confirmLabel: "Refuser",
      });
      if (n === null) return;
      notes = n.trim() || undefined;
    }
    setBulkBusy(true);
    const res = await bulkReviewLeavesAction({ ids: Array.from(selectedIds), decision, notes });
    setBulkBusy(false);
    if (res.success) {
      // TÂCHE 21 : afficher detail erreurs si presentes
      const baseMsg = `${res.data.processed} traitee${res.data.processed > 1 ? "s" : ""}${res.data.skipped > 0 ? ` · ${res.data.skipped} ignoree${res.data.skipped > 1 ? "s" : ""}` : ""}`;
      toast.success(baseMsg);
      if (res.data.errors && res.data.errors.length > 0) {
        const sample = res.data.errors.slice(0, 3).map((e) => `#${e.id}: ${e.reason}`).join(" — ");
        const more = res.data.errors.length > 3 ? ` (+${res.data.errors.length - 3} autres)` : "";
        toast.warning(`Detail erreurs : ${sample}${more}`, { duration: 6000 });
      }
      clearSelection();
      router.refresh();
    } else toast.error(res.error || "Erreur lors du traitement");
  };

  const reviewOne = async (id: number, decision: "approved" | "rejected") => {
    if (busyIds.has(id)) return;
    let notes: string | undefined;
    if (decision === "rejected") {
      const n = await promptDialog({
        title: "Refuser la demande de conge",
        label: "Motif du refus (optionnel)",
        placeholder: "Ex : periode chargee, equipe sous-effectif…",
        multiline: true,
        variant: "destructive",
        confirmLabel: "Refuser",
      });
      if (n === null) return;
      notes = n.trim() || undefined;
    }
    markBusy(id, true);
    const res = await reviewLeaveRequestAction({ id, decision, notes });
    markBusy(id, false);
    if (res.success) { toast.success(decision === "approved" ? "Approuvee" : "Refusee"); router.refresh(); }
    else toast.error(res.error || "Erreur lors du traitement");
  };

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <Card className="p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Rechercher un employe…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8 text-xs"
          />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-muted-foreground" />
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {Object.entries(TYPE_META).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterEmployee} onValueChange={setFilterEmployee}>
            <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Employe" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous employes</SelectItem>
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
          <p className="text-sm font-medium">Aucune demande en attente</p>
          <p className="text-xs text-muted-foreground mt-1">
            {pendingReviews.length > 0 ? "Aucune demande ne correspond aux filtres." : "Toutes les demandes ont ete traitees."}
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
                  Deselectionner
                </Button>
                <Button size="sm" variant="outline" disabled={bulkBusy} className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90" onClick={() => bulk("approved")}>
                  <CheckCircle2 className="h-3 w-3 mr-1" />{bulkBusy ? "..." : "Approuver selection"}
                </Button>
                <Button size="sm" variant="outline" disabled={bulkBusy} className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white border-0" onClick={() => bulk("rejected")}>
                  <XCircle className="h-3 w-3 mr-1" />{bulkBusy ? "..." : "Refuser selection"}
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

          {/* P2-4 : pagination back-end */}
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
                    Suivant<ChevronRight className="h-3.5 w-3.5 ml-1" />
                  </Link>
                ) : (
                  <span className="inline-flex items-center h-7 px-2 text-xs border rounded text-muted-foreground opacity-50">
                    Suivant<ChevronRight className="h-3.5 w-3.5 ml-1" />
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
  const meta = typeMeta(request.type);
  const Icon = meta.icon;
  const halfLabel = request.halfDay === "AM" ? "½ matin" : request.halfDay === "PM" ? "½ apres-midi" : null;
  const team = request.admin?.team;
  const sameDay = request.startDate.slice(0, 10) === request.endDate.slice(0, 10);

  return (
    <Card className="p-3 sm:p-4 hover:ring-1 hover:ring-[#0F2D52]/20 transition">
      <div className="flex items-start gap-3">
        <ActionTooltip label={selected ? "Deselectionner" : "Selectionner pour bulk action"}>
          <div className="pt-1.5">
            <Checkbox checked={selected} onCheckedChange={onToggleSelect} aria-label="Selectionner" />
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
              {meta.label}
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
              ? <>Le <strong className="text-foreground">{fmtDateLong(request.startDate)}</strong></>
              : <>Du <strong className="text-foreground">{fmtDate(request.startDate)}</strong> au <strong className="text-foreground">{fmtDate(request.endDate)}</strong></>
            }
            {" · "}
            <strong className="tabular-nums text-foreground">{Number(request.daysCount)}</strong> jour{Number(request.daysCount) > 1 ? "s" : ""}
          </p>
          {request.reason && <p className="text-xs italic text-muted-foreground mt-1">« {request.reason} »</p>}
        </div>
        <div className="flex gap-1 shrink-0">
          <ActionTooltip label="Voir details employe">
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
            <CheckCircle2 className="h-3 w-3 mr-1" />{busy ? "..." : "Approuver"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={busy}
            className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50 hover:text-red-800"
            onClick={() => onReview("rejected")}
          >
            <XCircle className="h-3 w-3 mr-1" />{busy ? "..." : "Refuser"}
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

  // Filtrer les employes visibles selon filtres (et toujours afficher tous, meme sans absence)
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

  // Grouper conges par employe
  const leavesByEmp = useMemo(() => {
    const m = new Map<number, UpcomingLeave[]>();
    for (const l of filteredLeaves) {
      if (!l.admin?.id) continue;
      if (!m.has(l.admin.id)) m.set(l.admin.id, []);
      m.get(l.admin.id)!.push(l);
    }
    return m;
  }, [filteredLeaves]);

  // Compteur par jour (entete)
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
      {/* Toolbar pro */}
      <Card className="p-3 space-y-2">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1">
            <ActionTooltip label="2 semaines avant">
              <Button variant="outline" size="sm" className="h-8 w-8 p-0" onClick={() => setOffset((o) => Math.max(-180, o - 14))}>
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </ActionTooltip>
            <Button variant={offset === 0 ? "default" : "outline"} size="sm" className={`h-8 text-xs ${offset === 0 ? "bg-[#0F2D52] hover:bg-[#1a3a66]" : ""}`} onClick={() => setOffset(0)}>
              Aujourd&apos;hui
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOffset((o) => o + 7)}>
              +1 sem
            </Button>
            <Button variant="outline" size="sm" className="h-8 text-xs" onClick={() => setOffset((o) => o + 30)}>
              +1 mois
            </Button>
            <ActionTooltip label="2 semaines apres">
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
              <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous types</SelectItem>
                {Object.entries(TYPE_META).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterTeam} onValueChange={setFilterTeam}>
              <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Equipe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes equipes</SelectItem>
                <SelectItem value="none">Sans equipe</SelectItem>
                {teams.map((t) => <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterEmp} onValueChange={setFilterEmp}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Employe" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous employes</SelectItem>
                {employees.map((e) => <SelectItem key={e.id} value={String(e.id)}>{e.fullName || e.email}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </Card>

      {/* Gantt */}
      {visibleEmployees.length === 0 ? (
        <Card className="p-10 text-center">
          <div className="mx-auto h-12 w-12 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <Users className="h-6 w-6 text-slate-400" />
          </div>
          <p className="text-sm font-medium">Aucun employe dans le filtre</p>
          <p className="text-xs text-muted-foreground mt-1">
            Ajustez les filtres pour voir les employes.
          </p>
        </Card>
      ) : (
        <Card className="overflow-x-auto">
          <div className="grid" style={{ gridTemplateColumns: `220px repeat(28, minmax(28px, 1fr))`, minWidth: 1100 }}>
            {/* Header */}
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
              // Style header net (pattern PeekColleaguesDialog) : weekend gris franc, today ring navy
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

            {/* Rows */}
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

      {/* Légende propre style Excel : couleurs par type + indicateurs spéciaux */}
      <div className="flex items-center justify-between flex-wrap gap-3 text-[10px] text-muted-foreground px-1">
        <div className="flex items-center gap-x-3 gap-y-1 flex-wrap">
          {Object.entries(TYPE_META).map(([k, v]) => (
            <span key={k} className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm border" style={{ backgroundColor: v.bar, borderColor: v.barDark }} />
              {v.label}
            </span>
          ))}
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm bg-slate-100 border border-slate-200" />
            Weekend
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="inline-block w-3 h-3 rounded-sm ring-2 ring-[#0F2D52] bg-white" />
            Aujourd&apos;hui
          </span>
        </div>
        <p className="text-[10px] text-muted-foreground italic">
          Cliquez une cellule vide pour créer un congé · Survolez pour le détail
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

        // Style Excel : cellule pleine couleur, border-left coloré pour la barre de congé
        const isStart = leaveOnDay && dIso === leaveOnDay.startDate.slice(0, 10);

        const tooltipLabel = leaveOnDay && meta
          ? `${meta.label} : ${fmtDate(leaveOnDay.startDate)} → ${fmtDate(leaveOnDay.endDate)}${leaveOnDay.halfDay ? ` (½ ${leaveOnDay.halfDay})` : ""} — Cliquer pour détails`
          : `Cliquer pour créer un congé le ${d.toLocaleDateString("fr-CA", { weekday: "long", day: "2-digit", month: "short" })}`;

        // Fond cellule : weekend gris, today ring, congé = couleur pleine du type
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
        // Today : ring contrasté (amber sur congé, navy sinon)
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

  // Reset page quand filtres changent
  useEffect(() => { setPage(1); }, [search, teamFilter, sortBy, filterPending, filterLowBalance]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="space-y-3">
      <Card className="p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" />
        </div>
        <Select value={teamFilter} onValueChange={setTeamFilter}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue placeholder="Equipe" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes equipes</SelectItem>
            <SelectItem value="none">Sans equipe</SelectItem>
            {teams.map((t) => (
              <SelectItem key={t.id} value={String(t.id)}>{t.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="name">Trier par nom</SelectItem>
            <SelectItem value="remaining">Solde restant ↓</SelectItem>
            <SelectItem value="taken">Jours pris ↓</SelectItem>
            <SelectItem value="pending">Demandes en attente ↓</SelectItem>
          </SelectContent>
        </Select>
        <Label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <Checkbox checked={filterPending} onCheckedChange={(v) => setFilterPending(!!v)} />
          Avec demandes en attente
        </Label>
        <Label className="flex items-center gap-1.5 text-[11px] cursor-pointer">
          <Checkbox checked={filterLowBalance} onCheckedChange={(v) => setFilterLowBalance(!!v)} />
          Solde &lt; 2j
        </Label>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#0F2D52]/5 text-[10px] uppercase tracking-wider text-[#0F2D52]">
            <tr>
              <th className="px-3 py-2 text-left font-semibold">Employe</th>
              <th className="px-3 py-2 text-left font-semibold hidden sm:table-cell">Equipe</th>
              <th className="px-3 py-2 text-right font-semibold">Solde dispo</th>
              <th className="px-3 py-2 text-right font-semibold hidden md:table-cell">Pris</th>
              <th className="px-3 py-2 text-right font-semibold hidden md:table-cell">Planifies</th>
              <th className="px-3 py-2 text-center font-semibold">En attente</th>
              <th className="px-3 py-2 text-left font-semibold hidden lg:table-cell">Derniere demande</th>
              <th className="px-3 py-2 text-right font-semibold">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-12 text-center">
                  <div className="mx-auto h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center mb-2">
                    <Users className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-foreground">Aucun employe</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Ajustez les filtres ou videz la recherche.</p>
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
                          {STATUS_META[emp.lastRequest.status]?.label ?? emp.lastRequest.status}
                        </span>
                        <span className="text-muted-foreground ml-1">
                          {typeMeta(emp.lastRequest.type).label} · {fmtDate(emp.lastRequest.startDate)}
                        </span>
                      </div>
                    ) : (
                      <span className="text-[10px] text-muted-foreground">Aucune</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right" onClick={(e) => e.stopPropagation()}>
                    <div className="flex justify-end gap-1">
                      <ActionTooltip label="Voir details">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => onOpenDrill(emp.id)}
                        >
                          <Eye className="h-3.5 w-3.5 text-[#0F2D52]" />
                        </Button>
                      </ActionTooltip>
                      <ActionTooltip label="Creer une demande pour cet employe">
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
        {/* Pagination */}
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
  const totalDays = absencesByType.reduce((s, t) => s + t.daysCount, 0);
  const topRemaining = employees.slice().sort((a, b) => b.vacationDaysRemaining - a.vacationDaysRemaining).slice(0, 5);
  const lowRemaining = employees.slice().filter((e) => e.vacationDaysRemaining > 0).sort((a, b) => a.vacationDaysRemaining - b.vacationDaysRemaining).slice(0, 5);
  const maxRemaining = Math.max(1, ...topRemaining.map((e) => e.vacationDaysRemaining), ...lowRemaining.map((e) => e.vacationDaysRemaining));

  const rateDelta = +(kpis.absenteeismRate - prevMonthRate).toFixed(1);

  // Donut data : palette navy + accents
  const donutPalette = ["#0F2D52", "#3b6fb0", "#7ea0c4", "#bcd2eb", "#d97706", "#dc2626"];
  const donutData = absencesByType
    .filter((t) => t.daysCount > 0)
    .sort((a, b) => b.daysCount - a.daysCount)
    .map((t, i) => ({ name: typeMeta(t.type).label, value: t.daysCount, fill: donutPalette[i % donutPalette.length] }));

  return (
    <div className="space-y-3 min-w-0">
      {/* KPIs analytics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <ExecKpi
          icon={TrendingUp}
          label="Taux absent. (mois)"
          value={`${kpis.absenteeismRate}%`}
          tone={kpis.absenteeismRate > 10 ? "danger" : kpis.absenteeismRate > 5 ? "warning" : "neutral"}
          sub={`Mois precedent : ${prevMonthRate}%`}
          deltaDir={rateDelta > 0 ? "up" : rateDelta < 0 ? "down" : "flat"}
        />
        <ExecKpi
          icon={CalendarDays}
          label="Jours pris (annee)"
          value={totalDays}
          tone="neutral"
          sub={`${absencesByType.reduce((s, t) => s + t.requestsCount, 0)} demandes`}
        />
        <ExecKpi
          icon={Sun}
          label="Solde total"
          value={kpis.totalRemainingDays.toFixed(1)}
          tone="neutral"
          sub="Jours dispo equipe"
        />
        <ExecKpi
          icon={AlertTriangle}
          label="Conflits (mois)"
          value={kpis.conflictDays}
          tone={kpis.conflictDays > 0 ? "danger" : "neutral"}
          sub="Jours > 30% absent"
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-3 min-w-0">
        {/* Taux absenteisme 12 mois */}
        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <TrendingUp className="h-4 w-4" />Taux d&apos;absenteisme — 12 mois glissants
          </h3>
          {trailing12Months.length === 0 || trailing12Months.every((m) => m.rate === 0) ? (
            <EmptyChart text="Aucune donnee suffisante." />
          ) : (
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={trailing12Months} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} unit="%" />
                  <RTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e2e8f0" }}
                    formatter={(v) => [`${v}%`, "Taux"] as [string, string]}
                  />
                  <Line type="monotone" dataKey="rate" stroke={NAVY} strokeWidth={2} dot={{ fill: NAVY, r: 3 }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Repartition par type (donut) */}
        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <BarChart3 className="h-4 w-4" />Repartition par type (annee)
          </h3>
          {donutData.length === 0 ? (
            <EmptyChart text="Aucune absence approuvee cette annee." />
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

        {/* Jours pris par equipe */}
        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <Users className="h-4 w-4" />Jours pris par equipe (12 mois)
          </h3>
          {teamStats.length === 0 ? (
            <EmptyChart text="Aucune equipe avec absences." />
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
                      return [`${v}j (${emp} emp.)`, "Jours pris"] as [string, string];
                    }}
                  />
                  <Bar dataKey="days" fill={NAVY} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Prevision 8 semaines */}
        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <CalendarRange className="h-4 w-4" />Prevision 8 prochaines semaines
          </h3>
          {next8WeeksForecast.every((w) => w.absents === 0) ? (
            <EmptyChart text="Aucune absence planifiee." />
          ) : (
            <div className="h-56 w-full min-w-0">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={next8WeeksForecast} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} />
                  <YAxis tick={{ fontSize: 10, fill: "#64748b" }} axisLine={{ stroke: "#cbd5e1" }} tickLine={false} allowDecimals={false} />
                  <RTooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6 }}
                    formatter={(v, n) => [v, n === "absents" ? "Absents" : "Jours"] as [string | number, string]}
                  />
                  <Legend wrapperStyle={{ fontSize: 10 }} />
                  <Line type="monotone" dataKey="absents" stroke={NAVY} strokeWidth={2} dot={{ fill: NAVY, r: 3 }} name="Employes absents" />
                  <Line type="monotone" dataKey="days" stroke="#d97706" strokeWidth={2} strokeDasharray="4 2" dot={{ fill: "#d97706", r: 3 }} name="Jours-personne" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        {/* Top 5 plus de jours */}
        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <Sun className="h-4 w-4" />Top 5 — Plus de jours disponibles
          </h3>
          {topRemaining.length === 0 ? (
            <EmptyChart text="Aucune donnee." />
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

        {/* Bottom 5 solde bas */}
        <Card className="p-4 space-y-3 min-w-0 overflow-hidden">
          <h3 className="text-sm font-semibold flex items-center gap-2 text-[#0F2D52]">
            <AlertTriangle className="h-4 w-4 text-amber-600" />Top 5 — Solde le plus bas
          </h3>
          {lowRemaining.length === 0 ? (
            <EmptyChart text="Aucune donnee." />
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
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("Fermeture annuelle des Fetes");
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
      toast.error("Date debut, date fin et raison obligatoires.");
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
              <Building2 className="h-4 w-4" />Fermeture obligatoire d&apos;entreprise
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Cree un conge approuve pour tous les employes actifs sur la plage donnee (ex : Noel). Vous pouvez exempter certains employes essentiels.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <FormSection icon={CalendarRange} title="Periode">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Du" required>
                <DatePopover value={startDate} onChange={setStartDate} />
              </Field>
              <Field label="Au" required>
                <DatePopover value={endDate} onChange={setEndDate} min={startDate} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={ClipboardList} title="Type et raison">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Type">
                <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="other">Autre (non deduit du solde)</SelectItem>
                    <SelectItem value="vacation">Vacances (deduit du solde)</SelectItem>
                    <SelectItem value="unpaid">Sans solde</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Raison (visible employes)" required>
                <Input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Fermeture annuelle des Fetes" maxLength={300} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={Users} title={`Employes vises (${targetCount}/${employees.length})`}>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Rechercher pour exempter…"
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
                Decochez les employes essentiels qui doivent rester actifs (ex : astreinte, securite).
              </p>
            </div>
          </FormSection>

          <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900">
            <AlertTriangle className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" />
            <strong>Attention :</strong> Crée immediatement des conges approuves pour <strong>{targetCount}</strong> employe{targetCount > 1 ? "s" : ""}. Les conflits existants (autres demandes sur la meme periode) seront ignores.
          </div>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending || targetCount === 0} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            <Building2 className="h-4 w-4 mr-1.5" />{pending ? "Creation..." : `Creer pour ${targetCount} employe${targetCount > 1 ? "s" : ""}`}
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
  const [filter, setFilter] = useState<"pending" | "all">("pending");
  const [appeals, setAppeals] = useState<AppealItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewTarget, setReviewTarget] = useState<AppealItem | null>(null);

  const load = React.useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/vacation-windows/${w.id}/appeals?status=${filter}`)
      .then((r) => (r.ok ? r.json() : { appeals: [] }))
      .then((d) => setAppeals(d.appeals ?? []))
      .catch(() => toast.error("Impossible de charger les appels"))
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
              Examiner les appels soumis par les employes sur cette fenetre.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 flex-wrap">
            <Select value={filter} onValueChange={(v) => setFilter(v as "pending" | "all")}>
              <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En attente uniquement</SelectItem>
                <SelectItem value="all">Tous les appels</SelectItem>
              </SelectContent>
            </Select>
            <span className="text-[11px] text-muted-foreground ml-auto">
              {appeals.length} appel{appeals.length > 1 ? "s" : ""}
            </span>
          </div>
          {loading ? (
            <InlineLoader label="Chargement des appels..." />
          ) : appeals.length === 0 ? (
            <div className="rounded-md border bg-muted/10 p-6 text-center">
              <Megaphone className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm font-medium">Aucun appel {filter === "pending" ? "en attente" : ""}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {filter === "pending"
                  ? "Aucun employe n'a soumis d'appel pour cette attribution."
                  : "Cette fenetre n'a recu aucun appel."}
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-md border bg-background">
              {appeals.map((a) => {
                const statusMeta: Record<string, { label: string; cls: string }> = {
                  pending: { label: "En attente", cls: "bg-amber-50 text-amber-800 border-amber-200" },
                  approved: { label: "Accorde", cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
                  rejected: { label: "Refuse", cls: "bg-red-50 text-red-800 border-red-200" },
                };
                const sm = statusMeta[a.appealStatus ?? "pending"] ?? statusMeta.pending;
                return (
                  <li key={a.preferenceId} className="px-3 py-3 flex flex-col gap-2">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-semibold text-[#0F2D52] truncate">
                            {a.employee?.fullName || a.employee?.email || "Employe inconnu"}
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
                          Examiner
                        </Button>
                      )}
                    </div>
                    {a.appealReason && (
                      <div className="rounded-md border bg-amber-50/40 border-amber-200 p-2 text-[11px] text-amber-900 whitespace-pre-wrap">
                        <strong className="block text-[10px] uppercase tracking-wider font-bold mb-0.5">Motif</strong>
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
          <Button variant="outline" onClick={onClose}>Fermer</Button>
        </DialogFooter>
      </DialogContent>
      {reviewTarget && (
        <ReviewAppealDialog
          open
          onClose={() => setReviewTarget(null)}
          appeal={{
            preferenceId: reviewTarget.preferenceId,
            employeeName: reviewTarget.employee?.fullName || reviewTarget.employee?.email || "Employe",
            reason: reviewTarget.appealReason || "(aucun motif fourni)",
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
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Users className="h-4 w-4" />Vue equipe — 4 prochaines semaines
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Heatmap des absences approuvees et en attente dans votre perimetre.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 flex-1 overflow-y-auto">
          <TeamLeavesHeatmap />
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose}>Fermer</Button>
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
              Sur {windowsWithSubs.length} fenêtre{windowsWithSubs.length > 1 ? "s" : ""} active{windowsWithSubs.length > 1 ? "s" : ""}. À attribuer une fois la période de soumission fermée.
            </p>
          </div>
        </div>
        <Link
          href="/admin/employes/conges/fenetres"
          className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded border border-amber-500 bg-amber-500 text-white hover:bg-amber-600 font-semibold shrink-0"
        >
          <Eye className="h-3.5 w-3.5" />Gérer les préférences
        </Link>
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
              Voir →
            </Link>
          </li>
        ))}
      </ul>
    </Card>
  );
}

// Conserve les constantes pour rester compatible avec tout import externe
export { NAVY, NAVY_HOVER };

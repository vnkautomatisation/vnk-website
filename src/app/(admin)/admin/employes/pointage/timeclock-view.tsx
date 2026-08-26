"use client";
import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { startOfWeek, endOfWeek } from "@/lib/week";
import { overtimeMinutes } from "@/lib/services/payroll-hours";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { promptDialog, confirmDialog } from "@/components/admin/prompt-dialog";
import { LiveShiftCounter } from "@/components/admin/live-shift-counter";
import { DurationPicker, HourMinutePicker, TimePicker } from "@/components/admin/time-picker";
import { DatePopover } from "@/components/admin/date-popover";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import {
  Clock, Play, Square, Plus, Trash2, CheckCircle2, XCircle, FileDown,
  ChevronDown, ChevronRight, ChevronLeft, Layers, AlertCircle, Calendar, Send,
  AlertTriangle, Coffee, User as UserIcon, FileText, Users,
  Lock, Unlock, History, TrendingUp, LayoutGrid, ListChecks,
  Bell, MoreHorizontal, CalendarRange, CalendarClock, CalendarDays, Briefcase,
  SlidersHorizontal, Monitor, KeyRound, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { SettingsTabs, type TabItem } from "@/components/admin/settings-tabs";
import { FormSection, Field } from "@/components/admin/form-section";
import { TimesheetFilters, type StatusFilter } from "./timesheet-filters";
import {
  clockInAction, clockOutAction, manualTimeEntryAction, deleteTimeClockAction,
  approveTimeClockAction, rejectTimeClockAction, rejectManyTimeClockAction, unapproveTimeClockAction,
  mergeDayTimeClockAction, deleteShortTimeClockAction,
  updateTimeClockAction, submitWeekTimeClocksAction,
  forceClockOutAction, pauseClockAction, resumeClockAction,
  undoTimeClockSnapshotAction, approveWeekTimeClockAction,
  requestEditTimeClockAction, unlockTimeClockEntriesAction, denyEditRequestAction,
  notifyForgottenDaysAction, remindSubmitWeekAction,
  revealMyKioskPinAction, requestKioskPinAction,
} from "@/app/actions/hr-timeclock";
import type { Entry, HistoryEvent, ForgottenEmployee, ManualEntry, ManualCategory } from "./_types";
import { formatShiftDuration as _formatShiftDuration } from "./_types";
import { ApprovedBadge } from "./_components/ApprovedBadge";
import { StatBox } from "./_components/StatBox";
import { HistoryPopover } from "./_components/HistoryPopover";
import { ManualEntryDialog } from "./_components/ManualEntryDialog";
import { EditEntryDialog } from "./_components/EditEntryDialog";
import { PdfPreviewModal } from "@/components/admin/pdf-preview-modal";
import { EmployeeWeekPanelRemote } from "./_components/EmployeeWeekPanel";
import { DayMultiEmployeePanel } from "./_components/DayMultiEmployeePanel";
import { DayDetailPanel } from "./_components/DayDetailPanel";
import { CompactEntryRow, DayAggregateRow } from "./_components/EntryRows";
import { dayKey, startOfDay, fmtDuration, capFirst, fmtTime, avatarColor, CAT_LABEL } from "./_components/_utils";
import { entryTiming, minutesBetween, workedMin, MERGE_MAX_GAP_MIN } from "@/lib/time-entry";

type EditRequest = {
  id: number;
  adminId: number;
  entryIds: number[] | unknown;
  reason: string;
  status: string;
  createdAt: string;
  admin?: { id: number; fullName: string | null; email: string } | null;
};

type HolidayMap = Record<string, { name: string; isPaid: boolean; type: string }>;

// Re-exported for the page; the type itself lives in _types.ts.
export type { ForgottenEmployee } from "./_types";

const formatShiftDuration = _formatShiftDuration;

function todayKey(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

// Date helpers for the period presets.
function endOfDay(d: Date): Date { const n = new Date(d); n.setHours(23, 59, 59, 999); return n; }
function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// ════════════════════════════════════════════════════════════════
// Admin review view types: scoped and paginated props.
// ════════════════════════════════════════════════════════════════
export type TeamLite = { id: number; name: string; color: string | null };

export type TeamStat = {
  teamId: number | null;
  teamName: string;
  teamColor: string | null;
  memberCount: number;
  totalMin: number;
  toApproveCount: number;
};

export type EmployeeRow = {
  id: number;
  fullName: string | null;
  email: string;
  title: string | null;
  department: string | null;
  team: TeamLite | null;
  position: { name: string } | null;
  totalMin: number;
  toApprove: number;
  approved: number;
  status: "approved" | "pending" | "none";
};

export type DayAggRow = {
  key: string;
  adminId: number;
  adminName: string;
  adminEmail: string;
  teamId: number | null;
  teamName: string | null;
  department: string | null;
  date: string;
  workMin: number;
  meetingMin: number;
  trainingMin: number;
  breakMin: number;
  leaveMin: number;
  totalMin: number;
  status: "approved" | "submitted" | "pending" | "rejected" | "mixed";
  hasPending: boolean;
  entries: Entry[];
};

type ReviewProps = {
  mode?: "review";
  scope: {
    isHr: boolean;
    isFounder: boolean;
    allowedAdminCount: number | null; // null = HR
    myTeams: TeamLite[];
  };
  currentAdminId?: number;
  periodFrom: string;
  periodTo: string;
  holidays: HolidayMap;
  teams: TeamLite[];
  departments: string[];
  editRequests: EditRequest[];
  teamStats: TeamStat[] | null;
  adminKpis: {
    totalMin: number;
    toApproveCount: number;
    approvedCount: number;
    activeAdmins: number;
    overtimeMin: number;
    overtimeWeeklyMin: number;
    complianceRate: number;
    pendingRequests: number;
    forgottenTodayCount: number;
    forgottenThisWeekCount: number;
  } | null;
  tab: "overview" | "by-employee" | "to-approve";
  page: number;
  pageSize: number;
  q: string;
  teamFilter: number | null;
  departmentFilter: string | null;
  statusFilter: StatusFilter;
  overview: {
    totalMin: number;
    toApproveCount: number;
    approvedCount: number;
    activeAdmins: number;
    teamStats: TeamStat[];
  } | null;
  byEmployee: { items: EmployeeRow[]; total: number };
  toApprove: { items: DayAggRow[]; total: number };
  employeesWithForgottenDays: ForgottenEmployee[];
  approveQueue: {
    rows: Array<{
      adminId: number; name: string; email: string; teamName: string | null;
      pendingIds: number[]; pendingMin: number; days: number; weekTotalMin: number;
    }>;
    awaitingSubmission: Array<{ adminId: number; name: string; email: string; draftCount: number }>;
    upToDate: Array<{ adminId: number; name: string; email: string }>;
    pastPendingCount: number;
    pastPendingWeeks: number;
    pastPendingLatestWeek: string | null;
  };
  reachedEntryCap?: boolean;
};

type EmployeeProps = {
  mode: "employee";
  myEntries: Entry[];
  entriesTruncated?: boolean;
  overtimeWeeklyMin?: number;
  openEntry: Entry | null;
  currentAdminId: number;
  periodFrom?: string;
  periodTo?: string;
  holidays?: HolidayMap;
  /** Capture GPS at punch (settings hr_pointage.geoloc_enabled). */
  geolocEnabled?: boolean;
  /** Shared-tablet kiosk enabled (settings hr_pointage.kiosk_enabled). */
  kioskEnabled?: boolean;
  /** Whether this employee already generated a kiosk PIN. */
  hasKioskPin?: boolean;
  /** When the current PIN was generated (ISO), for the card badge. */
  kioskPinSetAt?: string | null;
  /** Pending PIN request made by this employee (ISO), if any. */
  kioskPinRequestedAt?: string | null;
};

export function TimeclockView(props: ReviewProps | EmployeeProps) {
  if (props.mode === "employee") {
    return (
      <TimeclockEmployeeView
        myEntries={props.myEntries}
        entriesTruncated={props.entriesTruncated}
        openEntry={props.openEntry}
        overtimeWeeklyMin={props.overtimeWeeklyMin}
        currentAdminId={props.currentAdminId}
        periodFrom={props.periodFrom}
        periodTo={props.periodTo}
        holidays={props.holidays ?? {}}
        geolocEnabled={props.geolocEnabled ?? false}
        kioskEnabled={props.kioskEnabled ?? false}
        hasKioskPin={props.hasKioskPin ?? false}
        kioskPinSetAt={props.kioskPinSetAt ?? null}
        kioskPinRequestedAt={props.kioskPinRequestedAt ?? null}
      />
    );
  }
  return <TimeclockReviewView {...props} />;
}

// ════════════════════════════════════════════════════════════════
// PeriodFilter: date-range selector.
// ════════════════════════════════════════════════════════════════
type Period = { from: Date; to: Date; label: string };

function getPresets(): Period[] {
  const now = new Date();
  const cw = startOfWeek(now);
  // "This week" runs Sunday -> today, never to the upcoming Sunday.
  const cwE = endOfDay(now);
  const lw = startOfWeek(new Date(now.getTime() - 7 * 86400000));
  const lwE = endOfWeek(new Date(now.getTime() - 7 * 86400000));
  const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const mEnd = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const pmStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const pmEnd = endOfDay(new Date(now.getFullYear(), now.getMonth(), 0));
  const d30 = new Date(now.getTime() - 30 * 86400000);
  const d90 = new Date(now.getTime() - 90 * 86400000);
  return [
    { label: "Cette semaine", from: cw, to: cwE },
    { label: "Semaine dernière", from: lw, to: lwE },
    { label: "Ce mois", from: mStart, to: mEnd },
    { label: "Mois dernier", from: pmStart, to: pmEnd },
    { label: "30 derniers jours", from: d30, to: now },
    { label: "90 derniers jours", from: d90, to: now },
  ];
}

function PeriodFilter({ from, to }: { from?: string; to?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const presets = useMemo(() => getPresets(), []);
  const [customFrom, setCustomFrom] = useState(from ? isoDate(new Date(from)) : "");
  const [customTo, setCustomTo] = useState(to ? isoDate(new Date(to)) : "");

  const currentLabel = useMemo(() => {
    if (!from || !to) return "30 derniers jours";
    const f = new Date(from); const t = new Date(to);
    const sameDay = (a: Date, b: Date) =>
      a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
    const match = presets.find((p) => sameDay(p.from, f) && sameDay(p.to, t));
    if (match) return match.label;
    return `${isoDate(f)} → ${isoDate(t)}`;
  }, [from, to, presets]);

  // Preserves the current URL (tab, filters) and only swaps from/to.
  const apply = useCallback((f: Date, t: Date) => {
    const params = new URLSearchParams(sp.toString());
    params.set("from", isoDate(f));
    params.set("to", isoDate(t));
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }, [router, pathname, sp]);

  const applyCustom = () => {
    if (!customFrom || !customTo) {
      toast.error("Période invalide");
      return;
    }
    // Date-only strings parse as UTC and shift a day back.
    const f = new Date(customFrom + "T00:00:00");
    const t = endOfDay(new Date(customTo + "T00:00:00"));
    if (isNaN(f.getTime()) || isNaN(t.getTime()) || t < f) {
      toast.error("Période invalide");
      return;
    }
    apply(f, t);
  };

  // One icon per period preset.
  const presetIcons: Record<string, typeof Calendar> = {
    "Cette semaine": Calendar,
    "Semaine dernière": CalendarRange,
    "Ce mois": CalendarDays,
    "Mois dernier": History,
    "30 derniers jours": Clock,
    "90 derniers jours": CalendarClock,
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Calendar className="h-3.5 w-3.5" />
          <span className="text-xs">{currentLabel}</span>
          <ChevronDown className="h-3 w-3" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72 p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-3 py-2">
          <p className="text-[10px] uppercase tracking-wider font-bold opacity-80">Période sélectionnée</p>
          <p className="text-sm font-semibold mt-0.5 truncate">{currentLabel}</p>
        </div>

        <div className="p-1">
          {presets.map((p) => {
            const Icon = presetIcons[p.label] ?? Calendar;
            const isActive = p.label === currentLabel;
            return (
              <button
                key={p.label}
                type="button"
                onClick={() => apply(p.from, p.to)}
                className={`w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition ${
                  isActive
                    ? "bg-[#0F2D52] text-white font-semibold"
                    : "hover:bg-[#0F2D52]/5 text-foreground"
                }`}
              >
                <Icon className={`h-3.5 w-3.5 ${isActive ? "text-white" : "text-[#0F2D52]"}`} />
                <span className="flex-1 text-left">{p.label}</span>
                {isActive && <CheckCircle2 className="h-3 w-3" />}
              </button>
            );
          })}
        </div>

        <div className="border-t bg-muted/20 p-3 space-y-2" onClick={(e) => e.stopPropagation()}>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52]">Personnalisé</p>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1 min-w-0">
              <Label className="block text-[9px] uppercase tracking-wider text-muted-foreground">Du</Label>
              <DatePopover value={customFrom} onChange={setCustomFrom} max={isoDate(new Date())} className="w-full justify-start" />
            </div>
            <div className="space-y-1 min-w-0">
              <Label className="block text-[9px] uppercase tracking-wider text-muted-foreground">Au</Label>
              <DatePopover value={customTo} onChange={setCustomTo} min={customFrom || undefined} max={isoDate(new Date())} className="w-full justify-start" />
            </div>
          </div>
          <Button
            size="sm"
            className="w-full h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white font-semibold"
            onClick={applyCustom}
            disabled={!customFrom || !customTo}
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />Appliquer la période
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ════════════════════════════════════════════════════════════════
// Employee view: clock in/out, history grouped by day, stats.
// ════════════════════════════════════════════════════════════════
const SUBMITTABLE_CATS = new Set(["work", "meeting", "training"]);
const LEAVE_CATS = new Set(["vacation", "sick", "parental", "bereavement"]);

function TimeclockEmployeeView({
  myEntries, entriesTruncated = false, openEntry, currentAdminId, periodFrom, periodTo, holidays,
  overtimeWeeklyMin = 40 * 60,
  geolocEnabled = false, kioskEnabled = false, hasKioskPin = false, kioskPinSetAt = null,
  kioskPinRequestedAt = null,
}: {
  myEntries: Entry[];
  entriesTruncated?: boolean;
  overtimeWeeklyMin?: number;
  openEntry: Entry | null;
  currentAdminId: number;
  periodFrom?: string;
  periodTo?: string;
  holidays: HolidayMap;
  geolocEnabled?: boolean;
  kioskEnabled?: boolean;
  hasKioskPin?: boolean;
  kioskPinSetAt?: string | null;
  kioskPinRequestedAt?: string | null;
}) {
  const router = useRouter();
  const [manualOpen, setManualOpen] = useState(false);
  const [manualPresetDate, setManualPresetDate] = useState<string | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [submitWeekOpen, setSubmitWeekOpen] = useState(false);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set([todayKey()]));
  // VNK rule: every PDF goes through PdfPreviewModal.
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  // A long period is dozens of screens of day cards without this.
  const DAYS_PER_PAGE = 15;
  const [dayPage, setDayPage] = useState(1);
  // The bar only carries the totals once the KPI tiles have scrolled away;
  // otherwise it repeats them a few pixels below.
  const kpiSentinelRef = useRef<HTMLDivElement>(null);
  const [kpisHidden, setKpisHidden] = useState(false);
  useEffect(() => {
    const el = kpiSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => setKpisHidden(!entry.isIntersecting),
      { threshold: 0, rootMargin: "-64px 0px 0px 0px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const myStats = useMemo(() => {
    // Gross = worked + deducted breaks; durationMin alone is already net.
    const total = myEntries.reduce((s, e) => s + (entryTiming(e).gross ?? 0), 0);
    const work = myEntries.filter((e) => SUBMITTABLE_CATS.has(e.category)).reduce((s, e) => s + (e.durationMin ?? 0), 0);
    const approved = myEntries.filter((e) => e.approvedAt).reduce((s, e) => s + (e.durationMin ?? 0), 0);
    const pending = myEntries.filter((e) => !e.approvedAt && e.clockOut).reduce((s, e) => s + (e.durationMin ?? 0), 0);
    return { total, work, approved, pending };
  }, [myEntries]);

  // Current-week entries (Sunday -> Saturday) eligible for submission.
  const submittableThisWeek = useMemo(() => {
    const ws = startOfWeek(new Date());
    const we = endOfWeek(new Date());
    return myEntries.filter((e) => {
      const d = new Date(e.clockIn);
      return d >= ws && d <= we && e.clockOut && !e.approvedAt && !e.submittedAt && SUBMITTABLE_CATS.has(e.category);
    });
  }, [myEntries]);

  // A day paid at double time. Its minutes never enter the overtime base:
  // payroll already pays them x2 and would otherwise stack the premiums.
  const isPaidHolidayDay = useCallback(
    (date: string) => holidays[date]?.isPaid === true,
    [holidays],
  );

  // Overtime over the displayed period, same rule as payroll: past the weekly
  // threshold (40h by default), holidays counted in but never paid 1.5x.
  const { totalOvertimeMin, holidayWorkedMin } = useMemo(() => {
    const worked = myEntries
      .filter((e) => SUBMITTABLE_CATS.has(e.category))
      .map((e) => ({ clockIn: new Date(e.clockIn), durationMin: e.durationMin, category: e.category }));
    const holidayMin = worked
      .filter((e) => isPaidHolidayDay(isoDate(e.clockIn)))
      .reduce((s, e) => s + (e.durationMin ?? 0), 0);
    return {
      totalOvertimeMin: overtimeMinutes(
        worked,
        (d) => isoDate(startOfWeek(d)),
        overtimeWeeklyMin,
        (d) => isPaidHolidayDay(isoDate(d)),
      ),
      holidayWorkedMin: holidayMin,
    };
  }, [myEntries, overtimeWeeklyMin, isPaidHolidayDay]);

  // Group by date and inject the empty working days of the current week.
  const groupedByDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of myEntries) {
      const key = dayKey(e.clockIn);
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(e);
    }

    // Empty working days between Sunday and today, only when the period
    // covers them and includes today, else "90 days" fills up with blanks.
    const today = new Date();
    const periodFromDate = periodFrom ? new Date(periodFrom) : null;
    const periodToDate = periodTo ? new Date(periodTo) : null;
    const todayInPeriod =
      !periodFromDate || !periodToDate
        ? true
        : today >= periodFromDate && today <= periodToDate;
    if (todayInPeriod) {
      const ws = startOfWeek(today);
      const cursor = new Date(ws);
      while (cursor <= today) {
        const dow = cursor.getDay();
        const key = isoDate(cursor);
        const isWeekend = dow === 0 || dow === 6;
        if (!map.has(key) && !isWeekend) {
          map.set(key, []);
        }
        cursor.setDate(cursor.getDate() + 1);
      }
    }

    return Array.from(map.entries())
      .map(([date, entries]) => {
        const sorted = [...entries].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
        // Counts legacy "break" entries AND pause/resume minutes, otherwise a
        // button-punched break reads as non-compliant.
        let workMin = 0;
        let breakMin = 0;
        for (const e of sorted) {
          const dur = e.durationMin ?? 0;
          if (SUBMITTABLE_CATS.has(e.category)) workMin += dur;
          else if (e.category === "break") breakMin += dur;
          const t = entryTiming(e);
          breakMin += t.breakMin + t.paidBreakMin;
        }
        // A day made only of manual entries has no tracked break detail, so
        // treat it as compliant: the CNESST rule only targets real punches.
        const allManual = sorted.length > 0 && sorted.every((e) => e.isManual);
        const compliant = allManual || workMin < 300 || breakMin >= 30;
        // Real bracket of the day and the time inside it that was NOT worked,
        // so a day made of scattered punches cannot read as one long shift.
        const closed = sorted.filter((e) => e.clockOut);
        const firstIn = closed.length > 0
          ? Math.min(...closed.map((e) => new Date(e.clockIn).getTime()))
          : null;
        const lastOut = closed.length > 0
          ? Math.max(...closed.map((e) => new Date(e.clockOut!).getTime()))
          : null;
        const spanMin = firstIn != null && lastOut != null
          ? minutesBetween(new Date(firstIn), new Date(lastOut))
          : 0;
        const totalMin = sorted.reduce((s, e) => s + (e.durationMin ?? 0), 0);
        return {
          date,
          entries: sorted,
          spanLabel: firstIn != null && lastOut != null
            ? `${fmtTime(new Date(firstIn))} → ${fmtTime(new Date(lastOut))}`
            : "En cours",
          idleMin: Math.max(0, spanMin - totalMin),
          isEmpty: sorted.length === 0,
          totalMin: sorted.reduce((s, e) => s + (e.durationMin ?? 0), 0),
          workMin,
          breakMin,
          compliant,
          allManual,
          hasOpen: sorted.some((e) => !e.clockOut),
          categories: Array.from(new Set(sorted.map((e) => e.category))),
          allApproved: sorted.length > 0 && sorted.every((e) => e.approvedAt),
          anyPending: sorted.some((e) => !e.approvedAt && e.clockOut),
          allSubmitted: sorted.length > 0 && sorted.every((e) => e.submittedAt || e.approvedAt),
          shortCount: sorted.filter((e) => (e.durationMin ?? 0) > 0 && (e.durationMin ?? 0) < 5 && !e.approvedAt && !e.payStubId).length,
          // Only offer the merge when at least two punches are close enough
          // to be bridged (same rule as the server: 15 min).
          mergeableCount: (() => {
            const ok = sorted.filter(
              (e) => e.category === "work" && e.clockOut && !e.approvedAt && !e.submittedAt && !e.payStubId,
            );
            const close = ok.filter((e, i) =>
              i > 0 && minutesBetween(ok[i - 1].clockOut!, e.clockIn) <= MERGE_MAX_GAP_MIN);
            return close.length > 0 ? ok.length : 0;
          })(),
          holiday: holidays[date] ?? null,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [myEntries, holidays, periodFrom, periodTo]);

  // Best-effort GPS capture (feature-flagged). Never blocks the punch:
  // resolves {} on denial/timeout — the server enforces geofencing if active.
  const getPunchCoords = (): Promise<{ lat?: number; lng?: number }> =>
    new Promise((resolve) => {
      if (!geolocEnabled || typeof navigator === "undefined" || !navigator.geolocation) {
        return resolve({});
      }
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => resolve({}),
        { timeout: 4000, maximumAge: 60000 },
      );
    });

  const handleClockIn = async (category: string = "work") => {
    const coords = await getPunchCoords();
    const r = await clockInAction({ category, ...coords });
    if (r.success) { toast.success(`Pointage démarré · ${CAT_LABEL[category]?.label ?? category}`); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };
  const handleClockOut = async () => {
    const coords = await getPunchCoords();
    const r = await clockOutAction(coords);
    if (r.success) { toast.success(`Pointage fermé à ${fmtDuration(r.data.durationMin)}`); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  // Real-time weekly overtime banner: worked minutes in the CURRENT week
  // (Sunday-based), including the running shift.
  const weekOvertime = useMemo(() => {
    const ws = startOfWeek(new Date());
    const weekEndExcl = new Date(ws);
    weekEndExcl.setDate(weekEndExcl.getDate() + 7);
    let total = 0;
    for (const e of myEntries) {
      const ci = new Date(e.clockIn);
      if (ci < ws || ci >= weekEndExcl) continue;
      if (!SUBMITTABLE_CATS.has(e.category)) continue;
      total += e.durationMin ?? 0;
    }
    if (openEntry && !openEntry.pausedAt) {
      const ci = new Date(openEntry.clockIn);
      if (ci >= ws && SUBMITTABLE_CATS.has(openEntry.category)) {
        total += workedMin(ci, new Date(), openEntry.totalBreakMin);
      }
    }
    const THRESHOLD = overtimeWeeklyMin;
    const WARN = Math.round(overtimeWeeklyMin * 0.9);
    return {
      totalMin: total,
      level: total >= THRESHOLD ? ("over" as const) : total >= WARN ? ("warn" as const) : null,
      overMin: Math.max(0, total - THRESHOLD),
    };
  }, [myEntries, openEntry, overtimeWeeklyMin]);

  const toggleDay = (date: string) => {
    setExpanded((s) => {
      const n = new Set(s);
      if (n.has(date)) n.delete(date); else n.add(date);
      return n;
    });
  };

  // A shift can be closed from the kiosk while this page stays open, which
  // would keep the counter running on stale data. Re-sync on focus and every
  // 60s while a shift is open.
  useEffect(() => {
    if (!openEntry) return;
    const sync = () => { if (document.visibilityState === "visible") router.refresh(); };
    window.addEventListener("focus", sync);
    document.addEventListener("visibilitychange", sync);
    const t = setInterval(sync, 60_000);
    return () => {
      window.removeEventListener("focus", sync);
      document.removeEventListener("visibilitychange", sync);
      clearInterval(t);
    };
  }, [openEntry, router]);

  // No idle detection: an employee's hours are never changed automatically.
  // He alone decides when he starts, pauses and ends.

  // Pause / resume mutate the running shift instead of creating an entry.
  // QC rules: meal unpaid (deducted), short break paid (never deducted).
  const handlePause = async (kind: "meal" | "paid") => {
    if (!openEntry) return;
    const r = await pauseClockAction({ kind });
    if (r.success) {
      toast.success(kind === "paid" ? "Pause courte (payée)" : "Pause repas");
      router.refresh();
    } else {
      toast.error(r.error || "");
    }
  };
  const handleResume = async () => {
    if (!openEntry) return;
    const r = await resumeClockAction();
    if (r.success) {
      toast.success("Reprise");
      router.refresh();
    } else {
      toast.error(r.error || "");
    }
  };

  // Toast undo helper
  const undoToast = useCallback((snapshotId: number, successMsg: string) => {
    toast.success(successMsg, {
      duration: 10_000,
      action: {
        label: "Annuler",
        onClick: async () => {
          const u = await undoTimeClockSnapshotAction({ snapshotId });
          if (u.success) toast.success(`${u.data.restored} entrée(s) restaurée(s)`);
          else toast.error(u.error || "");
          router.refresh();
        },
      },
    });
  }, [router]);

  const TODAY = todayKey();

  useEffect(() => { setDayPage(1); }, [periodFrom, periodTo, groupedByDay.length]);

  const dayTotalPages = Math.max(1, Math.ceil(groupedByDay.length / DAYS_PER_PAGE));
  const dayFrom = groupedByDay.length === 0 ? 0 : (dayPage - 1) * DAYS_PER_PAGE + 1;
  const dayTo = Math.min(groupedByDay.length, dayPage * DAYS_PER_PAGE);
  const pagedDays = groupedByDay.slice((dayPage - 1) * DAYS_PER_PAGE, dayPage * DAYS_PER_PAGE);
  const pdfHref = useMemo(() => {
    if (periodFrom && periodTo) {
      return `/api/admin/timeclock/me/pdf?from=${isoDate(new Date(periodFrom))}&to=${isoDate(new Date(periodTo))}`;
    }
    return "/api/admin/timeclock/me/pdf";
  }, [periodFrom, periodTo]);

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <Clock className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">Mon pointage</h1>
              <p className="text-xs text-white/80">
                Suivez vos heures de travail · approuvées avant chaque paie.
              </p>
            </div>
          </div>

          {openEntry ? (
            <div className="flex items-center gap-2 flex-wrap">
              {openEntry.pausedAt ? (
                <>
                  <span className="px-2.5 py-1.5 rounded-md bg-amber-400/20 border border-amber-300/30 text-xs font-mono text-white">
                    {(openEntry as { pausedKind?: string | null }).pausedKind === "paid"
                      ? "Pause courte (payée)"
                      : "Pause repas"}
                  </span>
                  <Button
                    variant="outline" size="sm"
                    onClick={handleResume}
                    className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur"
                  >
                    <Play className="h-3.5 w-3.5 mr-1.5" />Reprendre
                  </Button>
                </>
              ) : (
                <>
                  <LiveShiftCounter
                    clockIn={openEntry.clockIn}
                    pausedAt={openEntry.pausedAt}
                    totalBreakMin={openEntry.totalBreakMin ?? 0}
                    variant="light"
                  />
                  <ActionTooltip label="Pause repas — non payée, déduite des heures">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => handlePause("meal")}
                      className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur"
                    >
                      <Coffee className="h-3.5 w-3.5 mr-1.5" />Repas
                    </Button>
                  </ActionTooltip>
                  <ActionTooltip label="Pause courte — payée, tracée mais non déduite">
                    <Button
                      variant="outline" size="sm"
                      onClick={() => handlePause("paid")}
                      className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur"
                    >
                      <Coffee className="h-3.5 w-3.5 mr-1.5" />Pause courte
                    </Button>
                  </ActionTooltip>
                </>
              )}
              <Button
                size="sm"
                onClick={handleClockOut}
                className="bg-red-500 hover:bg-red-600 text-white border-0"
              >
                <Square className="h-4 w-4 mr-1.5" />Arrêter
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              <div className="[&_button]:!bg-white/10 [&_button]:hover:!bg-white/20 [&_button]:!text-white [&_button]:!border-white/20 [&_button]:backdrop-blur">
                <PeriodFilter from={periodFrom} to={periodTo} />
              </div>
              {submittableThisWeek.length > 0 && (
                <Button
                  variant="outline" size="sm"
                  onClick={() => setSubmitWeekOpen(true)}
                  className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur"
                >
                  <Send className="h-3.5 w-3.5 mr-1.5" />Soumettre la semaine ({submittableThisWeek.length})
                </Button>
              )}
              <ActionTooltip label={myEntries.length === 0 ? "Aucune donnée à exporter pour cette période" : "Aperçu PDF du relevé"}>
                <Button
                  variant="outline" size="sm"
                  onClick={() => setPdfPreviewOpen(true)}
                  disabled={myEntries.length === 0}
                  className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />Aperçu PDF
                </Button>
              </ActionTooltip>
              <Button
                variant="outline" size="sm"
                onClick={() => setManualOpen(true)}
                className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur"
              >
                <Plus className="h-3.5 w-3.5 mr-1.5" />Saisie manuelle
              </Button>
              <Button
                size="sm"
                onClick={() => handleClockIn("work")}
                className="bg-white text-[#0F2D52] hover:bg-white/90 font-semibold border-0"
              >
                <Play className="h-4 w-4 mr-1.5" />Commencer ma journée
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Gentle reminder: 5h+ continuous shift without any punched break
          (aligned with QC norms — same threshold for everyone, no per-person
          config; nothing is ever auto-deducted). */}
      {openEntry && !openEntry.pausedAt
        && (openEntry.totalBreakMin ?? 0) === 0
        && (((openEntry as { paidBreakMin?: number }).paidBreakMin) ?? 0) === 0
        && Date.now() - new Date(openEntry.clockIn).getTime() >= 5 * 60 * 60 * 1000 && (
        <div className="rounded-md border border-sky-300 bg-sky-50 px-3 py-2.5 flex items-center gap-2.5 text-sm text-sky-900">
          <Coffee className="h-4 w-4 shrink-0 text-sky-600" />
          <span>
            Vous travaillez depuis plus de 5 h sans pause punchée — si vous en
            avez pris une, pensez à la puncher (Repas ou Pause courte).
          </span>
        </div>
      )}

      {/* Real-time weekly overtime banner (36h warning, 40h+ alert) */}
      {weekOvertime.level && (
        <div
          className={`rounded-md border px-3 py-2.5 flex items-center gap-2.5 text-sm ${
            weekOvertime.level === "over"
              ? "border-red-300 bg-red-50 text-red-900"
              : "border-amber-300 bg-amber-50 text-amber-900"
          }`}
        >
          <AlertTriangle className={`h-4 w-4 shrink-0 ${weekOvertime.level === "over" ? "text-red-600" : "text-amber-600"}`} />
          {weekOvertime.level === "over" ? (
            <span>
              <span className="font-semibold">Temps supplémentaire :</span>{" "}
              {fmtDuration(weekOvertime.totalMin)} cette semaine — vous avez dépassé 40 h de{" "}
              {fmtDuration(weekOvertime.overMin)}.
            </span>
          ) : (
            <span>
              <span className="font-semibold">Attention :</span> {fmtDuration(weekOvertime.totalMin)}{" "}
              cette semaine — le seuil de temps supplémentaire (40 h) approche.
            </span>
          )}
        </div>
      )}

      {openEntry && dayKey(openEntry.clockIn) !== TODAY && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-700" />
          <div className="min-w-0 flex-1">
            <p className="font-semibold">
              Pointage du {capFirst(new Date(openEntry.clockIn).toLocaleDateString("fr-CA", { weekday: "long", day: "numeric", month: "long" }))} jamais fermé
            </p>
            <p className="mt-0.5">
              Il tourne encore depuis {fmtTime(openEntry.clockIn)}. Tant qu&apos;il reste ouvert, vous ne pouvez pas soumettre votre semaine —
              arrêtez-le et corrigez l&apos;heure de fin si besoin.
            </p>
          </div>
          <Button size="sm" variant="destructive" className="h-8 text-xs shrink-0" onClick={handleClockOut}>
            <Square className="h-3 w-3 mr-1" />Arrêter
          </Button>
        </div>
      )}

      {entriesTruncated && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span>
            Période trop longue : seuls les premiers pointages sont chargés, les totaux
            ci-dessous sont donc incomplets. Choisissez une période plus courte.
          </span>
        </div>
      )}
      <div className={`grid grid-cols-2 gap-2 ${holidayWorkedMin > 0 ? "md:grid-cols-6" : "md:grid-cols-5"}`}>
        <StatBox label="Total brut" value={fmtDuration(myStats.total)} accent="emerald" hint="Avec pauses" icon={Clock} />
        <StatBox label="Travail" value={fmtDuration(myStats.work)} accent="blue" icon={Briefcase} />
        <StatBox label="Heures sup." value={fmtDuration(totalOvertimeMin)} accent="blue" hint="Payées x1,5" icon={TrendingUp} />
        {holidayWorkedMin > 0 && (
          <StatBox label="Férié travaillé" value={fmtDuration(holidayWorkedMin)} accent="amber" hint="Payé x2" icon={CalendarDays} />
        )}
        <StatBox label="Approuvé" value={fmtDuration(myStats.approved)} accent="emerald" icon={CheckCircle2} />
        {/* Odd tile count in a 2-col grid: the last one spans, no orphan half-row. */}
        <div className={holidayWorkedMin > 0 ? "md:col-span-1" : "col-span-2 md:col-span-1"}>
          <StatBox label="En attente" value={fmtDuration(myStats.pending)} accent="amber" icon={AlertCircle} />
        </div>
      </div>
      <div ref={kpiSentinelRef} aria-hidden className="h-px" />

      {/* Kiosk punch, only when the kiosk is enabled */}
      {kioskEnabled && (
        <MyKioskPinCard
          hasPin={hasKioskPin}
          pinSetAt={kioskPinSetAt}
          pinRequestedAt={kioskPinRequestedAt}
        />
      )}

      {dayTotalPages > 1 && (
        <div className="sticky top-[100px] lg:top-[64px] z-20 px-3 sm:px-4 rounded-b-lg pt-3 pb-2.5 bg-slate-50 border-t-[3px] border-t-[#0F2D52] border-b border-b-slate-200 shadow-[0_3px_8px_-3px_rgba(15,45,82,0.22)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <p className="text-xs text-muted-foreground tabular-nums truncate">
              Jours {dayFrom}–{dayTo} sur {groupedByDay.length}
            </p>
            {kpisHidden && (
              <>
                <span className="hidden sm:inline-flex items-center gap-1.5 text-xs shrink-0">
                  <span className="text-muted-foreground">Travail</span>
                  <span className="font-mono font-bold tabular-nums text-[#0F2D52]">{fmtDuration(myStats.work)}</span>
                </span>
                {myStats.pending > 0 && (
                  <span className="hidden md:inline-flex items-center gap-1.5 text-xs shrink-0">
                    <span className="text-muted-foreground">En attente</span>
                    <span className="font-mono font-bold tabular-nums text-amber-700">{fmtDuration(myStats.pending)}</span>
                  </span>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3"
              disabled={dayPage <= 1}
              onClick={() => { setDayPage((n) => n - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
              <ChevronLeft className="h-3.5 w-3.5 sm:mr-1" /><span className="hidden sm:inline">Précédent</span>
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums px-1">
              {dayPage} / {dayTotalPages}
            </span>
            <Button
              variant="outline" size="sm" className="h-8 text-xs px-2 sm:px-3"
              disabled={dayPage >= dayTotalPages}
              onClick={() => { setDayPage((n) => n + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}
            >
<span className="hidden sm:inline">Suivant</span><ChevronRight className="h-3.5 w-3.5 sm:ml-1" />
            </Button>
          </div>
        </div>
      )}

      <div className="space-y-2">
        {groupedByDay.length === 0 ? (
          <Card>
            <div className="p-8 text-center text-sm text-muted-foreground">
              Aucun pointage sur la période sélectionnée.
            </div>
          </Card>
        ) : (
          pagedDays.map((day) => {
            const isOpen = expanded.has(day.date);
            const isToday = day.date === TODAY;
            const dateLabel = capFirst(new Date(day.date + "T12:00:00").toLocaleDateString("fr-CA", {
              weekday: "long", day: "numeric", month: "long",
            }));
            const canMerge = day.mergeableCount >= 2;
            const canDeleteShorts = day.shortCount >= 1;

            // Empty-day card: working days between Sunday and today only.
            if (day.isEmpty) {
              return (
                <Card key={day.date} className="border-amber-200 bg-amber-50/40 p-0 overflow-hidden">
                  <div className="flex items-center gap-3 p-3">
                    <AlertCircle className="h-4 w-4 text-amber-700 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-amber-900">{dateLabel}</span>
                        {isToday && (
                          <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">Aujourd&apos;hui</Badge>
                        )}
                        {day.holiday && (
                          <Badge className="text-[10px] bg-cyan-100 text-cyan-800 border-cyan-300">
                            Férié — {day.holiday.name}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-amber-900/80 mt-0.5">Aucune entrée enregistrée</p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100"
                      onClick={() => { setManualPresetDate(day.date); setManualOpen(true); }}
                    >
                      <Plus className="h-3 w-3 mr-1" />Ajouter saisie manuelle
                    </Button>
                  </div>
                </Card>
              );
            }

            return (
              <Card key={day.date} className="overflow-hidden p-0">
                <button
                  type="button"
                  onClick={() => toggleDay(day.date)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-muted/40 text-left"
                  aria-expanded={isOpen}
                >
                  {isOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-semibold">{dateLabel}</span>
                      {isToday && (
                        <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">Aujourd&apos;hui</Badge>
                      )}
                      {day.holiday && (
                        <Badge className="text-[10px] bg-cyan-100 text-cyan-800 border-cyan-300">
                          Férié — {day.holiday.name}
                        </Badge>
                      )}
                      {day.categories.map((c) => {
                        const cat = CAT_LABEL[c] ?? { label: c, color: "bg-gray-100 text-gray-700" };
                        return <Badge key={c} className={`text-[10px] ${cat.color}`}>{cat.label}</Badge>;
                      })}
                      {day.hasOpen && (
                        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">En cours</Badge>
                      )}
                      {!day.hasOpen && day.allApproved && (
                        <Badge className="text-[10px] bg-emerald-600 text-white border-emerald-700 hover:bg-emerald-700">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-1" />Tout validé
                        </Badge>
                      )}
                      {!day.hasOpen && !day.allApproved && day.allSubmitted && (
                        <Badge variant="outline" className="text-[10px] border-blue-300 text-blue-700 bg-blue-50">
                          <Lock className="h-2.5 w-2.5 mr-1" />Verrouillé
                        </Badge>
                      )}
                      {!day.hasOpen && !day.allApproved && !day.allSubmitted && day.anyPending && (
                        <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                          <AlertCircle className="h-2.5 w-2.5 mr-1" />En attente
                        </Badge>
                      )}
                    </div>
                    {/* Day summary: real bracket, unworked time and punch count. */}
                    <p className="text-[11px] text-muted-foreground mt-1 tabular-nums">
                      {day.spanLabel}
                      {day.idleMin > 0 && ` · ${fmtDuration(day.idleMin)} hors travail`}
                      {` · ${day.entries.length} pointage${day.entries.length > 1 ? "s" : ""}`}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-lg font-bold tabular-nums text-[#0F2D52]">{fmtDuration(day.totalMin)}</p>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Travaillé</p>
                  </div>
                </button>

                {/* Where the day actually happened: blocks are worked, gaps are not. */}
                <DayTimeline entries={day.entries} showLegend={day.date === pagedDays[0]?.date} />

                {isOpen && (
                  <div>
                    {(canMerge || canDeleteShorts) && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-muted/30 border-t">
                        {canMerge && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              const ok = await confirmDialog({
                                title: "Fusionner les pointages",
                                description: `Regrouper les pointages "Travail" qui se suivent à moins de 15 minutes (sortie puis rentrée par erreur). Le temps entre eux est compté en pause, et les pointages plus éloignés restent séparés.`,
                                confirmLabel: "Fusionner",
                              });
                              if (!ok) return;
                              const r = await mergeDayTimeClockAction({ date: day.date });
                              if (r.success) {
                                undoToast(
                                  r.data.snapshotId,
                                  r.data.groups > 1
                                    ? `${r.data.punches} pointages regroupés en ${r.data.groups} entrées`
                                    : `${r.data.punches} pointages fusionnés`,
                                );
                                router.refresh();
                              } else toast.error(r.error || "");
                            }}
                          >
                            <Layers className="h-3.5 w-3.5 mr-1.5" />Fusionner ({day.mergeableCount})
                          </Button>
                        )}
                        {canDeleteShorts && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs text-red-700 hover:text-red-800 hover:bg-red-50"
                            onClick={async (ev) => {
                              ev.stopPropagation();
                              const ok = await confirmDialog({
                                title: "Supprimer les pointages courts",
                                description: `Supprimer les ${day.shortCount} pointage(s) de moins de 5 minutes de cette journée ?`,
                                confirmLabel: "Supprimer",
                                variant: "destructive",
                              });
                              if (!ok) return;
                              const r = await deleteShortTimeClockAction({ date: day.date, maxMin: 5 });
                              if (r.success) {
                                undoToast(r.data.snapshotId, `${r.data.deleted} supprimé(s)`);
                                router.refresh();
                              } else toast.error(r.error || "");
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" />Supprimer courts ({day.shortCount})
                          </Button>
                        )}
                      </div>
                    )}
                    <div className="divide-y">
                      {day.entries.map((e) => (
                        <CompactEntryRow
                          key={e.id}
                          entry={e}
                          canEdit={e.adminId === currentAdminId && !e.payStubId && !e.submittedAt && !e.approvedAt}
                          isLocked={!!e.submittedAt && !e.approvedAt}
                          onEdit={() => setEditEntry(e)}
                          onDelete={async () => {
                            const r = await deleteTimeClockAction({ id: e.id });
                            if (r.success) { toast.success("Supprimé"); router.refresh(); }
                            else toast.error(r.error || "");
                          }}
                          onRequestUnlock={async () => {
                            const reason = await promptDialog({
                              title: "Demander modification",
                              label: "Pourquoi cette modification ?",
                              placeholder: "Ex : oubli pointage, mauvaise heure...",
                              multiline: true,
                              required: true,
                              confirmLabel: "Envoyer la demande",
                            });
                            if (!reason) return;
                            const r = await requestEditTimeClockAction({ ids: [e.id], reason });
                            if (r.success) { toast.success("Demande envoyée"); router.refresh(); }
                            else toast.error(r.error || "");
                          }}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>

      <ManualEntryDialog
        open={manualOpen}
        onClose={() => { setManualOpen(false); setManualPresetDate(null); }}
        onSaved={() => router.refresh()}
        presetDate={manualPresetDate}
      />

      {/* VNK rule: PDFs never open via window.open or a bare <a href>. */}
      <PdfPreviewModal
        open={pdfPreviewOpen}
        url={pdfPreviewOpen ? pdfHref : null}
        title="Mon relevé de pointage"
        description={periodFrom && periodTo
          ? `Période ${new Date(periodFrom).toLocaleDateString("fr-CA")} → ${new Date(periodTo).toLocaleDateString("fr-CA")}`
          : undefined}
        downloadFilename="releve-pointage.pdf"
        onClose={() => setPdfPreviewOpen(false)}
      />

      {editEntry && (
        <EditEntryDialog
          entry={editEntry}
          isAdminOverride={false}
          onClose={() => setEditEntry(null)}
          onSaved={() => { setEditEntry(null); router.refresh(); }}
        />
      )}

      <SubmitWeekDialog
        open={submitWeekOpen}
        onClose={() => setSubmitWeekOpen(false)}
        weekEntries={myEntries.filter((e) => {
          const ws = startOfWeek(new Date());
          const we = endOfWeek(new Date());
          const d = new Date(e.clockIn);
          // Like submittableThisWeek: approved/submitted excluded.
          return d >= ws && d <= we && e.clockOut && !e.approvedAt && !e.submittedAt;
        })}
        onSaved={() => { setSubmitWeekOpen(false); router.refresh(); }}
      />

    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// DayTimeline — proportional bar of the day. Worked blocks are solid, the
// stretches between them are hatched and labelled, so a day of scattered
// punches cannot read as one long shift.
function DayTimeline({ entries, showLegend = false }: { entries: Entry[]; showLegend?: boolean }) {
  const closed = entries
    .filter((e) => e.clockOut)
    .sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
  if (closed.length === 0) return null;
  const start = new Date(closed[0].clockIn).getTime();
  const end = Math.max(...closed.map((e) => new Date(e.clockOut!).getTime()));
  const span = end - start;
  if (span <= 60_000) return null;

  // Worked blocks and the gaps between them, so the empty stretches are
  // labelled instead of reading as a broken bar.
  type Seg = { kind: "work" | "gap"; from: number; to: number };
  const segs: Seg[] = [];
  let cursor = start;
  for (const e of closed) {
    const s = new Date(e.clockIn).getTime();
    const t = new Date(e.clockOut!).getTime();
    if (s > cursor) segs.push({ kind: "gap", from: cursor, to: s });
    segs.push({ kind: "work", from: s, to: t });
    cursor = Math.max(cursor, t);
  }

  const pct = (v: number) => (v / span) * 100;

  return (
    <div className="px-3 pb-2.5 -mt-0.5">
      <div className="relative h-2.5 rounded-full bg-muted/70 overflow-hidden ring-1 ring-border">
        {segs.map((seg) => {
          const mins = minutesBetween(new Date(seg.from), new Date(seg.to));
          const range = `${fmtTime(new Date(seg.from))} → ${fmtTime(new Date(seg.to))}`;
          const label = seg.kind === "work"
            ? `Travaillé · ${range} · ${fmtDuration(mins)}`
            : `Hors travail · ${range} · ${fmtDuration(mins)}`;
          return (
            <ActionTooltip key={`${seg.kind}-${seg.from}`} label={label}>
              <div
                className={
                  seg.kind === "work"
                    ? "absolute inset-y-0 rounded-full bg-[#0F2D52] cursor-help"
                    : "absolute inset-y-0 cursor-help"
                }
                style={{
                  left: `${pct(seg.from - start)}%`,
                  width: `${Math.max(seg.kind === "work" ? 0.7 : 0, pct(seg.to - seg.from))}%`,
                  ...(seg.kind === "gap"
                    ? {
                        backgroundImage:
                          "repeating-linear-gradient(135deg, rgba(100,116,139,.35) 0 3px, transparent 3px 6px)",
                      }
                    : {}),
                }}
              />
            </ActionTooltip>
          );
        })}
      </div>
      <div className="flex items-center justify-between gap-2 mt-1 text-[9px] text-muted-foreground tabular-nums">
        <span>{fmtTime(new Date(start))}</span>
        <span className={`items-center gap-2.5 shrink-0 ${showLegend ? "flex" : "hidden"}`}>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-3 rounded-full bg-[#0F2D52]" aria-hidden />
            Travaillé
          </span>
          {segs.some((x) => x.kind === "gap") && (
            <span className="flex items-center gap-1">
              <span
                className="h-1.5 w-3 rounded-full ring-1 ring-border"
                style={{
                  backgroundImage:
                    "repeating-linear-gradient(135deg, rgba(100,116,139,.35) 0 3px, transparent 3px 6px)",
                }}
                aria-hidden
              />
              Hors travail
            </span>
          )}
        </span>
        <span>{fmtTime(new Date(end))}</span>
      </div>
    </div>
  );
}

// MyKioskPinCard — the employee reads his own kiosk PIN after confirming
// his password. HR issues and replaces it, never reads it.
// ════════════════════════════════════════════════════════════════
function MyKioskPinCard({
  hasPin, pinSetAt, pinRequestedAt,
}: {
  hasPin: boolean;
  pinSetAt: string | null;
  pinRequestedAt: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [revealed, setRevealed] = useState<string | null>(null);

  // PIN request. Acts as a ticket: HR sees it in the time clock settings.
  const requestPin = async () => {
    const ok = await confirmDialog({
      title: hasPin ? "Demander un nouveau NIP" : "Demander un NIP",
      description: hasPin
        ? "Les ressources humaines seront prévenues et vous remettront un nouveau NIP. L'actuel restera valide jusque-là."
        : "Les ressources humaines seront prévenues et vous attribueront un NIP pour la borne.",
      confirmLabel: "Envoyer la demande",
    });
    if (!ok) return;
    setBusy(true);
    const r = await requestKioskPinAction();
    setBusy(false);
    if (r.success) { toast.success("Demande envoyée aux ressources humaines"); router.refresh(); }
    else toast.error(r.error || "Erreur");
  };

  // Revealing the PIN requires re-entering the account password.
  const reveal = async () => {
    const password = await promptDialog({
      title: "Afficher mon NIP",
      label: "Confirmez votre mot de passe",
      placeholder: "Mot de passe du compte",
      password: true,
      required: true,
      confirmLabel: "Afficher",
    });
    if (!password) return;
    setBusy(true);
    const r = await revealMyKioskPinAction({ password });
    setBusy(false);
    if (r.success) setRevealed(r.data.pin);
    else toast.error(r.error || "Erreur");
  };

  return (
    <>
      <Card className="p-3.5">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="h-9 w-9 rounded-md bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center shrink-0" aria-hidden>
            <Monitor className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">Punch sur la borne</p>
              {hasPin ? (
                <Badge variant="outline" className="text-[10px] text-emerald-700 border-emerald-300 bg-emerald-50">
                  NIP actif
                  {pinSetAt ? ` · ${capFirst(new Date(pinSetAt).toLocaleDateString("fr-CA", { day: "numeric", month: "long" }))}` : ""}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 bg-slate-50">
                  Aucun NIP
                </Badge>
              )}
              {pinRequestedAt && (
                <Badge variant="outline" className="text-[10px] text-amber-800 border-amber-300 bg-amber-50">
                  Demande envoyée
                </Badge>
              )}
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {pinRequestedAt
                ? "Votre demande est en attente — les ressources humaines vous remettront un NIP."
                : hasPin
                  ? "Code à 4 chiffres qui vous identifie sur la tablette partagée. Oublié ? Affichez-le avec votre mot de passe."
                  : "Les ressources humaines vous remettent un NIP à 4 chiffres pour poinçonner sur la tablette partagée."}
            </p>
          </div>
          {/* The employee reads or requests his PIN; HR issues it. */}
          <div className="flex items-center gap-1.5 flex-wrap min-w-0">
            {!pinRequestedAt && (
              <Button
                variant={hasPin ? "ghost" : "outline"}
                size="sm"
                className={`h-8 text-xs ${hasPin ? "text-muted-foreground" : ""}`}
                onClick={requestPin}
                disabled={busy}
              >
                {hasPin ? "Demander un nouveau NIP" : "Demander un NIP"}
              </Button>
            )}
            {hasPin && (
              <Button
                size="sm"
                className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                onClick={reveal}
                disabled={busy}
              >
                <KeyRound className="h-3.5 w-3.5 mr-1.5" />
                Afficher mon NIP
              </Button>
            )}
          </div>
        </div>
      </Card>

      <Dialog open={revealed != null} onOpenChange={(o) => { if (!o) setRevealed(null); }}>
        <DialogContent className="max-w-sm p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
            <DialogHeader className="space-y-1">
              <DialogTitle className="text-base text-white flex items-center gap-2">
                <KeyRound className="h-4 w-4" />Votre NIP de borne
              </DialogTitle>
              <DialogDescription className="text-white/80 text-xs">
                Vous pouvez le réafficher à tout moment avec votre mot de passe.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-5 py-6 space-y-3 text-center">
            <p className="font-mono text-4xl font-bold tracking-[0.35em] text-[#0F2D52] tabular-nums">
              {revealed}
            </p>
            <Button
              variant="outline" size="sm" className="h-8 text-xs"
              onClick={() => {
                if (revealed) {
                  navigator.clipboard?.writeText(revealed)
                    .then(() => toast.success("NIP copié"))
                    .catch(() => toast.error("Copie impossible"));
                }
              }}
            >
              <Copy className="h-3.5 w-3.5 mr-1.5" />Copier
            </Button>
            <p className="text-[11px] text-muted-foreground">
              Tapez ce NIP sur la tablette partagée pour poinçonner. Ne le communiquez à personne.
            </p>
          </div>
          <DialogFooter className="px-5 py-3 border-t bg-muted/30">
            <Button onClick={() => setRevealed(null)} className="bg-[#0F2D52] hover:bg-[#15406d]">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ════════════════════════════════════════════════════════════════
// HR admin view: hour approval, scalable tabs.
// ════════════════════════════════════════════════════════════════
function TimeclockReviewView({
  scope, currentAdminId, periodFrom, periodTo, holidays, teams, departments,
  editRequests, adminKpis,
  tab, page, pageSize, q, teamFilter, departmentFilter, statusFilter,
  overview, byEmployee, toApprove, employeesWithForgottenDays, approveQueue, reachedEntryCap,
}: ReviewProps) {
  const isFounder = scope.isFounder;
  const showSelfNotice = !isFounder; // everyone but the founder sees the reminder
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [selectedToApprove, setSelectedToApprove] = useState<Set<number>>(new Set());
  const [focusAdmin, setFocusAdmin] = useState<{ adminId: number; date?: string | null } | null>(null);

  // "?focus=<adminId>" opens that employee's week panel directly.
  const focusParam = sp.get("focus");
  useEffect(() => {
    if (!focusParam) return;
    const id = Number(focusParam);
    if (Number.isFinite(id) && id > 0) {
      setFocusAdmin({ adminId: id });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusParam]);
  const [focusDay, setFocusDay] = useState<string | null>(null);
  const [forceClose, setForceClose] = useState<{ adminId: number; name: string } | null>(null);
  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [detailAgg, setDetailAgg] = useState<DayAggRow | null>(null);

  // Sticky compress-on-scroll. rootMargin -64px offsets the sticky topbar so
  // the sentinel counts as "out" once it passes UNDER it, not off-viewport.
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

  const setTab = useCallback(
    (next: "overview" | "by-employee" | "to-approve") => {
      const params = new URLSearchParams(sp.toString());
      params.set("tab", next);
      params.delete("page"); // reset pagination quand on change d'onglet
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );
  const setPage = useCallback(
    (next: number) => {
      const params = new URLSearchParams(sp.toString());
      params.set("page", String(next));
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );
  const setTeamFilter = useCallback(
    (teamId: number | null) => {
      const params = new URLSearchParams(sp.toString());
      if (teamId == null) params.delete("team");
      else params.set("team", String(teamId));
      params.delete("page");
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, sp],
  );

  const undoToast = useCallback((snapshotId: number, successMsg: string) => {
    toast.success(successMsg, {
      duration: 10_000,
      action: {
        label: "Annuler",
        onClick: async () => {
          const u = await undoTimeClockSnapshotAction({ snapshotId });
          if (u.success) toast.success(`${u.data.restored} entrée(s) restaurée(s)`);
          else toast.error(u.error || "");
          router.refresh();
        },
      },
    });
  }, [router]);

  // Empty state: manager with no direct report.
  if (!scope.isHr && scope.allowedAdminCount === 0) {
    return (
      <div className="space-y-4">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-[#0F2D52]" />Approbation des heures
          </h1>
          <p className="text-sm text-muted-foreground">
            Gestion du pointage de votre équipe.
          </p>
        </div>
        <Card className="p-10 text-center">
          <Users className="h-10 w-10 text-[#0F2D52]/40 mx-auto mb-3" />
          <p className="text-base font-semibold text-[#0F2D52]">
            Vous n&apos;avez pas encore d&apos;employé sous votre supervision.
          </p>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
            Dès que des employés vous seront rattachés (en tant que manager direct ou chef d&apos;équipe),
            leurs pointages apparaîtront ici pour approbation.
          </p>
        </Card>
      </div>
    );
  }

  const tabs: TabItem<"overview" | "by-employee" | "to-approve">[] = [
    { key: "overview", label: "Vue d'ensemble", shortLabel: "Ensemble", icon: LayoutGrid },
    {
      // No count here: headcount is static info, not a workload.
      key: "by-employee",
      label: "Par employé",
      shortLabel: "Employés",
      icon: UserIcon,
    },
    {
      key: "to-approve",
      label: "À approuver",
      shortLabel: "Approuver",
      icon: ListChecks,
      count: adminKpis?.toApproveCount || undefined,
    },
  ];

  // Subtitle depends on the scope.
  const subtitle = scope.isHr
    ? "Vue d'ensemble de tous les employés"
    : `Mon équipe (${scope.allowedAdminCount ?? 0} employé${(scope.allowedAdminCount ?? 0) > 1 ? "s" : ""})`;

  return (
    <div className="space-y-4">
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-4 sm:px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <CheckCircle2 className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">Approbation des heures</h1>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                <p className="text-xs text-white/80">{subtitle}</p>
                {!scope.isHr && scope.myTeams.length > 0 && (
                  <div className="flex items-center gap-1 flex-wrap">
                    {scope.myTeams.map((t) => (
                      <Badge
                        key={t.id}
                        variant="outline"
                        className="text-[10px] border-white/30 text-white bg-white/10"
                        style={t.color ? { borderColor: `${t.color}88` } : undefined}
                      >
                        {t.name}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="[&_button]:!bg-white/10 [&_button]:hover:!bg-white/20 [&_button]:!text-white [&_button]:!border-white/20 [&_button]:backdrop-blur">
              <PeriodFilter from={periodFrom} to={periodTo} />
            </div>
            <ActionTooltip label="Exporte uniquement les pointages approuvés sur la période sélectionnée">
              <Button
                variant="outline" size="sm" asChild
                className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur"
              >
                <a
                  href={`/api/admin/timeclock/csv${periodFrom && periodTo ? `?from=${isoDate(new Date(periodFrom))}&to=${isoDate(new Date(periodTo))}` : ""}`}
                  target="_blank"
                  rel="noopener"
                >
                  <FileDown className="h-3.5 w-3.5 mr-1.5" />Exporter CSV (approuvés)
                </a>
              </Button>
            </ActionTooltip>
            {scope.isHr && (
              <ActionTooltip label="Arrondi des punchs, localisation, borne kiosque">
                <Button
                  variant="outline" size="sm" asChild
                  className="!bg-white/10 hover:!bg-white/20 !text-white !border-white/20 backdrop-blur"
                >
                  <a href="/admin/employes/pointage/parametres">
                    <SlidersHorizontal className="h-3.5 w-3.5 mr-1.5" />Paramètres
                  </a>
                </Button>
              </ActionTooltip>
            )}
          </div>
        </div>
      </div>

      <SettingsTabs
        tabs={tabs}
        active={tab}
        onChange={setTab}
        ariaLabel="Vues du pointage"
      />

      {/* Sentinel: detects when the header scrolls out, to show the mini bar */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Sticky mini bar, only while scrolled. Mobile top-[108px] (64 topbar
          + 44 sub-header), desktop top-[64px]. */}
      {scrolled && (
      <div className="sticky top-[100px] lg:top-[64px] z-20 px-3 sm:px-4 rounded-b-lg pt-3 pb-2 bg-slate-50 border-t-[3px] border-t-[#0F2D52] border-b border-b-slate-200 shadow-[0_3px_8px_-3px_rgba(15,45,82,0.22)] animate-overlay-fade-in">
        <div className="flex flex-col gap-2 px-3 sm:flex-row sm:items-center sm:gap-3">
          <span className="font-bold text-sm text-[#0F2D52] hidden lg:inline-flex items-center gap-1.5 shrink-0">
            <CheckCircle2 className="h-4 w-4" />
            Approbation des heures
          </span>
          <div className="min-w-0 w-full sm:flex-1 lg:max-w-md">
            <SettingsTabs tabs={tabs} active={tab} onChange={setTab} ariaLabel="Vues du pointage" dense />
          </div>
          <div className="flex items-center gap-1.5 shrink-0 sm:ml-0">
            <PeriodFilter from={periodFrom} to={periodTo} />
            <DropdownMenu>
              <ActionTooltip label="Actions supplémentaires">
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    aria-label="Actions supplémentaires"
                  >
                    <MoreHorizontal className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
              </ActionTooltip>
              <DropdownMenuContent align="end" className="w-52">
                <DropdownMenuItem asChild>
                  <a
                    href={`/api/admin/timeclock/csv${periodFrom && periodTo ? `?from=${isoDate(new Date(periodFrom))}&to=${isoDate(new Date(periodTo))}` : ""}`}
                    target="_blank"
                    rel="noopener"
                  >
                    <FileDown className="h-3.5 w-3.5 mr-2" />Exporter CSV (approuvés)
                  </a>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
      )}

      {editRequests.length > 0 && (
        <Card className="border-blue-200 bg-blue-50/40">
          <div className="p-3">
            <div className="flex items-center gap-2 mb-2">
              <Unlock className="h-4 w-4 text-blue-700" />
              <span className="text-sm font-semibold text-blue-900">
                Demandes de modification ({editRequests.length})
              </span>
            </div>
            <div className="divide-y divide-blue-200/60">
              {editRequests.map((req) => {
                const empName = req.admin?.fullName || req.admin?.email || `Admin#${req.adminId}`;
                const ids = Array.isArray(req.entryIds) ? (req.entryIds as number[]) : [];
                const when = new Date(req.createdAt).toLocaleDateString("fr-CA");
                return (
                  <div key={req.id} className="flex items-start gap-3 py-2.5">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-medium">{empName}</span>
                        <Badge className="text-[10px] bg-blue-100 text-blue-700 border-blue-300">
                          {ids.length} entrée{ids.length > 1 ? "s" : ""}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">demande du {when}</span>
                      </div>
                      <p className="text-xs text-muted-foreground italic mt-0.5">
                        Raison : {req.reason}
                      </p>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                        onClick={async () => {
                          const r = await unlockTimeClockEntriesAction({ requestId: req.id });
                          if (r.success) { toast.success(`${r.data.unlocked} entrée(s) débloquée(s)`); router.refresh(); }
                          else toast.error(r.error || "");
                        }}
                      >
                        <Unlock className="h-3 w-3 mr-1" />Débloquer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs border-red-300 text-red-700 hover:bg-red-50"
                        onClick={async () => {
                          const reason = await promptDialog({
                            title: "Refuser la demande",
                            label: "Motif (optionnel)",
                            placeholder: "Le motif sera communiqué à l'employé",
                            multiline: true,
                            confirmLabel: "Refuser",
                            variant: "destructive",
                          });
                          if (reason === null) return;
                          const r = await denyEditRequestAction({ requestId: req.id, reason: reason || undefined });
                          if (r.success) { toast.success("Demande refusée"); router.refresh(); }
                          else toast.error(r.error || "");
                        }}
                      >
                        <XCircle className="h-3 w-3 mr-1" />Refuser
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </Card>
      )}

      {/* No self-approval for non-founder managers/HR. */}
      {showSelfNotice && (
        <div className="flex items-start gap-2 rounded-md border border-[#0F2D52]/20 bg-[#0F2D52]/5 p-3 text-xs text-[#0F2D52]">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <p>
            Note : vos propres heures ne s&apos;affichent pas ici. Votre supérieur direct est responsable de les valider.
          </p>
        </div>
      )}

      {reachedEntryCap && (
        <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <p className="font-semibold">Plus de 5000 pointages chargés sur cette période</p>
            <p className="mt-0.5">Affinez la période pour voir le détail complet — les agrégats peuvent être tronqués.</p>
          </div>
        </div>
      )}

      {/* Bulk bar, sticky under the mini-header + tabs. */}
      {selectedToApprove.size > 0 && (
        <div className="sticky top-[176px] lg:top-[140px] z-10 flex items-center gap-2 p-3 rounded-md bg-[#0F2D52] text-white shadow-lg flex-wrap">
          <Badge className="text-[11px] bg-white text-[#0F2D52] border-white">
            {selectedToApprove.size} entrée{selectedToApprove.size > 1 ? "s" : ""} sélectionnée{selectedToApprove.size > 1 ? "s" : ""}
          </Badge>
          <div className="flex-1" />
          <Button
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white border-emerald-600"
            onClick={async () => {
              const ids = Array.from(selectedToApprove);
              const ok = await confirmDialog({
                title: `Approuver ${ids.length} entrée(s)`,
                description: "Confirmer l'approbation de la sélection ?",
                confirmLabel: "Approuver",
              });
              if (!ok) return;
              const r = await approveTimeClockAction({ ids });
              if (r.success) { toast.success(`${r.data.approved} approuvée(s)`); setSelectedToApprove(new Set()); router.refresh(); }
              else toast.error(r.error || "");
            }}
          >
            <CheckCircle2 className="h-4 w-4 mr-1.5" />Approuver la sélection
          </Button>
          <Button
            size="sm"
            className="bg-red-500 hover:bg-red-600 text-white border-red-600"
            onClick={async () => {
              const ids = Array.from(selectedToApprove);
              const reason = await promptDialog({
                title: `Rejeter ${ids.length} entrée(s)`,
                label: "Motif du rejet (visible par l'employé)",
                placeholder: "Ex : période chevauchée, heure incorrecte…",
                multiline: true,
                required: true,
              });
              if (!reason) return;
              const r = await rejectManyTimeClockAction({ ids, reason });
              if (r.success) {
                toast.success(`${r.data.rejected} entrée(s) rejetée(s)${r.data.skipped > 0 ? ` (${r.data.skipped} ignorée(s))` : ""}`);
              } else {
                toast.error(r.error);
              }
              setSelectedToApprove(new Set());
              router.refresh();
            }}
          >
            <XCircle className="h-4 w-4 mr-1.5" />Rejeter la sélection
          </Button>
          <Button size="sm" variant="ghost" className="text-white hover:bg-white/20" onClick={() => setSelectedToApprove(new Set())}>
            Désélectionner tout
          </Button>
        </div>
      )}

      {tab === "overview" && overview && (
        <OverviewTab
          isHr={scope.isHr}
          overview={overview}
          adminKpis={adminKpis}
          onPickTeam={(teamId) => {
            setTeamFilter(teamId);
            setTab("by-employee");
          }}
          onGoToApprove={() => setTab("to-approve")}
        />
      )}

      {tab === "by-employee" && (
        <ByEmployeeTab
          overtimeWeeklyMin={adminKpis?.overtimeWeeklyMin ?? 40 * 60}
          teams={teams}
          departments={departments}
          q={q}
          teamFilter={teamFilter}
          departmentFilter={departmentFilter}
          statusFilter={statusFilter}
          items={byEmployee.items}
          total={byEmployee.total}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          periodFrom={periodFrom}
          periodTo={periodTo}
          onFocusEmployee={(id) => setFocusAdmin({ adminId: id })}
          onApproveWeek={async (empId, name) => {
            // Approves the DISPLAYED week, not the current one.
            const weekStartD = periodFrom ? startOfWeek(new Date(periodFrom)) : startOfWeek(new Date());
            const weekLabel = `la semaine du ${weekStartD.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;
            const ok = await confirmDialog({
              title: `Approuver ${weekLabel}`,
              description: `Approuver toutes les entrées soumises de ${weekLabel} pour ${name} ?`,
              confirmLabel: "Approuver",
            });
            if (!ok) return;
            const r = await approveWeekTimeClockAction({ adminId: empId, weekStart: isoDate(weekStartD) });
            if (r.success) {
              toast.success(`${r.data.approved} entrée(s) approuvée(s) pour ${name}`);
              router.refresh();
            } else toast.error(r.error || "");
          }}
        />
      )}

      {tab === "to-approve" && (
        <ToApproveTab
          overtimeWeeklyMin={adminKpis?.overtimeWeeklyMin ?? 40 * 60}
          teams={teams}
          departments={departments}
          q={q}
          teamFilter={teamFilter}
          departmentFilter={departmentFilter}
          statusFilter={statusFilter}
          items={toApprove.items}
          total={toApprove.total}
          page={page}
          pageSize={pageSize}
          onPage={setPage}
          employeesWithForgottenDays={employeesWithForgottenDays}
          approveQueue={approveQueue}
          periodFrom={periodFrom}
          periodTo={periodTo}
          selectedToApprove={selectedToApprove}
          onToggleSelectAll={(ids, v) => {
            setSelectedToApprove((s) => {
              const n = new Set(s);
              for (const id of ids) {
                if (v) n.add(id); else n.delete(id);
              }
              return n;
            });
          }}
          holidaysByDay={(() => {
            const m = new Map<string, string>();
            for (const [date, h] of Object.entries(holidays)) m.set(date, h.name);
            return m;
          })()}
          onFocusEmployee={(id) => setFocusAdmin({ adminId: id })}
          onClickDay={(date) => setFocusDay(date)}
          onShowDetails={(agg) => setDetailAgg(agg)}
          onApprove={async (ids) => {
            if (ids.length === 0) return;
            const r = await approveTimeClockAction({ ids });
            if (r.success) { toast.success(`${r.data.approved} approuvée(s)`); router.refresh(); }
            else toast.error(r.error || "");
          }}
          onApproveWeek={async (empId, name) => {
            // Approves the DISPLAYED week, not the current one.
            const weekStartD = periodFrom ? startOfWeek(new Date(periodFrom)) : startOfWeek(new Date());
            const weekLabel = `la semaine du ${weekStartD.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;
            const ok = await confirmDialog({
              title: `Approuver ${weekLabel}`,
              description: `Approuver toutes les entrées soumises de ${weekLabel} pour ${name} ?`,
              confirmLabel: "Approuver",
            });
            if (!ok) return;
            const r = await approveWeekTimeClockAction({ adminId: empId, weekStart: isoDate(weekStartD) });
            if (r.success) {
              toast.success(`${r.data.approved} entrée(s) approuvée(s) pour ${name}`);
              router.refresh();
            } else toast.error(r.error || "");
          }}
          onReject={async (ids) => {
            if (ids.length === 0) return;
            const reason = await promptDialog({
              title: "Rejeter la journée",
              label: "Motif du rejet",
              placeholder: "L'employé verra ce message",
              multiline: true,
              required: true,
              variant: "destructive",
              confirmLabel: "Rejeter",
            });
            if (!reason) return;
            let snap: number | null = null;
            let rejected = 0;
            for (const id of ids) {
              const r = await rejectTimeClockAction({ id, reason });
              if (r.success) {
                rejected++;
                snap = r.data.snapshotId;
              }
            }
            if (rejected > 0 && snap != null) {
              undoToast(snap, `${rejected} pointage(s) rejeté(s)`);
              router.refresh();
            } else if (rejected === 0) {
              toast.error("Aucun rejet effectué");
            }
          }}
        />
      )}

      {forceClose && (
        <ForceCloseDialog
          adminId={forceClose.adminId}
          name={forceClose.name}
          onClose={() => setForceClose(null)}
          onSaved={() => { setForceClose(null); router.refresh(); }}
        />
      )}

      {editEntry && (
        <EditEntryDialog
          entry={editEntry}
          isAdminOverride
          onClose={() => setEditEntry(null)}
          onSaved={() => { setEditEntry(null); router.refresh(); }}
        />
      )}

      <Sheet open={focusAdmin != null} onOpenChange={(o) => { if (!o) setFocusAdmin(null); }}>
        <SheetContent side="right" className="overflow-y-auto p-0 sm:max-w-xl w-full">
          {focusAdmin != null && (
            <EmployeeWeekPanelRemote
              adminId={focusAdmin.adminId}
              periodFrom={periodFrom}
              periodTo={periodTo}
              focusDate={focusAdmin.date}
              onClose={() => setFocusAdmin(null)}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={focusDay != null} onOpenChange={(o) => { if (!o) setFocusDay(null); }}>
        <SheetContent side="right" className="overflow-y-auto p-0 sm:max-w-2xl w-full">
          {focusDay != null && (
            <DayMultiEmployeePanel
              dayDate={focusDay}
              onClose={() => setFocusDay(null)}
              onApprove={async (ids) => {
                if (ids.length === 0) return;
                const r = await approveTimeClockAction({ ids });
                if (r.success) { toast.success(`${r.data.approved} approuvée(s)`); router.refresh(); }
                else toast.error(r.error || "");
              }}
              onReject={async (id) => {
                const reason = await promptDialog({
                  title: "Rejeter le pointage",
                  label: "Motif du rejet",
                  placeholder: "L'employé verra ce message",
                  multiline: true,
                  required: true,
                  variant: "destructive",
                  confirmLabel: "Rejeter",
                });
                if (!reason) return;
                const r = await rejectTimeClockAction({ id, reason });
                if (r.success) {
                  undoToast(r.data.snapshotId, "Pointage rejeté");
                  router.refresh();
                } else toast.error(r.error || "");
              }}
              onUnapprove={async (ids) => {
                if (ids.length === 0) return;
                const reason = await promptDialog({
                  title: "Annuler l'approbation",
                  label: "Motif (optionnel)",
                  placeholder: "Pourquoi revenir sur cette décision ?",
                  multiline: true,
                  required: false,
                  variant: "destructive",
                  confirmLabel: "Annuler l'approbation",
                });
                if (reason === null) return;
                const r = await unapproveTimeClockAction({ ids, reason: reason || undefined });
                if (r.success) { toast.success(`${r.data.unapproved} approbation(s) annulée(s)`); router.refresh(); }
                else toast.error(r.error || "");
              }}
              onEditEntry={(e) => setEditEntry(e)}
            />
          )}
        </SheetContent>
      </Sheet>

      <Sheet open={detailAgg != null} onOpenChange={(o) => { if (!o) setDetailAgg(null); }}>
        <SheetContent side="right" className="overflow-y-auto p-0">
          {detailAgg && (
            <DayDetailPanel
              adminName={detailAgg.adminName}
              date={detailAgg.date}
              workMin={detailAgg.workMin}
              breakMin={detailAgg.breakMin}
              entries={detailAgg.entries}
              onEdit={(e) => setEditEntry(e)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab 1: overview (KPIs + per-team cards).
// ════════════════════════════════════════════════════════════════
function OverviewTab({
  isHr, overview, adminKpis, onPickTeam, onGoToApprove,
}: {
  isHr: boolean;
  overview: {
    totalMin: number;
    toApproveCount: number;
    approvedCount: number;
    activeAdmins: number;
    teamStats: TeamStat[];
  };
  adminKpis: ReviewProps["adminKpis"];
  onPickTeam: (teamId: number | null) => void;
  onGoToApprove: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        <StatBox
          label="Total heures période"
          value={fmtDuration(overview.totalMin)}
          accent="emerald"
          icon={Clock}
        />
        <StatBox
          label="À approuver"
          value={String(overview.toApproveCount)}
          accent={overview.toApproveCount > 0 ? "amber" : "emerald"}
          hint={overview.toApproveCount > 0 ? "Cliquer pour ouvrir" : undefined}
          onClick={overview.toApproveCount > 0 ? onGoToApprove : undefined}
          icon={ListChecks}
        />
        <StatBox label="Approuvées" value={String(overview.approvedCount)} accent="emerald" icon={CheckCircle2} />
        <StatBox label="Employés actifs" value={String(overview.activeAdmins)} accent="blue" icon={Users} />
      </div>

      {adminKpis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {/* "Missed today" folded in as a hint: it was a subset of the same data. */}
          <StatBox
            label="Pointages oubliés (semaine)"
            value={String(adminKpis.forgottenThisWeekCount)}
            accent={adminKpis.forgottenThisWeekCount > 0 ? "red" : "emerald"}
            hint={adminKpis.forgottenThisWeekCount > 0
              ? (adminKpis.forgottenTodayCount > 0
                ? `dont ${adminKpis.forgottenTodayCount} aujourd'hui · voir détail`
                : "Voir détail")
              : undefined}
            onClick={adminKpis.forgottenThisWeekCount > 0 ? onGoToApprove : undefined}
            icon={AlertTriangle}
          />
          <StatBox label="Heures sup." value={fmtDuration(adminKpis.overtimeMin)} accent="blue" icon={TrendingUp} />
          <StatBox
            label="Demandes modif."
            value={String(adminKpis.pendingRequests)}
            accent={adminKpis.pendingRequests > 0 ? "amber" : "blue"}
            icon={Unlock}
          />
          <StatBox
            label="Conformité pauses"
            value={`${adminKpis.complianceRate}%`}
            accent={adminKpis.complianceRate >= 90 ? "emerald" : "amber"}
            hint="Loi CNESST"
            icon={Coffee}
          />
        </div>
      )}

      <Card className="p-3">
        <div className="flex items-center gap-2 mb-3">
          <Users className="h-4 w-4 text-[#0F2D52]" />
          <span className="text-xs font-bold uppercase tracking-wider text-[#0F2D52]">
            {isHr ? "Équipes" : "Mon équipe"}
          </span>
        </div>
        {overview.teamStats.length === 0 ? (
          <p className="text-sm text-muted-foreground p-4 text-center">Aucune équipe à afficher.</p>
        ) : (
          <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {overview.teamStats.map((t) => (
              <div
                key={`${t.teamId ?? "none"}-${t.teamName}`}
                className="rounded-lg border p-3 hover:border-[#0F2D52]/40 hover:bg-[#0F2D52]/5 transition-colors"
                style={t.teamColor ? { borderLeftColor: t.teamColor, borderLeftWidth: 3 } : undefined}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{t.teamName}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.memberCount} membre{t.memberCount > 1 ? "s" : ""}
                    </p>
                  </div>
                  {t.toApproveCount > 0 && (
                    <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300 shrink-0">
                      {t.toApproveCount} à approuver
                    </Badge>
                  )}
                </div>
                <div className="mt-2 flex items-end justify-between gap-2">
                  <div>
                    <p className="text-[9px] uppercase tracking-wider text-muted-foreground">
                      Total période
                    </p>
                    <p className="font-mono text-lg font-bold tabular-nums text-[#0F2D52]">
                      {fmtDuration(t.totalMin)}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => onPickTeam(t.teamId)}
                  >
                    Voir détails
                    <ChevronRight className="h-3 w-3 ml-0.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
          {/* Hint when no real team exists yet */}
          {overview.teamStats.every((t) => t.teamId == null) && (
            <p className="text-[11px] text-muted-foreground mt-2 px-1">
              Créez des équipes (Personnes › Équipes) pour voir les statistiques par équipe.
            </p>
          )}
          </>
        )}
      </Card>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab 2: per employee (paginated table).
// ════════════════════════════════════════════════════════════════
function ByEmployeeTab({
  teams, departments, q, teamFilter, departmentFilter, statusFilter,
  items, total, page, pageSize, onPage,
  onFocusEmployee, onApproveWeek, periodFrom, periodTo, overtimeWeeklyMin,
}: {
  teams: TeamLite[];
  departments: string[];
  q: string;
  teamFilter: number | null;
  departmentFilter: string | null;
  statusFilter: StatusFilter;
  items: EmployeeRow[];
  total: number;
  page: number;
  pageSize: number;
  onPage: (n: number) => void;
  onFocusEmployee: (id: number) => void;
  onApproveWeek: (empId: number, name: string) => void;
  periodFrom?: string;
  periodTo?: string;
  overtimeWeeklyMin: number;
}) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  // Progress bar vs the weekly threshold: only meaningful on a ~1 week period.
  const showBar = useMemo(() => {
    if (!periodFrom || !periodTo) return true;
    return (new Date(periodTo).getTime() - new Date(periodFrom).getTime()) / 86400_000 <= 8;
  }, [periodFrom, periodTo]);
  return (
    <div className="space-y-3">
      {/* Single card: toolbar attached to the table */}
      <Card className="overflow-hidden p-0">
        <div className="px-3 py-2.5 border-b bg-muted/20 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold uppercase tracking-wider text-[#0F2D52] inline-flex items-center gap-1.5 shrink-0">
            <Users className="h-4 w-4" />
            Employés
            <Badge variant="outline" className="text-[10px] tabular-nums">{total}</Badge>
          </span>
          <div className="flex-1 min-w-[240px]">
            <TimesheetFilters
              teams={teams}
              departments={departments}
              showStatus={false}
              q={q}
              teamFilter={teamFilter}
              departmentFilter={departmentFilter}
              statusFilter={statusFilter}
            />
          </div>
        </div>
        {items.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucun employé correspondant aux filtres.
          </div>
        ) : (
          <>
          {/* Below sm the table becomes a card list: a seven-column table asks
              the reader to drag sideways, and the header leaves with it. */}
          <div className="divide-y sm:hidden">
            {items.map((emp) => {
              const name = emp.fullName || emp.email;
              return (
                <button
                  key={emp.id}
                  type="button"
                  onClick={() => onFocusEmployee(emp.id)}
                  className="w-full text-left p-3 hover:bg-[#0F2D52]/5 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`h-8 w-8 rounded-full ${avatarColor(name)} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                      {name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {emp.position?.name ?? emp.title ?? emp.email}
                      </p>
                    </div>
                    <span className="font-mono tabular-nums text-sm font-bold text-[#0F2D52] shrink-0">
                      {fmtDuration(emp.totalMin)}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                    {emp.status === "pending" && (
                      <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">En attente</Badge>
                    )}
                    {emp.status === "approved" && <ApprovedBadge />}
                    {emp.status === "none" && (
                      <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 bg-slate-50">Aucune heure</Badge>
                    )}
                    {emp.team && (
                      <Badge variant="outline" className="text-[10px]"
                        style={emp.team.color ? { borderColor: `${emp.team.color}55`, color: emp.team.color } : undefined}>
                        {emp.team.name}
                      </Badge>
                    )}
                    {emp.toApprove > 0 && (
                      <span className="text-[10px] text-amber-800">{emp.toApprove} à approuver</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">{emp.approved} approuvées</span>
                  </div>
                  {emp.toApprove > 0 && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(ev) => { ev.stopPropagation(); onApproveWeek(emp.id, name); }}
                      onKeyDown={(ev) => { if (ev.key === "Enter") { ev.stopPropagation(); onApproveWeek(emp.id, name); } }}
                      className="mt-2 inline-flex items-center justify-center gap-1.5 h-8 w-full rounded-md border border-emerald-300 text-emerald-700 text-xs hover:bg-emerald-50"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5" />Approuver la semaine
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          {/* max-h + overflow creates the scroll container the sticky header needs. */}
          <div className="hidden sm:block overflow-auto max-h-[70vh]">
            <table className="w-full text-sm">
              {/* Sticky header: keeps the columns readable at 50/100 rows per page */}
              <thead className="bg-muted/40 text-[10px] uppercase tracking-wider text-muted-foreground sticky top-0 z-10 shadow-[0_1px_0_0_hsl(var(--border))]">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">Employé</th>
                  <th className="text-left px-3 py-2 font-semibold">Équipe</th>
                  <th className="text-right px-3 py-2 font-semibold">Heures période</th>
                  <th className="text-right px-3 py-2 font-semibold">À approuver</th>
                  <th className="text-right px-3 py-2 font-semibold">Approuvées</th>
                  <th className="text-left px-3 py-2 font-semibold">Statut</th>
                  <th className="text-right px-3 py-2 font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {items.map((emp) => {
                  const name = emp.fullName || emp.email;
                  const initials = name.slice(0, 2).toUpperCase();
                  return (
                    <tr
                      key={emp.id}
                      className="hover:bg-[#0F2D52]/5 cursor-pointer transition-colors"
                      onClick={() => onFocusEmployee(emp.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" || ev.key === " ") {
                          ev.preventDefault();
                          onFocusEmployee(emp.id);
                        }
                      }}
                      aria-label={`Ouvrir le panneau d'approbation pour ${name}`}
                    >
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`h-7 w-7 rounded-full ${avatarColor(name)} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{name}</p>
                            <p className="text-[10px] text-muted-foreground truncate">
                              {emp.position?.name ?? emp.title ?? emp.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        {emp.team ? (
                          <Badge
                            variant="outline"
                            className="text-[10px]"
                            style={emp.team.color ? { borderColor: `${emp.team.color}55`, color: emp.team.color } : undefined}
                          >
                            {emp.team.name}
                          </Badge>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <span className="font-mono tabular-nums text-[#0F2D52] font-semibold">
                          {fmtDuration(emp.totalMin)}
                        </span>
                        {showBar && (
                          <div className="h-1 w-16 rounded-full bg-muted ml-auto mt-1" aria-hidden>
                            <div
                              className={`h-1 rounded-full ${emp.totalMin > overtimeWeeklyMin ? "bg-amber-500" : "bg-[#0F2D52]"}`}
                              style={{ width: `${Math.min(100, Math.round((emp.totalMin / overtimeWeeklyMin) * 100))}%` }}
                            />
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {emp.toApprove > 0 ? (
                          <Badge className="text-[10px] bg-amber-100 text-amber-800 border-amber-300">
                            {emp.toApprove}
                          </Badge>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">0</span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-[11px]">
                        {emp.approved}
                      </td>
                      <td className="px-3 py-2.5">
                        {emp.status === "pending" && (
                          <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                            En attente
                          </Badge>
                        )}
                        {emp.status === "approved" && <ApprovedBadge strong />}
                        {emp.status === "none" && (
                          <Badge variant="outline" className="text-[10px] text-slate-500 border-slate-200 bg-slate-50">
                            Aucune heure
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right">
                        <div className="flex items-center gap-1 justify-end">
                          {emp.toApprove > 0 && (
                            <ActionTooltip label="Approuver toute la semaine (raccourci)">
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  onApproveWeek(emp.id, name);
                                }}
                              >
                                <CheckCircle2 className="h-3 w-3 mr-1" />Semaine
                              </Button>
                            </ActionTooltip>
                          )}
                          <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          </>
        )}
      </Card>

      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        totalPages={totalPages}
        onPage={onPage}
      />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Tab 3: To approve — decision queue.
// Progressive disclosure: the screen only shows decisions to take.
//   - WeekNav: week navigation (Sunday -> Saturday)
//   - Queue: one row per employee, total hours + Approve / Details
//   - Collapsed: awaiting submission (with reminder), up-to-date employees
//   - "By day" view kept for fine granularity and bulk selection
// Nothing lost: reject/undo/edit per entry live in the Details panel.
// ════════════════════════════════════════════════════════════════
type ApproveViewMode = "queue" | "by-day";

type ApproveQueueRow = {
  adminId: number;
  name: string;
  email: string;
  teamName: string | null;
  pendingIds: number[];
  pendingMin: number;
  days: number;
  weekTotalMin: number;
};

type ApproveQueueData = {
  rows: ApproveQueueRow[];
  awaitingSubmission: Array<{ adminId: number; name: string; email: string; draftCount: number }>;
  upToDate: Array<{ adminId: number; name: string; email: string }>;
  pastPendingCount: number;
  pastPendingWeeks: number;
  pastPendingLatestWeek: string | null; // local Sunday of the most recent pending week
};

// WeekNav — URL-driven week stepper.
function WeekNav({ periodFrom, periodTo }: { periodFrom?: string; periodTo?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const base = periodFrom ? new Date(periodFrom) : new Date();
  const ws = startOfWeek(base);
  const we = endOfWeek(ws);
  const nowWs = startOfWeek(new Date());
  const isCurrentWeek = ws.getTime() === nowWs.getTime();
  // Exact-week period: from = Sunday, to inside the same week. Compared as
  // LOCAL dates (isoDate); millisecond math breaks across timezones.
  const isWeekPeriod =
    !!periodFrom
    && isoDate(new Date(periodFrom)) === isoDate(ws)
    && (!periodTo || isoDate(new Date(periodTo)) <= isoDate(we));

  const goToDate = (d: Date) => {
    const target = startOfWeek(d);
    const end = endOfWeek(target);
    const params = new URLSearchParams(sp.toString());
    params.set("from", isoDate(target));
    // Current week: cap to today, future days hold nothing.
    const capped = end > new Date() ? new Date() : end;
    params.set("to", isoDate(capped));
    params.set("tab", "to-approve");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const goWeek = (offset: number) => {
    const target = new Date(ws);
    target.setDate(target.getDate() + offset * 7);
    goToDate(target);
  };

  const label = isWeekPeriod
    ? `Semaine du ${ws.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })} au ${we.toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`
    : "Période personnalisée";
  // Compact label for mobile.
  const labelShort = isWeekPeriod
    ? `${ws.getDate()} – ${we.toLocaleDateString("fr-CA", { day: "numeric", month: "short" })}`
    : "Personnalisée";

  return (
    <div className="flex items-center gap-1.5 flex-wrap justify-center">
      <ActionTooltip label="Semaine précédente">
        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => goWeek(-1)} aria-label="Semaine précédente">
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </ActionTooltip>
      <div className="min-w-0 text-center px-1">
        <p className="text-sm font-bold text-[#0F2D52] whitespace-nowrap hidden sm:block">{label}</p>
        <p className="text-sm font-bold text-[#0F2D52] whitespace-nowrap sm:hidden">{labelShort}</p>
        {!isCurrentWeek && (
          <button
            type="button"
            onClick={() => goWeek(Math.round((nowWs.getTime() - ws.getTime()) / (7 * 86400_000)))}
            className="text-[10px] text-muted-foreground hover:text-[#0F2D52] underline-offset-2 hover:underline"
          >
            Revenir à cette semaine
          </button>
        )}
      </div>
      <ActionTooltip label="Semaine suivante">
        <Button
          variant="outline" size="icon" className="h-8 w-8"
          onClick={() => goWeek(1)}
          disabled={isCurrentWeek}
          aria-label="Semaine suivante"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </ActionTooltip>
      {/* Jump to any week: days -> months -> years calendar */}
      <DatePopover
        value={isoDate(ws)}
        max={isoDate(new Date())}
        onChange={(v) => {
          if (!v) return;
          const [y, m, d] = v.split("-").map(Number);
          goToDate(new Date(y, m - 1, d));
        }}
        className="h-8 ml-1"
      />
    </div>
  );
}

function ToApproveTab(props: {
  teams: Array<{ id: number; name: string; color: string | null }>;
  departments: string[];
  q: string;
  teamFilter: number | null;
  departmentFilter: string | null;
  statusFilter: StatusFilter;
  items: DayAggRow[];
  total: number;
  page: number;
  pageSize: number;
  onPage: (n: number) => void;
  employeesWithForgottenDays: ForgottenEmployee[];
  approveQueue: ApproveQueueData;
  periodFrom?: string;
  periodTo?: string;
  selectedToApprove: Set<number>;
  onToggleSelectAll: (ids: number[], v: boolean) => void;
  holidaysByDay: Map<string, string>;
  onFocusEmployee: (adminId: number) => void;
  onClickDay: (date: string) => void;
  onShowDetails: (agg: DayAggRow) => void;
  onApprove: (ids: number[]) => Promise<void>;
  onApproveWeek: (empId: number, name: string) => Promise<void>;
  onReject: (ids: number[]) => Promise<void>;
  overtimeWeeklyMin: number;
}) {
  const {
    teams, departments, q, teamFilter, departmentFilter, statusFilter,
    items, total, page, pageSize, onPage,
    employeesWithForgottenDays, approveQueue, periodFrom, periodTo,
    selectedToApprove, onToggleSelectAll, holidaysByDay,
    onFocusEmployee, onClickDay, onShowDetails, onApprove, onReject,
    overtimeWeeklyMin,
  } = props;
  const [viewMode, setViewMode] = useState<ApproveViewMode>("queue");
  const [showUpToDate, setShowUpToDate] = useState(false);
  const [showAwaiting, setShowAwaiting] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const hasActiveFilters = !!q || teamFilter != null || !!departmentFilter || statusFilter !== "all";

  // Search applied client-side on the queue; team/department are already
  // filtered in SQL, but q only filters the "by day" view server-side.
  const ql = q.trim().toLowerCase();
  const queueRows = useMemo(
    () => (ql
      ? approveQueue.rows.filter((r) => r.name.toLowerCase().includes(ql) || r.email.toLowerCase().includes(ql))
      : approveQueue.rows),
    [approveQueue.rows, ql],
  );
  const upToDateRows = useMemo(
    () => (ql
      ? approveQueue.upToDate.filter((r) => r.name.toLowerCase().includes(ql) || r.email.toLowerCase().includes(ql))
      : approveQueue.upToDate),
    [approveQueue.upToDate, ql],
  );

  // Overtime badge only makes sense on a ~1 week period.
  const showOvertimeBadge = useMemo(() => {
    if (!periodFrom || !periodTo) return true;
    const days = (new Date(periodTo).getTime() - new Date(periodFrom).getTime()) / 86400_000;
    return days <= 8;
  }, [periodFrom, periodTo]);

  // "Awaiting submission" = unsubmitted drafts + days with no entry at all.
  const awaiting = useMemo(() => {
    const map = new Map<number, {
      adminId: number;
      name: string;
      email: string;
      draftCount: number;
      forgottenDays: string[];
    }>();
    for (const d of approveQueue.awaitingSubmission) {
      map.set(d.adminId, { ...d, forgottenDays: [] });
    }
    for (const f of employeesWithForgottenDays) {
      const cur = map.get(f.adminId);
      if (cur) cur.forgottenDays = f.forgottenDays;
      else map.set(f.adminId, {
        adminId: f.adminId,
        name: f.fullName || f.email,
        email: f.email,
        draftCount: 0,
        forgottenDays: f.forgottenDays,
      });
    }
    let list = Array.from(map.values());
    if (ql) {
      list = list.filter((r) => r.name.toLowerCase().includes(ql) || r.email.toLowerCase().includes(ql));
    }
    return list.sort((a, b) => a.name.localeCompare(b.name));
  }, [approveQueue.awaitingSubmission, employeesWithForgottenDays, ql]);

  const [remindedIds, setRemindedIds] = useState<Set<number>>(new Set());
  const [busyAll, setBusyAll] = useState(false);
  const remind = async (emp: { adminId: number; name: string; draftCount: number; forgottenDays: string[] }) => {
    setBusyId(emp.adminId);
    const r = emp.forgottenDays.length > 0
      ? await notifyForgottenDaysAction({ adminId: emp.adminId, days: emp.forgottenDays })
      : await remindSubmitWeekAction({ adminId: emp.adminId });
    setBusyId(null);
    if (r.success) {
      toast.success(`${emp.name} a été relancé(e).`);
      setRemindedIds((s) => { const n = new Set(s); n.add(emp.adminId); return n; });
    } else toast.error(r.error || "Erreur");
  };

  // Bulk reminder: everyone not reminded yet.
  const remindAll = async () => {
    const targets = awaiting.filter((e) => !remindedIds.has(e.adminId));
    if (targets.length === 0) return;
    const ok = await confirmDialog({
      title: "Relancer tous les employés",
      description: `${targets.length} employé${targets.length > 1 ? "s" : ""} recevront une notification de rappel (soumission ou pointages manquants).`,
      confirmLabel: "Relancer tous",
    });
    if (!ok) return;
    setBusyAll(true);
    let sent = 0;
    for (const emp of targets) {
      const r = emp.forgottenDays.length > 0
        ? await notifyForgottenDaysAction({ adminId: emp.adminId, days: emp.forgottenDays })
        : await remindSubmitWeekAction({ adminId: emp.adminId });
      if (r.success) {
        sent++;
        setRemindedIds((s) => { const n = new Set(s); n.add(emp.adminId); return n; });
      }
    }
    setBusyAll(false);
    if (sent > 0) toast.success(`${sent} employé${sent > 1 ? "s" : ""} relancé${sent > 1 ? "s" : ""}.`);
    else toast.error("Aucune relance envoyée");
  };

  const approveRow = async (row: ApproveQueueRow) => {
    const ok = await confirmDialog({
      title: `Approuver la semaine de ${row.name}`,
      description: `${fmtDuration(row.pendingMin)} sur ${row.days} jour${row.days > 1 ? "s" : ""} seront approuvées.`,
      confirmLabel: "Approuver",
    });
    if (!ok) return;
    setBusyId(row.adminId);
    await onApprove(row.pendingIds);
    setBusyId(null);
  };

  return (
    <div className="space-y-3">
      <Card className="p-3">
        <div className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="flex-1 flex justify-center sm:justify-start">
            <WeekNav periodFrom={periodFrom} periodTo={periodTo} />
          </div>
          <div className="flex items-center justify-center gap-2 shrink-0 flex-wrap">
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs relative">
                  <ListChecks className="h-3.5 w-3.5 mr-1.5" />Filtres
                  {hasActiveFilters && (
                    <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-amber-500" aria-hidden />
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-[320px] p-3">
                <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52] mb-2">Filtres</p>
                <TimesheetFilters
                  teams={teams}
                  departments={departments}
                  showStatus={viewMode === "by-day"}
                  q={q}
                  teamFilter={teamFilter}
                  departmentFilter={departmentFilter}
                  statusFilter={statusFilter}
                />
              </PopoverContent>
            </Popover>
            <div className="inline-flex rounded-md border border-input p-0.5 bg-muted/30">
              <button
                type="button"
                onClick={() => setViewMode("queue")}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  viewMode === "queue" ? "bg-[#0F2D52] text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <UserIcon className="h-3 w-3 inline-block mr-1" />File
              </button>
              <button
                type="button"
                onClick={() => setViewMode("by-day")}
                className={`text-xs px-2.5 py-1 rounded transition-colors ${
                  viewMode === "by-day" ? "bg-[#0F2D52] text-white" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Calendar className="h-3 w-3 inline-block mr-1" />Par jour
              </button>
            </div>
          </div>
        </div>
      </Card>

      {approveQueue.pastPendingCount > 0 && (
        <div className="flex items-center gap-2.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-900 flex-wrap">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
          <span className="flex-1 min-w-0">
            <strong>{approveQueue.pastPendingCount}</strong> entrée{approveQueue.pastPendingCount > 1 ? "s" : ""} soumise{approveQueue.pastPendingCount > 1 ? "s" : ""} sur{" "}
            <strong>{approveQueue.pastPendingWeeks}</strong> semaine{approveQueue.pastPendingWeeks > 1 ? "s" : ""} antérieure{approveQueue.pastPendingWeeks > 1 ? "s" : ""} attend{approveQueue.pastPendingCount > 1 ? "ent" : ""} encore une approbation.
          </span>
          <WeekNavBackButton periodFrom={periodFrom} targetWeek={approveQueue.pastPendingLatestWeek} />
        </div>
      )}

      {viewMode === "queue" && (
        <>
          {queueRows.length === 0 ? (
            <Card className="p-10 text-center space-y-3">
              <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500" />
              <p className="text-sm font-semibold">
                {ql ? "Aucun employé correspondant en attente" : "Tout est approuvé pour cette semaine"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ql
                  ? "Aucune heure soumise en attente pour cette recherche sur la période affichée."
                  : "Aucune heure soumise en attente de décision sur la période affichée."}
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground px-1">
                <strong className="text-[#0F2D52]">{queueRows.length}</strong> employé{queueRows.length > 1 ? "s" : ""} en attente de votre décision.
              </p>
              {queueRows.map((row) => {
                const overtimeMin = Math.max(0, row.weekTotalMin - overtimeWeeklyMin);
                const initials = row.name.slice(0, 2).toUpperCase();
                const busy = busyId === row.adminId;
                return (
                  <Card key={row.adminId} className="p-0 overflow-hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-3 p-3.5">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={`h-10 w-10 rounded-full ${avatarColor(row.name)} flex items-center justify-center text-xs font-bold shrink-0`}>
                          {initials}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-sm font-semibold truncate">{row.name}</p>
                            {row.teamName && (
                              <Badge variant="outline" className="text-[10px]">{row.teamName}</Badge>
                            )}
                            {showOvertimeBadge && overtimeMin > 0 && (
                              <Badge variant="outline" className="text-[10px] text-amber-700 border-amber-300 bg-amber-50">
                                +{fmtDuration(overtimeMin)} sup.
                              </Badge>
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {row.days} jour{row.days > 1 ? "s" : ""} soumis
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0">
                        <p className="font-mono text-xl font-bold tabular-nums text-[#0F2D52]">
                          {fmtDuration(row.pendingMin)}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-9 text-xs"
                            onClick={() => onFocusEmployee(row.adminId)}
                          >
                            Détail
                          </Button>
                          <Button
                            size="sm"
                            disabled={busy}
                            onClick={() => approveRow(row)}
                            className="h-9 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
                            Approuver
                          </Button>
                        </div>
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}

          {awaiting.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <div className="flex items-center">
                <button
                  type="button"
                  onClick={() => setShowAwaiting((v) => !v)}
                  className="flex-1 flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-muted/40 text-left min-w-0"
                  aria-expanded={showAwaiting}
                >
                  {showAwaiting
                    ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                  <Clock className="h-4 w-4 text-slate-500 shrink-0" />
                  <span className="text-sm text-slate-700 flex-1 min-w-0">
                    En attente de soumission
                    <span className="text-muted-foreground"> · {awaiting.length} employé{awaiting.length > 1 ? "s" : ""}</span>
                  </span>
                </button>
                {awaiting.some((e) => !remindedIds.has(e.adminId)) && (
                  <ActionTooltip label="Envoyer un rappel à tous les employés pas encore relancés">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs mr-3 shrink-0"
                      disabled={busyAll}
                      onClick={remindAll}
                    >
                      <Bell className="h-3 w-3 mr-1.5" />
                      Relancer tous
                    </Button>
                  </ActionTooltip>
                )}
              </div>
              {showAwaiting && (
                <div className="border-t divide-y">
                  {awaiting.map((emp) => (
                    <div key={emp.adminId} className="flex items-center gap-2.5 px-3.5 py-2.5">
                      <div className={`h-8 w-8 rounded-full ${avatarColor(emp.name)} flex items-center justify-center text-[10px] font-bold shrink-0`}>
                        {emp.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{emp.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">
                          {emp.forgottenDays.length > 0
                            ? `${emp.forgottenDays.length} jour${emp.forgottenDays.length > 1 ? "s" : ""} sans pointage`
                            : `${emp.draftCount} entrée${emp.draftCount > 1 ? "s" : ""} en brouillon`}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 text-xs shrink-0"
                        disabled={busyId === emp.adminId || remindedIds.has(emp.adminId)}
                        onClick={() => remind(emp)}
                      >
                        <Bell className="h-3 w-3 mr-1.5" />
                        {remindedIds.has(emp.adminId) ? "Relancé" : "Relancer"}
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {upToDateRows.length > 0 && (
            <Card className="p-0 overflow-hidden">
              <button
                type="button"
                onClick={() => setShowUpToDate((v) => !v)}
                className="w-full flex items-center gap-2.5 px-3.5 py-2.5 hover:bg-muted/40 text-left"
                aria-expanded={showUpToDate}
              >
                {showUpToDate
                  ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
                  : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-sm text-slate-700 flex-1">
                  À jour
                  <span className="text-muted-foreground"> · {upToDateRows.length} employé{upToDateRows.length > 1 ? "s" : ""} tout approuvé</span>
                </span>
              </button>
              {showUpToDate && (
                <div className="border-t divide-y">
                  {upToDateRows.map((emp) => (
                    <div key={emp.adminId} className="flex items-center gap-2.5 px-3.5 py-2">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <p className="text-sm flex-1 min-w-0 truncate">{emp.name}</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => onFocusEmployee(emp.adminId)}
                      >
                        Voir
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}
        </>
      )}

      {viewMode === "by-day" && (
        <>
          <DayOnlyView
            items={items}
            statusFilter={statusFilter}
            employeesWithForgottenDays={employeesWithForgottenDays}
            holidaysByDay={holidaysByDay}
            selectedToApprove={selectedToApprove}
            onToggleSelectAll={onToggleSelectAll}
            onClickDay={onClickDay}
          />
          <Pagination
            page={page}
            pageSize={pageSize}
            total={total}
            totalPages={totalPages}
            onPage={onPage}
          />
        </>
      )}
    </div>
  );
}

// Past-weeks banner button: jumps straight to the most recent week that
// still has pending entries, not just -7 days.
function WeekNavBackButton({ periodFrom, targetWeek }: { periodFrom?: string; targetWeek: string | null }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const go = () => {
    let target: Date;
    if (targetWeek) {
      const [y, m, d] = targetWeek.split("-").map(Number);
      target = startOfWeek(new Date(y, m - 1, d));
    } else {
      const base = periodFrom ? new Date(periodFrom) : new Date();
      target = startOfWeek(base);
      target.setDate(target.getDate() - 7);
    }
    const params = new URLSearchParams(sp.toString());
    params.set("from", isoDate(target));
    params.set("to", isoDate(endOfWeek(target)));
    params.set("tab", "to-approve");
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };
  const label = targetWeek
    ? (() => {
        const [y, m, d] = targetWeek.split("-").map(Number);
        return `Semaine du ${new Date(y, m - 1, d).toLocaleDateString("fr-CA", { day: "numeric", month: "long" })}`;
      })()
    : "Semaine précédente";
  return (
    <Button variant="outline" size="sm" className="h-7 text-xs border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0" onClick={go}>
      <ChevronLeft className="h-3 w-3 mr-1" />{label}
    </Button>
  );
}
// ════════════════════════════════════════════════════════════════
// DayOnlyView: one card per day listing every
// aggregated employees (approved / pending / missing counters).
// ════════════════════════════════════════════════════════════════
type DayBucket = {
  date: string;                 // YYYY-MM-DD
  totalEntries: number;
  approvedCount: number;
  pendingCount: number;
  submittedCount: number;
  rejectedCount: number;
  totalWorkMin: number;
  uniqueAdminCount: number;     // employees with at least one entry
  missingAdminCount: number;    // active scoped employees with none
  pendingIds: number[];         // pending entry ids, for the bulk select
};

function DayOnlyView({
  items, statusFilter, employeesWithForgottenDays, holidaysByDay,
  selectedToApprove, onToggleSelectAll,
  onClickDay,
}: {
  items: DayAggRow[];
  statusFilter: StatusFilter;
  employeesWithForgottenDays: ForgottenEmployee[];
  holidaysByDay: Map<string, string>;
  selectedToApprove: Set<number>;
  onToggleSelectAll: (ids: number[], v: boolean) => void;
  onClickDay: (date: string) => void;
}) {
  // Invert forgottenDays: date -> Set<adminId>
  const missingByDay = useMemo(() => {
    const m = new Map<string, Set<number>>();
    for (const emp of employeesWithForgottenDays) {
      for (const d of emp.forgottenDays) {
        if (!m.has(d)) m.set(d, new Set());
        m.get(d)!.add(emp.adminId);
      }
    }
    return m;
  }, [employeesWithForgottenDays]);

  // Group DayAggRow by date (each row is one employee on one day).
  const buckets = useMemo<DayBucket[]>(() => {
    const byDate = new Map<string, {
      adminIds: Set<number>;
      totalEntries: number;
      approvedCount: number;
      pendingCount: number;
      submittedCount: number;
      rejectedCount: number;
      totalWorkMin: number;
      pendingIds: number[];
    }>();
    for (const agg of items) {
      let b = byDate.get(agg.date);
      if (!b) {
        b = {
          adminIds: new Set(),
          totalEntries: 0,
          approvedCount: 0,
          pendingCount: 0,
          submittedCount: 0,
          rejectedCount: 0,
          totalWorkMin: 0,
          pendingIds: [] as number[],
        };
        byDate.set(agg.date, b);
      }
      b.adminIds.add(agg.adminId);
      b.totalWorkMin += agg.workMin;
      // Submission-before-approval: only SUBMITTED entries are selectable.
      // are approvable, so they feed pendingIds for the bulk selection.
      // Drafts are counted separately and cannot be selected.
      for (const e of agg.entries) {
        b.totalEntries++;
        if (e.approvedAt) b.approvedCount++;
        else if (e.submittedAt) {
          b.submittedCount++;
          b.pendingIds.push(e.id);
        } else if (!e.clockOut) {
          // Running shift: not finalized, counted nowhere.
        } else {
          b.pendingCount++; // draft still awaiting the employee's submission
        }
        // Rejection has no flag on Entry; only the aggregate status carries it.
      }
      // A fully rejected aggregate counts as rejected.
      if (agg.status === "rejected") {
        b.rejectedCount += agg.entries.length;
      }
    }
    // Add "missing only" days: no entry at all, but employees who forgot.
    for (const [date, adminSet] of missingByDay) {
      if (!byDate.has(date) && adminSet.size > 0) {
        byDate.set(date, {
          adminIds: new Set(),
          totalEntries: 0,
          approvedCount: 0,
          pendingCount: 0,
          submittedCount: 0,
          rejectedCount: 0,
          totalWorkMin: 0,
          pendingIds: [] as number[],
        });
      }
    }
    // Status filter: keep only days with at least one entry of that status.
    // Items are server-filtered, but "missing only" must still be honoured.
    const out: DayBucket[] = [];
    for (const [date, b] of byDate) {
      const missingAdminIds = missingByDay.get(date);
      const missingAdminCount = missingAdminIds ? missingAdminIds.size : 0;
      // Skip days with no matching entry and nobody missing.
      const hasAnyEntry = b.totalEntries > 0;
      if (!hasAnyEntry && missingAdminCount === 0) continue;
      out.push({
        date,
        totalEntries: b.totalEntries,
        approvedCount: b.approvedCount,
        pendingCount: b.pendingCount,
        submittedCount: b.submittedCount,
        rejectedCount: b.rejectedCount,
        totalWorkMin: b.totalWorkMin,
        uniqueAdminCount: b.adminIds.size,
        missingAdminCount,
        pendingIds: b.pendingIds,
      });
    }
    out.sort((a, b) => b.date.localeCompare(a.date));
    return out;
  }, [items, missingByDay]);

  // Applied server-side on `items`; referenced to silence the unused warning.
  void statusFilter;

  return (
    <Card>
      <div className="divide-y">
        {buckets.length === 0 ? (
          <div className="p-8 text-center text-sm text-muted-foreground">
            Aucune journée à afficher avec ces filtres.
          </div>
        ) : buckets.map((b) => (
          <DayOnlyRow
            key={b.date}
            bucket={b}
            holidayName={holidaysByDay.get(b.date)}
            selectedToApprove={selectedToApprove}
            onToggleSelectAll={onToggleSelectAll}
            onClick={() => onClickDay(b.date)}
          />
        ))}
      </div>
    </Card>
  );
}

function DayOnlyRow({
  bucket, holidayName, selectedToApprove, onToggleSelectAll, onClick,
}: {
  bucket: DayBucket;
  holidayName?: string;
  selectedToApprove: Set<number>;
  onToggleSelectAll: (ids: number[], v: boolean) => void;
  onClick: () => void;
}) {
  const isToday = bucket.date === todayKey();
  const dateLabel = capFirst(new Date(bucket.date + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }));
  const hasPending = bucket.pendingIds.length > 0;
  const allSelected = hasPending && bucket.pendingIds.every((id) => selectedToApprove.has(id));
  const someSelected = bucket.pendingIds.some((id) => selectedToApprove.has(id)) && !allSelected;

  return (
    <div
      className="flex items-center gap-3 p-3 hover:bg-[#0F2D52]/5 cursor-pointer transition-colors"
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          onClick();
        }
      }}
      aria-label={`Voir détail de la journée ${dateLabel}`}
    >
      {/* Only SUBMITTED entries of the day are selectable. */}
      {hasPending && (
        <div onClick={(e) => e.stopPropagation()} className="shrink-0">
          <ActionTooltip label={allSelected ? "Désélectionner le jour" : "Sélectionner tous les pointages soumis de ce jour"}>
            <Checkbox
              checked={allSelected ? true : someSelected ? "indeterminate" : false}
              onCheckedChange={(v) => onToggleSelectAll(bucket.pendingIds, v === true)}
              aria-label={`Sélectionner les pointages soumis du ${dateLabel}`}
            />
          </ActionTooltip>
        </div>
      )}
      <div
        className="h-9 w-9 rounded-md bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center shrink-0"
        aria-hidden
      >
        <Calendar className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold">{dateLabel}</span>
          {isToday && (
            <Badge className="text-[10px] bg-[#0F2D52] text-white border-[#0F2D52]">
              Aujourd'hui
            </Badge>
          )}
          {holidayName && (
            <Badge className="text-[10px] bg-cyan-100 text-cyan-800 border-cyan-300">
              Férié - {holidayName}
            </Badge>
          )}
        </div>
        <p className="sm:hidden mt-1 text-[11px] text-muted-foreground flex flex-wrap items-center gap-x-1.5">
          {bucket.uniqueAdminCount > 0 && <span>{bucket.uniqueAdminCount} pointé{bucket.uniqueAdminCount > 1 ? "s" : ""}</span>}
          {bucket.approvedCount > 0 && <span className="text-emerald-700">· {bucket.approvedCount} validé{bucket.approvedCount > 1 ? "s" : ""}</span>}
          {bucket.submittedCount > 0 && <span className="text-blue-700">· {bucket.submittedCount} soumis</span>}
          {bucket.pendingCount > 0 && <span className="text-amber-800">· {bucket.pendingCount} brouillon{bucket.pendingCount > 1 ? "s" : ""}</span>}
          {bucket.missingAdminCount > 0 && <span className="text-red-700">· {bucket.missingAdminCount} sans pointage</span>}
          {bucket.rejectedCount > 0 && <span className="text-violet-700">· {bucket.rejectedCount} rejeté{bucket.rejectedCount > 1 ? "s" : ""}</span>}
        </p>
        <div className="hidden sm:flex items-center gap-2 flex-wrap mt-1">
          {bucket.uniqueAdminCount > 0 && (
            <ActionTooltip label="Employés ayant au moins 1 pointage">
              <span className="text-[11px] text-muted-foreground inline-flex items-center gap-1 cursor-help">
                <UserIcon className="h-3 w-3" />
                {bucket.uniqueAdminCount} employé{bucket.uniqueAdminCount > 1 ? "s" : ""} pointé{bucket.uniqueAdminCount > 1 ? "s" : ""}
              </span>
            </ActionTooltip>
          )}
          {bucket.approvedCount > 0 && (
            <ActionTooltip label={`${bucket.approvedCount} pointage(s) validé(s)`}>
              <Badge className="text-[10px] bg-emerald-100 text-emerald-900 border-emerald-300 cursor-help">
                <CheckCircle2 className="h-2.5 w-2.5 mr-1" />
                {bucket.approvedCount} validé{bucket.approvedCount > 1 ? "s" : ""}
              </Badge>
            </ActionTooltip>
          )}
          {bucket.submittedCount > 0 && (
            <ActionTooltip label={`${bucket.submittedCount} pointage(s) soumis — à approuver`}>
              <Badge className="text-[10px] text-blue-700 border-blue-300 bg-blue-50 cursor-help">
                <Send className="h-2.5 w-2.5 mr-1" />
                {bucket.submittedCount} soumis
              </Badge>
            </ActionTooltip>
          )}
          {bucket.pendingCount > 0 && (
            <ActionTooltip label={`${bucket.pendingCount} brouillon(s) en attente de soumission par l'employé`}>
              <Badge className="text-[10px] text-amber-800 border-amber-300 bg-amber-50 cursor-help">
                <AlertCircle className="h-2.5 w-2.5 mr-1" />
                {bucket.pendingCount} brouillon{bucket.pendingCount > 1 ? "s" : ""}
              </Badge>
            </ActionTooltip>
          )}
          {bucket.missingAdminCount > 0 && (
            <ActionTooltip label={`${bucket.missingAdminCount} employé(s) sans pointage ce jour`}>
              <Badge className="text-[10px] text-red-700 border-red-300 bg-red-50 cursor-help">
                <AlertTriangle className="h-2.5 w-2.5 mr-1" />
                {bucket.missingAdminCount} sans pointage
              </Badge>
            </ActionTooltip>
          )}
          {bucket.rejectedCount > 0 && (
            <ActionTooltip label={`${bucket.rejectedCount} pointage(s) rejeté(s)`}>
              <Badge className="text-[10px] text-violet-700 border-violet-300 bg-violet-50 cursor-help">
                <XCircle className="h-2.5 w-2.5 mr-1" />
                {bucket.rejectedCount} rejeté{bucket.rejectedCount > 1 ? "s" : ""}
              </Badge>
            </ActionTooltip>
          )}
        </div>
      </div>
      <div className="text-right shrink-0">
        <p className="font-mono text-sm font-bold tabular-nums text-[#0F2D52]">
          {fmtDuration(bucket.totalWorkMin)}
        </p>
        <p className="text-[9px] uppercase tracking-wider text-muted-foreground">Total</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" aria-hidden />
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// Pagination
// ════════════════════════════════════════════════════════════════
const PAGE_SIZES = [25, 50, 100];

function Pagination({
  page, pageSize, total, totalPages, onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  onPage: (n: number) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const setPageSize = (n: number) => {
    const params = new URLSearchParams(sp.toString());
    params.set("pageSize", String(n));
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };
  // Shown as soon as the smallest page size is not enough, so 25 stays
  // reachable.
  if (total <= PAGE_SIZES[0]) return null;
  const start = (page - 1) * pageSize + 1;
  const end = Math.min(total, page * pageSize);
  // Compact display: 1 .. p-1 p p+1 .. last
  const pages: Array<number | "ellipsis"> = [];
  const push = (v: number | "ellipsis") => pages.push(v);
  const window = 1;
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || (i >= page - window && i <= page + window)) {
      push(i);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      push("ellipsis");
    }
  }
  return (
    <div className="flex items-center justify-between gap-2 flex-wrap">
      <div className="flex items-center gap-2">
        <p className="text-xs text-muted-foreground">
          {start}–{end} sur {total}
        </p>
        <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
          <SelectTrigger className="h-8 w-[110px] text-xs" aria-label="Taille de page">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PAGE_SIZES.map((n) => (
              <SelectItem key={n} value={String(n)}>{n} / page</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex items-center gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />Précédent
        </Button>
        {pages.map((p, i) =>
          p === "ellipsis" ? (
            <span key={`e-${i}`} className="px-1 text-muted-foreground text-xs">…</span>
          ) : (
            <Button
              key={p}
              variant={p === page ? "default" : "outline"}
              size="sm"
              className={`h-8 w-8 p-0 text-xs ${p === page ? "bg-[#0F2D52] hover:bg-[#15406d]" : ""}`}
              onClick={() => onPage(p)}
            >
              {p}
            </Button>
          ),
        )}
        <Button
          variant="outline"
          size="sm"
          className="h-8 text-xs"
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
        >
          Suivant<ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// ManualEntryDialog helpers
// ════════════════════════════════════════════════════════════════

function toLocalInput(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const mn = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${dd}T${h}:${mn}`;
}

// ════════════════════════════════════════════════════════════════
// SubmitWeekDialog: submit the week for review.
// ════════════════════════════════════════════════════════════════
function SubmitWeekDialog({
  open, onClose, weekEntries, onSaved,
}: {
  open: boolean;
  onClose: () => void;
  weekEntries: Entry[];
  onSaved: () => void;
}) {
  const [pending, setPending] = useState(false);

  // Aggregats
  const buckets = useMemo(() => {
    let workMin = 0;
    let breakMin = 0;
    let leaveMin = 0;
    for (const e of weekEntries) {
      const dur = e.durationMin ?? 0;
      if (SUBMITTABLE_CATS.has(e.category)) workMin += dur;
      else if (e.category === "break") breakMin += dur;
      else if (LEAVE_CATS.has(e.category)) leaveMin += dur;
    }
    return { workMin, breakMin, leaveMin };
  }, [weekEntries]);

  const nonCompliantDays = useMemo(() => {
    const byDay = new Map<string, { workMin: number; breakMin: number }>();
    for (const e of weekEntries) {
      const key = dayKey(e.clockIn);
      if (!byDay.has(key)) byDay.set(key, { workMin: 0, breakMin: 0 });
      const slot = byDay.get(key)!;
      const dur = e.durationMin ?? 0;
      if (SUBMITTABLE_CATS.has(e.category)) slot.workMin += dur;
      else if (e.category === "break") slot.breakMin += dur;
    }
    const out: { date: string; workMin: number; breakMin: number }[] = [];
    for (const [date, v] of byDay) {
      if (v.workMin >= 300 && v.breakMin < 30) out.push({ date, ...v });
    }
    out.sort((a, b) => a.date.localeCompare(b.date));
    return out;
  }, [weekEntries]);

  const submit = async () => {
    setPending(true);
    const ws = startOfWeek(new Date());
    const r = await submitWeekTimeClocksAction({ weekStart: ws.toISOString() });
    setPending(false);
    if (r.success) {
      toast.success(`${r.data.submitted} entrée(s) soumise(s) · ${fmtDuration(r.data.workMin)} travaillées`);
      onSaved();
    } else toast.error(r.error || "");
  };

  const workHours = (buckets.workMin / 60).toFixed(1);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Send className="h-4 w-4" />Soumettre la semaine
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Les heures travaillées seront verrouillées et les administrateurs notifiés.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto">
          <FormSection icon={Clock} title="Récapitulatif de la semaine">
            <div className="rounded-lg border-2 border-[#0F2D52] bg-gradient-to-br from-[#0F2D52]/5 to-[#0F2D52]/10 p-4">
              <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52]">Heures travaillées</p>
              <p className="font-mono text-3xl font-bold text-[#0F2D52] tabular-nums mt-1">{workHours}h</p>
              <p className="text-xs text-muted-foreground mt-1">À soumettre pour la paie</p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="rounded border p-2 bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Pauses</p>
                <p className="font-mono font-bold">{fmtDuration(buckets.breakMin)}</p>
                <p className="text-[10px] text-muted-foreground italic">info — non soumis</p>
              </div>
              <div className="rounded border p-2 bg-muted/30">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Congés payés</p>
                <p className="font-mono font-bold">{fmtDuration(buckets.leaveMin)}</p>
                <p className="text-[10px] text-muted-foreground italic">auto</p>
              </div>
            </div>
          </FormSection>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button onClick={submit} disabled={pending || buckets.workMin === 0}>
            {pending ? "..." : "Soumettre"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ════════════════════════════════════════════════════════════════
// ForceCloseDialog: an admin force-closes a shift left open.
// ════════════════════════════════════════════════════════════════
function ForceCloseDialog({
  adminId, name, onClose, onSaved,
}: {
  adminId: number;
  name: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [when, setWhen] = useState(toLocalInput(new Date()));
  const [pending, setPending] = useState(false);
  // A shift can have been left open for days; the picker defaults to this week.
  const minDate = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - 60);
    return isoDate(d);
  }, []);

  const submit = async () => {
    setPending(true);
    const r = await forceClockOutAction({
      adminId,
      when: new Date(when).toISOString(),
    });
    setPending(false);
    if (r.success) { toast.success("Pointage fermé"); onSaved(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-sm p-0 overflow-hidden">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />Forcer fermeture
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Fermer le pointage en cours de {name}.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3">
          <FormSection icon={Clock} title="Fermeture du pointage">
            <Field label="Heure de fermeture" required>
              <TimePicker value={when} onChange={setWhen} minDate={minDate} />
            </Field>
            <p className="text-[11px] text-muted-foreground">
              L&apos;employé sera notifié. Une note d&apos;audit sera ajoutée à l&apos;entrée.
            </p>
          </FormSection>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30">
          <Button variant="outline" onClick={onClose} disabled={pending}>Annuler</Button>
          <Button variant="destructive" onClick={submit} disabled={pending}>
            {pending ? "..." : "Fermer le pointage"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


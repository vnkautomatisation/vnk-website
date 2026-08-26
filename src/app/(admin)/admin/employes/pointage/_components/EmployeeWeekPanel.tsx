"use client";
// Quick approval panel for one employee's week.
// EmployeeWeekPanelRemote fetches; EmployeeWeekPanel is pure presentation.
import { useState, useEffect, useMemo, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, AlertCircle, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { promptDialog, confirmDialog } from "@/components/admin/prompt-dialog";
import { InlineLoader } from "@/components/admin/page-loader";
import {
  approveTimeClockAction, rejectTimeClockAction, unapproveTimeClockAction,
  approveWeekTimeClockAction,
} from "@/app/actions/hr-timeclock";
import type { Entry } from "../_types";
import { ApprovedBadge } from "./ApprovedBadge";
import { PanelEntryRow } from "./EntryRows";
import { dayKey, fmtDuration, capFirst } from "./_utils";

export function EmployeeWeekPanelRemote({
  adminId, periodFrom, periodTo, focusDate, onClose,
}: {
  adminId: number;
  periodFrom: string;
  periodTo: string;
  focusDate?: string | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const [data, setData] = useState<{
    name: string;
    email: string;
    position: string | null;
    entries: Entry[];
    truncated?: boolean;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const url = `/api/admin/timeclock/employee?adminId=${adminId}&from=${encodeURIComponent(periodFrom)}&to=${encodeURIComponent(periodTo)}`;
    fetch(url)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!cancelled) setData(json);
      })
      .catch((e) => {
        if (!cancelled) setError(String(e?.message || e));
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [adminId, periodFrom, periodTo, refreshKey]);

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1);
    router.refresh();
  }, [router]);

  // Wrapped actions: toast + refresh both the panel and the page.
  const approve = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    setPending(true);
    const r = await approveTimeClockAction({ ids });
    setPending(false);
    if (r.success) { toast.success(`${r.data.approved} entrée(s) approuvée(s)`); reload(); }
    else toast.error(r.error || "");
  }, [reload]);

  const reject = useCallback(async (id: number) => {
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
    setPending(true);
    const r = await rejectTimeClockAction({ id, reason });
    setPending(false);
    if (r.success) { toast.success("Pointage rejeté"); reload(); }
    else toast.error(r.error || "");
  }, [reload]);

  const unapprove = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    const reason = await promptDialog({
      title: ids.length > 1 ? "Annuler les approbations" : "Annuler l'approbation",
      label: "Motif (optionnel)",
      placeholder: "Pourquoi revenir sur cette décision ?",
      multiline: true,
      required: false,
      variant: "destructive",
      confirmLabel: "Annuler l'approbation",
    });
    if (reason === null) return;
    setPending(true);
    const r = await unapproveTimeClockAction({ ids, reason: reason || undefined });
    setPending(false);
    if (r.success) { toast.success(`${r.data.unapproved} approbation(s) annulée(s)`); reload(); }
    else toast.error(r.error || "");
  }, [reload]);

  const approveWeek = useCallback(async (name: string) => {
    const ok = await confirmDialog({
      title: "Approuver la semaine en cours",
      description: `Approuver toutes les entrées non approuvées de la semaine en cours pour ${name} ?`,
      confirmLabel: "Approuver",
    });
    if (!ok) return;
    setPending(true);
    const r = await approveWeekTimeClockAction({ adminId });
    setPending(false);
    if (r.success) { toast.success(`${r.data.approved} entrée(s) approuvée(s)`); reload(); }
    else toast.error(r.error || "");
  }, [adminId, reload]);

  if (loading) {
    return (
      <>
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5">
          <SheetHeader>
            <SheetTitle className="text-white">Chargement…</SheetTitle>
          </SheetHeader>
        </div>
        <div className="p-5">
          <InlineLoader label="Chargement des entrées…" />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5">
          <SheetHeader>
            <SheetTitle className="text-white">Erreur</SheetTitle>
          </SheetHeader>
        </div>
        <div className="p-5 text-sm text-red-700">{error ?? "Impossible de charger les données."}</div>
      </>
    );
  }

  return (
    <EmployeeWeekPanel
      employee={{ id: adminId, name: data.name, email: data.email, position: data.position, entries: data.entries }}
      truncated={data.truncated ?? false}
      focusDate={focusDate ?? null}
      pending={pending}
      onApprove={approve}
      onReject={reject}
      onUnapprove={unapprove}
      onApproveWeek={() => approveWeek(data.name)}
      onClose={onClose}
    />
  );
}

export function EmployeeWeekPanel({
  employee, focusDate, pending, truncated = false,
  onApprove, onReject, onUnapprove, onApproveWeek, onClose,
}: {
  employee: { id: number; name: string; email: string; position: string | null; entries: Entry[] };
  focusDate: string | null;
  truncated?: boolean;
  pending: boolean;
  onApprove: (ids: number[]) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  onUnapprove: (ids: number[]) => Promise<void>;
  onApproveWeek: () => Promise<void>;
  onClose: () => void;
}) {
  const entries = employee.entries;


  const stats = useMemo(() => {
    let total = 0;
    let toApproveCount = 0, approvedCount = 0;
    for (const e of entries) {
      const d = e.durationMin ?? 0;
      total += d;
      if (e.approvedAt) { approvedCount++; }
      else if (e.clockOut && e.submittedAt) { toApproveCount++; }
    }
    return { total, toApproveCount, approvedCount };
  }, [entries]);

  // Group by day, most recent first, with focusDate pulled to the top.
  const groupedDays = useMemo(() => {
    const map = new Map<string, Entry[]>();
    for (const e of entries) {
      const k = dayKey(e.clockIn);
      if (!map.has(k)) map.set(k, []);
      map.get(k)!.push(e);
    }
    const arr = Array.from(map.entries())
      .map(([date, ents]) => {
        const sorted = [...ents].sort((a, b) => new Date(a.clockIn).getTime() - new Date(b.clockIn).getTime());
        const dayTotal = sorted.reduce((s, e) => s + (e.durationMin ?? 0), 0);
        const allApproved = sorted.every((e) => e.approvedAt);
        const anyPending = sorted.some((e) => e.submittedAt && !e.approvedAt && e.clockOut);
        return { date, entries: sorted, dayTotal, allApproved, anyPending };
      })
      .sort((a, b) => b.date.localeCompare(a.date));

    if (focusDate) {
      const idx = arr.findIndex((d) => d.date === focusDate);
      if (idx > 0) {
        const [item] = arr.splice(idx, 1);
        arr.unshift(item);
      }
    }
    return arr;
  }, [entries, focusDate]);


  const allPendingIds = useMemo(
    // Workflow rule: only SUBMITTED entries are approvable.
    () => entries.filter((e) => e.submittedAt && !e.approvedAt && e.clockOut).map((e) => e.id),
    [entries],
  );

  // The panel renders every day it is given; a long period is dozens of
  // screens of internal scroll.
  const DAYS_PER_PAGE = 10;
  const [dayPage, setDayPage] = useState(1);
  useEffect(() => { setDayPage(1); }, [employee.id, groupedDays.length]);
  const dayTotalPages = Math.max(1, Math.ceil(groupedDays.length / DAYS_PER_PAGE));
  const dayFrom = groupedDays.length === 0 ? 0 : (dayPage - 1) * DAYS_PER_PAGE + 1;
  const dayTo = Math.min(groupedDays.length, dayPage * DAYS_PER_PAGE);
  const pagedDays = groupedDays.slice((dayPage - 1) * DAYS_PER_PAGE, dayPage * DAYS_PER_PAGE);

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5 shrink-0">
        <SheetHeader>
          <SheetTitle className="text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-white/15 flex items-center justify-center font-bold text-sm shrink-0">
                {employee.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-base truncate">{employee.name}</p>
                <p className="text-xs text-white/70 font-normal truncate">
                  {employee.position || employee.email}
                </p>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-3 gap-2 mt-4">
          <div className="rounded-md bg-white/10 p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-white/70">À approuver</p>
            <p className="text-lg font-bold tabular-nums">{stats.toApproveCount}</p>
          </div>
          <div className="rounded-md bg-white/10 p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-white/70">Approuvées</p>
            <p className="text-lg font-bold tabular-nums">{stats.approvedCount}</p>
          </div>
          <div className="rounded-md bg-white/10 p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-white/70">Heures</p>
            <p className="text-lg font-bold tabular-nums">{fmtDuration(stats.total)}</p>
          </div>
        </div>
        <div className="mt-3">
          <Button
            variant="outline"
            size="sm"
            asChild
            className="w-full bg-white/10 border-white/20 text-white hover:bg-white/20 hover:text-white"
          >
            <Link href={`/admin/employes/${employee.id}/dossier`}>
              <UserIcon className="h-3.5 w-3.5 mr-1.5" />Voir le dossier complet
            </Link>
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {truncated && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>Période trop longue : seules les entrées les plus récentes sont chargées.</span>
          </div>
        )}
        {dayTotalPages > 1 && (
          <div className="sticky -top-4 z-10 -mt-4 -mx-4 px-4 pt-4 pb-2 bg-background border-b flex items-center justify-between gap-2">
            <span className="text-[11px] text-muted-foreground tabular-nums">
              Jours {dayFrom}–{dayTo} sur {groupedDays.length}
            </span>
            <div className="flex items-center gap-1">
              <Button variant="outline" size="sm" className="h-7 text-[11px] px-2"
                disabled={dayPage <= 1} onClick={() => setDayPage((n) => n - 1)}>
                Préc.
              </Button>
              <span className="text-[11px] text-muted-foreground tabular-nums px-0.5">{dayPage}/{dayTotalPages}</span>
              <Button variant="outline" size="sm" className="h-7 text-[11px] px-2"
                disabled={dayPage >= dayTotalPages} onClick={() => setDayPage((n) => n + 1)}>
                Suiv.
              </Button>
            </div>
          </div>
        )}
        {groupedDays.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune entrée sur la période.</p>
        ) : pagedDays.map((day) => {
          const dateLabel = capFirst(new Date(day.date + "T12:00:00").toLocaleDateString("fr-CA", {
            weekday: "long", day: "numeric", month: "long",
          }));
          const isFocus = focusDate === day.date;
          return (
            <div
              key={day.date}
              className={`rounded-lg border ${isFocus ? "border-[#0F2D52] ring-2 ring-[#0F2D52]/20" : "border-border"}`}
            >
              <div className="flex items-center justify-between gap-2 p-2.5 bg-muted/40 border-b">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold">{dateLabel}</span>
                  {day.allApproved && day.entries.length > 0 && <ApprovedBadge strong />}
                  {day.anyPending && (
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50">
                      <AlertCircle className="h-2.5 w-2.5 mr-1" />En attente
                    </Badge>
                  )}
                </div>
                <span className="font-mono text-sm font-bold tabular-nums text-[#0F2D52] shrink-0">
                  {fmtDuration(day.dayTotal)}
                </span>
              </div>
              <div className="divide-y">
                {day.entries.map((e) => (
                  <PanelEntryRow
                    key={e.id}
                    entry={e}
                    pending={pending}
                    onApprove={() => onApprove([e.id])}
                    onReject={() => onReject(e.id)}
                    onUnapprove={() => onUnapprove([e.id])}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t bg-muted/30 p-3 shrink-0 flex flex-col sm:flex-row sm:items-center gap-2">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending} className="hidden sm:inline-flex">
          Fermer
        </Button>
        <div className="hidden sm:block flex-1" />
        {allPendingIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onApprove(allPendingIds)}
            className="w-full sm:w-auto border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
            <span className="truncate">Approuver tout ({allPendingIds.length})</span>
          </Button>
        )}
        <Button
          size="sm"
          disabled={pending}
          onClick={onApproveWeek}
          className="w-full sm:w-auto bg-[#0F2D52] hover:bg-[#15406d]"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5 shrink-0" />
          <span className="truncate">Approuver la semaine</span>
        </Button>
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending} className="sm:hidden">
          Fermer
        </Button>
      </div>
    </div>
  );
}

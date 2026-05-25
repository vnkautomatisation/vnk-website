"use client";
// EmployeeWeekPanel + EmployeeWeekPanelRemote — extraits de timeclock-view.tsx
// (refactor #87). Panel d'approbation rapide pour la semaine d'un employe.
// EmployeeWeekPanelRemote fait le fetch + wrap les actions, EmployeeWeekPanel
// est purement presentationnel.
import { useState, useEffect, useMemo, useCallback } from "react";
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
import { dayKey, fmtDuration } from "./_utils";

// ─────────────────────────────────────────────────────────────────────────────
// EmployeeWeekPanelRemote — fetch leger + EmployeeWeekPanel
// Refonte 2026 : un seul panel d'approbation pour la vue admin.
// Click-to-open depuis ByEmployee row OU ToApprove card.
// Actions par entry : Approuver / Rejeter / Annuler approbation.
// Footer : Approuver toute la semaine.
// ─────────────────────────────────────────────────────────────────────────────
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

  // Actions encapsulees (toast + reload local du panel + page)
  const approve = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    setPending(true);
    const r = await approveTimeClockAction({ ids });
    setPending(false);
    if (r.success) { toast.success(`${r.data.approved} approuvee(s)`); reload(); }
    else toast.error(r.error || "");
  }, [reload]);

  const reject = useCallback(async (id: number) => {
    const reason = await promptDialog({
      title: "Rejeter le pointage",
      label: "Motif du rejet",
      placeholder: "L'employe verra ce message",
      multiline: true,
      required: true,
      variant: "destructive",
      confirmLabel: "Rejeter",
    });
    if (!reason) return;
    setPending(true);
    const r = await rejectTimeClockAction({ id, reason });
    setPending(false);
    if (r.success) { toast.success("Pointage rejete"); reload(); }
    else toast.error(r.error || "");
  }, [reload]);

  const unapprove = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    const reason = await promptDialog({
      title: ids.length > 1 ? "Annuler les approbations" : "Annuler l'approbation",
      label: "Motif (optionnel)",
      placeholder: "Pourquoi revenir sur cette decision ?",
      multiline: true,
      required: false,
      variant: "destructive",
      confirmLabel: "Annuler l'approbation",
    });
    if (reason === null) return;
    setPending(true);
    const r = await unapproveTimeClockAction({ ids, reason: reason || undefined });
    setPending(false);
    if (r.success) { toast.success(`${r.data.unapproved} approbation(s) annulee(s)`); reload(); }
    else toast.error(r.error || "");
  }, [reload]);

  const approveWeek = useCallback(async (name: string) => {
    const ok = await confirmDialog({
      title: "Approuver la semaine en cours",
      description: `Approuver toutes les entrees non-approuvees de la semaine en cours pour ${name} ?`,
      confirmLabel: "Approuver",
    });
    if (!ok) return;
    setPending(true);
    const r = await approveWeekTimeClockAction({ adminId });
    setPending(false);
    if (r.success) { toast.success(`${r.data.approved} entree(s) approuvee(s)`); reload(); }
    else toast.error(r.error || "");
  }, [adminId, reload]);

  if (loading) {
    return (
      <>
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5">
          <SheetHeader>
            <SheetTitle className="text-white">Chargement...</SheetTitle>
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
        <div className="p-5 text-sm text-red-700">{error ?? "Impossible de charger les donnees."}</div>
      </>
    );
  }

  return (
    <EmployeeWeekPanel
      employee={{ id: adminId, name: data.name, email: data.email, position: data.position, entries: data.entries }}
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

// ─────────────────────────────────────────────────────────────────────────────
// EmployeeWeekPanel — version presentationnelle (recoit ses callbacks).
// ─────────────────────────────────────────────────────────────────────────────
export function EmployeeWeekPanel({
  employee, focusDate, pending,
  onApprove, onReject, onUnapprove, onApproveWeek, onClose,
}: {
  employee: { id: number; name: string; email: string; position: string | null; entries: Entry[] };
  focusDate: string | null;
  pending: boolean;
  onApprove: (ids: number[]) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  onUnapprove: (ids: number[]) => Promise<void>;
  onApproveWeek: () => Promise<void>;
  onClose: () => void;
}) {
  const entries = employee.entries;

  // KPIs rapides
  const stats = useMemo(() => {
    let total = 0;
    let toApproveCount = 0, approvedCount = 0;
    for (const e of entries) {
      const d = e.durationMin ?? 0;
      total += d;
      if (e.approvedAt) { approvedCount++; }
      else if (e.clockOut) { toApproveCount++; }
    }
    return { total, toApproveCount, approvedCount };
  }, [entries]);

  // Group by day (date desc, mais focus en haut)
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
        const anyPending = sorted.some((e) => !e.approvedAt && e.clockOut);
        return { date, entries: sorted, dayTotal, allApproved, anyPending };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
    // Si focusDate fourni, le mettre en premier
    if (focusDate) {
      const idx = arr.findIndex((d) => d.date === focusDate);
      if (idx > 0) {
        const [item] = arr.splice(idx, 1);
        arr.unshift(item);
      }
    }
    return arr;
  }, [entries, focusDate]);

  // Toutes les ids pending de la semaine (utilise pour bouton footer alternatif)
  const allPendingIds = useMemo(
    () => entries.filter((e) => !e.approvedAt && e.clockOut).map((e) => e.id),
    [entries],
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header navy avec avatar + KPIs */}
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
            <p className="text-[9px] uppercase tracking-wider text-white/70">A approuver</p>
            <p className="text-lg font-bold tabular-nums">{stats.toApproveCount}</p>
          </div>
          <div className="rounded-md bg-white/10 p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-white/70">Approuvees</p>
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
            <a href={`/admin/employes/${employee.id}/dossier`}>
              <UserIcon className="h-3.5 w-3.5 mr-1.5" />Voir le dossier complet
            </a>
          </Button>
        </div>
      </div>

      {/* Body : liste des jours avec entries */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {groupedDays.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Aucune entree sur la periode.</p>
        ) : groupedDays.map((day) => {
          const dateLabel = new Date(day.date + "T12:00:00").toLocaleDateString("fr-CA", {
            weekday: "long", day: "numeric", month: "long",
          });
          const isFocus = focusDate === day.date;
          return (
            <div
              key={day.date}
              className={`rounded-lg border ${isFocus ? "border-[#0F2D52] ring-2 ring-[#0F2D52]/20" : "border-border"}`}
            >
              {/* Header du jour */}
              <div className="flex items-center justify-between gap-2 p-2.5 bg-muted/40 border-b">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-sm font-semibold capitalize">{dateLabel}</span>
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
              {/* Entries du jour */}
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

      {/* Footer : bouton approuver la semaine */}
      <div className="border-t bg-muted/30 p-3 flex items-center gap-2 shrink-0">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          Fermer
        </Button>
        <div className="flex-1" />
        {allPendingIds.length > 0 && (
          <Button
            size="sm"
            variant="outline"
            disabled={pending}
            onClick={() => onApprove(allPendingIds)}
            className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Approuver tout ({allPendingIds.length})
          </Button>
        )}
        <Button
          size="sm"
          disabled={pending}
          onClick={onApproveWeek}
          className="bg-[#0F2D52] hover:bg-[#15406d]"
        >
          <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
          Approuver la semaine
        </Button>
      </div>
    </div>
  );
}

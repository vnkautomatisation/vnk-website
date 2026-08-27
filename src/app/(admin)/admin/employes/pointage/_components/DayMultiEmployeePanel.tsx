"use client";
// One day, every employee in scope: their punches, then those with none.
import { useState, useEffect, useMemo, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  Clock, CheckCircle2, AlertCircle, Plus, Calendar,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { InlineLoader } from "@/components/admin/page-loader";
import type { Entry } from "../_types";
import { ApprovedBadge } from "./ApprovedBadge";
import { PanelEntryRowWithHistory } from "./EntryRows";
import { ManualEntryDialog } from "./ManualEntryDialog";
import { fmtDuration, capFirst } from "./_utils";

type AdminWithoutEntry = {
  id: number;
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  title?: string | null;
  position?: { name: string } | null;
  team?: { id: number; name: string; color: string | null } | null;
};

export function DayMultiEmployeePanel({
  dayDate, onClose, onApprove, onReject, onUnapprove,
  onEditEntry,
}: {
  dayDate: string;
  onClose: () => void;
  onApprove: (ids: number[]) => Promise<void>;
  onReject: (id: number) => Promise<void>;
  onUnapprove: (ids: number[]) => Promise<void>;
  onEditEntry: (entry: Entry) => void;
}) {
  const t = useTranslations("admin.timeclock");
  const tc = useTranslations("common");
  const router = useRouter();
  const [data, setData] = useState<{
    entries: Entry[];
    entriesTruncated?: boolean;
    adminsWithoutEntries: AdminWithoutEntry[];
    adminsWithoutEntriesTotal?: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [pending, setPending] = useState(false);
  const [manualForAdmin, setManualForAdmin] = useState<{ id: number; name: string } | null>(null);


  const EMP_PER_PAGE = 10;
  const [empPage, setEmpPage] = useState(1);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/timeclock/day?date=${encodeURIComponent(dayDate)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const json = await r.json();
        if (!cancelled) setData(json);
      })
      .catch((e) => { if (!cancelled) setError(String(e?.message || e)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dayDate, refreshKey]);

  const reload = useCallback(() => {
    setRefreshKey((k) => k + 1);
    router.refresh();
  }, [router]);

  const groupedByAdmin = useMemo(() => {
    if (!data) return [];
    const m = new Map<number, { admin: NonNullable<Entry["admin"]>; entries: Entry[] }>();
    for (const e of data.entries) {
      if (!e.admin) continue;
      if (!m.has(e.adminId)) {
        m.set(e.adminId, { admin: e.admin, entries: [] });
      }
      m.get(e.adminId)!.entries.push(e);
    }
    return Array.from(m.values()).sort((a, b) =>
      (a.admin.fullName || a.admin.email).localeCompare(b.admin.fullName || b.admin.email),
    );
  }, [data]);

  const stats = useMemo(() => {
    if (!data) return { totalEntries: 0, pending: 0, approved: 0, workMin: 0 };
    let pending = 0, approved = 0, workMin = 0;
    for (const e of data.entries) {
      if (e.approvedAt) approved++;
      else if (e.clockOut && e.submittedAt) pending++;
      workMin += e.durationMin ?? 0;
    }
    return { totalEntries: data.entries.length, pending, approved, workMin };
  }, [data]);

  const allPendingIds = useMemo(() => {
    if (!data) return [];

    return data.entries.filter((e) => e.submittedAt && !e.approvedAt && e.clockOut).map((e) => e.id);
  }, [data]);

  const handleApprove = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    setPending(true);
    await onApprove(ids);
    setPending(false);
    reload();
  }, [onApprove, reload]);

  const handleReject = useCallback(async (id: number) => {
    setPending(true);
    await onReject(id);
    setPending(false);
    reload();
  }, [onReject, reload]);

  const handleUnapprove = useCallback(async (ids: number[]) => {
    setPending(true);
    await onUnapprove(ids);
    setPending(false);
    reload();
  }, [onUnapprove, reload]);

  const empTotalPages = Math.max(1, Math.ceil(groupedByAdmin.length / EMP_PER_PAGE));
  const empFrom = groupedByAdmin.length === 0 ? 0 : (empPage - 1) * EMP_PER_PAGE + 1;
  const empTo = Math.min(groupedByAdmin.length, empPage * EMP_PER_PAGE);
  const pagedAdmins = groupedByAdmin.slice((empPage - 1) * EMP_PER_PAGE, empPage * EMP_PER_PAGE);

  const dayLabel = capFirst(new Date(dayDate + "T12:00:00").toLocaleDateString("fr-CA", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  }));

  if (loading) {
    return (
      <>
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5">
          <SheetHeader>
            <SheetTitle className="text-white">{t("chargement")}</SheetTitle>
          </SheetHeader>
        </div>
        <div className="p-5">
          <InlineLoader label={t("chargement_journee")} />
        </div>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5">
          <SheetHeader>
            <SheetTitle className="text-white">{t("erreur")}</SheetTitle>
          </SheetHeader>
        </div>
        <div className="p-5 text-sm text-red-700">{error ?? t("impossible_charger_journee")}</div>
      </>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5 shrink-0">
        <SheetHeader>
          <SheetTitle className="text-white">
            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 shrink-0" />
              <div className="min-w-0">
                <p className="text-base">{t("journee_multi_employes")}</p>
                <p className="text-xs text-white/70 font-normal">{dayLabel}</p>
              </div>
            </div>
          </SheetTitle>
        </SheetHeader>
        <div className="grid grid-cols-4 gap-2 mt-4">
          <div className="rounded-md bg-white/10 p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-white/70">{t("pointages")}</p>
            <p className="text-lg font-bold tabular-nums">{stats.totalEntries}</p>
          </div>
          <div className="rounded-md bg-white/10 p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-white/70">{t("a_approuver")}</p>
            <p className="text-lg font-bold tabular-nums">{stats.pending}</p>
          </div>
          <div className="rounded-md bg-white/10 p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-white/70">{t("approuves")}</p>
            <p className="text-lg font-bold tabular-nums">{stats.approved}</p>
          </div>
          <div className="rounded-md bg-white/10 p-2 text-center">
            <p className="text-[9px] uppercase tracking-wider text-white/70">{t("heures")}</p>
            <p className="text-lg font-bold tabular-nums">{fmtDuration(stats.workMin)}</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {data.entriesTruncated && (
          <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 p-2.5 text-[11px] text-amber-900">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>{t("daymultiemployeepanel_journee_trop_volumineuse_seuls_les_premiers_pointages")}</span>
          </div>
        )}
        <div>
          <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52] mb-2 flex items-center gap-1.5">
            <Clock className="h-3 w-3" />Pointages du jour ({groupedByAdmin.length} employé{groupedByAdmin.length > 1 ? "s" : ""})
          </p>
          {empTotalPages > 1 && (
            <div className="sticky -top-4 z-10 -mt-4 -mx-4 px-4 pt-4 pb-2 mb-2 bg-background border-b flex items-center justify-between gap-2">
              <span className="text-[11px] text-muted-foreground tabular-nums">
                {empFrom}–{empTo} sur {groupedByAdmin.length}
              </span>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2"
                  disabled={empPage <= 1} onClick={() => setEmpPage((n) => n - 1)}>{t("prec")}</Button>
                <span className="text-[11px] text-muted-foreground tabular-nums px-0.5">{empPage}/{empTotalPages}</span>
                <Button variant="outline" size="sm" className="h-7 text-[11px] px-2"
                  disabled={empPage >= empTotalPages} onClick={() => setEmpPage((n) => n + 1)}>{t("suiv")}</Button>
              </div>
            </div>
          )}
          {groupedByAdmin.length === 0 ? (
            <Card className="p-4 text-center text-xs text-muted-foreground">
              {t("aucun_pointage_enregistre_jour")}
            </Card>
          ) : (
            <div className="space-y-2">
              {pagedAdmins.map((g) => {
                const empPendingIds = g.entries.filter((e) => e.submittedAt && !e.approvedAt && e.clockOut).map((e) => e.id);
                const empTotal = g.entries.reduce((s, e) => s + (e.durationMin ?? 0), 0);
                const allApproved = g.entries.length > 0 && g.entries.every((e) => e.approvedAt);
                return (
                  <div key={g.admin.id} className="rounded-lg border border-border">
                    <div className="flex items-center justify-between gap-2 p-2.5 bg-muted/40 border-b">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-7 w-7 rounded-full bg-[#0F2D52]/10 text-[#0F2D52] flex items-center justify-center text-[10px] font-bold shrink-0">
                          {(g.admin.fullName || g.admin.email).slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold truncate">{g.admin.fullName || g.admin.email}</p>
                          <p className="text-[10px] text-muted-foreground truncate">
                            {g.admin.position?.name || g.admin.title || g.admin.email}
                          </p>
                        </div>
                        {allApproved && <ApprovedBadge />}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono text-sm font-bold tabular-nums text-[#0F2D52]">
                          {fmtDuration(empTotal)}
                        </span>
                        {empPendingIds.length > 0 && (
                          <ActionTooltip label={`Approuver les ${empPendingIds.length} entrée(s) en attente`}>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={pending}
                              onClick={() => handleApprove(empPendingIds)}
                              className="h-7 text-xs border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                            >
                              <CheckCircle2 className="h-3 w-3 mr-1" />Approuver tout ({empPendingIds.length})
                            </Button>
                          </ActionTooltip>
                        )}
                      </div>
                    </div>
                    <div className="divide-y">
                      {g.entries.map((e) => (
                        <PanelEntryRowWithHistory
                          key={e.id}
                          entry={e}
                          pending={pending}
                          onApprove={() => handleApprove([e.id])}
                          onReject={() => handleReject(e.id)}
                          onUnapprove={() => handleUnapprove([e.id])}
                          onEdit={!e.payStubId ? () => onEditEntry(e) : undefined}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {data.adminsWithoutEntries.length > 0 && (
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52] mb-2 flex items-center gap-1.5">
              <AlertCircle className="h-3 w-3 text-amber-600" />
              Sans pointage ce jour ({data.adminsWithoutEntriesTotal ?? data.adminsWithoutEntries.length})
            </p>
            <Card>
              <div className="divide-y">
                {data.adminsWithoutEntries.map((a) => (
                  <div key={a.id} className="flex items-center gap-2 p-2.5">
                    <div className="h-7 w-7 rounded-full bg-amber-100 text-amber-800 flex items-center justify-center text-[10px] font-bold shrink-0">
                      {(a.fullName || a.email).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{a.fullName || a.email}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {a.position?.name || a.title || a.email}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 shrink-0">
                      {t("aucune_entree")}
                    </Badge>
                    <ActionTooltip label={t("saisir_manuellement_cet_employe")}>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={pending}
                        onClick={() => setManualForAdmin({ id: a.id, name: a.fullName || a.email })}
                        className="h-7 text-xs"
                      >
                        <Plus className="h-3 w-3 mr-1" />Saisir
                      </Button>
                    </ActionTooltip>
                  </div>
                ))}
              </div>
              {(data.adminsWithoutEntriesTotal ?? 0) > data.adminsWithoutEntries.length && (
                <p className="border-t px-2.5 py-2 text-[11px] text-muted-foreground">
                  {data.adminsWithoutEntries.length} affichés sur {data.adminsWithoutEntriesTotal}.
                  Filtrez par équipe ou département pour cibler, ou exportez le CSV.
                </p>
              )}
            </Card>
          </div>
        )}
      </div>

      <div className="border-t bg-muted/30 p-3 flex items-center gap-2 shrink-0 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onClose} disabled={pending}>
          {tc("close")}
        </Button>
        <div className="flex-1" />
        {allPendingIds.length > 0 && (
          <Button
            size="sm"
            disabled={pending}
            onClick={() => handleApprove(allPendingIds)}
            className="bg-[#0F2D52] hover:bg-[#15406d]"
          >
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Approuver tous les pointages du jour ({allPendingIds.length})
          </Button>
        )}
      </div>

      <ManualEntryDialog
        open={manualForAdmin != null}
        onClose={() => setManualForAdmin(null)}
        onSaved={() => { setManualForAdmin(null); reload(); }}
        presetDate={dayDate}
        targetAdmin={manualForAdmin}
      />

    </div>
  );
}

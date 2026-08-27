"use client";
// Modal qui montre les collègues en conflit avec une demande spécifique.
// Réutilisable côté employé (sur sa propre demande) ET admin (sur n'importe laquelle).
// Fetch GET /api/admin/leaves/[id]/conflicts (créé par un autre agent).
//
// TODO: l'endpoint /api/admin/leaves/[id]/conflicts est censé renvoyer :
//   { conflicts: [{ id, fullName, type, startDate, endDate, status }], count }

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Users, CheckCircle2, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type Conflict = {
  id: number;
  fullName: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string; // approved | pending
};

const TYPE_KEYS: Record<string, string> = {
  vacation: "leave_vacation",
  sick: "leave_sick",
  parental: "leave_parental",
  unpaid: "leave_unpaid",
  bereavement: "leave_bereavement",
  other: "leave_other",
};

const TYPE_COLORS: Record<string, string> = {
  vacation: "bg-cyan-100 text-cyan-900 border-cyan-300",
  sick: "bg-red-100 text-red-900 border-red-300",
  parental: "bg-pink-100 text-pink-900 border-pink-300",
  unpaid: "bg-slate-100 text-slate-900 border-slate-300",
  bereavement: "bg-gray-100 text-gray-900 border-gray-300",
  other: "bg-amber-100 text-amber-900 border-amber-300",
};

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = /^\d{4}-\d{2}-\d{2}$/.test(iso)
    ? new Date(Number(iso.slice(0, 4)), Number(iso.slice(5, 7)) - 1, Number(iso.slice(8, 10)))
    : new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("fr-CA", { day: "numeric", month: "long" });
}

export function RequestConflictsDialog({
  leaveId,
  leaveLabel,
  open,
  onClose,
}: {
  leaveId: number;
  leaveLabel?: string;
  open: boolean;
  onClose: () => void;
}) {
  const t = useTranslations("admin.ui");
  const tc = useTranslations("common");
  const [conflicts, setConflicts] = useState<Conflict[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/admin/leaves/${leaveId}/conflicts`)
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => null);
          throw new Error(j?.error || `Erreur ${r.status}`);
        }
        return r.json();
      })
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data?.conflicts) ? (data.conflicts as Conflict[]) : [];
        setConflicts(list);
      })
      .catch((e: Error) => {
        if (!cancelled) {
          setError(e.message || t("impossible_recuperer_conflits"));
          setConflicts([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [open, leaveId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 overflow-hidden flex flex-col w-screen h-[100dvh] max-w-none max-h-none rounded-none sm:w-[95vw] sm:max-w-lg sm:h-auto sm:max-h-[90vh] sm:rounded-lg">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-4 sm:px-5 py-3 sm:py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-sm sm:text-base text-white flex items-center gap-2 pr-8">
              <Users className="h-4 w-4 shrink-0" />
              <span className="truncate">{t("collegues_conflit")}</span>
            </DialogTitle>
            <DialogDescription className="text-white/80 text-[11px] sm:text-xs">
              {leaveLabel || `Demande #${leaveId}`}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-4 sm:p-5 space-y-3 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("chargement_conflits")}
            </div>
          ) : error ? (
            <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-xs text-amber-900 flex gap-2">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          ) : conflicts && conflicts.length === 0 ? (
            <div className="rounded-md border bg-muted/10 p-6 text-center">
              <CheckCircle2 className="h-8 w-8 text-emerald-500/60 mx-auto mb-2" />
              <p className="text-sm font-medium">{t("aucun_conflit_detecte")}</p>
              <p className="text-xs text-muted-foreground mt-1">
                {t("aucun_collegue_n_apos_demande")}
              </p>
            </div>
          ) : (
            <ul className="divide-y rounded-md border bg-background">
              {(conflicts ?? []).map((c) => {
                const typeCls = TYPE_COLORS[c.type] ?? TYPE_COLORS.other;
                const isPending = c.status === "pending";
                return (
                  <li key={c.id} className="px-3 py-2.5 flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-[#0F2D52] truncate">{c.fullName}</p>
                      <p className="text-[11px] text-muted-foreground tabular-nums">
                        {formatDate(c.startDate)} → {formatDate(c.endDate)}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded border ${typeCls} font-semibold`}
                      >
                        {TYPE_KEYS[c.type] ? t(TYPE_KEYS[c.type]) : c.type}
                      </span>
                      {isPending ? (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-amber-300 bg-amber-50 text-amber-900 font-semibold inline-flex items-center gap-1">
                          <Clock className="h-2.5 w-2.5" />
                          {t("attente_2")}
                        </span>
                      ) : (
                        <span className="text-[10px] px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-50 text-emerald-900 font-semibold inline-flex items-center gap-1">
                          <CheckCircle2 className="h-2.5 w-2.5" />
                          {t("approuve")}
                        </span>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <DialogFooter className="px-3 sm:px-5 py-2 sm:py-3 border-t bg-muted/30 shrink-0 gap-2 flex-wrap [&>button]:flex-1 sm:[&>button]:flex-initial">
          <Button variant="outline" onClick={onClose}>
            {tc("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";
// Bandeau affiche dans mon-espace/conges pour chaque fenetre de vacances pertinente.
// Affichage adaptatif selon le state :
//   - open       : countdown + bouton "Soumettre" / "Modifier"
//   - closed     : "Periode fermee, attente attribution"
//   - in_review  : "RH revise les preferences"
//   - allocated  : afficher granted/denied par rang
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarRange, Plus, Trash2, Clock, CheckCircle2, XCircle, Lock, Eye, Users, ChevronLeft, ChevronRight, Megaphone, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { DatePopover } from "@/components/admin/date-popover";
import { FormSection, Field } from "@/components/admin/form-section";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { submitPreferencesAction } from "@/app/actions/hr-vacation-windows";
import { withdrawAppealAction } from "@/app/actions/hr-vacation-appeals";
import { SubmitAppealDialog } from "@/components/admin/appeal-dialog";

export type OpenWindow = {
  id: number;
  name: string;
  status: string;
  openingDate: string;
  closingDate: string;
  coversFrom: string;
  coversTo: string;
  maxDaysPerEmployee: number;
  myPreferences: Array<{
    /** Identifiant interne de la preference (pour appel R5). Optionnel
     * pour compatibilite ascendante avec les callers qui ne le passent pas. */
    id?: number;
    rank: number;
    startDate: string;
    endDate: string;
    daysCount: number;
    status: string;
    /** Statut de l'appel R5 : null si aucun, "pending" | "approved" | "rejected" */
    appealStatus?: string | null;
  }>;
};

export function VacationWindowBanner({ windows }: { windows: OpenWindow[] }) {
  const [openId, setOpenId] = useState<number | null>(null);
  const [peekId, setPeekId] = useState<number | null>(null);
  if (windows.length === 0) return null;
  const currentWindow = windows.find((w) => w.id === openId);
  const peekWindow = windows.find((w) => w.id === peekId);

  return (
    <>
      <div className="space-y-2">
        {windows.map((w) => (
          <WindowBannerCard
            key={w.id}
            window={w}
            onOpenSubmit={() => setOpenId(w.id)}
            onOpenPeek={() => setPeekId(w.id)}
          />
        ))}
      </div>

      {currentWindow && currentWindow.status === "open" && (
        <PreferencesDialog
          window={currentWindow}
          onClose={() => setOpenId(null)}
        />
      )}

      {peekWindow && (
        <PeekColleaguesDialog
          window={peekWindow}
          onClose={() => setPeekId(null)}
        />
      )}
    </>
  );
}

// ─── Card adaptative selon state ─────────────────────────────────
function WindowBannerCard({ window: w, onOpenSubmit, onOpenPeek }: { window: OpenWindow; onOpenSubmit: () => void; onOpenPeek: () => void }) {
  const t = useTranslations("admin.leave_windows");
  const dateTag = useDateLocale();
  const status = w.status;
  const submitted = w.myPreferences.length > 0;


  const [remaining, setRemaining] = useState<string | null>(null);
  useEffect(() => {
    if (status !== "open") { setRemaining(null); return; }
    const update = () => {
      const target = new Date(w.closingDate).getTime();
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining(t("periode_fermee")); return; }
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
      if (days > 0) setRemaining(t("vacation_window_banner_p0_jour_p1_restant_p2", { p0: days, p1: days > 1 ? "s" : "", p2: days > 1 ? "s" : "" }));
      else setRemaining(`${hours}h restantes`);
    };
    update();
    const timer = setInterval(update, 60_000);
    return () => clearInterval(timer);
  }, [status, w.closingDate]);


  const stateMeta = {
    open:      { borderCls: "border-l-emerald-500", iconBg: "bg-emerald-50 text-emerald-700", icon: CalendarRange, label: t("ouverte") },
    closed:    { borderCls: "border-l-amber-500",   iconBg: "bg-amber-50 text-amber-700",     icon: Lock,          label: t("fermee") },
    in_review: { borderCls: "border-l-[#0F2D52]",   iconBg: "bg-[#0F2D52]/10 text-[#0F2D52]", icon: Eye,           label: t("revue") },
    allocated: { borderCls: "border-l-emerald-600", iconBg: "bg-emerald-50 text-emerald-700", icon: CheckCircle2,  label: t("attribuee") },
  }[status as "open" | "closed" | "in_review" | "allocated"] ?? { borderCls: "border-l-slate-300", iconBg: "bg-slate-100 text-slate-700", icon: CalendarRange, label: status };

  const IconCmp = stateMeta.icon;

  return (
    <Card className={`p-3 sm:p-4 border-l-4 ${stateMeta.borderCls} bg-gradient-to-r from-slate-50/50 to-transparent`}>
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0 flex-1">
          <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 ${stateMeta.iconBg}`}>
            <IconCmp className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold">{w.name}</p>
              <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-white text-slate-700 font-semibold uppercase tracking-wider">
                {stateMeta.label}
              </span>
            </div>
            <p className="text-[11px] sm:text-xs text-muted-foreground mt-0.5">
              <span className="hidden sm:inline">{t("periode_couverte")} </span>
              {new Date(w.coversFrom).toLocaleDateString(dateTag)} → {new Date(w.coversTo).toLocaleDateString(dateTag)}
              {" · "}max {w.maxDaysPerEmployee} j
            </p>
            {status === "open" && (
              <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-x-2 gap-y-1 flex-wrap">
                <span>{t("avant")} <strong>{new Date(w.closingDate).toLocaleDateString(dateTag)}</strong></span>
                {remaining && (
                  <span className="inline-flex items-center gap-1 text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                    <Clock className="h-3 w-3" />
                    {remaining}
                  </span>
                )}
                {submitted && (
                  <span className="text-emerald-700 inline-flex items-center gap-1">
                    <CheckCircle2 className="h-3 w-3" />
                    {w.myPreferences.length} choix soumis
                  </span>
                )}
              </div>
            )}
            {(status === "closed" || status === "in_review") && (
              <p className="text-[11px] text-muted-foreground mt-1">
                {status === "closed"
                  ? t("periode_soumission_fermee_rh_va")
                  : t("rh_revise_preferences_avant_attribution")}
                {submitted && (
                  <span className="ml-1">{t("vacation_window_banner_vous_avez_soumis")}<strong>{w.myPreferences.length}</strong> choix.
                  </span>
                )}
              </p>
            )}
            {status === "allocated" && submitted && (
              <div className="mt-2 space-y-1.5">
                {w.myPreferences.map((p) => (
                  <PreferenceAllocatedRow key={`${p.rank}-${p.id ?? "noid"}`} pref={p} windowName={w.name} />
                ))}
              </div>
            )}
            {status === "allocated" && !submitted && (
              <p className="text-[11px] text-muted-foreground mt-1 italic">
                {t("vous_n_apos_avez_pas")}
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full lg:w-auto lg:shrink-0">
          {(status === "open" || status === "closed" || status === "in_review") && (
            <ActionTooltip label={t("voir_prend_conge_periode_noms")}>
              <Button
                variant="outline"
                size="sm"
                onClick={onOpenPeek}
                className="h-8 text-xs w-full sm:w-auto"
              >
                <Users className="h-3.5 w-3.5 mr-1.5" />
                {t("voir_mes_collegues")}
              </Button>
            </ActionTooltip>
          )}
          {status === "open" && (
            <Button
              size="sm"
              onClick={onOpenSubmit}
              className="h-8 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white w-full sm:w-auto"
            >
              <CalendarRange className="h-3.5 w-3.5 mr-1.5" />
              {submitted ? t("modifier_mes_preferences") : t("soumettre_mes_preferences")}
            </Button>
          )}
        </div>
      </div>
    </Card>
  );
}

// ─── R5 : ligne preference attribuee avec workflow d'appel ────────────
function PreferenceAllocatedRow({
  pref,
  windowName,
}: {
  pref: OpenWindow["myPreferences"][number];
  windowName: string;
}) {
  const t = useTranslations("admin.leave_windows");
  const router = useRouter();
  const [appealOpen, setAppealOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const dateTag = useDateLocale();

  const canAppeal = pref.id != null
    && (pref.status === "denied" || (pref.status === "granted" && pref.rank > 1))
    && !pref.appealStatus;
  const canWithdraw = pref.id != null && pref.appealStatus === "pending";

  const onWithdraw = async () => {
    if (pref.id == null) return;
    setBusy(true);
    const r = await withdrawAppealAction({ preferenceId: pref.id });
    setBusy(false);
    if (r.success) {
      toast.success(t("appel_retire"));
      router.refresh();
    } else toast.error(r.error || t("erreur"));
  };

  return (
    <>
      <div className="text-[11px] flex items-center gap-2 flex-wrap">
        <span className="font-bold text-[#0F2D52]">#{pref.rank}</span>
        <span className="text-muted-foreground tabular-nums">
          {new Date(pref.startDate).toLocaleDateString(dateTag)} → {new Date(pref.endDate).toLocaleDateString(dateTag)} ({pref.daysCount}j)
        </span>
        {pref.status === "granted" ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-2.5 w-2.5" />{t("vacation_window_banner_accordee")}</span>
        ) : pref.status === "denied" ? (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-800 border border-red-200">
            <XCircle className="h-2.5 w-2.5" />{t("vacation_window_banner_refusee")}</span>
        ) : (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            {t("attente_2")}
          </span>
        )}

        {pref.appealStatus === "pending" && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
            <Megaphone className="h-2.5 w-2.5" />Appel en attente
          </span>
        )}
        {pref.appealStatus === "approved" && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
            <CheckCircle2 className="h-2.5 w-2.5" />{t("vacation_window_banner_appel_accorde")}</span>
        )}
        {pref.appealStatus === "rejected" && (
          <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-800 border border-red-200">
            <XCircle className="h-2.5 w-2.5" />{t("vacation_window_banner_appel_refuse")}</span>
        )}
        {canAppeal && (
          <ActionTooltip label={t("contester_attribution_motif_requis")}>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-[10px] text-[#0F2D52] border-[#0F2D52]/30 hover:bg-[#0F2D52]/5 ml-auto"
              onClick={() => setAppealOpen(true)}
            >
              <Megaphone className="h-3 w-3 mr-1" />Faire appel
            </Button>
          </ActionTooltip>
        )}
        {canWithdraw && (
          <ActionTooltip label={t("retirer_mon_appel_cours")}>
            <Button
              size="sm"
              variant="outline"
              disabled={busy}
              className="h-6 px-2 text-[10px] text-muted-foreground ml-auto"
              onClick={onWithdraw}
            >
              <Undo2 className="h-3 w-3 mr-1" />Retirer
            </Button>
          </ActionTooltip>
        )}
      </div>

      {appealOpen && pref.id != null && (
        <SubmitAppealDialog
          open
          onClose={() => setAppealOpen(false)}
          preference={{
            id: pref.id,
            rank: pref.rank,
            startDate: pref.startDate,
            endDate: pref.endDate,
            status: pref.status,
            windowName,
          }}
          onSubmitted={() => {
            setAppealOpen(false);
            router.refresh();
          }}
        />
      )}
    </>
  );
}

// ─── Dialog "Voir mes collègues" : table style Excel approuvés + préférences ────
type CalendarAbsence = {
  id: number;
  adminId: number;
  fullName: string;
  type: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  halfDay: "AM" | "PM" | null;
  status: string; // approved | pending
  isMine: boolean;
};

type HolidayInfo = {
  date: string; // YYYY-MM-DD
  name: string;
  isPaid: boolean;
  type?: string;
};

// Couleurs par type de congé (cohérent avec TYPE_META de leaves-view)
const ABS_TYPE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  vacation: { bg: "bg-cyan-200", text: "text-cyan-900", border: "border-cyan-400" },
  sick: { bg: "bg-red-200", text: "text-red-900", border: "border-red-400" },
  parental: { bg: "bg-pink-200", text: "text-pink-900", border: "border-pink-400" },
  unpaid: { bg: "bg-slate-200", text: "text-slate-900", border: "border-slate-400" },
  bereavement: { bg: "bg-gray-200", text: "text-gray-900", border: "border-gray-400" },
  other: { bg: "bg-amber-200", text: "text-amber-900", border: "border-amber-400" },
};
const ABS_TYPE_KEYS: Record<string, string> = {
  vacation: "vacances", sick: "maladie", parental: "parental",
  unpaid: "sans_solde", bereavement: "deces", other: "autre_conge",
};

function PeekColleaguesDialog({ window: w, onClose }: { window: OpenWindow; onClose: () => void }) {
  const t = useTranslations("admin.leave_windows");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();
  type AnonHeat = { date: string; count: number };
  const [prefByDate, setPrefByDate] = useState<Map<string, number>>(new Map());
  const [submittedCount, setSubmittedCount] = useState<number | null>(null);
  const [absences, setAbsences] = useState<CalendarAbsence[]>([]);
  const [holidays, setHolidays] = useState<HolidayInfo[]>([]);
  const [loading, setLoading] = useState(true);


  const coversFrom = useMemo(() => new Date(w.coversFrom.slice(0, 10) + "T00:00:00"), [w.coversFrom]);
  const coversTo = useMemo(() => new Date(w.coversTo.slice(0, 10) + "T00:00:00"), [w.coversTo]);
  const [viewMonth, setViewMonth] = useState<Date>(() => {
    const d = new Date(coversFrom);
    d.setDate(1);
    return d;
  });

  const minMonth = useMemo(() => { const d = new Date(coversFrom); d.setDate(1); return d; }, [coversFrom]);
  const maxMonth = useMemo(() => { const d = new Date(coversTo); d.setDate(1); return d; }, [coversTo]);
  const canPrev = viewMonth.getTime() > minMonth.getTime();
  const canNext = viewMonth.getTime() < maxMonth.getTime();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);


    const prefPromise = fetch(`/api/admin/vacation-windows/${w.id}/anonymous-prefs`)
      .then((r) => r.ok ? r.json() : null)
      .then((data: { heatmap?: AnonHeat[]; submittedCount?: number } | null) => {
        if (cancelled || !data) return;
        const m = new Map<string, number>();
        for (const h of data.heatmap ?? []) m.set(h.date, h.count);
        setPrefByDate(m);
        setSubmittedCount(typeof data.submittedCount === "number" ? data.submittedCount : null);
      })
      .catch(() => null);


    const fmt = (d: Date) => d.toISOString().slice(0, 10);
    const chunks: Array<[string, string]> = [];
    const cur = new Date(coversFrom);
    while (cur <= coversTo) {
      const chunkEnd = new Date(cur);
      chunkEnd.setDate(chunkEnd.getDate() + 180);
      if (chunkEnd > coversTo) chunkEnd.setTime(coversTo.getTime());
      chunks.push([fmt(cur), fmt(chunkEnd)]);
      const next = new Date(chunkEnd);
      next.setDate(next.getDate() + 1);
      cur.setTime(next.getTime());
    }

    const absPromise = Promise.all(
      chunks.map(([from, to]) =>
        fetch(`/api/admin/leaves/calendar?from=${from}&to=${to}`)
          .then((r) => r.ok ? r.json() : { absences: [], holidays: [] })
          .catch(() => ({ absences: [], holidays: [] }))
      )
    ).then((results) => {
      if (cancelled) return;
      const seen = new Set<number>();
      const all: CalendarAbsence[] = [];
      const holidayMap = new Map<string, HolidayInfo>();
      for (const res of results) {
        for (const a of (res?.absences ?? [])) {
          if (seen.has(a.id)) continue;
          seen.add(a.id);
          all.push(a as CalendarAbsence);
        }
        for (const h of (res?.holidays ?? [])) {
          if (!holidayMap.has(h.date)) holidayMap.set(h.date, h as HolidayInfo);
        }
      }
      setAbsences(all);
      setHolidays(Array.from(holidayMap.values()));
    });

    Promise.all([prefPromise, absPromise]).finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [w.id, coversFrom, coversTo]);


  const absByDate = useMemo(() => {
    const map = new Map<string, CalendarAbsence[]>();
    for (const a of absences) {
      const s = new Date(a.startDate + "T00:00:00");
      const e = new Date(a.endDate + "T00:00:00");
      const cur = new Date(s);
      while (cur <= e) {
        const key = cur.toISOString().slice(0, 10);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
        cur.setDate(cur.getDate() + 1);
      }
    }
    return map;
  }, [absences]);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl w-[95vw] p-0 overflow-hidden flex flex-col max-h-[92vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <Users className="h-4 w-4" />{t("vacation_window_banner_mes_collegues_sur_cette_fenetre")}</DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {w.name} · {coversFrom.toLocaleDateString(dateTag)} → {coversTo.toLocaleDateString(dateTag)}
              {submittedCount !== null && (
                <span> · {t("collegues_ayant_soumis", { count: submittedCount })}</span>
              )}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-3 flex-1 overflow-y-auto">

          <div className="flex items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground flex-wrap">
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-cyan-200 border border-cyan-400" />
              {t("vacances")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-red-200 border border-red-400" />
              {t("maladie")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-pink-200 border border-pink-400" />
              {t("parental")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-amber-100 border border-amber-300 border-dashed" />
              {t("preference_anonyme")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-purple-100 border border-purple-300" />
              {t("ferie")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm bg-slate-200 border border-slate-300" />
              {t("weekend")}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="inline-block w-3 h-3 rounded-sm ring-2 ring-[#0F2D52] bg-white" />
              {t("aujourd_apos_hui")}
            </span>
          </div>


          <div className="flex items-center justify-between gap-2 border-b pb-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev}
              onClick={() => {
                const d = new Date(viewMonth);
                d.setMonth(d.getMonth() - 1);
                setViewMonth(d);
              }}
              className="h-7"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <p className="text-sm font-semibold text-[#0F2D52] capitalize">
              {viewMonth.toLocaleDateString(dateTag, { month: "long", year: "numeric" })}
            </p>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => {
                const d = new Date(viewMonth);
                d.setMonth(d.getMonth() + 1);
                setViewMonth(d);
              }}
              className="h-7"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {loading ? (
            <p className="text-center text-xs text-muted-foreground py-8">{t("chargement_calendrier")}</p>
          ) : (
            <ColleaguesMonthTable
              month={viewMonth}
              coversFrom={coversFrom}
              coversTo={coversTo}
              absences={absences}
              absByDate={absByDate}
              prefByDate={prefByDate}
              holidays={holidays}
            />
          )}

          {!loading && (() => {




            const monthStart = new Date(viewMonth.getFullYear(), viewMonth.getMonth(), 1);
            const monthEnd = new Date(viewMonth.getFullYear(), viewMonth.getMonth() + 1, 0);
            const monthEndISO = monthEnd.toISOString().slice(0, 10);
            const monthStartISO = monthStart.toISOString().slice(0, 10);
            const absInMonth = absences.some((a) => {
              const s = a.startDate.slice(0, 10);
              const e = a.endDate.slice(0, 10);
              return !(e < monthStartISO || s > monthEndISO);
            });
            let prefInMonth = false;
            for (const [iso] of prefByDate) {
              if (iso >= monthStartISO && iso <= monthEndISO) { prefInMonth = true; break; }
            }
            const nothingAnywhere = absences.length === 0 && prefByDate.size === 0;
            const nothingInMonth = !absInMonth && !prefInMonth;
            if (!nothingInMonth) return null;


            if (nothingAnywhere && (submittedCount === null || submittedCount === 0)) {
              return (
                <div className="rounded-md border bg-muted/10 p-6 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium">{t("0_collegue_n_apos_encore")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("vous_etes_parmi_premiers_consulter")}
                  </p>
                </div>
              );
            }

            if (absences.length === 0 && submittedCount !== null && submittedCount > 0) {
              return (
                <div className="rounded-md border bg-muted/10 p-6 text-center">
                  <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm font-medium">{t("aucun_conge_approuve_mois")}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {submittedCount} collègue{submittedCount > 1 ? t("s_ont") : " a"} soumis des préférences pour la fenêtre.
                  </p>
                </div>
              );
            }

            return (
              <div className="rounded-md border bg-muted/10 p-6 text-center">
                <Users className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                <p className="text-sm font-medium">{t("aucune_absence_ni_preference_mois")}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {t("utilisez_fleches_naviguer_vers_autres")}
                </p>
              </div>
            );
          })()}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose}>{tc("close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Table style Excel : 1 colonne par jour du mois, 1 ligne par employé ────
function ColleaguesMonthTable({
  month, coversFrom, coversTo, absences, absByDate, prefByDate, holidays,
}: {
  month: Date;
  coversFrom: Date;
  coversTo: Date;
  absences: CalendarAbsence[];
  absByDate: Map<string, CalendarAbsence[]>;
  prefByDate: Map<string, number>;
  holidays: HolidayInfo[];
}) {
  const t = useTranslations("admin.leave_windows");
  const dateTag = useDateLocale();
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString().slice(0, 10);


  const lastDay = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const days = useMemo(() => {
    const out: { date: Date; iso: string }[] = [];
    for (let d = 1; d <= lastDay; d++) {
      const dt = new Date(month.getFullYear(), month.getMonth(), d);
      out.push({ date: dt, iso: dt.toISOString().slice(0, 10) });
    }
    return out;
  }, [month, lastDay]);


  const holidayByDate = useMemo(() => {
    const m = new Map<string, HolidayInfo>();
    for (const h of holidays) m.set(h.date, h);
    return m;
  }, [holidays]);


  const employeesInMonth = useMemo(() => {
    const map = new Map<number, { id: number; fullName: string; isMine: boolean }>();
    for (const a of absences) {
      const s = new Date(a.startDate + "T00:00:00");
      const e = new Date(a.endDate + "T00:00:00");
      const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
      const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0);
      if (s > monthEnd || e < monthStart) continue;
      if (!map.has(a.adminId)) {
        map.set(a.adminId, { id: a.adminId, fullName: a.fullName, isMine: a.isMine });
      }
    }
    return Array.from(map.values()).sort((x, y) => {
      if (x.isMine && !y.isMine) return -1;
      if (!x.isMine && y.isMine) return 1;
      return x.fullName.localeCompare(y.fullName, "fr");
    });
  }, [absences, month]);


  const maxPref = useMemo(() => {
    let m = 0;
    for (const c of prefByDate.values()) if (c > m) m = c;
    return m;
  }, [prefByDate]);


  const absForEmpDay = (empId: number, iso: string): CalendarAbsence | undefined => {
    return (absByDate.get(iso) ?? []).find((a) => a.adminId === empId && a.status === "approved");
  };

  const totalCols = 1 + days.length; // 1 col fixe employé + N jours
  const dayColWidth = 26; // px par jour
  const minWidth = 160 + days.length * dayColWidth;

  return (
    <div className="rounded-md border overflow-hidden bg-background">
      <div className="overflow-x-auto">
        <div
          className="grid"
          style={{
            gridTemplateColumns: `160px repeat(${days.length}, minmax(${dayColWidth}px, 1fr))`,
            minWidth,
          }}
        >

          <div className="sticky left-0 z-20 bg-muted/40 border-r border-b px-2 py-1.5 text-[10px] uppercase font-bold tracking-wider text-muted-foreground">
            {t("employe")}
          </div>
          {days.map(({ date, iso }, i) => {
            const isWeekend = date.getDay() === 0 || date.getDay() === 6;
            const isToday = iso === todayISO;
            const holiday = holidayByDate.get(iso);
            const inWindow = date >= coversFrom && date <= coversTo;
            const dayLetter = ["D", "L", "M", "M", "J", "V", "S"][date.getDay()];
            let headerBg = "bg-muted/30";
            if (!inWindow) headerBg = "bg-slate-100 text-muted-foreground/50";
            else if (holiday) headerBg = "bg-purple-100 text-purple-900";
            else if (isWeekend) headerBg = "bg-slate-100 text-slate-500";
            const tooltipLabel = t("vacation_window_banner_p0_p1_p2", { p0: date.toLocaleDateString(dateTag, { weekday: "long", day: "numeric", month: "long", year: "numeric" }), p1: holiday ? ` — Férié : ${holiday.name}` : "", p2: !inWindow ? " (hors période)" : "" });
            return (
              <ActionTooltip key={i} label={tooltipLabel}>
                <div className={`border-r border-b px-0.5 py-1 text-center text-[9px] font-semibold ${headerBg} ${isToday ? "ring-1 ring-[#0F2D52] ring-inset" : ""}`}>
                  <div className="tabular-nums">{date.getDate()}</div>
                  <div className="text-[8px] uppercase tracking-wider opacity-70">{dayLetter}</div>
                </div>
              </ActionTooltip>
            );
          })}


          {employeesInMonth.length === 0 && (
            <div
              className="border-b col-span-full p-6 text-center text-xs text-muted-foreground italic"
              style={{ gridColumn: `1 / span ${totalCols}` }}
            >
              {t("aucun_collegue_n_apos_conge")}
            </div>
          )}
          {employeesInMonth.map((emp) => (
            <EmployeeRow
              key={emp.id}
              emp={emp}
              days={days}
              coversFrom={coversFrom}
              coversTo={coversTo}
              todayISO={todayISO}
              holidayByDate={holidayByDate}
              absForEmpDay={absForEmpDay}
            />
          ))}


          {maxPref > 0 && (
            <>
              <div className="sticky left-0 z-10 bg-amber-50/60 border-r border-b border-t-2 border-t-amber-300 px-2 py-1.5 text-[10px] font-semibold text-amber-900 flex items-center gap-1 italic">
                <Clock className="h-3 w-3" />{t("vacation_window_banner_preferences_anonymes")}</div>
              {days.map(({ date, iso }, i) => {
                const isWeekend = date.getDay() === 0 || date.getDay() === 6;
                const holiday = holidayByDate.get(iso);
                const inWindow = date >= coversFrom && date <= coversTo;
                const count = prefByDate.get(iso) ?? 0;
                const ratio = maxPref > 0 ? count / maxPref : 0;
                let bg = "bg-amber-50/30";
                if (!inWindow) bg = "bg-slate-100";
                else if (holiday) bg = "bg-purple-50";
                else if (isWeekend) bg = "bg-slate-50";
                else if (count > 0) {
                  bg = ratio >= 0.66 ? "bg-amber-400" : ratio >= 0.33 ? "bg-amber-200" : "bg-amber-100";
                }
                const tooltip = t("vacation_window_banner_p0_p1_preference_p2_soumise_p3_anonyme", { p0: date.toLocaleDateString(dateTag, { weekday: "long", day: "numeric", month: "long" }), p1: count, p2: count > 1 ? "s" : "", p3: count > 1 ? "s" : "" });
                return (
                  <ActionTooltip key={i} label={tooltip}>
                    <div className={`border-r border-b border-t-2 border-t-amber-300 ${bg} flex items-center justify-center text-[9px] font-bold text-amber-900 min-h-[28px]`}>
                      {inWindow && count > 0 ? count : ""}
                    </div>
                  </ActionTooltip>
                );
              })}
            </>
          )}
        </div>
      </div>
      <div className="px-2 py-1.5 text-[10px] text-muted-foreground bg-muted/10 border-t">
        {t("survolez_cellule_voir_detail_faites")}
      </div>
    </div>
  );
}

// ─── Ligne employé : nom sticky à gauche + cellule par jour ────────────────
function EmployeeRow({
  emp, days, coversFrom, coversTo, todayISO, holidayByDate, absForEmpDay,
}: {
  emp: { id: number; fullName: string; isMine: boolean };
  days: { date: Date; iso: string }[];
  coversFrom: Date;
  coversTo: Date;
  todayISO: string;
  holidayByDate: Map<string, HolidayInfo>;
  absForEmpDay: (empId: number, iso: string) => CalendarAbsence | undefined;
}) {
  const t = useTranslations("admin.leave_windows");
  const dateTag = useDateLocale();
  return (
    <>
      <ActionTooltip label={emp.fullName} side="right">
        <div
          className={`sticky left-0 z-10 border-r border-b px-2 py-1.5 text-[11px] truncate flex items-center gap-1.5 ${emp.isMine ? "bg-[#0F2D52]/5 font-bold text-[#0F2D52]" : "bg-background"}`}
        >
          {emp.isMine && (
            <span className="text-[8px] uppercase tracking-wider font-bold text-[#0F2D52] bg-[#0F2D52]/10 px-1 rounded shrink-0">
              {t("moi")}
            </span>
          )}
          <span className="truncate">{emp.fullName}</span>
        </div>
      </ActionTooltip>
      {days.map(({ date, iso }, i) => {
        const isWeekend = date.getDay() === 0 || date.getDay() === 6;
        const isToday = iso === todayISO;
        const holiday = holidayByDate.get(iso);
        const inWindow = date >= coversFrom && date <= coversTo;
        const abs = absForEmpDay(emp.id, iso);

        let bg = "";
        let border = "";
        let label = "";
        if (!inWindow) bg = "bg-slate-100";
        else if (holiday) bg = "bg-purple-50";
        else if (isWeekend) bg = "bg-slate-50";

        if (abs) {
          const c = ABS_TYPE_COLORS[abs.type] ?? ABS_TYPE_COLORS.other;
          bg = c.bg;
          border = c.border;
          label = ABS_TYPE_KEYS[abs.type] ? t(ABS_TYPE_KEYS[abs.type]) : abs.type;
        }

        const longDate = date.toLocaleDateString(dateTag, { weekday: "long", day: "numeric", month: "long" });
        const tooltip = abs
          ? `${emp.fullName} — ${label}${abs.halfDay ? ` (½ ${abs.halfDay})` : ""} · ${longDate}`
          : holiday
            ? t("date_ferie_nom", { date: longDate, name: holiday.name })
            : `${longDate}${!inWindow ? t("hors_periode_suffixe") : ""}`;



        const todayRing = isToday
          ? abs
            ? "ring-2 ring-amber-400 ring-inset"
            : "ring-1 ring-[#0F2D52] ring-inset"
          : "";
        return (
          <ActionTooltip key={i} label={tooltip}>
            <div
              className={`border-r border-b min-h-[28px] ${bg} ${border ? `border-l-2 ${border}` : ""} ${todayRing}`}
            />
          </ActionTooltip>
        );
      })}
    </>
  );
}

function PreferencesDialog({ window: w, onClose }: { window: OpenWindow; onClose: () => void }) {
  const t = useTranslations("admin.leave_windows");
  const tc = useTranslations("common");
  const router = useRouter();
  const dateTag = useDateLocale();
  type Choice = { rank: number; startDate: string; endDate: string };
  const initialChoices: Choice[] = w.myPreferences.length > 0
    ? w.myPreferences
        .filter((p) => p.status === "pending")
        .sort((a, b) => a.rank - b.rank)
        .map((p) => ({ rank: p.rank, startDate: p.startDate.slice(0, 10), endDate: p.endDate.slice(0, 10) }))
    : [{ rank: 1, startDate: "", endDate: "" }];
  const [choices, setChoices] = useState<Choice[]>(initialChoices);
  const [pending, setPending] = useState(false);


  const [peekOpen, setPeekOpen] = useState(false);

  const addChoice = () => {
    if (choices.length >= 3) return;
    const usedRanks = new Set(choices.map((c) => c.rank));
    const nextRank = [1, 2, 3].find((r) => !usedRanks.has(r)) ?? 3;
    setChoices((cs) => [...cs, { rank: nextRank, startDate: "", endDate: "" }].sort((a, b) => a.rank - b.rank));
  };
  const removeChoice = (rank: number) => {
    setChoices((cs) => cs.filter((c) => c.rank !== rank));
  };
  const updateChoice = (rank: number, patch: Partial<Choice>) => {
    setChoices((cs) => cs.map((c) => c.rank === rank ? { ...c, ...patch } : c));
  };

  const submit = async () => {

    for (const c of choices) {
      if (!c.startDate || !c.endDate) {
        toast.error(`Choix #${c.rank} : dates obligatoires.`);
        return;
      }
    }
    setPending(true);
    const r = await submitPreferencesAction({ windowId: w.id, choices });
    setPending(false);
    if (r.success) {
      toast.success(`${r.data.count} preference${r.data.count > 1 ? "s" : ""} enregistree${r.data.count > 1 ? "s" : ""}`);
      onClose();
      router.refresh();
    } else toast.error(r.error || "");
  };

  return (
    <>
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />Vos preferences — {w.name}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("jusqu_apos_3_choix_rang")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div className="text-xs text-muted-foreground bg-muted/30 rounded-md p-2">
            Periode autorisee : <strong>{new Date(w.coversFrom).toLocaleDateString(dateTag)}</strong>
            {" → "}<strong>{new Date(w.coversTo).toLocaleDateString(dateTag)}</strong>
            {" · "}max <strong>{w.maxDaysPerEmployee} jours</strong>{t("vacation_window_banner_par_choix")}</div>


          <div className="rounded-md border bg-muted/20 p-3 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-semibold text-[#0F2D52] flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" />{t("vacation_window_banner_voir_les_conges_de_vos_collegues")}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {t("visualisez_prend_deja_vacances_preferences")}
              </p>
            </div>
            <Button variant="outline" size="sm" onClick={() => setPeekOpen(true)} className="h-8 text-xs shrink-0">
              <CalendarRange className="h-3.5 w-3.5 mr-1.5" />{t("vacation_window_banner_ouvrir_le_calendrier")}</Button>
          </div>

          {choices.map((c) => (
            <FormSection
              key={c.rank}
              icon={CalendarRange}
              title={`Choix #${c.rank}${c.rank === 1 ? t("prefere") : ""}`}
              action={
                choices.length > 1 ? (
                  <button
                    type="button"
                    onClick={() => removeChoice(c.rank)}
                    className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1"
                    aria-label={t("vacation_window_banner_supprimer_le_choix_p0", { p0: c.rank })}
                  >
                    <Trash2 className="h-3 w-3" />Retirer
                  </button>
                ) : null
              }
            >
              <div className="grid grid-cols-2 gap-3">
                <Field label={t("debut")} required>
                  <DatePopover
                    value={c.startDate}
                    onChange={(v) => updateChoice(c.rank, { startDate: v, endDate: c.endDate && c.endDate < v ? v : c.endDate })}
                    min={w.coversFrom.slice(0, 10)}
                    max={w.coversTo.slice(0, 10)}
                  />
                </Field>
                <Field label={t("fin")} required>
                  <DatePopover
                    value={c.endDate}
                    onChange={(v) => updateChoice(c.rank, { endDate: v })}
                    min={c.startDate || w.coversFrom.slice(0, 10)}
                    max={w.coversTo.slice(0, 10)}
                  />
                </Field>
              </div>
            </FormSection>
          ))}

          {choices.length < 3 && (
            <Button variant="outline" onClick={addChoice} className="w-full">
              <Plus className="h-3.5 w-3.5 mr-1" />{t("vacation_window_banner_ajouter_un_choix")}</Button>
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button
            onClick={submit}
            disabled={pending}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {pending ? t("soumission_cours") : t("soumettre")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    {peekOpen && (
      <PeekColleaguesDialog window={w} onClose={() => setPeekOpen(false)} />
    )}
    </>
  );
}


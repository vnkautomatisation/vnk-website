"use client";
// LeaveRequestCalendar — modal de demande de conge avec calendrier visuel
// + sidebar live affichant : type, demi-journee, raison, solde, conflits.
//
// Source de donnees : /api/admin/leaves/calendar?from=&to=
//   - absences[] : conges approuves visibles selon scope hierarchique
//   - holidays[] : jours feries QC sur la plage
//
// Selection range : 1er clic = start, 2e clic = end (auto-swap si inverse).
// Re-clic sur la range -> reset. Drag aussi possible.
//
// Theme VNK navy partout, pas de dependance externe.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import {
  CalendarDays, ChevronLeft, ChevronRight, Sun, Bandage, Baby, Home,
  AlertTriangle, Users, Loader2, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FormSection, Field } from "@/components/admin/form-section";

// ─── Types ────────────────────────────────────────────────────────
export type LeaveType = "vacation" | "sick" | "parental" | "unpaid" | "bereavement" | "other";

export type CalendarAbsence = {
  id: number;
  adminId: number;
  fullName: string;
  type: string;
  startDate: string; // YYYY-MM-DD
  endDate: string;
  halfDay: string | null;
  status: string;
  isMine: boolean;
};

export type CalendarHoliday = {
  date: string;
  name: string;
  isPaid: boolean;
  type: string;
};

export type LeaveBalanceInfo = {
  vacationDaysRemaining: number;
  policyName?: string;
};

export const LEAVE_TYPE_META: Record<LeaveType, { label: string; icon: typeof Sun; color: string }> = {
  vacation: { label: "Vacances", icon: Sun, color: "bg-cyan-100 text-cyan-700" },
  sick: { label: "Maladie", icon: Bandage, color: "bg-red-100 text-red-700" },
  parental: { label: "Parental", icon: Baby, color: "bg-pink-100 text-pink-700" },
  unpaid: { label: "Sans solde", icon: Home, color: "bg-slate-100 text-slate-700" },
  bereavement: { label: "Deces", icon: Home, color: "bg-gray-100 text-gray-700" },
  other: { label: "Autre", icon: CalendarDays, color: "bg-amber-100 text-amber-700" },
};

const MONTHS_FR = [
  "Janvier", "Fevrier", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Aout", "Septembre", "Octobre", "Novembre", "Decembre",
];
const DAYS_FR_SHORT = ["D", "L", "M", "M", "J", "V", "S"]; // dimanche-first (convention projet)

function pad(n: number) { return n.toString().padStart(2, "0"); }
function toISO(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function parseISO(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
function startOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d: Date): Date { return new Date(d.getFullYear(), d.getMonth() + 1, 0); }
function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// ─── Submit payload ───────────────────────────────────────────────
export type LeaveSubmitPayload = {
  type: LeaveType;
  startDate: string;
  endDate: string;
  halfDay: "AM" | "PM" | null;
  reason: string | null;
  /** Mode admin uniquement : si true, approuver dès création. */
  autoApprove?: boolean;
  /** Mode admin uniquement : id de l'employé cible (sinon = soi-même). */
  employeeId?: number;
};

export type LeaveInitialValues = {
  type?: LeaveType;
  startDate?: string;
  endDate?: string;
  halfDay?: "AM" | "PM" | null;
  reason?: string | null;
};

// ─── Composant principal ──────────────────────────────────────────
export function LeaveRequestCalendar({
  open, onClose, onSubmit, balance, isSuperAdmin = false, initialType = "vacation",
  mode = "create", initialValues, title, subtitle,
  adminMode = false, employeeIdOverride, employeeName, canAutoApprove = false,
  calendarUrl, monthsVisible = 1,
}: {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: LeaveSubmitPayload) => Promise<void>;
  balance?: LeaveBalanceInfo;
  isSuperAdmin?: boolean;
  initialType?: LeaveType;
  /** "create" : nouvelle demande. "edit" : pre-remplir + label "Enregistrer". */
  mode?: "create" | "edit";
  /** En mode edit : valeurs initiales pour pre-remplir. */
  initialValues?: LeaveInitialValues;
  /** Override du titre du header (par defaut "Demander un conge" / "Modifier la demande"). */
  title?: string;
  /** Override du sous-titre du header. */
  subtitle?: string;
  /** Mode admin : action effectuée pour un autre employé (toggle auto-approve + ignore cutoff). */
  adminMode?: boolean;
  /** Id employé cible : en mode admin, on charge le calendrier de sa team. */
  employeeIdOverride?: number;
  /** Nom employé cible (affiché dans le header). */
  employeeName?: string;
  /** Mode admin : true si l'acteur a l'autorité d'approuver immédiatement. */
  canAutoApprove?: boolean;
  /** Override l'URL fetch du calendrier (par defaut /api/admin/leaves/calendar). */
  calendarUrl?: string;
  /** Nombre de mois visibles cote a cote sur desktop (default 1). Mobile reste 1 mois. */
  monthsVisible?: 1 | 2 | 3;
}) {
  const tc = useTranslations("common");
  const today = useMemo(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }, []);
  // Determination du mois visible initial : si edit avec date de debut, on l'utilise
  const initialMonth = useMemo(() => {
    if (initialValues?.startDate) {
      try { return startOfMonth(parseISO(initialValues.startDate.slice(0, 10))); }
      catch { return startOfMonth(today); }
    }
    return startOfMonth(today);
  }, [initialValues?.startDate, today]);

  const [visibleMonth, setVisibleMonth] = useState<Date>(initialMonth);
  const [start, setStart] = useState<string>(initialValues?.startDate?.slice(0, 10) ?? "");
  const [end, setEnd] = useState<string>(initialValues?.endDate?.slice(0, 10) ?? "");
  const [type, setType] = useState<LeaveType>((initialValues?.type as LeaveType) ?? initialType);
  const [isHalfDay, setIsHalfDay] = useState(!!initialValues?.halfDay);
  const [halfPart, setHalfPart] = useState<"AM" | "PM">((initialValues?.halfDay as "AM" | "PM") ?? "AM");
  const [reason, setReason] = useState(initialValues?.reason ?? "");
  const [pending, setPending] = useState(false);
  // Mode admin : approuver immédiatement la demande créée
  const [autoApprove, setAutoApprove] = useState(false);

  // Cache des fetches : key = "YYYY-MM" -> { absences, holidays }
  const [cache, setCache] = useState<Map<string, { absences: CalendarAbsence[]; holidays: CalendarHoliday[] }>>(new Map());
  const [loading, setLoading] = useState(false);

  // Fetch les data pour CHAQUE mois visible (multi-mois) — fait en parallele, alimente le cache.
  // Aussi precharge ±2 semaines (buffer) pour la suggestion alternative.
  useEffect(() => {
    if (!open) return;
    const monthsToFetch: Date[] = [];
    for (let i = 0; i < monthsVisible; i++) {
      monthsToFetch.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + i, 1));
    }
    // Pour la suggestion : on prefetch aussi le mois precedent et suivant
    monthsToFetch.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1));
    monthsToFetch.push(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + monthsVisible, 1));

    const base = calendarUrl ?? "/api/admin/leaves/calendar";

    const missing = monthsToFetch.filter((d) => !cache.has(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`));
    if (missing.length === 0) return;
    setLoading(true);
    Promise.all(
      missing.map((m) => {
        const params = new URLSearchParams({ from: toISO(startOfMonth(m)), to: toISO(endOfMonth(m)) });
        if (adminMode && employeeIdOverride) params.set("employeeId", String(employeeIdOverride));
        return fetch(`${base}?${params.toString()}`)
          .then((r) => r.ok ? r.json() : { absences: [], holidays: [] })
          .then((data) => ({ key: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, data }))
          .catch(() => ({ key: `${m.getFullYear()}-${pad(m.getMonth() + 1)}`, data: { absences: [], holidays: [] } }));
      }),
    ).then((results) => {
      setCache((prev) => {
        const next = new Map(prev);
        for (const { key, data } of results) {
          next.set(key, { absences: data.absences ?? [], holidays: data.holidays ?? [] });
        }
        return next;
      });
    }).finally(() => setLoading(false));
  }, [open, visibleMonth, cache, adminMode, employeeIdOverride, calendarUrl, monthsVisible]);

  // Reset le state quand le modal ouvre
  // - Mode create : tout vide
  // - Mode edit : pre-rempli avec initialValues
  useEffect(() => {
    if (open) {
      if (mode === "edit" && initialValues) {
        setStart(initialValues.startDate?.slice(0, 10) ?? "");
        setEnd(initialValues.endDate?.slice(0, 10) ?? "");
        setReason(initialValues.reason ?? "");
        setIsHalfDay(!!initialValues.halfDay);
        setHalfPart((initialValues.halfDay as "AM" | "PM") ?? "AM");
        setType((initialValues.type as LeaveType) ?? initialType);
        if (initialValues.startDate) {
          try { setVisibleMonth(startOfMonth(parseISO(initialValues.startDate.slice(0, 10)))); }
          catch { setVisibleMonth(startOfMonth(today)); }
        } else {
          setVisibleMonth(startOfMonth(today));
        }
      } else {
        setStart("");
        setEnd("");
        setReason("");
        setIsHalfDay(false);
        setHalfPart("AM");
        setType(initialType);
        setVisibleMonth(startOfMonth(today));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, initialType, today, mode]);

  // ─── Heatmap : agregge TOUS les mois visibles + buffer pour suggestions ────
  // On consolide absences/holidays sur l'ensemble du cache (utilise pour heatmap,
  // conflits, et suggestion d'alternatives sans conflit dans une fenetre +/-2 sem).
  const { absences, holidays } = useMemo(() => {
    const allAbs: CalendarAbsence[] = [];
    const allHol: CalendarHoliday[] = [];
    for (const { absences: a, holidays: h } of cache.values()) {
      allAbs.push(...a);
      allHol.push(...h);
    }
    return { absences: allAbs, holidays: allHol };
  }, [cache]);

  const dayAbsenceCount = useMemo(() => {
    const map = new Map<string, CalendarAbsence[]>();
    const seenIds = new Set<string>();
    for (const a of absences) {
      if (a.status !== "approved") continue;
      const s = parseISO(a.startDate);
      const e = parseISO(a.endDate);
      const cursor = new Date(s);
      while (cursor <= e) {
        const key = toISO(cursor);
        const dedupeKey = `${a.id}-${key}`;
        if (seenIds.has(dedupeKey)) {
          cursor.setDate(cursor.getDate() + 1);
          continue;
        }
        seenIds.add(dedupeKey);
        if (!map.has(key)) map.set(key, []);
        map.get(key)!.push(a);
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return map;
  }, [absences]);

  const holidaysMap = useMemo(() => {
    const m = new Map<string, CalendarHoliday>();
    for (const h of holidays) m.set(h.date, h);
    return m;
  }, [holidays]);

  // ─── Grilles 6 semaines (dimanche-first) — une par mois visible ────
  const grids = useMemo(() => {
    const out: Array<{ month: Date; days: Date[] }> = [];
    for (let i = 0; i < monthsVisible; i++) {
      const month = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + i, 1);
      const first = startOfMonth(month);
      const firstDayIdx = first.getDay(); // 0 = dimanche
      const startGrid = new Date(first);
      startGrid.setDate(startGrid.getDate() - firstDayIdx);
      const days: Date[] = [];
      for (let j = 0; j < 42; j++) {
        const d = new Date(startGrid);
        d.setDate(startGrid.getDate() + j);
        days.push(d);
      }
      out.push({ month, days });
    }
    return out;
  }, [visibleMonth, monthsVisible]);

  // ─── Disabled : >14j dans le passe sans super_admin ─────────────
  const cutoffPast = useMemo(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - 14);
    return d;
  }, [today]);

  const isDayDisabled = (d: Date) => {
    if (isSuperAdmin || adminMode) return false;
    return d < cutoffPast;
  };

  // ─── Selection range : 2 modes possibles ────────────────────────
  // 1) Drag : mouse-down sur une cellule, drag par-dessus les autres -> range live
  // 2) Click sequence (fallback si pas de drag) : click 1 = start, click 2 = end (auto-swap si reverse)
  //
  // On distingue les deux via dragStartedAt : si pointerdown puis pointerup sur la meme cellule sans mouvement,
  // on traite comme un click sequence; sinon, on commit la range definie par le drag.
  const [dragStartIso, setDragStartIso] = useState<string | null>(null);
  const [dragHoverIso, setDragHoverIso] = useState<string | null>(null);
  const [didDrag, setDidDrag] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);

  // Recherche la date associee a un point (touchmove). On utilise data-iso sur les boutons.
  const isoFromPoint = useCallback((x: number, y: number): string | null => {
    const el = document.elementFromPoint(x, y);
    if (!el) return null;
    const btn = (el as HTMLElement).closest?.("[data-cal-iso]") as HTMLElement | null;
    return btn?.getAttribute("data-cal-iso") ?? null;
  }, []);

  const commitRange = useCallback((aIso: string, bIso: string) => {
    const aDate = parseISO(aIso);
    const bDate = parseISO(bIso);
    const lo = aDate <= bDate ? aIso : bIso;
    const hi = aDate <= bDate ? bIso : aIso;
    setStart(lo);
    setEnd(hi);
  }, []);

  // Mouse handlers (desktop)
  const onCellMouseDown = (d: Date) => {
    if (isDayDisabled(d)) return;
    setDragStartIso(toISO(d));
    setDragHoverIso(toISO(d));
    setDidDrag(false);
  };
  const onCellMouseEnter = (d: Date) => {
    if (!dragStartIso) return;
    if (isDayDisabled(d)) return;
    const iso = toISO(d);
    if (iso !== dragStartIso) setDidDrag(true);
    setDragHoverIso(iso);
  };
  // Global mouseup : commit le range si drag, sinon laisser handleDayClick gerer
  useEffect(() => {
    if (!open) return;
    const onUp = () => {
      if (dragStartIso && dragHoverIso && didDrag) {
        commitRange(dragStartIso, dragHoverIso);
      }
      // Si pas drag (= simple click), handleDayClick a deja gere via onClick
      setDragStartIso(null);
      setDragHoverIso(null);
      setDidDrag(false);
    };
    window.addEventListener("mouseup", onUp);
    return () => window.removeEventListener("mouseup", onUp);
  }, [open, dragStartIso, dragHoverIso, didDrag, commitRange]);

  // Touch handlers (mobile) — on suit touchmove via document
  const onCellTouchStart = (d: Date) => {
    if (isDayDisabled(d)) return;
    setDragStartIso(toISO(d));
    setDragHoverIso(toISO(d));
    setDidDrag(false);
  };
  useEffect(() => {
    if (!open || !dragStartIso) return;
    const onMove = (e: TouchEvent) => {
      const t = e.touches[0];
      if (!t) return;
      const iso = isoFromPoint(t.clientX, t.clientY);
      if (!iso) return;
      if (iso !== dragStartIso) setDidDrag(true);
      setDragHoverIso(iso);
      // Empeche le scroll pendant le drag
      e.preventDefault();
    };
    const onEnd = () => {
      if (dragStartIso && dragHoverIso && didDrag) {
        commitRange(dragStartIso, dragHoverIso);
      }
      setDragStartIso(null);
      setDragHoverIso(null);
      setDidDrag(false);
    };
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd);
    document.addEventListener("touchcancel", onEnd);
    return () => {
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
    };
  }, [open, dragStartIso, dragHoverIso, didDrag, isoFromPoint, commitRange]);

  // Click sequence fallback (utilise quand le drag n'a pas bouge)
  const handleDayClick = (d: Date) => {
    if (isDayDisabled(d)) return;
    if (didDrag) return; // le commit a deja eu lieu via mouseup
    const iso = toISO(d);
    // Si pas de start, ou si on a deja start+end -> reset
    if (!start || (start && end)) {
      setStart(iso);
      setEnd("");
      return;
    }
    if (start && !end) {
      const sDate = parseISO(start);
      if (d < sDate) {
        setStart(iso);
        setEnd(start);
      } else if (sameDay(d, sDate)) {
        setEnd(iso);
      } else {
        setEnd(iso);
      }
    }
  };

  // Aperçu visuel pendant le drag (priorité sur la range committed)
  const previewRange = (() => {
    if (!dragStartIso || !dragHoverIso) return null;
    const a = parseISO(dragStartIso);
    const b = parseISO(dragHoverIso);
    return a <= b
      ? { lo: dragStartIso, hi: dragHoverIso }
      : { lo: dragHoverIso, hi: dragStartIso };
  })();

  const isInRange = (d: Date): boolean => {
    if (previewRange) {
      const lo = parseISO(previewRange.lo);
      const hi = parseISO(previewRange.hi);
      return d >= lo && d <= hi;
    }
    if (!start) return false;
    const sDate = parseISO(start);
    const eDate = end ? parseISO(end) : sDate;
    return d >= sDate && d <= eDate;
  };
  const isRangeStart = (d: Date): boolean => {
    if (previewRange) return sameDay(d, parseISO(previewRange.lo));
    return start ? sameDay(d, parseISO(start)) : false;
  };
  const isRangeEnd = (d: Date): boolean => {
    if (previewRange) return sameDay(d, parseISO(previewRange.hi));
    return end ? sameDay(d, parseISO(end)) : false;
  };

  // ─── Calcul jours ouvres dans la range (cote client, approximatif) ─
  const estimatedDays = useMemo(() => {
    if (!start) return 0;
    const sDate = parseISO(start);
    const eDate = end ? parseISO(end) : sDate;
    if (eDate < sDate) return 0;
    let count = 0;
    const cursor = new Date(sDate);
    while (cursor <= eDate) {
      const dow = cursor.getDay();
      const isWeekend = dow === 0 || dow === 6;
      const isHoliday = holidaysMap.has(toISO(cursor));
      if (!isWeekend && !isHoliday) count++;
      cursor.setDate(cursor.getDate() + 1);
    }
    if (isHalfDay && start === end) return 0.5;
    return count;
  }, [start, end, isHalfDay, holidaysMap]);

  // ─── Conflits equipe ────────────────────────────────────────────
  const teamConflicts = useMemo(() => {
    if (!start) return { othersCount: 0, names: [] as string[] };
    const sDate = parseISO(start);
    const eDate = end ? parseISO(end) : sDate;
    const seen = new Map<number, string>();
    for (const a of absences) {
      if (a.isMine) continue;
      if (a.status !== "approved") continue;
      const aStart = parseISO(a.startDate);
      const aEnd = parseISO(a.endDate);
      if (aEnd >= sDate && aStart <= eDate) {
        seen.set(a.adminId, a.fullName);
      }
    }
    return { othersCount: seen.size, names: Array.from(seen.values()).slice(0, 5) };
  }, [start, end, absences]);

  // ─── Auto-suggestion : alternatives sans conflit ────────────────
  // Declenchee si conflits >= 30% (proxy : >=2 absents) et range complete.
  // Algo : scan glissant fenetre = (eDate - sDate) jours, ±2 semaines de la date initiale,
  // retourne les 3 premieres fenetres avec 0 conflit (skip weekends/feries dans la duree).
  const suggestions = useMemo<Array<{ start: string; end: string }>>(() => {
    if (!start || !end) return [];
    if (teamConflicts.othersCount < 2) return [];
    const sDate = parseISO(start);
    const eDate = parseISO(end);
    const durationDays = Math.round((eDate.getTime() - sDate.getTime()) / 86400000);
    if (durationDays < 0 || durationDays > 21) return [];

    // Range de scan : -14j à +14j
    const found: Array<{ start: string; end: string }> = [];
    const scanFrom = new Date(sDate);
    scanFrom.setDate(scanFrom.getDate() - 14);
    const scanTo = new Date(sDate);
    scanTo.setDate(scanTo.getDate() + 14);

    const hasConflict = (winStart: Date, winEnd: Date): boolean => {
      for (const a of absences) {
        if (a.isMine) continue;
        if (a.status !== "approved") continue;
        const aS = parseISO(a.startDate);
        const aE = parseISO(a.endDate);
        if (aE >= winStart && aS <= winEnd) return true;
      }
      return false;
    };

    const cursor = new Date(scanFrom);
    while (cursor <= scanTo && found.length < 3) {
      // Skip si la fenetre commence avant cutoff passe ou meme jour que la selection courante
      if (cursor < cutoffPast && !isSuperAdmin && !adminMode) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
      const winEnd = new Date(cursor);
      winEnd.setDate(winEnd.getDate() + durationDays);
      // On evite de proposer la meme periode
      if (sameDay(cursor, sDate)) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
      // Skip si le start est weekend (pour proposer un mardi/mercredi propre)
      const dow = cursor.getDay();
      if (dow === 0 || dow === 6) {
        cursor.setDate(cursor.getDate() + 1);
        continue;
      }
      if (!hasConflict(cursor, winEnd)) {
        found.push({ start: toISO(cursor), end: toISO(winEnd) });
        // Skip 3 jours pour eviter les doublons quasi-identiques
        cursor.setDate(cursor.getDate() + 3);
      } else {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
    return found;
  }, [start, end, absences, teamConflicts.othersCount, cutoffPast, isSuperAdmin, adminMode]);

  const applySuggestion = (s: { start: string; end: string }) => {
    setStart(s.start);
    setEnd(s.end);
    setVisibleMonth(startOfMonth(parseISO(s.start)));
  };

  // ─── Submit ─────────────────────────────────────────────────────
  const sameDayRange = start && end && start === end;
  const canSubmit = !!start && !!end && !pending && estimatedDays > 0;

  const submit = async () => {
    if (!canSubmit || !start || !end) return;
    setPending(true);
    try {
      await onSubmit({
        type,
        startDate: start,
        endDate: end,
        halfDay: isHalfDay && sameDayRange ? halfPart : null,
        reason: reason || null,
        autoApprove: adminMode && canAutoApprove ? autoApprove : undefined,
        employeeId: adminMode ? employeeIdOverride : undefined,
      });
    } finally {
      setPending(false);
    }
  };

  if (!open) return null;

  const balanceAfter = balance ? Math.max(0, balance.vacationDaysRemaining - estimatedDays) : null;
  const balanceInsufficient = balance && type === "vacation" && estimatedDays > balance.vacationDaysRemaining;

  // Labels dynamiques selon le mode
  const headerTitle = title ?? (
    adminMode && mode === "create" ? `Créer un congé${employeeName ? ` — ${employeeName}` : ""}`
    : adminMode && mode === "edit" ? `Modifier le congé${employeeName ? ` — ${employeeName}` : ""}`
    : mode === "edit" ? "Modifier la demande"
    : "Demander un conge"
  );
  const headerSubtitle = subtitle ?? (
    adminMode
      ? "Action administrateur — l'employé sera notifié."
      : mode === "edit"
        ? "Ajustez la periode ou les details. Le superviseur sera notifie."
        : "Selectionnez votre periode sur le calendrier — les absences de votre equipe sont visibles."
  );
  const submitLabel = adminMode && mode === "create" && autoApprove
    ? "Créer et approuver"
    : adminMode && mode === "create"
      ? "Créer la demande"
      : mode === "edit"
        ? "Enregistrer"
        : "Soumettre";
  const submitPending = mode === "edit" ? "Enregistrement..." : "Création...";

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-start md:items-center justify-center p-2 md:p-4 overflow-y-auto" onClick={onClose}>
      <div
        className="bg-background rounded-lg shadow-2xl w-full max-w-5xl my-4 overflow-hidden border flex flex-col max-h-[95vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header navy sticky */}
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 flex items-center justify-between gap-3 shrink-0">
          <div className="min-w-0">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-4 w-4 shrink-0" />{headerTitle}
            </h2>
            <p className="text-white/80 text-xs">{headerSubtitle}</p>
          </div>
          <ActionTooltip label={tc("close")}>
            <button
              onClick={onClose}
              className="h-8 w-8 rounded-md hover:bg-white/15 flex items-center justify-center shrink-0"
              aria-label={tc("close")}
            >
              <span aria-hidden className="text-lg leading-none">×</span>
            </button>
          </ActionTooltip>
        </div>

        {/* Body : 2 colonnes responsive, scrollable */}
        <div className="grid md:grid-cols-[1fr_320px] gap-0 flex-1 overflow-y-auto">
          {/* Colonne gauche : calendrier (1 a N mois) */}
          <div className="p-4 border-r" ref={calendarRef}>
            {/* Nav mois */}
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
                aria-label="Mois precedent"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold tabular-nums text-[#0F2D52]">
                  {monthsVisible > 1
                    ? `${MONTHS_FR[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()} — ${MONTHS_FR[new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + monthsVisible - 1, 1).getMonth()]} ${new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + monthsVisible - 1, 1).getFullYear()}`
                    : `${MONTHS_FR[visibleMonth.getMonth()]} ${visibleMonth.getFullYear()}`}
                </span>
                {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
              </div>
              <button
                onClick={() => setVisibleMonth((m) => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
                className="h-8 w-8 rounded-md hover:bg-muted flex items-center justify-center"
                aria-label="Mois suivant"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <div className={`grid gap-4 ${monthsVisible === 3 ? "lg:grid-cols-3" : monthsVisible === 2 ? "lg:grid-cols-2" : "grid-cols-1"} select-none`}>
              {grids.map(({ month, days }, mi) => (
                <div key={mi}>
                  {monthsVisible > 1 && (
                    <div className="text-xs font-semibold text-[#0F2D52] mb-1 tabular-nums">
                      {MONTHS_FR[month.getMonth()]} {month.getFullYear()}
                    </div>
                  )}
                  {/* Header jours */}
                  <div className="grid grid-cols-7 gap-0.5 mb-1">
                    {DAYS_FR_SHORT.map((d, i) => (
                      <div key={i} className="text-[10px] uppercase tracking-wider text-muted-foreground text-center font-semibold py-1">
                        {d}
                      </div>
                    ))}
                  </div>
                  {/* Grille */}
                  <div className="grid grid-cols-7 gap-0.5">
                    {days.map((d, i) => {
                      const inMonth = d.getMonth() === month.getMonth();
                      const iso = toISO(d);
                      const dow = d.getDay();
                      const isWeekend = dow === 0 || dow === 6;
                      const isToday = sameDay(d, today);
                      const disabled = isDayDisabled(d);
                      const inSel = isInRange(d);
                      const isStart = isRangeStart(d);
                      const isEnd = isRangeEnd(d);
                      const holiday = holidaysMap.get(iso);
                      const absOnDay = dayAbsenceCount.get(iso) ?? [];
                      const count = absOnDay.length;

                      // Couleur de heatmap (background)
                      let heatmapBg = "";
                      if (!inSel && count > 0) {
                        if (count >= 6) heatmapBg = "bg-red-100";
                        else if (count >= 3) heatmapBg = "bg-orange-100";
                        else heatmapBg = "bg-yellow-50";
                      }

                      // Tooltip text
                      const tooltipParts: string[] = [];
                      if (holiday) tooltipParts.push(`Ferie : ${holiday.name}`);
                      if (count > 0) tooltipParts.push(`${count} absent${count > 1 ? "s" : ""} : ${absOnDay.map((a) => a.fullName).join(", ")}`);
                      const tooltip = tooltipParts.join(" | ");

                      const classes = [
                        "relative h-14 rounded-md text-xs font-medium tabular-nums transition border flex flex-col items-center justify-start p-1 touch-none",
                        disabled
                          ? "text-muted-foreground/30 cursor-not-allowed bg-muted/20"
                          : inSel
                            ? "bg-[#0F2D52] text-white border-[#0F2D52] shadow-sm"
                            : holiday
                              ? `bg-cyan-50 border-cyan-200 ${inMonth ? "text-cyan-900" : "text-cyan-900/50"}`
                              : isToday
                                ? `${heatmapBg || "bg-[#0F2D52]/10"} text-[#0F2D52] font-bold ring-2 ring-[#0F2D52]/40 border-transparent`
                                : inMonth
                                  ? `${heatmapBg || (isWeekend ? "bg-slate-50/50 text-muted-foreground/70" : "hover:bg-muted")} border-transparent`
                                  : `${heatmapBg || "text-muted-foreground/40"} border-transparent hover:bg-muted/30`,
                        (isStart || isEnd) && inSel ? "ring-2 ring-[#0F2D52]/60" : "",
                      ].join(" ");

                      const dayCell = (
                        <button
                          key={i}
                          type="button"
                          data-cal-iso={iso}
                          onClick={() => handleDayClick(d)}
                          onMouseDown={() => onCellMouseDown(d)}
                          onMouseEnter={() => onCellMouseEnter(d)}
                          onTouchStart={() => onCellTouchStart(d)}
                          disabled={disabled}
                          className={classes}
                          aria-label={iso}
                        >
                          <span className="text-xs">{d.getDate()}</span>
                          {/* Indicateurs */}
                          <div className="flex items-center gap-0.5 mt-0.5">
                            {holiday && (
                              <span className="text-[8px] font-bold uppercase tracking-tight text-cyan-700" aria-hidden>F</span>
                            )}
                            {count > 0 && !inSel && (
                              <span className={`text-[9px] font-bold ${count >= 6 ? "text-red-700" : count >= 3 ? "text-orange-700" : "text-amber-700"}`}>
                                {count}
                              </span>
                            )}
                          </div>
                        </button>
                      );

                      return tooltip ? (
                        <ActionTooltip key={i} label={tooltip}>{dayCell}</ActionTooltip>
                      ) : dayCell;
                    })}
                  </div>
                </div>
              ))}
            </div>

            {/* Legende */}
            <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-[#0F2D52]" />Selection</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-yellow-50 border" />1-2 absent</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-orange-100 border" />3-5 absents</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-red-100 border" />6+ absents</span>
              <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded bg-cyan-50 border" />Ferie (F)</span>
              <span className="text-[10px] text-muted-foreground/70 ml-auto italic">Astuce : glissez pour selectionner une plage</span>
            </div>
          </div>

          {/* Colonne droite : sidebar */}
          <div className="p-4 space-y-4 bg-muted/10">
            <FormSection icon={CalendarDays} title="Type de conge">
              <Select value={type} onValueChange={(v) => setType(v as LeaveType)}>
                <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.entries(LEAVE_TYPE_META) as [LeaveType, typeof LEAVE_TYPE_META[LeaveType]][]).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FormSection>

            {/* Periode selectionnee */}
            <div className="rounded-md border bg-background p-3 text-xs">
              <p className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground mb-1">Periode</p>
              {!start ? (
                <p className="text-muted-foreground italic">Cliquez une date de debut sur le calendrier</p>
              ) : (
                <>
                  <p className="font-medium">
                    Du <strong className="text-[#0F2D52]">{parseISO(start).toLocaleDateString("fr-CA", { weekday: "short", day: "2-digit", month: "short" })}</strong>
                    {end && start !== end && (
                      <>
                        {" au "}
                        <strong className="text-[#0F2D52]">{parseISO(end).toLocaleDateString("fr-CA", { weekday: "short", day: "2-digit", month: "short" })}</strong>
                      </>
                    )}
                  </p>
                  {!end && <p className="text-muted-foreground mt-0.5">Cliquez une date de fin</p>}
                  {start && end && (
                    <p className="mt-1 text-muted-foreground">
                      <strong className="tabular-nums text-foreground">{estimatedDays}</strong> jour{estimatedDays > 1 ? "s" : ""} ouvr{estimatedDays > 1 ? "es" : "e"}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Demi-journee */}
            {sameDayRange && (
              <Field label="Demi-journee">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <Checkbox checked={isHalfDay} onCheckedChange={(v) => setIsHalfDay(!!v)} />
                  <span>Cette demande couvre une demi-journee</span>
                </label>
                {isHalfDay && (
                  <Select value={halfPart} onValueChange={(v) => setHalfPart(v as "AM" | "PM")}>
                    <SelectTrigger className="h-8 w-full text-xs mt-2"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="AM">Matin (AM)</SelectItem>
                      <SelectItem value="PM">Apres-midi (PM)</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              </Field>
            )}

            {/* Solde dispo */}
            {balance && type === "vacation" && (
              <div className={`rounded-md border p-3 text-xs ${balanceInsufficient ? "bg-red-50 border-red-200" : "bg-background"}`}>
                <p className="uppercase tracking-wider text-[10px] font-semibold text-muted-foreground mb-1">Solde vacances</p>
                <p className="font-medium">
                  <span className="tabular-nums text-[#0F2D52] text-base font-bold">{balance.vacationDaysRemaining}</span>
                  <span className="text-muted-foreground"> j dispo</span>
                  {start && end && (
                    <>
                      <span className="mx-1.5 text-muted-foreground">·</span>
                      <span className="tabular-nums">demande {estimatedDays}</span>
                      <span className="mx-1.5 text-muted-foreground">→</span>
                      <span className={`tabular-nums font-bold ${balanceInsufficient ? "text-red-700" : "text-emerald-700"}`}>{balanceAfter}</span>
                    </>
                  )}
                </p>
                {balanceInsufficient && (
                  <p className="text-red-700 text-[11px] mt-1 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />Solde insuffisant
                  </p>
                )}
                {/* Barre de progression */}
                <div className="mt-2 h-1.5 bg-muted rounded overflow-hidden">
                  <div
                    className={`h-full transition ${balanceInsufficient ? "bg-red-500" : "bg-[#0F2D52]"}`}
                    style={{
                      width: `${balance.vacationDaysRemaining > 0
                        ? Math.min(100, ((estimatedDays || 0) / balance.vacationDaysRemaining) * 100)
                        : 0}%`,
                    }}
                  />
                </div>
              </div>
            )}

            {/* Conflits equipe */}
            {start && teamConflicts.othersCount > 0 && (
              <div className="rounded-md border border-orange-200 bg-orange-50 p-3 text-xs">
                <p className="flex items-center gap-1.5 font-semibold text-orange-800">
                  <Users className="h-3.5 w-3.5" />
                  {teamConflicts.othersCount} collegue{teamConflicts.othersCount > 1 ? "s" : ""} absent{teamConflicts.othersCount > 1 ? "s" : ""}
                </p>
                <p className="text-orange-700/80 mt-0.5 line-clamp-2">{teamConflicts.names.join(", ")}{teamConflicts.othersCount > teamConflicts.names.length ? "…" : ""}</p>
              </div>
            )}

            {/* Auto-suggestions : dates sans conflit ±2 semaines */}
            {suggestions.length > 0 && (
              <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs space-y-1.5">
                <p className="flex items-center gap-1.5 font-semibold text-emerald-800">
                  <Sparkles className="h-3.5 w-3.5" />
                  Dates suggerees sans conflit
                </p>
                <p className="text-[10px] text-emerald-700/80">
                  Cliquez pour pre-remplir une periode equivalente avec 0 absent.
                </p>
                <div className="flex flex-col gap-1 pt-0.5">
                  {suggestions.map((s, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => applySuggestion(s)}
                      className="rounded border border-emerald-300 bg-white hover:bg-emerald-100 px-2 py-1.5 text-left text-emerald-900 transition flex items-center justify-between gap-2"
                    >
                      <span className="font-medium tabular-nums">
                        {parseISO(s.start).toLocaleDateString("fr-CA", { weekday: "short", day: "2-digit", month: "short" })}
                        {s.start !== s.end && (
                          <>
                            {" → "}
                            {parseISO(s.end).toLocaleDateString("fr-CA", { weekday: "short", day: "2-digit", month: "short" })}
                          </>
                        )}
                      </span>
                      <span className="text-[10px] uppercase tracking-wider text-emerald-700">Appliquer</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Raison */}
            <Field label="Raison (optionnelle)">
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
                placeholder="Contexte, urgence, lien…"
                maxLength={500}
              />
            </Field>

            {/* Toggle Approuver immédiatement (admin uniquement, en création) */}
            {adminMode && mode === "create" && canAutoApprove && (
              <div className="rounded-md border border-[#0F2D52]/30 bg-[#0F2D52]/5 p-3 text-xs">
                <label className="flex items-start gap-2 cursor-pointer">
                  <Checkbox
                    checked={autoApprove}
                    onCheckedChange={(v) => setAutoApprove(!!v)}
                    className="mt-0.5"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-[#0F2D52]">Approuver immédiatement</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      La demande sera créée en statut <strong>approuvé</strong> sans passer par la file d&apos;attente.
                      Les TimeClock seront générés automatiquement pour les congés payés.
                    </p>
                  </div>
                </label>
              </div>
            )}
          </div>
        </div>

        {/* Footer sticky */}
        <div className="px-5 py-3 border-t bg-muted/30 flex items-center justify-between gap-2 shrink-0">
          <p className="text-xs text-muted-foreground">
            {start && end ? (
              <>Total : <strong className="tabular-nums text-foreground">{estimatedDays}</strong> jour{estimatedDays > 1 ? "s" : ""}</>
            ) : "Selectionnez une periode"}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
            <Button
              onClick={submit}
              disabled={!canSubmit || (balanceInsufficient ?? false)}
              className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
            >
              {pending ? submitPending : submitLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

"use client";
// Page admin : gestion des fenetres de selection de vacances (bidding) — PRO.
//
// Cycle complet : draft -> open -> closed -> in_review -> allocated -> archived
//
// Actions contextuelles selon le state :
//   draft     : Publier (-> open) / Supprimer
//   open      : Fermer maintenant (-> closed) / Voir preferences soumises
//   closed    : Reviser (-> in_review) / Allouer directement (-> allocated)
//   in_review : Lancer l'allocation (-> allocated)
//   allocated : Archiver (-> archived)
//   archived  : Lecture seule
//
// Le cron /api/cron/vacation-window-transitions gere les passages auto
// (draft->open a openingDate, open->closed apres closingDate).
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useDateLocale } from "@/lib/i18n-format";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarRange, Plus, ChevronDown, ChevronUp, Trash2, Play, Lock, Sparkles,
  RotateCw, RotateCcw, Users, Inbox, Archive, Eye, Filter, Clock, Search, FlaskConical,
  CheckCircle2, AlertTriangle, XCircle, MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { FormSection, Field } from "@/components/admin/form-section";
import { DatePopover } from "@/components/admin/date-popover";
import { useConfirm } from "@/hooks/use-confirm";
import {
  createVacationWindowAction, updateVacationWindowStatusAction,
  deleteVacationWindowAction, allocateVacationsAction,
  bulkOpenWindowsAction, bulkCloseWindowsAction, simulateAllocationAction,
  updateVacationPreferenceAction, unallocateVacationsAction,
  type SimulationResult,
} from "@/app/actions/hr-vacation-windows";
import { promptDialog } from "@/components/admin/prompt-dialog";

type Preference = {
  id: number;
  adminId: number;
  rank: number;
  startDate: string;
  endDate: string;
  daysCount: number;
  status: string;
  leaveRequestId: number | null;
  admin: { id: number; fullName: string | null; email: string };
  leaveRequest: { id: number } | null;
};

type Window = {
  id: number;
  name: string;
  openingDate: string;
  closingDate: string;
  coversFrom: string;
  coversTo: string;
  maxDaysPerEmployee: number;
  allocationMethod: string;
  status: string;
  notes: string | null;
  createdAt: string;
  preferences: Preference[];
};

// Palette restreinte : navy / amber / emerald / red / slate
const STATUS_META: Record<string, { label: string; cls: string; dotCls: string }> = {
  draft:     { label: "Brouillon",   cls: "bg-slate-100 text-slate-700 border-slate-200",       dotCls: "bg-slate-400" },
  open:      { label: "Ouverte",     cls: "bg-emerald-50 text-emerald-800 border-emerald-200",  dotCls: "bg-emerald-500" },
  closed:    { label: "Fermee",      cls: "bg-amber-50 text-amber-800 border-amber-200",        dotCls: "bg-amber-500" },
  in_review: { label: "En revue",    cls: "bg-[#0F2D52]/10 text-[#0F2D52] border-[#0F2D52]/20", dotCls: "bg-[#0F2D52]" },
  allocated: { label: "Attribuee",   cls: "bg-emerald-50 text-emerald-800 border-emerald-200",  dotCls: "bg-emerald-600" },
  archived:  { label: "Archivee",    cls: "bg-slate-100 text-slate-500 border-slate-200",       dotCls: "bg-slate-400" },
};

const METHOD_LABEL: Record<string, string> = {
  seniority: "Anciennete",
  seniority_multi_round: "Anciennete (multi-rondes)",
  fcfs: "Premier arrive",
  manual: "Manuel",
};

// Phases dans l'ordre pour la progress bar
const PHASES: Array<{ key: string; label: string }> = [
  { key: "draft",     label: "Brouillon" },
  { key: "open",      label: "Ouverte" },
  { key: "closed",    label: "Fermee" },
  { key: "in_review", label: "En revue" },
  { key: "allocated", label: "Attribuee" },
  { key: "archived",  label: "Archivee" },
];

function phaseIndex(status: string): number {
  return Math.max(0, PHASES.findIndex((p) => p.key === status));
}

// Helpers hors composant : le traducteur leur est passe, sinon leurs libelles
// restaient francais quelle que soit la langue du lecteur.
type Tr = (key: string, params?: Record<string, string | number>) => string;

function formatRemaining(toIso: string, t: Tr): { label: string; urgency: "low" | "medium" | "high" } | null {
  const target = new Date(toIso).getTime();
  const now = Date.now();
  if (target <= now) return null;
  const diffH = Math.floor((target - now) / (1000 * 60 * 60));
  if (diffH < 24) return { label: t("ferme_dans_h", { hours: diffH }), urgency: "high" };
  const diffD = Math.floor(diffH / 24);
  if (diffD <= 3) return { label: t("jours_avant_fermeture", { days: diffD }), urgency: "medium" };
  return { label: t("ferme_dans_jours", { days: diffD }), urgency: "low" };
}

function formatOpeningIn(toIso: string, t: Tr): string | null {
  const target = new Date(toIso).getTime();
  const now = Date.now();
  if (target <= now) return null;
  const diffH = Math.floor((target - now) / (1000 * 60 * 60));
  if (diffH < 24) return t("ouvre_dans_h", { hours: diffH });
  const diffD = Math.floor(diffH / 24);
  return t("ouvre_dans_jours", { days: diffD });
}

export function WindowsView({ windows }: { windows: Window[] }) {
  const t = useTranslations("admin.leave_windows");
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);


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


  const [navExtraEl, setNavExtraEl] = useState<HTMLElement | null>(null);
  useEffect(() => {
    setNavExtraEl(document.getElementById("vnk-module-nav-extra"));
  }, []);

  const filtered = windows.filter((w) => {
    if (statusFilter === "active" && (w.status === "archived")) return false;
    if (statusFilter !== "active" && statusFilter !== "all" && w.status !== statusFilter) return false;
    if (search && !w.name.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });


  const counts = windows.reduce<Record<string, number>>((acc, w) => {
    acc[w.status] = (acc[w.status] ?? 0) + 1;
    return acc;
  }, {});

  const draftsCount = counts.draft ?? 0;
  const opensCount = counts.open ?? 0;
  const closedAwaitingAlloc = (counts.closed ?? 0) + (counts.in_review ?? 0);
  const allocatedCount = counts.allocated ?? 0;
  const archivedCount = counts.archived ?? 0;

  const onBulkOpen = async () => {
    if (draftsCount === 0) { toast.info(t("aucun_brouillon_ouvrir")); return; }
    const ok = await confirm({
      title: t("ouvrir_n_brouillons", { count: draftsCount }),
      description: t("toutes_fenetres_brouillon_passeront_etat"),
      confirmLabel: t("ouvrir_tout"),
    });
    if (!ok) return;
    setBulkBusy(true);
    const r = await bulkOpenWindowsAction();
    setBulkBusy(false);
    if (r.success) {
      toast.success(t("n_fenetres_ouvertes", { count: r.data.opened }));
      router.refresh();
    } else toast.error(r.error || t("erreur"));
  };
  const onBulkClose = async () => {
    if (opensCount === 0) { toast.info(t("aucune_fenetre_ouverte_fermer")); return; }
    const ok = await confirm({
      title: `Fermer ${opensCount} fenetre${opensCount > 1 ? "s" : ""} ?`,
      description: t("plus_aucun_employe_ne_pourra"),
      variant: "destructive",
      confirmLabel: t("fermer_tout"),
    });
    if (!ok) return;
    setBulkBusy(true);
    const r = await bulkCloseWindowsAction();
    setBulkBusy(false);
    if (r.success) {
      toast.success(`${r.data.closed} fenetre${r.data.closed > 1 ? "s" : ""} fermee${r.data.closed > 1 ? "s" : ""}`);
      router.refresh();
    } else toast.error(r.error || t("erreur"));
  };

  return (
    <div className="space-y-4">

      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <CalendarRange className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">{t("fenetres_selection_vacances")}</h1>
              <p className="text-xs text-white/80">
                {t("workflow_brouillon_gt_ouverte_employes")}
              </p>
            </div>
          </div>

          <div className="flex gap-2 flex-wrap shrink-0">
            <Button onClick={() => setCreating(true)} variant="secondary" size="sm" className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1.5" />{t("nouvelle_fenetre")}
            </Button>
            <ActionTooltip label={t("ouvrir_tous_brouillons", { count: draftsCount })}>
              <Button
                onClick={onBulkOpen}
                disabled={bulkBusy || draftsCount === 0}
                variant="secondary" size="sm"
                className="hidden md:inline-flex h-8 text-xs bg-white/15 hover:bg-white/25 text-white border-white/20 disabled:opacity-40"
              >
                <Play className="h-3.5 w-3.5 mr-1.5" />Ouvrir ({draftsCount})
              </Button>
            </ActionTooltip>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="secondary" size="sm"
                  className="h-8 text-xs bg-white/15 hover:bg-white/25 text-white border-white/20"
                >
                  <MoreHorizontal className="h-3.5 w-3.5 mr-1.5" />{t("windows_view_plus")}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  className="md:hidden"
                  disabled={bulkBusy || draftsCount === 0}
                  onClick={onBulkOpen}
                >
                  <Play className="h-3.5 w-3.5 mr-2" />Ouvrir tout ({draftsCount})
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={bulkBusy || opensCount === 0}
                  onClick={onBulkClose}
                >
                  <Lock className="h-3.5 w-3.5 mr-2" />Fermer tout ({opensCount})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>


      <Card className="p-3 border-l-4 border-l-[#0F2D52]">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52]">{t("etat_systeme")}</span>
          <StatusPill icon={Play} color="emerald" label={t("n_ouvertes", { count: opensCount })} highlight={opensCount > 0} />
          <StatusPill icon={Inbox} color="slate" label={t("n_brouillons", { count: draftsCount })} />
          <StatusPill icon={Lock} color="amber" label={t("n_attente_attribution", { count: closedAwaitingAlloc })} highlight={closedAwaitingAlloc > 0} />
          <StatusPill icon={Sparkles} color="emerald" label={t("n_attribuees", { count: allocatedCount })} />
          <StatusPill icon={Archive} color="slate" label={t("n_archivees", { count: archivedCount })} />
        </div>
      </Card>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("att")}</span>
                  <span className="hidden min-[480px]:inline">{t("attente_2")}</span>
                </span>
                <span className={closedAwaitingAlloc > 0 ? "font-semibold text-amber-600" : "font-semibold"}>
                  {closedAwaitingAlloc}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">{t("att")}</span>
                  <span className="hidden min-[480px]:inline">{t("attribuees")}</span>
                </span>
                <span className="font-semibold text-emerald-600">{allocatedCount}</span>
              </span>
            </div>,
            navExtraEl,
          )
        : null}


      <div
        className={cn(
          "sticky top-[92px] pt-4 lg:top-[64px] lg:pt-0 z-20 bg-background",
          "-mx-4 sm:-mx-5 lg:mx-0 transition-shadow",
          scrolled ? "shadow-sm border-b" : "border-b border-transparent",
        )}
      >
        <div className={cn(
          "hidden px-4 items-center gap-3 flex-wrap py-2",
          scrolled ? "lg:flex" : "lg:hidden",
        )}>
          <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 shrink-0">
            <CalendarRange className="h-4 w-4" />
            {t("fenetres_vacances")}
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              {t("nouvelle_fenetre")}
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="outline" className="h-7 text-xs">
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem
                  disabled={bulkBusy || draftsCount === 0}
                  onClick={onBulkOpen}
                >
                  <Play className="h-3.5 w-3.5 mr-2" />Ouvrir tout ({draftsCount})
                </DropdownMenuItem>
                <DropdownMenuItem
                  disabled={bulkBusy || opensCount === 0}
                  onClick={onBulkClose}
                >
                  <Lock className="h-3.5 w-3.5 mr-2" />Fermer tout ({opensCount})
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>


      <Card className="p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder={t("rechercher_fenetre")} value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" />
        </div>
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">{t("actives_non_archivees")}</SelectItem>
            <SelectItem value="all">{t("toutes")}</SelectItem>
            {PHASES.map((p) => (
              <SelectItem key={p.key} value={p.key}>
                {p.label} {counts[p.key] ? `(${counts[p.key]})` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Card>

      <div className="space-y-3">
        {filtered.length === 0 ? (
          <Card className="p-10 text-center">
            <div className="mx-auto h-12 w-12 rounded-full bg-[#0F2D52]/10 flex items-center justify-center mb-3">
              <Inbox className="h-6 w-6 text-[#0F2D52]" />
            </div>
            <p className="text-sm font-medium text-foreground">
              {windows.length === 0 ? t("aucune_fenetre_selection") : t("aucune_fenetre_ne_correspond_filtres")}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {windows.length === 0
                ? t("creez_fenetre_lancer_cycle_selection")
                : t("modifiez_filtres_videz_recherche")}
            </p>
            {windows.length === 0 && (
              <Button onClick={() => setCreating(true)} className="mt-4 bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
                <Plus className="h-4 w-4 mr-1.5" />{t("windows_view_creer_une_fenetre")}</Button>
            )}
          </Card>
        ) : (
          filtered.map((w) => (
            <WindowCard
              key={w.id}
              window={w}
              confirm={confirm}
              onChanged={() => router.refresh()}
            />
          ))
        )}
      </div>

      {creating && (
        <CreateWindowDialog
          onClose={() => setCreating(false)}
          onSaved={() => { setCreating(false); router.refresh(); }}
        />
      )}

      {ConfirmModal}
    </div>
  );
}

function WindowCard({ window: w, onChanged, confirm }: {
  window: Window;
  onChanged: () => void;
  confirm: (opts: { title: string; description: string; variant?: "destructive" | "default"; confirmLabel?: string }) => Promise<boolean>;
}) {
  const t = useTranslations("admin.leave_windows");



  const [expanded, setExpanded] = useState(() => w.preferences.length > 0);
  const [busy, setBusy] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const dateTag = useDateLocale();
  const status = STATUS_META[w.status] ?? STATUS_META.draft;
  const submittedAdmins = new Set(w.preferences.map((p) => p.adminId)).size;
  const grantedCount = w.preferences.filter((p) => p.status === "granted").length;
  const deniedCount = w.preferences.filter((p) => p.status === "denied").length;
  const phaseIdx = phaseIndex(w.status);
  const remaining = w.status === "open" ? formatRemaining(w.closingDate, t) : null;
  const openingIn = w.status === "draft" ? formatOpeningIn(w.openingDate, t) : null;

  const simulate = async () => {
    setSimBusy(true);
    const r = await simulateAllocationAction({ id: w.id });
    setSimBusy(false);
    if (r.success) { setSimulation(r.data); }
    else toast.error(r.error || t("erreur_lors_simulation"));
  };

  const setStatus = async (next: "draft" | "open" | "closed" | "in_review" | "allocated" | "archived") => {
    if (busy) return;
    setBusy(true);
    const r = await updateVacationWindowStatusAction({ id: w.id, status: next });
    setBusy(false);
    if (r.success) { toast.success(t("statut_mis_jour")); onChanged(); }
    else toast.error(r.error || t("erreur"));
  };

  const allocate = async () => {
    const ok = await confirm({
      title: t("lancer_attribution_maintenant"),
      description: t("leaverequest_approuvees_seront_crees_chaque"),
      variant: "default",
      confirmLabel: t("attribuer"),
    });
    if (!ok || busy) return;
    setBusy(true);
    const r = await allocateVacationsAction({ id: w.id });
    setBusy(false);
    if (r.success) {
      toast.success(`Attribution faite : ${r.data.granted} accordees, ${r.data.denied} refusees.`);
      onChanged();
    } else toast.error(r.error || t("erreur_lors_attribution"));
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Supprimer "${w.name}" ?`,
      description: t("toutes_preferences_soumises_seront_perdues"),
      variant: "destructive",
      confirmLabel: t("supprimer"),
    });
    if (!ok || busy) return;
    setBusy(true);
    const r = await deleteVacationWindowAction({ id: w.id });
    setBusy(false);
    if (r.success) { toast.success(t("fenetre_supprimee")); onChanged(); }
    else toast.error(r.error || t("erreur_lors_suppression"));
  };


  const grantedWithLeaves = w.preferences.filter((p) => p.status === "granted" && p.leaveRequestId !== null);
  const affectedEmployees = new Set(grantedWithLeaves.map((p) => p.adminId)).size;
  const unallocate = async () => {
    const ok = await confirm({
      title: t("annuler_attribution_fenetre"),
      description: t("windows_view_cette_action_supprimera_p0_conge_s_cree_s", { p0: grantedWithLeaves.length, p1: affectedEmployees }),
      variant: "destructive",
      confirmLabel: t("continuer"),
    });
    if (!ok) return;
    const reason = await promptDialog({
      title: t("raison_annulation"),
      label: t("motif_requis_notifie_employes"),
      multiline: true,
      required: true,
      variant: "destructive",
      confirmLabel: t("annuler_attribution"),
    });
    if (!reason) return;
    if (busy) return;
    setBusy(true);
    const r = await unallocateVacationsAction({ windowId: w.id, reason: reason.trim() });
    setBusy(false);
    if (r.success) {
      toast.success(t("windows_view_attribution_annulee_p0_preference_s_p1_conge_s", { p0: r.data.unallocated, p1: r.data.deletedLeaves }));
      onChanged();
    } else toast.error(r.error || t("erreur_lors_annulation"));
  };

  return (
    <Card className="p-4">
      <div className="flex items-start gap-3 flex-wrap">
        <div className="h-10 w-10 rounded-lg flex items-center justify-center bg-[#0F2D52]/10 text-[#0F2D52] shrink-0">
          <CalendarRange className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-sm">{w.name}</h3>
            <span className={`inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${status.cls}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${status.dotCls}`} />
              {status.label}
            </span>
            <span className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
              {METHOD_LABEL[w.allocationMethod] ?? w.allocationMethod}
            </span>
            {remaining && (
              <span className={`inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border font-semibold ${
                remaining.urgency === "high" ? "border-red-300 bg-red-50 text-red-800 animate-pulse"
                : remaining.urgency === "medium" ? "border-amber-300 bg-amber-50 text-amber-800"
                : "border-slate-200 bg-slate-50 text-slate-700"
              }`}>
                <Clock className="h-2.5 w-2.5" />
                {remaining.label}
              </span>
            )}
            {openingIn && (
              <span className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700">
                <Clock className="h-2.5 w-2.5" />
                {openingIn}
              </span>
            )}
          </div>
          <ul className="text-xs text-muted-foreground mt-1.5 space-y-0.5">
            <li>
              <strong>{t("soumission")}</strong>{" "}
              {new Date(w.openingDate).toLocaleDateString(dateTag)} → {new Date(w.closingDate).toLocaleDateString(dateTag)}
            </li>
            <li>
              <strong>{t("couvre")}</strong>{" "}
              {new Date(w.coversFrom).toLocaleDateString(dateTag)} → {new Date(w.coversTo).toLocaleDateString(dateTag)}
              {" · "}max {w.maxDaysPerEmployee} j/employe
            </li>
            <li className="flex items-center gap-1 flex-wrap">
              <Users className="h-3 w-3" />
              {submittedAdmins} employe{submittedAdmins > 1 ? "s" : ""} a soumis
              {grantedCount > 0 && <span className="text-emerald-700"> · {grantedCount} accordee{grantedCount > 1 ? "s" : ""}</span>}
              {deniedCount > 0 && <span className="text-red-700"> · {deniedCount} refusee{deniedCount > 1 ? "s" : ""}</span>}
            </li>
          </ul>
          {w.notes && <p className="text-[11px] italic text-muted-foreground mt-1">« {w.notes} »</p>}


          <PhaseProgress currentIdx={phaseIdx} />
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap">

          {w.status === "draft" && (
            <>
              <ActionTooltip label={t("publier_fenetre_employes_seront_notifies")}>
                <Button size="sm" className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white" disabled={busy} onClick={() => setStatus("open")}>
                  <Play className="h-3 w-3 mr-1" />{busy ? "..." : t("publier")}
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("supprimer_fenetre_brouillon")}>
                <Button size="sm" variant="outline" className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50" disabled={busy} onClick={remove}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </ActionTooltip>
            </>
          )}
          {w.status === "open" && (
            <>
              <ActionTooltip label={t("fermer_maintenant_plus_soumissions")}>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setStatus("closed")}>
                  <Lock className="h-3 w-3 mr-1" />{busy ? "..." : t("fermer_maintenant")}
                </Button>
              </ActionTooltip>
              {submittedAdmins > 0 && (
                <ActionTooltip label={t("voir_preferences_soumises")}>
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExpanded(true)}>
                    <Eye className="h-3 w-3 mr-1" />{submittedAdmins}
                  </Button>
                </ActionTooltip>
              )}
            </>
          )}
          {w.status === "closed" && (
            <>
              <ActionTooltip label={t("simuler_attribution_preview_sans_rien")}>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={simBusy} onClick={simulate}>
                  <FlaskConical className="h-3 w-3 mr-1" />{simBusy ? "..." : t("simuler")}
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("passer_revue_ajuster_manuellement")}>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setStatus("in_review")}>
                  <Eye className="h-3 w-3 mr-1" />Reviser
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("lancer_maintenant_attribution_irreversible")}>
                <Button size="sm" className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white font-semibold" disabled={busy} onClick={allocate}>
                  <Sparkles className="h-3 w-3 mr-1" />{busy ? "..." : t("lancer_attribution")}
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("rouvrir_soumissions")}>
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={busy} onClick={() => setStatus("open")}>
                  <RotateCw className="h-3 w-3" />
                </Button>
              </ActionTooltip>
            </>
          )}
          {w.status === "in_review" && (
            <>
              <ActionTooltip label={t("simuler_attribution_preview_sans_rien")}>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={simBusy} onClick={simulate}>
                  <FlaskConical className="h-3 w-3 mr-1" />{simBusy ? "..." : t("simuler")}
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("lancer_attribution_finale_irreversible")}>
                <Button size="sm" className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white font-semibold" disabled={busy} onClick={allocate}>
                  <Sparkles className="h-3 w-3 mr-1" />{busy ? "..." : t("lancer_attribution")}
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("retour_statut_ferme")}>
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={busy} onClick={() => setStatus("closed")}>
                  <Lock className="h-3 w-3" />
                </Button>
              </ActionTooltip>
            </>
          )}
          {w.status === "allocated" && (
            <>

              <ActionTooltip label={t("annuler_attribution_supprime_conges_crees")}>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                  disabled={busy}
                  onClick={unallocate}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />{busy ? "..." : t("annuler_attribution")}
                </Button>
              </ActionTooltip>
              <ActionTooltip label={t("archiver_fenetre_lecture_seule")}>
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setStatus("archived")}>
                  <Archive className="h-3 w-3 mr-1" />Archiver
                </Button>
              </ActionTooltip>
            </>
          )}
          {w.status !== "draft" && w.status !== "allocated" && w.status !== "archived" && (
            <ActionTooltip label={t("supprimer_fenetre")}>
              <Button
                size="sm"
                variant="outline"
                className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50"
                disabled={busy}
                onClick={remove}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </ActionTooltip>
          )}
          <ActionTooltip label={expanded ? t("replier") : t("voir_preferences_soumises")}>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </ActionTooltip>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t pt-3">
          {w.preferences.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">{t("aucune_preference_soumise")}</p>
          ) : (
            <>
              {/* Bandeau explicatif quand fenêtre OPEN : les actions sont grisées,
                  l'admin doit cliquer t("fermer_maintenant") en haut pour débloquer. */}
              {w.status === "open" && (
                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-amber-900">
                    <strong>{t("fenetre_encore_ouverte")}</strong>{t("windows_view_les_boutons_accorder_refuser_sont_desactives_tant")}<br />{t("windows_view_cliquez_sur")}<strong>{t("fermer_maintenant")}</strong>{t("windows_view_en_haut_pour_stopper_les_soumissions_et")}</div>
                </div>
              )}
              <PreferencesTable preferences={w.preferences} windowStatus={w.status} onChanged={onChanged} />
            </>
          )}
        </div>
      )}

      {simulation && (
        <SimulationDialog
          windowName={w.name}
          result={simulation}
          onClose={() => setSimulation(null)}
          onConfirm={async () => {
            setSimulation(null);
            await allocate();
          }}
        />
      )}
    </Card>
  );
}

// Pastille d'etat globale (bandeau systeme)
function StatusPill({
  icon: Icon, color, label, highlight,
}: {
  icon: typeof Play;
  color: "emerald" | "amber" | "slate";
  label: string;
  highlight?: boolean;
}) {
  const cls = color === "emerald"
    ? (highlight ? "bg-emerald-100 text-emerald-900 border-emerald-300 font-bold" : "bg-emerald-50 text-emerald-700 border-emerald-200")
    : color === "amber"
      ? (highlight ? "bg-amber-100 text-amber-900 border-amber-300 font-bold" : "bg-amber-50 text-amber-700 border-amber-200")
      : "bg-slate-50 text-slate-700 border-slate-200";
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] ${cls}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  );
}

// Modal de preview/simulation d'attribution (sandbox sans creation)
function SimulationDialog({
  windowName, result, onClose, onConfirm,
}: {
  windowName: string;
  result: SimulationResult;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useTranslations("admin.leave_windows");
  const [committing, setCommitting] = useState(false);
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <FlaskConical className="h-4 w-4" />Simulation d&apos;attribution — {windowName}
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("apercu_sera_attribue_aucun_conge")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-3">
              <div className="flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-[10px] uppercase tracking-wider font-bold">{t("accordees")}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-emerald-800 mt-1">{result.granted.length}</p>
            </div>
            <div className="rounded-lg border bg-red-50/50 border-red-200 p-3">
              <div className="flex items-center gap-1.5 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="text-[10px] uppercase tracking-wider font-bold">{t("refusees")}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-red-800 mt-1">{result.denied.length}</p>
            </div>
            <div className="rounded-lg border bg-amber-50/50 border-amber-200 p-3">
              <div className="flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-[10px] uppercase tracking-wider font-bold">{t("conflits")}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-amber-800 mt-1">{result.conflicts.length}</p>
            </div>
          </div>

          {result.granted.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-emerald-800 mb-1.5">{t("accordees")}</h4>
              <ul className="divide-y border rounded text-xs">
                {result.granted.map((g, i) => (
                  <li key={i} className="px-3 py-1.5 flex items-center justify-between gap-2">
                    <span className="font-medium truncate">{g.fullName}</span>
                    <span className="text-muted-foreground tabular-nums shrink-0">
                      Rang #{g.rank} · {g.startDate} → {g.endDate} ({g.daysCount}j)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.denied.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-1.5">{t("refusees")}</h4>
              <ul className="divide-y border rounded text-xs">
                {result.denied.map((d, i) => (
                  <li key={i} className="px-3 py-1.5">
                    <p className="font-medium">{d.fullName}</p>
                    {d.reasons.length > 0 && (
                      <ul className="ml-3 text-[11px] text-muted-foreground list-disc list-inside mt-0.5">
                        {d.reasons.map((r, j) => <li key={j}>{r}</li>)}
                      </ul>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result.conflicts.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-amber-800 mb-1.5">{t("conflits_apos_effectif")}</h4>
              <ul className="divide-y border rounded text-xs">
                {result.conflicts.map((c, i) => (
                  <li key={i} className="px-3 py-1.5 text-muted-foreground">{c.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {result.granted.length === 0 && result.denied.length === 0 && (
            <p className="text-center text-xs text-muted-foreground italic py-6">
              {t("aucune_preference_soumise_fenetre")}
            </p>
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={committing}>{t("fermer_sans_attribuer")}</Button>
          <Button
            onClick={async () => { setCommitting(true); await onConfirm(); setCommitting(false); }}
            disabled={committing || result.granted.length === 0}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />{committing ? t("attribution_cours") : t("confirmer_attribution_reelle")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Progress bar visuelle des phases
function PhaseProgress({ currentIdx }: { currentIdx: number }) {
  return (
    <div className="mt-3">
      <div className="flex items-center gap-0">
        {PHASES.map((p, i) => {
          const isPast = i < currentIdx;
          const isCurrent = i === currentIdx;
          const colorCls = isPast || isCurrent ? "bg-[#0F2D52]" : "bg-slate-200";
          const dotCls = isCurrent
            ? "bg-[#0F2D52] ring-2 ring-[#0F2D52]/30"
            : isPast ? "bg-[#0F2D52]" : "bg-slate-300";
          return (
            <div key={p.key} className="flex-1 flex items-center first:flex-none">
              {i > 0 && <div className={`h-0.5 flex-1 ${colorCls}`} />}
              <ActionTooltip label={p.label}>
                <div className={`h-2.5 w-2.5 rounded-full ${dotCls} shrink-0`} />
              </ActionTooltip>
            </div>
          );
        })}
      </div>
      <div className="flex justify-between mt-1">
        {PHASES.map((p, i) => {
          const isCurrent = i === currentIdx;
          return (
            <span
              key={p.key}
              className={`text-[8px] uppercase tracking-wider ${isCurrent ? "text-[#0F2D52] font-bold" : "text-muted-foreground"}`}
            >
              {p.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function PreferencesTable({
  preferences,
  windowStatus,
  onChanged,
}: {
  preferences: Preference[];
  windowStatus?: string;
  onChanged?: () => void;
}) {
  const t = useTranslations("admin.leave_windows");
  const tc = useTranslations("common");
  const dateTag = useDateLocale();

  const byAdmin = new Map<number, { admin: Preference["admin"]; prefs: Preference[] }>();
  for (const p of preferences) {
    if (!byAdmin.has(p.adminId)) byAdmin.set(p.adminId, { admin: p.admin, prefs: [] });
    byAdmin.get(p.adminId)!.prefs.push(p);
  }

  const canEdit = windowStatus === "closed" || windowStatus === "in_review";
  const isAllocated = windowStatus === "allocated";

  const showActionsCol = canEdit || windowStatus === "open" || isAllocated;
  const [busyId, setBusyId] = useState<number | null>(null);

  const setStatus = async (prefId: number, status: "granted" | "denied" | "pending") => {
    setBusyId(prefId);
    const r = await updateVacationPreferenceAction({ id: prefId, status });
    setBusyId(null);
    if (r.success) {
      toast.success(status === "granted" ? t("preference_accordee") : status === "denied" ? t("preference_refusee") : t("statut_reinitialise"));
      onChanged?.();
    } else {
      toast.error(r.error || t("erreur"));
    }
  };

  const cols = showActionsCol
    ? "grid-cols-[1fr_50px_1.2fr_50px_70px_auto]"
    : "grid-cols-[1fr_60px_1fr_60px_80px]";

  return (
    <div className="divide-y text-xs">
      <div className={`grid ${cols} gap-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground`}>
        <div>{t("employe")}</div>
        <div>{t("rang")}</div>
        <div>{t("periode")}</div>
        <div className="text-right">{t("jours")}</div>
        <div className="text-right">{tc("status")}</div>
        {showActionsCol && <div className="text-right">{tc("actions")}</div>}
      </div>
      {Array.from(byAdmin.values()).map(({ admin, prefs }) =>
        prefs.map((p) => (
          <div key={p.id} className={`grid ${cols} gap-2 py-1.5 items-center`}>
            <div className="truncate font-medium">{admin.fullName || admin.email}</div>
            <div className="text-[#0F2D52] font-bold">#{p.rank}</div>
            <div className="text-muted-foreground tabular-nums">
              {new Date(p.startDate).toLocaleDateString(dateTag)} → {new Date(p.endDate).toLocaleDateString(dateTag)}
            </div>
            <div className="text-right tabular-nums">{Number(p.daysCount)}</div>
            <div className="text-right">
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${
                p.status === "granted" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : p.status === "denied" ? "bg-red-50 text-red-800 border-red-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {p.status === "granted" ? t("accordee") : p.status === "denied" ? t("refusee") : t("attente_2")}
              </span>
            </div>
            {showActionsCol && (
              <div className="flex justify-end gap-1">

                {isAllocated && p.status === "granted" && p.leaveRequestId && (
                  <ActionTooltip label={t("voir_conge_cree_cet_employe")}>
                    <a
                      href={`/admin/employes/conges?employeeId=${p.adminId}&highlight=${p.leaveRequestId}`}
                      className="inline-flex items-center h-6 px-1.5 text-[10px] border border-[#0F2D52]/30 text-[#0F2D52] rounded hover:bg-[#0F2D52]/5"
                    >
                      <Eye className="h-3 w-3 mr-1" />{tc("view")}
                    </a>
                  </ActionTooltip>
                )}
                {p.status !== "granted" && !isAllocated && (
                  <ActionTooltip
                    label={canEdit
                      ? t("accorder_preference_cree_conge_approuve")
                      : t("disponible_fois_fenetre_fermee")}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-emerald-700 border-emerald-200 hover:bg-emerald-50 disabled:opacity-40"
                      disabled={!canEdit || busyId === p.id}
                      onClick={() => canEdit && setStatus(p.id, "granted")}
                    >
                      <CheckCircle2 className="h-3 w-3" />
                    </Button>
                  </ActionTooltip>
                )}
                {p.status !== "denied" && !isAllocated && (
                  <ActionTooltip
                    label={canEdit
                      ? t("refuser_preference")
                      : t("disponible_fois_fenetre_fermee")}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-red-700 border-red-200 hover:bg-red-50 disabled:opacity-40"
                      disabled={!canEdit || busyId === p.id}
                      onClick={() => canEdit && setStatus(p.id, "denied")}
                    >
                      <XCircle className="h-3 w-3" />
                    </Button>
                  </ActionTooltip>
                )}
                {p.status !== "pending" && !isAllocated && (
                  <ActionTooltip
                    label={canEdit
                      ? t("reinitialiser_attente")
                      : t("disponible_fois_fenetre_fermee")}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-6 px-1.5 text-muted-foreground disabled:opacity-40"
                      disabled={!canEdit || busyId === p.id}
                      onClick={() => canEdit && setStatus(p.id, "pending")}
                    >
                      <RotateCw className="h-3 w-3" />
                    </Button>
                  </ActionTooltip>
                )}
              </div>
            )}
          </div>
        )),
      )}
    </div>
  );
}

function CreateWindowDialog({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const t = useTranslations("admin.leave_windows");
  const tc = useTranslations("common");
  const [name, setName] = useState(t("vacances_ete_2026"));
  const [opening, setOpening] = useState("");
  const [closing, setClosing] = useState("");
  const [coversFrom, setCoversFrom] = useState("");
  const [coversTo, setCoversTo] = useState("");
  const [maxDays, setMaxDays] = useState(10);
  const [method, setMethod] = useState<"seniority" | "seniority_multi_round" | "fcfs" | "manual">("seniority");
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    if (!name.trim() || !opening || !closing || !coversFrom || !coversTo) {
      toast.error(t("tous_champs_obligatoires"));
      return;
    }
    setPending(true);
    const r = await createVacationWindowAction({
      name: name.trim(),
      openingDate: opening,
      closingDate: closing,
      coversFrom,
      coversTo,
      maxDaysPerEmployee: maxDays,
      allocationMethod: method,
      notes: notes || null,
    });
    setPending(false);
    if (r.success) { toast.success(t("fenetre_creee_brouillon")); onSaved(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />{t("nouvelle_fenetre")} de selection
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              {t("employes_soumettent_leurs_preferences_entre")}
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <FormSection icon={CalendarRange} title={t("identite")}>
            <Field label={t("nom")} required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={t("vacances_ete_2026")} />
            </Field>
          </FormSection>

          <FormSection icon={CalendarRange} title={t("periode_soumission")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("ouverture")} required>
                <DatePopover value={opening} onChange={setOpening} />
              </Field>
              <Field label={t("fermeture")} required>
                <DatePopover value={closing} onChange={setClosing} min={opening} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={CalendarRange} title={t("periode_couverte_vacances_visees")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("du")} required>
                <DatePopover value={coversFrom} onChange={setCoversFrom} />
              </Field>
              <Field label={t("au")} required>
                <DatePopover value={coversTo} onChange={setCoversTo} min={coversFrom} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={CalendarRange} title={t("regles")}>
            <div className="grid grid-cols-2 gap-3">
              <Field label={t("max_jours_employe")}>
                <Input type="number" value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} min={1} max={60} />
              </Field>
              <Field label={t("methode_attribution")}>
                <Select value={method} onValueChange={(v) => setMethod(v as "seniority" | "seniority_multi_round" | "fcfs" | "manual")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seniority">{t("anciennete_1_3_sequentiel")}</SelectItem>
                    <SelectItem value="seniority_multi_round">{t("anciennete_multi_rondes_chu")}</SelectItem>
                    <SelectItem value="fcfs">{t("premier_arrive_fcfs")}</SelectItem>
                    <SelectItem value="manual">{t("manuel")}</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection icon={CalendarRange} title={t("notes_optionnel")}>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              placeholder={t("informations_affichees_employes")}
              maxLength={500}
            />
          </FormSection>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            {pending ? t("creation") : t("creer_brouillon")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

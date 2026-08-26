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

function formatRemaining(toIso: string): { label: string; urgency: "low" | "medium" | "high" } | null {
  const target = new Date(toIso).getTime();
  const now = Date.now();
  if (target <= now) return null;
  const diffH = Math.floor((target - now) / (1000 * 60 * 60));
  if (diffH < 6) return { label: `Ferme dans ${diffH}h`, urgency: "high" };
  if (diffH < 24) return { label: `Ferme dans ${diffH}h`, urgency: "high" };
  const diffD = Math.floor(diffH / 24);
  if (diffD <= 3) return { label: `J-${diffD} avant fermeture`, urgency: "medium" };
  return { label: `Ferme dans ${diffD} jour${diffD > 1 ? "s" : ""}`, urgency: "low" };
}

function formatOpeningIn(toIso: string): string | null {
  const target = new Date(toIso).getTime();
  const now = Date.now();
  if (target <= now) return null;
  const diffH = Math.floor((target - now) / (1000 * 60 * 60));
  if (diffH < 24) return `Ouvre dans ${diffH}h`;
  const diffD = Math.floor(diffH / 24);
  return `Ouvre dans ${diffD} jour${diffD > 1 ? "s" : ""}`;
}

export function WindowsView({ windows }: { windows: Window[] }) {
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const [creating, setCreating] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const [search, setSearch] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  // Sticky bar pattern STANDARD (ref my-documents-view.tsx)
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

  // Portal target KPIs dans module-nav mobile
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

  // Comptages par state pour les onglets/filtres
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
    if (draftsCount === 0) { toast.info("Aucun brouillon a ouvrir."); return; }
    const ok = await confirm({
      title: `Ouvrir ${draftsCount} brouillon${draftsCount > 1 ? "s" : ""} ?`,
      description: "Toutes les fenetres brouillon passeront a l'etat Ouverte. Tous les employes actifs seront notifies.",
      confirmLabel: "Ouvrir tout",
    });
    if (!ok) return;
    setBulkBusy(true);
    const r = await bulkOpenWindowsAction();
    setBulkBusy(false);
    if (r.success) {
      toast.success(`${r.data.opened} fenetre${r.data.opened > 1 ? "s" : ""} ouverte${r.data.opened > 1 ? "s" : ""}`);
      router.refresh();
    } else toast.error(r.error || "Erreur");
  };
  const onBulkClose = async () => {
    if (opensCount === 0) { toast.info("Aucune fenetre ouverte a fermer."); return; }
    const ok = await confirm({
      title: `Fermer ${opensCount} fenetre${opensCount > 1 ? "s" : ""} ?`,
      description: "Plus aucun employe ne pourra soumettre de preferences. Les RH seront notifies pour l'attribution.",
      variant: "destructive",
      confirmLabel: "Fermer tout",
    });
    if (!ok) return;
    setBulkBusy(true);
    const r = await bulkCloseWindowsAction();
    setBulkBusy(false);
    if (r.success) {
      toast.success(`${r.data.closed} fenetre${r.data.closed > 1 ? "s" : ""} fermee${r.data.closed > 1 ? "s" : ""}`);
      router.refresh();
    } else toast.error(r.error || "Erreur");
  };

  return (
    <div className="space-y-4">
      {/* Hero navy non-sticky : scroll naturellement (pattern Finance) */}
      <div className="rounded-xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-5 py-4 text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" aria-hidden />
        <div className="relative flex items-start justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-lg bg-white/15 backdrop-blur flex items-center justify-center ring-2 ring-white/20 shrink-0">
              <CalendarRange className="h-5 w-5 text-white" />
            </div>
            <div className="min-w-0">
              <h1 className="text-lg font-bold">Fenetres de selection de vacances</h1>
              <p className="text-xs text-white/80">
                Workflow : brouillon -&gt; ouverte (employes soumettent) -&gt; fermee -&gt; attribution -&gt; archivee
              </p>
            </div>
          </div>
          {/* Actions : 2 boutons visibles desktop + Plus dropdown */}
          <div className="flex gap-2 flex-wrap shrink-0">
            <Button onClick={() => setCreating(true)} variant="secondary" size="sm" className="h-8 text-xs bg-white text-[#0F2D52] hover:bg-white/90 font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1.5" />Nouvelle fenetre
            </Button>
            <ActionTooltip label={`Ouvrir d'un coup tous les brouillons (${draftsCount})`}>
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
                  <MoreHorizontal className="h-3.5 w-3.5 mr-1.5" />Plus
                </Button>
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

      {/* Bandeau d'etat global — toujours visible (non-sticky) */}
      <Card className="p-3 border-l-4 border-l-[#0F2D52]">
        <div className="flex items-center gap-3 flex-wrap text-xs">
          <span className="text-[10px] uppercase tracking-wider font-bold text-[#0F2D52]">Etat systeme</span>
          <StatusPill icon={Play} color="emerald" label={`${opensCount} ouverte${opensCount > 1 ? "s" : ""}`} highlight={opensCount > 0} />
          <StatusPill icon={Inbox} color="slate" label={`${draftsCount} brouillon${draftsCount > 1 ? "s" : ""}`} />
          <StatusPill icon={Lock} color="amber" label={`${closedAwaitingAlloc} en attente d'attribution`} highlight={closedAwaitingAlloc > 0} />
          <StatusPill icon={Sparkles} color="emerald" label={`${allocatedCount} attribuee${allocatedCount > 1 ? "s" : ""}`} />
          <StatusPill icon={Archive} color="slate" label={`${archivedCount} archivee${archivedCount > 1 ? "s" : ""}`} />
        </div>
      </Card>

      {/* Sentinel : detecte sortie du hero+bandeau */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Portal KPIs vers module-nav mobile */}
      {navExtraEl && scrolled
        ? createPortal(
            <div className="flex items-center gap-x-2 sm:gap-x-3 text-[11px] sm:text-xs whitespace-nowrap lg:hidden">
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">Att :</span>
                  <span className="hidden min-[480px]:inline">En attente :</span>
                </span>
                <span className={closedAwaitingAlloc > 0 ? "font-semibold text-amber-600" : "font-semibold"}>
                  {closedAwaitingAlloc}
                </span>
              </span>
              <span className="text-muted-foreground">·</span>
              <span className="inline-flex items-baseline gap-1">
                <span className="text-muted-foreground">
                  <span className="min-[480px]:hidden">Att :</span>
                  <span className="hidden min-[480px]:inline">Attribuees :</span>
                </span>
                <span className="font-semibold text-emerald-600">{allocatedCount}</span>
              </span>
            </div>,
            navExtraEl,
          )
        : null}

      {/* Sticky container : mini-bar desktop (mobile = portal) */}
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
            Fenetres de vacances
          </span>
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
              onClick={() => setCreating(true)}
            >
              <Plus className="h-3.5 w-3.5 mr-1.5" />
              Nouvelle fenetre
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

      {/* Toolbar filtres */}
      <Card className="p-3 flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-2 flex-1 min-w-[180px]">
          <Search className="h-3.5 w-3.5 text-muted-foreground" />
          <Input placeholder="Rechercher une fenetre…" value={search} onChange={(e) => setSearch(e.target.value)} className="h-8 text-xs" />
        </div>
        <Filter className="h-3.5 w-3.5 text-muted-foreground" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="h-8 w-44 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Actives (non archivees)</SelectItem>
            <SelectItem value="all">Toutes</SelectItem>
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
              {windows.length === 0 ? "Aucune fenetre de selection" : "Aucune fenetre ne correspond aux filtres"}
            </p>
            <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
              {windows.length === 0
                ? "Creez une fenetre pour lancer un cycle de selection (ex : vacances ete 2026). Les employes soumettront leurs preferences avant la date de fermeture."
                : "Modifiez les filtres ou videz la recherche."}
            </p>
            {windows.length === 0 && (
              <Button onClick={() => setCreating(true)} className="mt-4 bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
                <Plus className="h-4 w-4 mr-1.5" />Creer une fenetre
              </Button>
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
  // Auto-expand par défaut quand la fenêtre contient des préférences soumises.
  // L'admin doit voir les actions (approuver/refuser) immédiatement, sans avoir
  // à cliquer sur un chevron caché.
  const [expanded, setExpanded] = useState(() => w.preferences.length > 0);
  const [busy, setBusy] = useState(false);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [simBusy, setSimBusy] = useState(false);
  const status = STATUS_META[w.status] ?? STATUS_META.draft;
  const submittedAdmins = new Set(w.preferences.map((p) => p.adminId)).size;
  const grantedCount = w.preferences.filter((p) => p.status === "granted").length;
  const deniedCount = w.preferences.filter((p) => p.status === "denied").length;
  const phaseIdx = phaseIndex(w.status);
  const remaining = w.status === "open" ? formatRemaining(w.closingDate) : null;
  const openingIn = w.status === "draft" ? formatOpeningIn(w.openingDate) : null;

  const simulate = async () => {
    setSimBusy(true);
    const r = await simulateAllocationAction({ id: w.id });
    setSimBusy(false);
    if (r.success) { setSimulation(r.data); }
    else toast.error(r.error || "Erreur lors de la simulation");
  };

  const setStatus = async (next: "draft" | "open" | "closed" | "in_review" | "allocated" | "archived") => {
    if (busy) return;
    setBusy(true);
    const r = await updateVacationWindowStatusAction({ id: w.id, status: next });
    setBusy(false);
    if (r.success) { toast.success("Statut mis a jour"); onChanged(); }
    else toast.error(r.error || "Erreur");
  };

  const allocate = async () => {
    const ok = await confirm({
      title: "Lancer l'attribution maintenant ?",
      description: "Les LeaveRequest approuvees seront crees pour chaque preference accordee. Cette action est irreversible.",
      variant: "default",
      confirmLabel: "Attribuer",
    });
    if (!ok || busy) return;
    setBusy(true);
    const r = await allocateVacationsAction({ id: w.id });
    setBusy(false);
    if (r.success) {
      toast.success(`Attribution faite : ${r.data.granted} accordees, ${r.data.denied} refusees.`);
      onChanged();
    } else toast.error(r.error || "Erreur lors de l'attribution");
  };

  const remove = async () => {
    const ok = await confirm({
      title: `Supprimer "${w.name}" ?`,
      description: "Toutes les preferences soumises seront perdues. Cette action est definitive.",
      variant: "destructive",
      confirmLabel: "Supprimer",
    });
    if (!ok || busy) return;
    setBusy(true);
    const r = await deleteVacationWindowAction({ id: w.id });
    setBusy(false);
    if (r.success) { toast.success("Fenetre supprimee"); onChanged(); }
    else toast.error(r.error || "Erreur lors de la suppression");
  };

  // P1-12 : annuler l'attribution (revient à closed, supprime LeaveRequest auto-créés)
  const grantedWithLeaves = w.preferences.filter((p) => p.status === "granted" && p.leaveRequestId !== null);
  const affectedEmployees = new Set(grantedWithLeaves.map((p) => p.adminId)).size;
  const unallocate = async () => {
    const ok = await confirm({
      title: "Annuler l'attribution de cette fenêtre ?",
      description: `Cette action supprimera ${grantedWithLeaves.length} congé(s) créé(s) et notifiera ${affectedEmployees} employé(s). La fenêtre repassera en statut "Fermée" pour permettre une nouvelle attribution. Les congés déjà dans une période payée seront refusés.`,
      variant: "destructive",
      confirmLabel: "Continuer",
    });
    if (!ok) return;
    const reason = await promptDialog({
      title: "Raison de l'annulation",
      label: "Motif (requis — notifié aux employés)",
      multiline: true,
      required: true,
      variant: "destructive",
      confirmLabel: "Annuler l'attribution",
    });
    if (!reason) return;
    if (busy) return;
    setBusy(true);
    const r = await unallocateVacationsAction({ windowId: w.id, reason: reason.trim() });
    setBusy(false);
    if (r.success) {
      toast.success(`Attribution annulée : ${r.data.unallocated} préférence(s), ${r.data.deletedLeaves} congé(s) supprimé(s)`);
      onChanged();
    } else toast.error(r.error || "Erreur lors de l'annulation");
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
              <strong>Soumission :</strong>{" "}
              {new Date(w.openingDate).toLocaleDateString("fr-CA")} → {new Date(w.closingDate).toLocaleDateString("fr-CA")}
            </li>
            <li>
              <strong>Couvre :</strong>{" "}
              {new Date(w.coversFrom).toLocaleDateString("fr-CA")} → {new Date(w.coversTo).toLocaleDateString("fr-CA")}
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

          {/* Progress bar phases */}
          <PhaseProgress currentIdx={phaseIdx} />
        </div>
        <div className="flex gap-1 shrink-0 flex-wrap">
          {/* Actions contextuelles selon state */}
          {w.status === "draft" && (
            <>
              <ActionTooltip label="Publier la fenetre — les employes seront notifies">
                <Button size="sm" className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white" disabled={busy} onClick={() => setStatus("open")}>
                  <Play className="h-3 w-3 mr-1" />{busy ? "..." : "Publier"}
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Supprimer la fenetre (brouillon)">
                <Button size="sm" variant="outline" className="h-7 px-2 text-red-700 border-red-200 hover:bg-red-50" disabled={busy} onClick={remove}>
                  <Trash2 className="h-3 w-3" />
                </Button>
              </ActionTooltip>
            </>
          )}
          {w.status === "open" && (
            <>
              <ActionTooltip label="Fermer maintenant (plus de soumissions)">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setStatus("closed")}>
                  <Lock className="h-3 w-3 mr-1" />{busy ? "..." : "Fermer maintenant"}
                </Button>
              </ActionTooltip>
              {submittedAdmins > 0 && (
                <ActionTooltip label="Voir preferences soumises">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setExpanded(true)}>
                    <Eye className="h-3 w-3 mr-1" />{submittedAdmins}
                  </Button>
                </ActionTooltip>
              )}
            </>
          )}
          {w.status === "closed" && (
            <>
              <ActionTooltip label="Simuler l'attribution (preview sans rien creer)">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={simBusy} onClick={simulate}>
                  <FlaskConical className="h-3 w-3 mr-1" />{simBusy ? "..." : "Simuler"}
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Passer en revue (ajuster manuellement)">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setStatus("in_review")}>
                  <Eye className="h-3 w-3 mr-1" />Reviser
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Lancer maintenant l'attribution (irreversible)">
                <Button size="sm" className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white font-semibold" disabled={busy} onClick={allocate}>
                  <Sparkles className="h-3 w-3 mr-1" />{busy ? "..." : "Lancer l'attribution"}
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Rouvrir aux soumissions">
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={busy} onClick={() => setStatus("open")}>
                  <RotateCw className="h-3 w-3" />
                </Button>
              </ActionTooltip>
            </>
          )}
          {w.status === "in_review" && (
            <>
              <ActionTooltip label="Simuler l'attribution (preview sans rien creer)">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={simBusy} onClick={simulate}>
                  <FlaskConical className="h-3 w-3 mr-1" />{simBusy ? "..." : "Simuler"}
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Lancer l'attribution finale (irreversible)">
                <Button size="sm" className="h-7 text-xs bg-[#0F2D52] hover:bg-[#1a3a66] text-white font-semibold" disabled={busy} onClick={allocate}>
                  <Sparkles className="h-3 w-3 mr-1" />{busy ? "..." : "Lancer l'attribution"}
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Retour au statut ferme">
                <Button size="sm" variant="outline" className="h-7 px-2" disabled={busy} onClick={() => setStatus("closed")}>
                  <Lock className="h-3 w-3" />
                </Button>
              </ActionTooltip>
            </>
          )}
          {w.status === "allocated" && (
            <>
              {/* P1-12 : annuler l'attribution (revient à closed) */}
              <ActionTooltip label="Annuler l'attribution : supprime les congés créés et notifie les employés">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 text-xs text-red-700 border-red-200 hover:bg-red-50"
                  disabled={busy}
                  onClick={unallocate}
                >
                  <RotateCcw className="h-3 w-3 mr-1" />{busy ? "..." : "Annuler attribution"}
                </Button>
              </ActionTooltip>
              <ActionTooltip label="Archiver la fenetre (lecture seule)">
                <Button size="sm" variant="outline" className="h-7 text-xs" disabled={busy} onClick={() => setStatus("archived")}>
                  <Archive className="h-3 w-3 mr-1" />Archiver
                </Button>
              </ActionTooltip>
            </>
          )}
          {w.status !== "draft" && w.status !== "allocated" && w.status !== "archived" && (
            <ActionTooltip label="Supprimer cette fenetre">
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
          <ActionTooltip label={expanded ? "Replier" : "Voir les preferences soumises"}>
            <Button size="sm" variant="outline" className="h-7 px-2" onClick={() => setExpanded((v) => !v)}>
              {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </Button>
          </ActionTooltip>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 border-t pt-3">
          {w.preferences.length === 0 ? (
            <p className="text-xs text-muted-foreground italic">Aucune préférence soumise.</p>
          ) : (
            <>
              {/* Bandeau explicatif quand fenêtre OPEN : les actions sont grisées,
                  l'admin doit cliquer "Fermer maintenant" en haut pour débloquer. */}
              {w.status === "open" && (
                <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 flex items-start gap-2">
                  <Lock className="h-3.5 w-3.5 text-amber-700 mt-0.5 shrink-0" />
                  <div className="text-[11px] text-amber-900">
                    <strong>Fenêtre encore ouverte.</strong> Les boutons Accorder/Refuser sont désactivés tant que la période de soumission n'est pas fermée (pour équité entre employés).
                    <br />
                    Cliquez sur <strong>Fermer maintenant</strong> en haut pour stopper les soumissions et débloquer l'attribution, ou attendez la date de clôture automatique.
                  </div>
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
              Apercu de ce qui sera attribue. Aucun congé n&apos;est créé tant que vous ne lancez pas l&apos;attribution réelle.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg border bg-emerald-50/50 border-emerald-200 p-3">
              <div className="flex items-center gap-1.5 text-emerald-800">
                <CheckCircle2 className="h-4 w-4" />
                <span className="text-[10px] uppercase tracking-wider font-bold">Accordees</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-emerald-800 mt-1">{result.granted.length}</p>
            </div>
            <div className="rounded-lg border bg-red-50/50 border-red-200 p-3">
              <div className="flex items-center gap-1.5 text-red-800">
                <XCircle className="h-4 w-4" />
                <span className="text-[10px] uppercase tracking-wider font-bold">Refusees</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-red-800 mt-1">{result.denied.length}</p>
            </div>
            <div className="rounded-lg border bg-amber-50/50 border-amber-200 p-3">
              <div className="flex items-center gap-1.5 text-amber-800">
                <AlertTriangle className="h-4 w-4" />
                <span className="text-[10px] uppercase tracking-wider font-bold">Conflits</span>
              </div>
              <p className="text-2xl font-bold tabular-nums text-amber-800 mt-1">{result.conflicts.length}</p>
            </div>
          </div>

          {result.granted.length > 0 && (
            <div>
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-emerald-800 mb-1.5">Accordees</h4>
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
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-red-800 mb-1.5">Refusees</h4>
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
              <h4 className="text-[11px] uppercase tracking-wider font-bold text-amber-800 mb-1.5">Conflits d&apos;effectif</h4>
              <ul className="divide-y border rounded text-xs">
                {result.conflicts.map((c, i) => (
                  <li key={i} className="px-3 py-1.5 text-muted-foreground">{c.reason}</li>
                ))}
              </ul>
            </div>
          )}

          {result.granted.length === 0 && result.denied.length === 0 && (
            <p className="text-center text-xs text-muted-foreground italic py-6">
              Aucune preference soumise dans cette fenetre.
            </p>
          )}
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={committing}>Fermer (sans attribuer)</Button>
          <Button
            onClick={async () => { setCommitting(true); await onConfirm(); setCommitting(false); }}
            disabled={committing || result.granted.length === 0}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            <Sparkles className="h-4 w-4 mr-1.5" />{committing ? "Attribution en cours..." : "Confirmer l'attribution reelle"}
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
  const tc = useTranslations("common");
  // Groupe par employe
  const byAdmin = new Map<number, { admin: Preference["admin"]; prefs: Preference[] }>();
  for (const p of preferences) {
    if (!byAdmin.has(p.adminId)) byAdmin.set(p.adminId, { admin: p.admin, prefs: [] });
    byAdmin.get(p.adminId)!.prefs.push(p);
  }
  // Edition manuelle uniquement quand fenetre fermee/en revue (pas allocated)
  const canEdit = windowStatus === "closed" || windowStatus === "in_review";
  const isAllocated = windowStatus === "allocated";
  // P1-2 : afficher la colonne actions meme si !canEdit avec boutons grises
  const showActionsCol = canEdit || windowStatus === "open" || isAllocated;
  const [busyId, setBusyId] = useState<number | null>(null);

  const setStatus = async (prefId: number, status: "granted" | "denied" | "pending") => {
    setBusyId(prefId);
    const r = await updateVacationPreferenceAction({ id: prefId, status });
    setBusyId(null);
    if (r.success) {
      toast.success(status === "granted" ? "Preference accordee" : status === "denied" ? "Preference refusee" : "Statut reinitialise");
      onChanged?.();
    } else {
      toast.error(r.error || "Erreur");
    }
  };

  const cols = showActionsCol
    ? "grid-cols-[1fr_50px_1.2fr_50px_70px_auto]"
    : "grid-cols-[1fr_60px_1fr_60px_80px]";

  return (
    <div className="divide-y text-xs">
      <div className={`grid ${cols} gap-2 py-1 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground`}>
        <div>Employe</div>
        <div>Rang</div>
        <div>Periode</div>
        <div className="text-right">Jours</div>
        <div className="text-right">{tc("status")}</div>
        {showActionsCol && <div className="text-right">{tc("actions")}</div>}
      </div>
      {Array.from(byAdmin.values()).map(({ admin, prefs }) =>
        prefs.map((p) => (
          <div key={p.id} className={`grid ${cols} gap-2 py-1.5 items-center`}>
            <div className="truncate font-medium">{admin.fullName || admin.email}</div>
            <div className="text-[#0F2D52] font-bold">#{p.rank}</div>
            <div className="text-muted-foreground tabular-nums">
              {new Date(p.startDate).toLocaleDateString("fr-CA")} → {new Date(p.endDate).toLocaleDateString("fr-CA")}
            </div>
            <div className="text-right tabular-nums">{Number(p.daysCount)}</div>
            <div className="text-right">
              <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${
                p.status === "granted" ? "bg-emerald-50 text-emerald-800 border-emerald-200"
                : p.status === "denied" ? "bg-red-50 text-red-800 border-red-200"
                : "bg-amber-50 text-amber-800 border-amber-200"
              }`}>
                {p.status === "granted" ? "Accordee" : p.status === "denied" ? "Refusee" : "En attente"}
              </span>
            </div>
            {showActionsCol && (
              <div className="flex justify-end gap-1">
                {/* P1-3 : pref granted avec leaveRequestId → lien "Voir le congé" */}
                {isAllocated && p.status === "granted" && p.leaveRequestId && (
                  <ActionTooltip label="Voir le congé créé pour cet employé">
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
                      ? "Accorder cette preference (cree un conge approuve)"
                      : "Disponible une fois la fenetre fermee"}
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
                      ? "Refuser cette preference"
                      : "Disponible une fois la fenetre fermee"}
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
                      ? "Reinitialiser en attente"
                      : "Disponible une fois la fenetre fermee"}
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
  const tc = useTranslations("common");
  const [name, setName] = useState("Vacances ete 2026");
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
      toast.error("Tous les champs sont obligatoires.");
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
    if (r.success) { toast.success("Fenetre creee (brouillon)"); onSaved(); }
    else toast.error(r.error || "");
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg p-0 overflow-hidden flex flex-col max-h-[90vh]">
        <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white px-5 py-4 shrink-0">
          <DialogHeader className="space-y-1">
            <DialogTitle className="text-base text-white flex items-center gap-2">
              <CalendarRange className="h-4 w-4" />Nouvelle fenetre de selection
            </DialogTitle>
            <DialogDescription className="text-white/80 text-xs">
              Les employes soumettent leurs preferences entre les dates de soumission ; vous lancez l&apos;attribution ensuite.
            </DialogDescription>
          </DialogHeader>
        </div>
        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <FormSection icon={CalendarRange} title="Identite">
            <Field label="Nom" required>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Vacances ete 2026" />
            </Field>
          </FormSection>

          <FormSection icon={CalendarRange} title="Periode de soumission">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Ouverture" required>
                <DatePopover value={opening} onChange={setOpening} />
              </Field>
              <Field label="Fermeture" required>
                <DatePopover value={closing} onChange={setClosing} min={opening} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={CalendarRange} title="Periode couverte (vacances visees)">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Du" required>
                <DatePopover value={coversFrom} onChange={setCoversFrom} />
              </Field>
              <Field label="Au" required>
                <DatePopover value={coversTo} onChange={setCoversTo} min={coversFrom} />
              </Field>
            </div>
          </FormSection>

          <FormSection icon={CalendarRange} title="Regles">
            <div className="grid grid-cols-2 gap-3">
              <Field label="Max jours/employe">
                <Input type="number" value={maxDays} onChange={(e) => setMaxDays(Number(e.target.value))} min={1} max={60} />
              </Field>
              <Field label="Methode d'attribution">
                <Select value={method} onValueChange={(v) => setMethod(v as "seniority" | "seniority_multi_round" | "fcfs" | "manual")}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="seniority">Anciennete (1→3 sequentiel)</SelectItem>
                    <SelectItem value="seniority_multi_round">Anciennete (multi-rondes CHU)</SelectItem>
                    <SelectItem value="fcfs">Premier arrive (FCFS)</SelectItem>
                    <SelectItem value="manual">Manuel</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FormSection>

          <FormSection icon={CalendarRange} title="Notes (optionnel)">
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-y"
              placeholder="Informations affichees aux employes"
              maxLength={500}
            />
          </FormSection>
        </div>
        <DialogFooter className="px-5 py-3 border-t bg-muted/30 shrink-0">
          <Button variant="outline" onClick={onClose} disabled={pending}>{tc("cancel")}</Button>
          <Button onClick={submit} disabled={pending} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white">
            {pending ? "Creation..." : "Creer (brouillon)"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

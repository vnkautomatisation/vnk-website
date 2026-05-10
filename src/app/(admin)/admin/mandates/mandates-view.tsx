"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase, Play, Clock, CheckCircle2, Plus, Search,
  Eye, Pencil, Trash2, SlidersHorizontal, X, CheckSquare,
  Pause, RotateCcw, FileText, Calendar, DollarSign, ClipboardList,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { StatCard } from "@/components/admin/stat-card";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormSection } from "@/components/admin/client-form-fields";
import { cn, formatDate } from "@/lib/utils";

// Slider HTML natif stylise VNK navy (evite dependance radix-slider)
function ProgressSlider({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <input
      type="range"
      min={0} max={100} step={5}
      value={value}
      onChange={(e) => onChange(Number(e.target.value))}
      className="w-full h-2 rounded-full appearance-none cursor-pointer bg-muted accent-[#0F2D52]"
      style={{ background: `linear-gradient(to right, #0F2D52 0%, #0F2D52 ${value}%, hsl(var(--muted)) ${value}%, hsl(var(--muted)) 100%)` }}
    />
  );
}

type Mandate = {
  id: number;
  clientId: number;
  clientName: string;
  companyName: string | null;
  title: string;
  description: string | null;
  serviceType: string | null;
  status: string;
  progress: number;
  notes: string | null;
  startDate: string | null;
  endDate: string | null;
  estimatedHours: number | null;
  actualHours: number | null;
  hourlyRate: number | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type StatusFilter = "all" | "active" | "in_progress" | "pending" | "completed" | "paused" | "cancelled";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "active", label: "En cours" },
  { key: "pending", label: "En attente" },
  { key: "completed", label: "Complétés" },
  { key: "paused", label: "En pause" },
  { key: "cancelled", label: "Annulés" },
];

const SERVICE_TYPES = [
  { value: "plc-support", label: "Support PLC" },
  { value: "audit", label: "Audit technique" },
  { value: "documentation", label: "Documentation" },
  { value: "refactoring", label: "Refactorisation" },
  { value: "modernization", label: "Modernisation" },
  { value: "training", label: "Formation" },
];

// Labels FR pour affichage utilisateur (pas l'identifiant brut comme "in_progress")
const STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  active: "Actif",
  in_progress: "En cours",
  completed: "Complété",
  paused: "En pause",
  cancelled: "Annulé",
};

export function MandatesView({
  mandates,
  clients,
  counts,
}: {
  mandates: Mandate[];
  clients: ClientOption[];
  counts: { active: number; pending: number; completed: number; total: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [view, setView] = useViewMode("mandates", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Filtres avances
  const [filterClients, setFilterClients] = useState<Set<number>>(new Set());
  const [filterServices, setFilterServices] = useState<Set<string>>(new Set());
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Edit modal
  const [editMandate, setEditMandate] = useState<Mandate | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editService, setEditService] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editProgress, setEditProgress] = useState(0);
  const [editDesc, setEditDesc] = useState("");
  const [editStart, setEditStart] = useState("");
  const [editEnd, setEditEnd] = useState("");
  const [editEstimatedHours, setEditEstimatedHours] = useState("");
  const [editActualHours, setEditActualHours] = useState("");
  const [editHourlyRate, setEditHourlyRate] = useState("");
  const [editNotes, setEditNotes] = useState("");

  // Delete
  const [deleteMandate, setDeleteMandate] = useState<Mandate | null>(null);

  // ── Creation form ────────────────────────────────────
  const [newClientId, setNewClientId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newService, setNewService] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newEstimatedHours, setNewEstimatedHours] = useState("");
  const [newHourlyRate, setNewHourlyRate] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Auto-ouvrir creation depuis ?newFor=<id>
  useEffect(() => {
    const newFor = searchParams.get("newFor");
    if (newFor && clients.some((c) => String(c.id) === newFor)) {
      setNewClientId(newFor);
      setCreateOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("newFor");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, clients]);

  const resetForm = () => {
    setNewClientId(""); setNewTitle(""); setNewService(""); setNewDesc("");
    setNewStart(""); setNewEnd(""); setNewEstimatedHours(""); setNewHourlyRate(""); setNewNotes("");
  };

  const openEdit = (m: Mandate) => {
    setEditMandate(m);
    setEditTitle(m.title);
    setEditService(m.serviceType ?? "");
    setEditStatus(m.status);
    setEditProgress(m.progress);
    setEditDesc(m.description ?? "");
    setEditStart(m.startDate ? m.startDate.slice(0, 10) : "");
    setEditEnd(m.endDate ? m.endDate.slice(0, 10) : "");
    setEditEstimatedHours(m.estimatedHours != null ? String(m.estimatedHours) : "");
    setEditActualHours(m.actualHours != null ? String(m.actualHours) : "");
    setEditHourlyRate(m.hourlyRate != null ? String(m.hourlyRate) : "");
    setEditNotes(m.notes ?? "");
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newTitle.trim()) return { success: false, error: "Client et titre requis" };
    try {
      const res = await fetch("/api/mandates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(newClientId),
          title: newTitle.trim(),
          serviceType: newService || undefined,
          description: newDesc.trim() || undefined,
          startDate: newStart || undefined,
          endDate: newEnd || undefined,
          estimatedHours: newEstimatedHours ? Number(newEstimatedHours) : undefined,
          hourlyRate: newHourlyRate ? Number(newHourlyRate) : undefined,
          notes: newNotes.trim() || undefined,
        }),
      });
      if (res.ok) { resetForm(); router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur réseau" }; }
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editMandate || !editTitle.trim()) return { success: false, error: "Titre requis" };
    try {
      const res = await fetch(`/api/mandates/${editMandate.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          serviceType: editService || undefined,
          status: editStatus,
          progress: editProgress,
          description: editDesc.trim() || undefined,
          startDate: editStart || undefined,
          endDate: editEnd || undefined,
          estimatedHours: editEstimatedHours ? Number(editEstimatedHours) : null,
          actualHours: editActualHours ? Number(editActualHours) : null,
          hourlyRate: editHourlyRate ? Number(editHourlyRate) : null,
          notes: editNotes.trim() || null,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur réseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteMandate) return;
    const res = await fetch(`/api/mandates/${deleteMandate.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Mandat supprimé"); setDeleteMandate(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur lors de la suppression"); }
  };

  // ── Quick actions (status transitions) ────────────────
  const updateStatus = async (m: Mandate, newStatus: string, label: string) => {
    const frStatus = STATUS_LABELS[newStatus] ?? newStatus;
    const isDestructive = newStatus === "cancelled";
    const ok = await confirm({
      title: `${label} ce mandat ?`,
      description: `"${m.title}" passera au statut « ${frStatus} ».`,
      confirmLabel: label,
      variant: isDestructive ? "destructive" : "default",
    });
    if (!ok) return;
    const res = await fetch(`/api/mandates/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus, ...(newStatus === "completed" ? { progress: 100 } : {}) }),
    });
    if (res.ok) { toast.success(`Mandat ${label.toLowerCase()}`); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  // ── Filtrage ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = mandates;
    if (statusFilter !== "all") {
      if (statusFilter === "active") {
        result = result.filter((m) => m.status === "active" || m.status === "in_progress");
      } else {
        result = result.filter((m) => m.status === statusFilter);
      }
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((m) =>
        m.title.toLowerCase().includes(q) ||
        m.clientName.toLowerCase().includes(q) ||
        m.companyName?.toLowerCase().includes(q) ||
        m.serviceType?.toLowerCase().includes(q)
      );
    }
    if (filterClients.size > 0) result = result.filter((m) => filterClients.has(m.clientId));
    if (filterServices.size > 0) result = result.filter((m) => m.serviceType && filterServices.has(m.serviceType));
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter((m) => new Date(m.createdAt).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86400000;
      result = result.filter((m) => new Date(m.createdAt).getTime() <= to);
    }
    return result;
  }, [mandates, statusFilter, searchQuery, filterClients, filterServices, filterDateFrom, filterDateTo]);

  const totalActiveFilters =
    (filterClients.size > 0 ? 1 : 0) +
    (filterServices.size > 0 ? 1 : 0) +
    (filterDateFrom ? 1 : 0) +
    (filterDateTo ? 1 : 0);

  const clearAllFilters = () => {
    setFilterClients(new Set());
    setFilterServices(new Set());
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  // ── Bulk archive (delete) ─────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} mandat(s) ?`,
      description: "Les mandats sans devis/contrats/factures seront supprimés. Les autres seront ignorés (409).",
      confirmLabel: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    const ids = Array.from(selectedIds);
    let success = 0, blocked = 0;
    for (const id of ids) {
      const res = await fetch(`/api/mandates/${id}`, { method: "DELETE" });
      if (res.ok) success++; else if (res.status === 409) blocked++;
    }
    toast.success(`${success}/${ids.length} supprimé(s)${blocked > 0 ? ` · ${blocked} bloqué(s) (enfants liés)` : ""}`);
    setSelectedIds(new Set());
    router.refresh();
  };

  const toggleSelectId = (id: number) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    setSelectedIds(set);
  };
  const toggleSelectAll = (allIds: number[]) => {
    if (allIds.every((id) => selectedIds.has(id))) setSelectedIds(new Set());
    else setSelectedIds(new Set(allIds));
  };

  // Actions menu pour EntityCard et table
  const getActions = useCallback((m: Mandate) => {
    const actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; variant?: "destructive" }> = [
      { label: "Voir le détail", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("mandate", m.id) },
      { label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(m) },
    ];
    // Quick actions selon statut
    if (m.status === "active" || m.status === "in_progress") {
      actions.push({ label: "Mettre en pause", icon: <Pause className="h-3.5 w-3.5" />, onClick: () => updateStatus(m, "paused", "Mettre en pause") });
      actions.push({ label: "Marquer terminé", icon: <CheckCircle2 className="h-3.5 w-3.5" />, onClick: () => updateStatus(m, "completed", "Marquer terminé") });
    } else if (m.status === "paused") {
      actions.push({ label: "Reprendre", icon: <Play className="h-3.5 w-3.5" />, onClick: () => updateStatus(m, "in_progress", "Reprendre") });
    } else if (m.status === "pending") {
      actions.push({ label: "Démarrer", icon: <Play className="h-3.5 w-3.5" />, onClick: () => updateStatus(m, "in_progress", "Démarrer") });
    }
    if (m.status !== "cancelled" && m.status !== "completed") {
      actions.push({ label: "Annuler", icon: <RotateCcw className="h-3.5 w-3.5" />, onClick: () => updateStatus(m, "cancelled", "Annuler") });
    }
    actions.push({ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteMandate(m), separator: true, variant: "destructive" as const });
    return actions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity]);

  // ── Colonnes ──────────────────────────────────────────
  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const columns: Column<Mandate>[] = [
    {
      key: "select",
      header: <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(allFilteredIds)} aria-label="Tout sélectionner" />,
      accessor: (r) => (
        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelectId(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Sélectionner ${r.title}`} />
      ),
    },
    {
      key: "client", header: "Client",
      accessor: (r) => (
        <div className="text-left">
          <div className="font-medium text-sm">{r.clientName}</div>
          {r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.clientName,
    },
    {
      key: "title", header: "Titre",
      accessor: (r) => <span className="font-medium text-sm">{r.title}</span>,
      sortable: true, sortBy: (r) => r.title,
    },
    {
      key: "service", header: "Service",
      accessor: (r) => r.serviceType ? SERVICE_TYPES.find((s) => s.value === r.serviceType)?.label ?? r.serviceType : "—",
      hiddenOnMobile: true,
    },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "progress", header: "Progression",
      accessor: (r) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className={cn("h-full transition-all", r.progress >= 100 ? "bg-emerald-500" : "bg-[#0F2D52]")} style={{ width: `${r.progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground tabular-nums">{r.progress}%</span>
        </div>
      ),
      sortable: true, sortBy: (r) => r.progress, hiddenOnMobile: true,
    },
    { key: "start", header: "Début", accessor: (r) => r.startDate ? formatDate(new Date(r.startDate)) : "—", hiddenOnMobile: true },
    { key: "end", header: "Fin est.", accessor: (r) => r.endDate ? formatDate(new Date(r.endDate)) : "—", hiddenOnMobile: true },
    {
      key: "actions",
      header: "",
      accessor: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors" aria-label="Actions">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {getActions(r).map((a, i) => (
                <div key={i}>
                  {a.separator && i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem
                    onSelect={() => a.onClick()}
                    className={a.variant === "destructive" ? "text-destructive" : ""}
                  >
                    <span className="mr-2">{a.icon}</span>
                    {a.label}
                  </DropdownMenuItem>
                </div>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* Hero header navy VNK */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Briefcase className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Mandats</h1>
              <p className="text-white/70 text-sm mt-0.5">Créer, suivre et mettre à jour la progression</p>
            </div>
          </div>
          <Button
            className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
            onClick={() => { resetForm(); setCreateOpen(true); }}
          >
            <Plus className="h-4 w-4" />Nouveau mandat
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="En cours" value={counts.active} icon={Play} accent="bg-blue-500" />
        <StatCard label="En attente" value={counts.pending} icon={Clock} accent="bg-amber-500" />
        <StatCard label="Complétés" value={counts.completed} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatCard label="Total" value={counts.total} icon={Briefcase} accent="bg-violet-500" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Client, titre, service..." className="pl-9" />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>

        {/* Filtres avances */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtres</span>
              {totalActiveFilters > 0 && <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{totalActiveFilters}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] max-w-[calc(100vw-2rem)] p-3 space-y-3" align="end">
            {clients.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Client</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {clients.map((c) => {
                    const isOn = filterClients.has(c.id);
                    return (
                      <button key={c.id} type="button"
                        onClick={() => {
                          const set = new Set(filterClients);
                          if (isOn) set.delete(c.id); else set.add(c.id);
                          setFilterClients(set);
                        }}
                        className={cn("px-2 py-0.5 rounded-full border text-[10px] transition-colors",
                          isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted")}
                      >{c.fullName}</button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type de service</p>
              <div className="flex flex-wrap gap-1">
                {SERVICE_TYPES.map((s) => {
                  const isOn = filterServices.has(s.value);
                  return (
                    <button key={s.value} type="button"
                      onClick={() => {
                        const set = new Set(filterServices);
                        if (isOn) set.delete(s.value); else set.add(s.value);
                        setFilterServices(set);
                      }}
                      className={cn("px-2 py-0.5 rounded-full border text-[10px] transition-colors",
                        isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted")}
                    >{s.label}</button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Période de création</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-xs" />
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            {totalActiveFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full text-xs">
                <X className="h-3 w-3 mr-1" />Effacer les filtres
              </Button>
            )}
          </PopoverContent>
        </Popover>

        <ViewToggle storageKey="mandates" defaultView="list" onChange={setView} />
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg border-2 border-[#0F2D52] bg-[#0F2D52]/5 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[#0F2D52]" />
            <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />Annuler
            </Button>
            <Button size="sm" variant="destructive" onClick={handleBulkDelete}>
              <Trash2 className="h-3.5 w-3.5 mr-1" />Supprimer tous
            </Button>
          </div>
        </div>
      )}

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((m) => (
            <EntityCard
              key={m.id}
              title={m.title}
              subtitle={m.clientName}
              avatarName={m.clientName}
              badges={[
                { label: m.status === "active" || m.status === "in_progress" ? "En cours" : m.status === "completed" ? "Complété" : m.status === "pending" ? "En attente" : m.status === "paused" ? "En pause" : m.status === "cancelled" ? "Annulé" : m.status, variant: m.status === "active" || m.status === "in_progress" ? "secondary" : "outline" },
                ...(m.serviceType ? [{ label: SERVICE_TYPES.find((s) => s.value === m.serviceType)?.label ?? m.serviceType, variant: "outline" as const }] : []),
              ]}
              stats={[{ label: "Progression", value: `${m.progress}%` }]}
              actions={getActions(m)}
              onClick={() => openEntity("mandate", m.id)}
              footer={
                <div className="space-y-1.5">
                  <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
                    <div className={cn("h-full transition-all", m.progress >= 100 ? "bg-emerald-500" : "bg-[#0F2D52]")} style={{ width: `${m.progress}%` }} />
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{m.startDate ? formatDate(new Date(m.startDate)) : "Pas de début"}</span>
                    <span>{m.endDate ? formatDate(new Date(m.endDate)) : "Pas de fin"}</span>
                  </div>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun mandat trouvé</div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => openEntity("mandate", r.id)}
          searchPlaceholder="Rechercher..."
          exportFilename="mandats"
          storageKey="admin-mandates"
        />
      )}

      {/* Modale creation */}
      <MandateFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        clients={clients}
        loading={false}
        values={{
          clientId: newClientId, title: newTitle, service: newService, status: "pending", progress: 0,
          desc: newDesc, start: newStart, end: newEnd, estimatedHours: newEstimatedHours, actualHours: "", hourlyRate: newHourlyRate, notes: newNotes,
        }}
        setters={{
          setClientId: setNewClientId, setTitle: setNewTitle, setService: setNewService, setStatus: () => {}, setProgress: () => {},
          setDesc: setNewDesc, setStart: setNewStart, setEnd: setNewEnd,
          setEstimatedHours: setNewEstimatedHours, setActualHours: () => {},
          setHourlyRate: setNewHourlyRate, setNotes: setNewNotes,
        }}
        onSubmit={handleCreate}
      />

      {/* Modale edition */}
      <MandateFormDialog
        open={!!editMandate}
        onOpenChange={(o) => { if (!o) setEditMandate(null); }}
        mode="edit"
        clients={clients}
        clientName={editMandate?.clientName}
        loading={false}
        values={{
          clientId: editMandate?.clientId ? String(editMandate.clientId) : "",
          title: editTitle, service: editService, status: editStatus, progress: editProgress,
          desc: editDesc, start: editStart, end: editEnd,
          estimatedHours: editEstimatedHours, actualHours: editActualHours, hourlyRate: editHourlyRate, notes: editNotes,
        }}
        setters={{
          setClientId: () => {}, setTitle: setEditTitle, setService: setEditService,
          setStatus: setEditStatus, setProgress: setEditProgress,
          setDesc: setEditDesc, setStart: setEditStart, setEnd: setEditEnd,
          setEstimatedHours: setEditEstimatedHours, setActualHours: setEditActualHours,
          setHourlyRate: setEditHourlyRate, setNotes: setEditNotes,
        }}
        onSubmit={handleEdit}
      />

      {/* Confirmation suppression */}
      <ConfirmDialog
        open={!!deleteMandate}
        onOpenChange={(o) => { if (!o) setDeleteMandate(null); }}
        title="Supprimer ce mandat ?"
        description={`Le mandat "${deleteMandate?.title}" sera supprimé. Cette action est irréversible.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      {ConfirmModal}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// MandateFormDialog — modal create/edit unifie avec theme VNK navy
// ─────────────────────────────────────────────────────────────────
type MFormValues = {
  clientId: string; title: string; service: string; status: string; progress: number;
  desc: string; start: string; end: string;
  estimatedHours: string; actualHours: string; hourlyRate: string; notes: string;
};
type MFormSetters = {
  setClientId: (v: string) => void; setTitle: (v: string) => void; setService: (v: string) => void;
  setStatus: (v: string) => void; setProgress: (v: number) => void;
  setDesc: (v: string) => void; setStart: (v: string) => void; setEnd: (v: string) => void;
  setEstimatedHours: (v: string) => void; setActualHours: (v: string) => void;
  setHourlyRate: (v: string) => void; setNotes: (v: string) => void;
};

function MandateFormDialog({
  open, onOpenChange, mode, clients, clientName, loading, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  clients: ClientOption[];
  clientName?: string;
  loading: boolean;
  values: MFormValues;
  setters: MFormSetters;
  onSubmit: () => Promise<{ success: boolean; error?: string }>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isCreate = mode === "create";

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await onSubmit();
      if (result.success) {
        toast.success(isCreate ? "Mandat créé avec succès" : "Mandat mis à jour");
        onOpenChange(false);
      } else {
        toast.error(result.error || "Une erreur est survenue");
      }
    } finally { setSubmitting(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header navy gradient */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isCreate ? <Briefcase className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white text-lg">
                {isCreate ? "Nouveau mandat" : "Modifier le mandat"}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {isCreate ? "Créer un mandat pour un client" : (clientName || "Modification du mandat")}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          {loading ? (
            <div className="text-center py-12 text-sm text-muted-foreground">Chargement…</div>
          ) : (
            <>
              <FormSection title="Identité" icon={<FileText className="h-3.5 w-3.5" />}>
                {isCreate && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client *</Label>
                    <Select value={values.clientId} onValueChange={setters.setClientId}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner un client" /></SelectTrigger>
                      <SelectContent>
                        {clients.map((c) => (
                          <SelectItem key={c.id} value={String(c.id)}>
                            {c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Titre *</Label>
                  <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder="Titre du mandat" />
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type de service</Label>
                    <Select value={values.service} onValueChange={setters.setService}>
                      <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                      <SelectContent>
                        {SERVICE_TYPES.map((s) => (
                          <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  {!isCreate && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Statut</Label>
                      <Select value={values.status} onValueChange={setters.setStatus}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="pending">En attente</SelectItem>
                          <SelectItem value="active">Actif</SelectItem>
                          <SelectItem value="in_progress">En cours</SelectItem>
                          <SelectItem value="completed">Complété</SelectItem>
                          <SelectItem value="paused">En pause</SelectItem>
                          <SelectItem value="cancelled">Annulé</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
                  <Textarea value={values.desc} onChange={(e) => setters.setDesc(e.target.value)} rows={3} placeholder="Détails du mandat…" />
                </div>
                {!isCreate && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                      <span>Progression</span>
                      <span className="text-[#0F2D52] font-bold tabular-nums">{values.progress}%</span>
                    </Label>
                    <ProgressSlider value={values.progress} onChange={setters.setProgress} />
                  </div>
                )}
              </FormSection>

              <FormSection title="Planification" icon={<Calendar className="h-3.5 w-3.5" />}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date début</Label>
                    <Input type="date" value={values.start} onChange={(e) => setters.setStart(e.target.value)} />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date fin estimée</Label>
                    <Input type="date" value={values.end} onChange={(e) => setters.setEnd(e.target.value)} />
                  </div>
                </div>
              </FormSection>

              <FormSection title="Estimations" icon={<DollarSign className="h-3.5 w-3.5" />}>
                <div className="grid sm:grid-cols-3 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Heures estimées</Label>
                    <Input type="number" min="0" step="0.5" value={values.estimatedHours} onChange={(e) => setters.setEstimatedHours(e.target.value)} placeholder="40" />
                  </div>
                  {!isCreate && (
                    <div className="space-y-2">
                      <Label className="text-xs uppercase tracking-wider text-muted-foreground">Heures réelles</Label>
                      <Input type="number" min="0" step="0.25" value={values.actualHours} onChange={(e) => setters.setActualHours(e.target.value)} placeholder="0" />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Taux horaire ($)</Label>
                    <Input type="number" min="0" step="5" value={values.hourlyRate} onChange={(e) => setters.setHourlyRate(e.target.value)} placeholder="125" />
                  </div>
                </div>
                {values.estimatedHours && values.hourlyRate && (
                  <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-2.5 space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Total estimé</span>
                      <span className="font-bold text-[#0F2D52] tabular-nums">
                        {(Number(values.estimatedHours) * Number(values.hourlyRate)).toFixed(2)} $
                      </span>
                    </div>
                    {!isCreate && values.actualHours && (
                      <div className="flex items-center justify-between border-t pt-1">
                        <span className="text-muted-foreground">Total facturable réel</span>
                        <span className="font-bold text-emerald-600 tabular-nums">
                          {(Number(values.actualHours) * Number(values.hourlyRate)).toFixed(2)} $
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </FormSection>

              <FormSection title="Notes internes" icon={<ClipboardList className="h-3.5 w-3.5" />}>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes (privées)</Label>
                  <Textarea value={values.notes} onChange={(e) => setters.setNotes(e.target.value)} rows={3} placeholder="Notes privées, jamais visibles par le client…" className="bg-amber-50/30" />
                </div>
              </FormSection>
            </>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading || !values.title.trim() || (isCreate && !values.clientId)}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {submitting ? "Enregistrement…" : (isCreate ? "Créer le mandat" : "Enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

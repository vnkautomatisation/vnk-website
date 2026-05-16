"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Inbox, Search, Sparkles, Loader2, CheckCircle2, AlertTriangle,
  Eye, Trash2, SlidersHorizontal, X, CheckSquare, MoreHorizontal,
  Briefcase, FileText, Play, Lock, Cpu,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatCard } from "@/components/admin/stat-card";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { useConfirm } from "@/hooks/use-confirm";
import { cn, formatDate } from "@/lib/utils";

type Request = {
  id: number;
  clientId: number;
  clientName: string;
  companyName: string | null;
  title: string;
  description: string;
  serviceType: string | null;
  urgency: string;
  status: string;
  plcBrand: string | null;
  budgetRange: string | null;
  convertedToMandateId: number | null;
  convertedToQuoteId: number | null;
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "all" | "new" | "in_progress" | "converted" | "closed";
type UrgencyFilter = "all" | "normal" | "urgent" | "critical";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "new", label: "Nouvelles" },
  { key: "in_progress", label: "En traitement" },
  { key: "converted", label: "Converties" },
  { key: "closed", label: "Fermées" },
];

const URGENCY_LABELS: Record<string, string> = {
  normal: "Normal",
  urgent: "Urgent",
  critical: "Critique",
};

const URGENCY_COLORS: Record<string, string> = {
  normal: "bg-blue-100 text-blue-700 border-blue-200",
  urgent: "bg-amber-100 text-amber-700 border-amber-200",
  critical: "bg-red-100 text-red-700 border-red-200",
};

const SERVICE_LABELS: Record<string, string> = {
  "plc-support": "Support PLC",
  "plc-programming": "Programmation PLC",
  "scada": "SCADA",
  "hmi": "Interface HMI",
  "web-development": "Développement web",
  "automation": "Automatisation",
  "consulting": "Consultation",
  "maintenance": "Maintenance",
};

export function RequestsView({
  requests,
  kpis,
}: {
  requests: Request[];
  kpis: { total: number; newCount: number; inProgress: number; converted: number; criticalCount: number };
}) {
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();
  const { confirm, ConfirmModal } = useConfirm();
  const [view, setView] = useViewMode("requests", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filtres avances
  const [filterUrgencies, setFilterUrgencies] = useState<Set<string>>(new Set());
  const [filterServices, setFilterServices] = useState<Set<string>>(new Set());
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Sticky scroll detection (pattern dashboard finance)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Listes distinctes
  const availableServices = useMemo(() => {
    const set = new Set<string>();
    for (const r of requests) if (r.serviceType) set.add(r.serviceType);
    return Array.from(set).sort();
  }, [requests]);

  const filtered = useMemo(() => {
    let result = requests;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.title.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.serviceType ?? "").toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q) ||
        (r.plcBrand ?? "").toLowerCase().includes(q)
      );
    }
    if (filterUrgencies.size > 0) result = result.filter((r) => filterUrgencies.has(r.urgency));
    if (filterServices.size > 0) result = result.filter((r) => r.serviceType && filterServices.has(r.serviceType));
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86400000;
      result = result.filter((r) => new Date(r.createdAt).getTime() <= to);
    }
    return result;
  }, [requests, statusFilter, searchQuery, filterUrgencies, filterServices, filterDateFrom, filterDateTo]);

  const totalActiveFilters =
    (filterUrgencies.size > 0 ? 1 : 0) +
    (filterServices.size > 0 ? 1 : 0) +
    (filterDateFrom ? 1 : 0) +
    (filterDateTo ? 1 : 0);

  const clearAllFilters = () => {
    setFilterUrgencies(new Set());
    setFilterServices(new Set());
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  // ── Actions API ──────────────────────────────────────
  const updateStatus = async (r: Request, newStatus: string, label: string) => {
    const ok = await confirm({
      title: `${label} cette demande ?`,
      description: `"${r.title}" passera au statut « ${newStatus === "in_progress" ? "En traitement" : newStatus === "closed" ? "Fermée" : newStatus} ».`,
      confirmLabel: label,
      variant: newStatus === "closed" ? "destructive" : "default",
    });
    if (!ok) return;
    const res = await fetch(`/api/project-requests/${r.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: newStatus }),
    });
    if (res.ok) { toast.success(`Demande ${label.toLowerCase()}`); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleDelete = async (r: Request) => {
    const ok = await confirm({
      title: "Supprimer cette demande ?",
      description: `"${r.title}" sera supprimée définitivement.`,
      confirmLabel: "Supprimer",
      variant: "destructive",
    });
    if (!ok) return;
    const res = await fetch(`/api/project-requests/${r.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Demande supprimée"); router.refresh(); }
    else { toast.error("Erreur"); }
  };

  // ── Bulk actions ─────────────────────────────────────
  const handleBulkClose = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Fermer ${selectedIds.size} demande(s) ?`,
      description: "Les demandes sélectionnées passeront au statut « Fermée ».",
      confirmLabel: "Fermer tous",
      variant: "destructive",
    });
    if (!ok) return;
    const ids = Array.from(selectedIds);
    let success = 0;
    for (const id of ids) {
      const res = await fetch(`/api/project-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "closed" }),
      });
      if (res.ok) success++;
    }
    toast.success(`${success}/${ids.length} demande(s) fermée(s)`);
    setSelectedIds(new Set());
    router.refresh();
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} demande(s) ?`,
      description: "Cette action est irréversible.",
      confirmLabel: "Supprimer tous",
      variant: "destructive",
    });
    if (!ok) return;
    const ids = Array.from(selectedIds);
    let success = 0;
    for (const id of ids) {
      const res = await fetch(`/api/project-requests/${id}`, { method: "DELETE" });
      if (res.ok) success++;
    }
    toast.success(`${success}/${ids.length} demande(s) supprimée(s)`);
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

  // Quick actions menu
  const getActions = useCallback((r: Request) => {
    const actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; variant?: "destructive" }> = [
      { label: "Voir le détail", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("request", r.id) },
      { label: "Voir client", icon: <Cpu className="h-3.5 w-3.5" />, onClick: () => openEntity("client", r.clientId) },
    ];
    if (r.status === "new") {
      actions.push({ label: "Mettre en traitement", icon: <Play className="h-3.5 w-3.5" />, onClick: () => updateStatus(r, "in_progress", "Mettre en traitement") });
    }
    if (r.status === "in_progress" || r.status === "new") {
      actions.push({ label: "Convertir", icon: <Briefcase className="h-3.5 w-3.5" />, onClick: () => openEntity("request", r.id) });
    }
    if (r.status !== "closed" && r.status !== "converted") {
      actions.push({ label: "Fermer", icon: <Lock className="h-3.5 w-3.5" />, onClick: () => updateStatus(r, "closed", "Fermer"), separator: true });
    }
    actions.push({ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => handleDelete(r), variant: "destructive" });
    return actions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity]);

  // ── Colonnes table ───────────────────────────────────
  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const columns: Column<Request>[] = [
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
        <div>
          <div className="font-medium text-sm">{r.clientName}</div>
          {r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.clientName,
    },
    {
      key: "title", header: "Demande",
      accessor: (r) => (
        <div>
          <p className="font-medium text-sm">{r.title}</p>
          <p className="text-[11px] text-muted-foreground line-clamp-1">{r.description}</p>
        </div>
      ),
      sortable: true, sortBy: (r) => r.title,
    },
    {
      key: "service", header: "Service",
      accessor: (r) => <span className="text-xs">{r.serviceType ? (SERVICE_LABELS[r.serviceType] ?? r.serviceType) : "—"}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "urgency", header: "Urgence",
      accessor: (r) => (
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium border inline-flex items-center gap-1", URGENCY_COLORS[r.urgency] ?? "bg-gray-100")}>
          {r.urgency === "critical" && <AlertTriangle className="h-3 w-3" />}
          {URGENCY_LABELS[r.urgency] ?? r.urgency}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.urgency === "critical" ? 0 : r.urgency === "urgent" ? 1 : 2,
    },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "date", header: "Reçue", accessor: (r) => formatDate(new Date(r.createdAt)), sortable: true, sortBy: (r) => r.createdAt, hiddenOnMobile: true },
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
                  <DropdownMenuItem onSelect={() => a.onClick()} className={a.variant === "destructive" ? "text-destructive" : ""}>
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
              <Inbox className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Demandes de projet</h1>
              <p className="text-white/70 text-sm mt-0.5">Demandes soumises via le portail client — traiter et convertir</p>
            </div>
          </div>
          {kpis.criticalCount > 0 && (
            <div className="flex items-center gap-2 bg-red-500/20 border border-red-300/30 rounded-lg px-3 py-2 backdrop-blur">
              <AlertTriangle className="h-4 w-4 text-red-200" />
              <span className="text-sm font-semibold text-white">{kpis.criticalCount} demande{kpis.criticalCount > 1 ? "s" : ""} critique{kpis.criticalCount > 1 ? "s" : ""}</span>
            </div>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total" value={kpis.total} icon={Inbox} accent="bg-blue-500" />
        <StatCard label="Nouvelles" value={kpis.newCount} icon={Sparkles} accent="bg-indigo-500" />
        <StatCard label="En traitement" value={kpis.inProgress} icon={Loader2} accent="bg-amber-500" />
        <StatCard label="Converties" value={kpis.converted} icon={CheckCircle2} accent="bg-emerald-500" />
      </div>

      {/* Sentinel + Sticky compact bar (pattern dashboard finance) */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Inbox className="h-4 w-4" />
              Demandes
            </span>
            <span className="font-semibold">{filtered.length} affichées</span>
            <span className="text-muted-foreground">Nouvelles <span className="font-semibold text-indigo-600">{kpis.newCount}</span></span>
            <span className="text-muted-foreground">En traitement <span className="font-semibold text-amber-600">{kpis.inProgress}</span></span>
            <span className="text-muted-foreground">Converties <span className="font-semibold text-emerald-600">{kpis.converted}</span></span>
            {kpis.criticalCount > 0 && (
              <span className="ml-auto inline-flex items-center gap-1 text-red-600 font-semibold">
                <AlertTriangle className="h-3 w-3" />
                {kpis.criticalCount} critique{kpis.criticalCount > 1 ? "s" : ""}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Titre, client, service, description..." className="pl-9" />
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
          <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-3 space-y-3" align="end">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Urgence</p>
              <div className="flex flex-wrap gap-1">
                {(["normal", "urgent", "critical"] as const).map((u) => {
                  const isOn = filterUrgencies.has(u);
                  return (
                    <button key={u} type="button"
                      onClick={() => {
                        const set = new Set(filterUrgencies);
                        if (isOn) set.delete(u); else set.add(u);
                        setFilterUrgencies(set);
                      }}
                      className={cn("px-2 py-0.5 rounded-full border text-[10px] transition-colors",
                        isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted")}>
                      {URGENCY_LABELS[u]}
                    </button>
                  );
                })}
              </div>
            </div>
            {availableServices.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Service</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {availableServices.map((s) => {
                    const isOn = filterServices.has(s);
                    return (
                      <button key={s} type="button"
                        onClick={() => {
                          const set = new Set(filterServices);
                          if (isOn) set.delete(s); else set.add(s);
                          setFilterServices(set);
                        }}
                        className={cn("px-2 py-0.5 rounded-full border text-[10px] transition-colors",
                          isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted")}>
                        {SERVICE_LABELS[s] ?? s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Période de réception</p>
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

        <ViewToggle storageKey="requests" defaultView="list" onChange={setView} />
      </div>

      {/* Bulk actions bar */}
      {selectedIds.size > 0 && (
        <div className="rounded-lg border-2 border-[#0F2D52] bg-[#0F2D52]/5 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[#0F2D52]" />
            <span className="text-sm font-medium">{selectedIds.size} sélectionnée(s)</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />Annuler
            </Button>
            <Button size="sm" variant="outline" onClick={handleBulkClose}>
              <Lock className="h-3.5 w-3.5 mr-1" />Fermer tous
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
          {filtered.map((r) => (
            <EntityCard
              key={r.id}
              title={r.title}
              subtitle={r.clientName}
              avatarName={r.clientName}
              alert={r.urgency === "critical" && r.status !== "converted" && r.status !== "closed"}
              badges={[
                { label: r.status === "new" ? "Nouvelle" : r.status === "in_progress" ? "En traitement" : r.status === "converted" ? "Convertie" : r.status === "closed" ? "Fermée" : r.status, variant: r.status === "new" ? "secondary" : r.status === "converted" ? "secondary" : "outline" },
                { label: URGENCY_LABELS[r.urgency] ?? r.urgency, variant: r.urgency === "critical" ? "destructive" : r.urgency === "urgent" ? "destructive" : "outline" },
              ]}
              actions={getActions(r)}
              onClick={() => openEntity("request", r.id)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{r.serviceType ? (SERVICE_LABELS[r.serviceType] ?? r.serviceType) : "Aucun service"}</span>
                  <span>{formatDate(new Date(r.createdAt))}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucune demande trouvée</div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => openEntity("request", r.id)}
          searchPlaceholder="Rechercher..."
          exportFilename="demandes"
          storageKey="admin-requests"
        />
      )}

      {ConfirmModal}
    </div>
  );
}

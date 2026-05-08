"use client";
import { useState, useMemo, useCallback } from "react";
import {
  Inbox,
  Search,
  Sparkles,
  Loader2,
  CheckCircle2,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/admin/stat-card";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { useEntityPanels } from "@/hooks/use-entity-panels";
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
  createdAt: string;
  updatedAt: string;
};

type StatusFilter = "all" | "new" | "in_progress" | "converted" | "closed";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "new", label: "Nouvelles" },
  { key: "in_progress", label: "En traitement" },
  { key: "converted", label: "Converties" },
  { key: "closed", label: "Fermees" },
];

const URGENCY_COLORS: Record<string, string> = {
  normal: "bg-blue-100 text-blue-700",
  urgent: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

const URGENCY_LABELS: Record<string, string> = {
  normal: "Normal",
  urgent: "Urgent",
  critical: "Critique",
};

export function RequestsView({
  requests,
  kpis,
}: {
  requests: Request[];
  kpis: { total: number; newCount: number; inProgress: number; converted: number };
}) {
  const { open: openEntity } = useEntityPanels();
  const [view, setView] = useViewMode("requests", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result = requests;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          (r.serviceType ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [requests, statusFilter, searchQuery]);

  // Actions menu pour EntityCard (lecture seule)
  const getActions = useCallback((r: Request) => [
    { label: "Voir client", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("client", r.clientId) },
  ], []);

  const columns: Column<Request>[] = [
    {
      key: "client",
      header: "Client",
      accessor: (r) => (
        <div>
          <div className="font-medium text-sm">{r.clientName}</div>
          {r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.clientName,
    },
    { key: "title", header: "Titre", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title },
    {
      key: "service",
      header: "Service",
      accessor: (r) => <span className="text-xs">{r.serviceType ?? "—"}</span>,
      hiddenOnMobile: true,
    },
    {
      key: "urgency",
      header: "Urgence",
      accessor: (r) => (
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium capitalize", URGENCY_COLORS[r.urgency] ?? "bg-gray-100 text-gray-700")}>
          {URGENCY_LABELS[r.urgency] ?? r.urgency}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.urgency,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "date",
      header: "Date",
      accessor: (r) => formatDate(new Date(r.createdAt)),
      sortable: true,
      sortBy: (r) => r.createdAt,
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Inbox className="h-6 w-6" />
          Demandes de projet
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Demandes soumises via le portail client</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total" value={kpis.total} icon={Inbox} accent="bg-blue-500" />
        <StatCard label="Nouvelles" value={kpis.newCount} icon={Sparkles} accent="bg-indigo-500" />
        <StatCard label="En traitement" value={kpis.inProgress} icon={Loader2} accent="bg-amber-500" />
        <StatCard label="Converties" value={kpis.converted} icon={CheckCircle2} accent="bg-emerald-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Titre, client, service..." className="pl-9" />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ViewToggle storageKey="requests" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => (
            <EntityCard
              key={r.id}
              title={r.title}
              subtitle={r.clientName}
              avatarName={r.clientName}
              alert={r.urgency === "critical"}
              badges={[
                { label: r.status === "new" ? "Nouvelle" : r.status === "in_progress" ? "En traitement" : r.status === "converted" ? "Convertie" : r.status === "closed" ? "Fermee" : r.status, variant: r.status === "new" ? "secondary" : r.status === "converted" ? "secondary" : "outline" },
                { label: URGENCY_LABELS[r.urgency] ?? r.urgency, variant: r.urgency === "critical" ? "destructive" : r.urgency === "urgent" ? "destructive" : "outline" },
              ]}
              actions={getActions(r)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{r.serviceType ?? "Aucun service"}</span>
                  <span>{formatDate(new Date(r.createdAt))}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucune demande trouvee</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="demandes" storageKey="admin-requests" />
      )}
    </div>
  );
}

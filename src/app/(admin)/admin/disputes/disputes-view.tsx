"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  AlertCircle,
  Plus,
  Search,
  ShieldAlert,
  CheckCircle2,
  Eye,
  Pencil,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatCard } from "@/components/admin/stat-card";
import { CreateModal } from "@/components/admin/create-modal";
import { EditModal } from "@/components/admin/edit-modal";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatDate } from "@/lib/utils";

type Dispute = {
  id: number;
  clientId: number;
  clientName: string;
  companyName: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  resolution: string | null;
  openedAt: string;
  resolvedAt: string | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type StatusFilter = "all" | "open" | "in_progress" | "resolved" | "closed";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "open", label: "Ouverts" },
  { key: "in_progress", label: "En cours" },
  { key: "resolved", label: "Resolus" },
  { key: "closed", label: "Fermes" },
];

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-blue-100 text-blue-700",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-red-100 text-red-700",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Faible",
  medium: "Moyenne",
  high: "Elevee",
};

export function DisputesView({
  disputes,
  clients,
  kpis,
}: {
  disputes: Dispute[];
  clients: ClientOption[];
  kpis: { total: number; open: number; resolved: number };
}) {
  const router = useRouter();
  const [view, setView] = useViewMode("disputes", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [newClientId, setNewClientId] = useState("");
  const [newPriority, setNewPriority] = useState("medium");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");

  // Edit/Delete
  const [editDispute, setEditDispute] = useState<Dispute | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editStatus, setEditStatus] = useState("open");
  const [editPriority, setEditPriority] = useState("medium");
  const [editResolution, setEditResolution] = useState("");
  const [deleteDispute, setDeleteDispute] = useState<Dispute | null>(null);

  const resetForm = () => {
    setNewClientId("");
    setNewPriority("medium");
    setNewTitle("");
    setNewDesc("");
  };

  const openEdit = (d: Dispute) => {
    setEditDispute(d);
    setEditTitle(d.title);
    setEditDesc(d.description ?? "");
    setEditStatus(d.status);
    setEditPriority(d.priority);
    setEditResolution(d.resolution ?? "");
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editDispute || !editTitle.trim()) return { success: false, error: "Titre requis" };
    try {
      const res = await fetch(`/api/disputes/${editDispute.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || undefined,
          status: editStatus,
          priority: editPriority,
          resolution: editResolution.trim() || undefined,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteDispute) return;
    const res = await fetch(`/api/disputes/${deleteDispute.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Litige supprime"); setDeleteDispute(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newTitle.trim() || !newDesc.trim()) {
      return { success: false, error: "Client, titre et description requis" };
    }
    try {
      const res = await fetch("/api/disputes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(newClientId),
          priority: newPriority,
          title: newTitle.trim(),
          description: newDesc.trim(),
        }),
      });
      if (res.ok) {
        resetForm();
        router.refresh();
        return { success: true };
      }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch {
      return { success: false, error: "Erreur reseau" };
    }
  };

  const filtered = useMemo(() => {
    let result = disputes;
    if (statusFilter !== "all") result = result.filter((d) => d.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (d) =>
          d.title.toLowerCase().includes(q) ||
          d.clientName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [disputes, statusFilter, searchQuery]);

  // Actions menu pour EntityCard
  const getActions = useCallback((d: Dispute) => [
    { label: "Voir", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => {} },
    { label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(d) },
    { label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteDispute(d), separator: true, variant: "destructive" as const },
  ], []);

  const columns: Column<Dispute>[] = [
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
      key: "priority",
      header: "Priorite",
      accessor: (r) => (
        <span className={cn("px-2 py-0.5 rounded-full text-xs font-medium", PRIORITY_COLORS[r.priority] ?? "bg-gray-100 text-gray-700")}>
          {PRIORITY_LABELS[r.priority] ?? r.priority}
        </span>
      ),
      sortable: true,
      sortBy: (r) => r.priority,
    },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "openedAt",
      header: "Ouvert le",
      accessor: (r) => formatDate(new Date(r.openedAt)),
      sortable: true,
      sortBy: (r) => r.openedAt,
      hiddenOnMobile: true,
    },
    {
      key: "resolvedAt",
      header: "Resolu le",
      accessor: (r) => r.resolvedAt ? formatDate(new Date(r.resolvedAt)) : "—",
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <AlertCircle className="h-6 w-6" />
            Litiges
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Gestion des litiges clients</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Nouveau litige
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Total" value={kpis.total} icon={AlertCircle} accent="bg-blue-500" />
        <StatCard label="Ouverts" value={kpis.open} icon={ShieldAlert} accent="bg-red-500" />
        <StatCard label="Resolus" value={kpis.resolved} icon={CheckCircle2} accent="bg-emerald-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Titre, client..." className="pl-9" />
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
        <ViewToggle storageKey="disputes" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((d) => (
            <EntityCard
              key={d.id}
              title={d.title}
              subtitle={d.clientName}
              avatarName={d.clientName}
              alert={d.priority === "high"}
              badges={[
                { label: d.status === "open" ? "Ouvert" : d.status === "in_progress" ? "En cours" : d.status === "resolved" ? "Resolu" : d.status === "closed" ? "Ferme" : d.status, variant: d.status === "resolved" ? "secondary" : d.status === "open" ? "destructive" : "outline" },
                { label: PRIORITY_LABELS[d.priority] ?? d.priority, variant: d.priority === "high" ? "destructive" : "outline" },
              ]}
              actions={getActions(d)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Ouvert le {formatDate(new Date(d.openedAt))}</span>
                  <span>{d.resolvedAt ? `Resolu le ${formatDate(new Date(d.resolvedAt))}` : "Non resolu"}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun litige trouve</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="litiges" storageKey="admin-disputes" />
      )}

      <EditModal open={!!editDispute} onOpenChange={(o) => { if (!o) setEditDispute(null); }} title="Modifier le litige" description={editDispute?.title} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Titre *</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Statut</Label>
              <Select value={editStatus} onValueChange={setEditStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="open">Ouvert</SelectItem>
                  <SelectItem value="in_progress">En cours</SelectItem>
                  <SelectItem value="resolved">Resolu</SelectItem>
                  <SelectItem value="closed">Ferme</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2"><Label>Priorite</Label>
              <Select value={editPriority} onValueChange={setEditPriority}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Faible</SelectItem>
                  <SelectItem value="medium">Moyenne</SelectItem>
                  <SelectItem value="high">Elevee</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} /></div>
          <div className="space-y-2"><Label>Resolution</Label><Textarea value={editResolution} onChange={(e) => setEditResolution(e.target.value)} rows={3} placeholder="Notes de resolution..." /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteDispute}
        onOpenChange={(o) => { if (!o) setDeleteDispute(null); }}
        title="Supprimer ce litige ?"
        description={`Le litige "${deleteDispute?.title}" sera supprime definitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouveau litige" icon={AlertCircle} accent="bg-red-500" submitLabel="Creer le litige" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {clients.map((c) => (
                  <SelectItem key={c.id} value={String(c.id)}>
                    {c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Priorite</Label>
            <Select value={newPriority} onValueChange={setNewPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Faible</SelectItem>
                <SelectItem value="medium">Moyenne</SelectItem>
                <SelectItem value="high">Elevee</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="dp-title">Titre *</Label>
            <Input id="dp-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="dp-desc">Description *</Label>
            <Textarea id="dp-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={4} />
          </div>
        </div>
      </CreateModal>
    </div>
  );
}

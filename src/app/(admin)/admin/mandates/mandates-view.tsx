"use client";
import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  Play,
  Clock,
  CheckCircle2,
  Plus,
  Search,
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
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatDate } from "@/lib/utils";

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
  hourlyRate: number | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };

type StatusFilter = "all" | "active" | "in_progress" | "pending" | "completed" | "paused";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "active", label: "En cours" },
  { key: "pending", label: "En attente" },
  { key: "completed", label: "Completes" },
  { key: "paused", label: "En pause" },
];

const SERVICE_TYPES = [
  { value: "plc-support", label: "Support PLC" },
  { value: "audit", label: "Audit technique" },
  { value: "documentation", label: "Documentation" },
  { value: "refactoring", label: "Refactorisation" },
];

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
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // ── Creation form ────────────────────────────────────
  const [newClientId, setNewClientId] = useState<string>("");
  const [newTitle, setNewTitle] = useState("");
  const [newService, setNewService] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const resetForm = () => {
    setNewClientId("");
    setNewTitle("");
    setNewService("");
    setNewDesc("");
    setNewStart("");
    setNewEnd("");
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newTitle.trim()) {
      return { success: false, error: "Client et titre requis" };
    }
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
      result = result.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          m.clientName.toLowerCase().includes(q) ||
          m.companyName?.toLowerCase().includes(q) ||
          m.serviceType?.toLowerCase().includes(q)
      );
    }
    return result;
  }, [mandates, statusFilter, searchQuery]);

  // ── Colonnes ──────────────────────────────────────────
  const columns: Column<Mandate>[] = [
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
    {
      key: "title",
      header: "Titre",
      accessor: (r) => <span className="font-medium text-sm">{r.title}</span>,
      sortable: true,
      sortBy: (r) => r.title,
    },
    {
      key: "service",
      header: "Service",
      accessor: (r) => r.serviceType ? SERVICE_TYPES.find((s) => s.value === r.serviceType)?.label ?? r.serviceType : "\u2014",
      hiddenOnMobile: true,
    },
    {
      key: "status",
      header: "Statut",
      accessor: (r) => <StatusBadge status={r.status} />,
    },
    {
      key: "progress",
      header: "Progression",
      accessor: (r) => (
        <div className="flex items-center gap-2 min-w-[120px]">
          <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${r.progress}%` }} />
          </div>
          <span className="text-xs text-muted-foreground">{r.progress}%</span>
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.progress,
      hiddenOnMobile: true,
    },
    {
      key: "start",
      header: "Debut",
      accessor: (r) => r.startDate ? formatDate(new Date(r.startDate)) : "\u2014",
      hiddenOnMobile: true,
    },
    {
      key: "end",
      header: "Fin est.",
      accessor: (r) => r.endDate ? formatDate(new Date(r.endDate)) : "\u2014",
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Header ────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Briefcase className="h-6 w-6" />
            Mandats
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Creer, suivre et mettre a jour la progression
          </p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Nouveau mandat
        </Button>
      </div>

      {/* ── KPIs ──────────────────────────────────────────── */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="En cours" value={counts.active} icon={Play} accent="bg-blue-500" />
        <StatCard label="En attente" value={counts.pending} icon={Clock} accent="bg-amber-500" />
        <StatCard label="Completes" value={counts.completed} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatCard label="Total" value={counts.total} icon={Briefcase} accent="bg-violet-500" />
      </div>

      {/* ── Toolbar ───────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Client, titre, service..."
            className="pl-9"
          />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === tab.key
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Table ─────────────────────────────────────────── */}
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Rechercher..."
        exportFilename="mandats"
        storageKey="admin-mandates"
      />

      {/* ── Modale creation ───────────────────────────────── */}
      <CreateModal
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nouveau mandat"
        description="Creer un mandat pour un client"
        icon={Briefcase}
        accent="bg-violet-500"
        submitLabel="Creer le mandat"
        onSubmit={handleCreate}
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder="Selectionner un client" /></SelectTrigger>
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
            <Label htmlFor="m-title">Titre *</Label>
            <Input id="m-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Titre du mandat" />
          </div>
          <div className="space-y-2">
            <Label>Type de service</Label>
            <Select value={newService} onValueChange={setNewService}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>
                {SERVICE_TYPES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="m-desc">Description</Label>
            <Textarea id="m-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="m-start">Date debut</Label>
              <Input id="m-start" type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="m-end">Date fin estimee</Label>
              <Input id="m-end" type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
            </div>
          </div>
        </div>
      </CreateModal>
    </div>
  );
}

"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users, UserCheck, UserX, UserPlus, Plus, Search,
  Eye, Pencil, FileText, Receipt, Briefcase, MessageSquare, Archive, Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatCard } from "@/components/admin/stat-card";
import { ClientDetailPanel } from "@/components/admin/client-detail-panel";
import { CreateModal } from "@/components/admin/create-modal";
import { EditModal } from "@/components/admin/edit-modal";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode } from "@/components/admin/view-toggle";
import { ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn, initials, formatDate } from "@/lib/utils";

type Client = {
  id: number;
  fullName: string;
  email: string;
  companyName: string | null;
  phone: string | null;
  sector: string | null;
  city: string | null;
  isActive: boolean;
  archived: boolean;
  lastLogin: string | null;
  createdAt: string;
  technologies: string | null;
  mandateCount: number;
  invoiceCount: number;
};

type StatusFilter = "all" | "active" | "inactive" | "archived";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "active", label: "Actifs" },
  { key: "inactive", label: "Inactifs" },
  { key: "archived", label: "Archives" },
];

export function ClientsView({
  clients,
  counts,
}: {
  clients: Client[];
  counts: { total: number; active: number; inactive: number; newThisMonth: number };
}) {
  const router = useRouter();
  const [view, setView] = useViewMode("clients", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modales
  const [cdpClientId, setCdpClientId] = useState<number | null>(null);
  const [cdpOpen, setCdpOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);

  // ── Creation form ────────────────────────────────────
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newPhone, setNewPhone] = useState("");

  // ── Edit form ────────────────────────────────────────
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editSector, setEditSector] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editPhone, setEditPhone] = useState("");

  const resetCreate = () => { setNewName(""); setNewEmail(""); setNewCompany(""); setNewSector(""); setNewCity(""); setNewPhone(""); };

  const openEdit = (c: Client) => {
    setEditClient(c);
    setEditName(c.fullName);
    setEditEmail(c.email);
    setEditCompany(c.companyName ?? "");
    setEditSector(c.sector ?? "");
    setEditCity(c.city ?? "");
    setEditPhone(c.phone ?? "");
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newName.trim() || !newEmail.trim()) return { success: false, error: "Nom et courriel requis" };
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: newName.trim(), email: newEmail.trim(), companyName: newCompany.trim() || undefined, sector: newSector.trim() || undefined, city: newCity.trim() || undefined, phone: newPhone.trim() || undefined }),
      });
      if (res.ok) { resetCreate(); router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editClient || !editName.trim()) return { success: false, error: "Nom requis" };
    try {
      const res = await fetch(`/api/clients/${editClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullName: editName.trim(), companyName: editCompany.trim() || null, sector: editSector.trim() || null, city: editCity.trim() || null, phone: editPhone.trim() || null }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleArchive = async () => {
    if (!deleteClient) return;
    const res = await fetch(`/api/clients/${deleteClient.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Client archive"); setDeleteClient(null); router.refresh(); }
    else { toast.error("Erreur lors de l'archivage"); }
  };

  // ── Filtrage ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = clients;
    if (statusFilter === "active") result = result.filter((c) => c.isActive && !c.archived);
    else if (statusFilter === "inactive") result = result.filter((c) => !c.isActive && !c.archived);
    else if (statusFilter === "archived") result = result.filter((c) => c.archived);
    else result = result.filter((c) => !c.archived);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.fullName.toLowerCase().includes(q) || c.email.toLowerCase().includes(q) || c.companyName?.toLowerCase().includes(q) || c.city?.toLowerCase().includes(q) || c.sector?.toLowerCase().includes(q));
    }
    return result;
  }, [clients, statusFilter, searchQuery]);

  // Actions menu pour EntityCard
  const getActions = useCallback((c: Client) => [
    { label: "Voir le detail", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => { setCdpClientId(c.id); setCdpOpen(true); } },
    { label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(c) },
    { label: "Archiver", icon: <Archive className="h-3.5 w-3.5" />, onClick: () => setDeleteClient(c), separator: true, variant: "destructive" as const },
  ], []);

  // ── Colonnes DataTable ────────────────────────────────
  const columns: Column<Client>[] = [
    { key: "client", header: "Client", accessor: (r) => (
      <button onClick={() => { setCdpClientId(r.id); setCdpOpen(true); }} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
        <Avatar className="h-9 w-9"><AvatarFallback className="vnk-gradient text-white text-xs">{initials(r.fullName)}</AvatarFallback></Avatar>
        <div><div className="font-medium text-sm">{r.fullName}</div><div className="text-xs text-muted-foreground">{r.email}</div></div>
      </button>
    ), sortable: true, sortBy: (r) => r.fullName },
    { key: "company", header: "Entreprise", accessor: (r) => r.companyName ?? "—", sortable: true, sortBy: (r) => r.companyName ?? "", hiddenOnMobile: true },
    { key: "sector", header: "Secteur", accessor: (r) => r.sector ?? "—", hiddenOnMobile: true },
    { key: "city", header: "Ville", accessor: (r) => r.city ?? "—", hiddenOnMobile: true },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.archived ? "cancelled" : r.isActive ? "active" : "paused"} /> },
    { key: "mandates", header: "Mandats", accessor: (r) => r.mandateCount, sortable: true, sortBy: (r) => r.mandateCount, hiddenOnMobile: true },
    { key: "last_login", header: "Connexion", accessor: (r) => (r.lastLogin ? formatDate(new Date(r.lastLogin)) : "Jamais"), hiddenOnMobile: true },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><Users className="h-6 w-6" />Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerez vos clients et leurs informations</p>
        </div>
        <Button onClick={() => { resetCreate(); setCreateOpen(true); }}><Plus className="h-4 w-4" />Nouveau client</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total" value={counts.total} icon={Users} accent="bg-blue-500" />
        <StatCard label="Actifs" value={counts.active} icon={UserCheck} accent="bg-emerald-500" />
        <StatCard label="Inactifs" value={counts.inactive} icon={UserX} accent="bg-amber-500" />
        <StatCard label="Nouveaux ce mois" value={counts.newThisMonth} icon={UserPlus} accent="bg-violet-500" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Nom, entreprise, courriel, ville..." className="pl-9" />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>
        <ViewToggle storageKey="clients" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <EntityCard
              key={c.id}
              title={c.fullName}
              subtitle={c.companyName ?? c.email}
              avatarName={c.fullName}
              badges={[
                { label: c.isActive ? "Actif" : c.archived ? "Archive" : "Inactif", variant: c.isActive ? "secondary" : "outline" },
                ...(c.sector ? [{ label: c.sector, variant: "outline" as const }] : []),
              ]}
              stats={[
                { label: "Mandats", value: c.mandateCount },
                { label: "Factures", value: c.invoiceCount },
              ]}
              actions={getActions(c)}
              onClick={() => { setCdpClientId(c.id); setCdpOpen(true); }}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{c.city ?? "—"}</span>
                  <span>{c.lastLogin ? formatDate(new Date(c.lastLogin)) : "Jamais connecte"}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun client trouve</div>
          )}
        </div>
      ) : (
        /* Vue liste */
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="clients" storageKey="admin-clients" />
      )}

      {/* CDP */}
      <ClientDetailPanel clientId={cdpClientId} open={cdpOpen} onOpenChange={setCdpOpen} />

      {/* Modale creation */}
      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouveau client" description="Ajoutez un nouveau client" icon={UserPlus} accent="bg-blue-500" submitLabel="Creer le client" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nom complet *</Label><Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Jean Dupont" /></div>
            <div className="space-y-2"><Label>Courriel *</Label><Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="jean@exemple.com" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Entreprise</Label><Input value={newCompany} onChange={(e) => setNewCompany(e.target.value)} placeholder="Industries XYZ" /></div>
            <div className="space-y-2"><Label>Secteur</Label><Input value={newSector} onChange={(e) => setNewSector(e.target.value)} placeholder="Manufacturier" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Ville</Label><Input value={newCity} onChange={(e) => setNewCity(e.target.value)} placeholder="Quebec" /></div>
            <div className="space-y-2"><Label>Telephone</Label><Input value={newPhone} onChange={(e) => setNewPhone(e.target.value)} placeholder="(819) 555-1234" /></div>
          </div>
        </div>
      </CreateModal>

      {/* Modale edition */}
      <EditModal open={!!editClient} onOpenChange={(o) => { if (!o) setEditClient(null); }} title="Modifier le client" description={editClient?.email} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Nom complet *</Label><Input value={editName} onChange={(e) => setEditName(e.target.value)} /></div>
            <div className="space-y-2"><Label>Courriel</Label><Input value={editEmail} disabled className="bg-muted" /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Entreprise</Label><Input value={editCompany} onChange={(e) => setEditCompany(e.target.value)} /></div>
            <div className="space-y-2"><Label>Secteur</Label><Input value={editSector} onChange={(e) => setEditSector(e.target.value)} /></div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label>Ville</Label><Input value={editCity} onChange={(e) => setEditCity(e.target.value)} /></div>
            <div className="space-y-2"><Label>Telephone</Label><Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} /></div>
          </div>
        </div>
      </EditModal>

      {/* Confirmation archivage */}
      <ConfirmDialog
        open={!!deleteClient}
        onOpenChange={(o) => { if (!o) setDeleteClient(null); }}
        title="Archiver ce client ?"
        description={`Le client "${deleteClient?.fullName}" sera archive. Cette action est reversible.`}
        confirmLabel="Archiver"
        onConfirm={handleArchive}
      />
    </div>
  );
}

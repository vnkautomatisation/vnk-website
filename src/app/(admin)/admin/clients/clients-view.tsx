"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Users, UserCheck, UserX, UserPlus, Plus, Search,
  Eye, Pencil, Archive, Copy, KeyRound, RotateCcw, Power, SlidersHorizontal, X, CheckSquare, Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatCard } from "@/components/admin/stat-card";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode } from "@/components/admin/view-toggle";
import { ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { AddressFields, TechPicker, SectorPicker, FormSection } from "@/components/admin/client-form-fields";
import { useConfirm } from "@/hooks/use-confirm";
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
  { key: "archived", label: "Archivés" },
];

export function ClientsView({
  clients,
  counts,
}: {
  clients: Client[];
  counts: { total: number; active: number; inactive: number; newThisMonth: number };
}) {
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const [view, setView] = useViewMode("clients", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filtres avances
  const [filterSectors, setFilterSectors] = useState<Set<string>>(new Set());
  const [filterCities, setFilterCities] = useState<Set<string>>(new Set());
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Selection multiple (bulk actions)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Modales
  const { open: openEntity } = useEntityPanels();
  const [createOpen, setCreateOpen] = useState(false);
  const [editClient, setEditClient] = useState<Client | null>(null);
  const [deleteClient, setDeleteClient] = useState<Client | null>(null);
  // Mot de passe genere — affiche une fois pour que l'admin le copie
  const [generatedCreds, setGeneratedCreds] = useState<{ email: string; password: string; isReset?: boolean } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  // ── Creation form (complet, multi-pays) ──────────────
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newSector, setNewSector] = useState("");
  const [newCountry, setNewCountry] = useState("CA");
  const [newAddress, setNewAddress] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newProvince, setNewProvince] = useState("");
  const [newPostalCode, setNewPostalCode] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [newTech, setNewTech] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // ── Edit form (complet, multi-pays) ──────────────────
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editSector, setEditSector] = useState("");
  const [editCountry, setEditCountry] = useState("CA");
  const [editAddress, setEditAddress] = useState("");
  const [editCity, setEditCity] = useState("");
  const [editProvince, setEditProvince] = useState("");
  const [editPostalCode, setEditPostalCode] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editTech, setEditTech] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editLoading, setEditLoading] = useState(false);

  const resetCreate = () => {
    setNewName(""); setNewEmail(""); setNewCompany(""); setNewSector("");
    setNewCountry("CA"); setNewAddress(""); setNewCity(""); setNewProvince("");
    setNewPostalCode(""); setNewPhone(""); setNewTech(""); setNewNotes("");
  };

  // Charge le client complet via API pour avoir tous les champs (address, tech, notes...)
  const openEdit = async (c: Client) => {
    setEditClient(c);
    setEditLoading(true);
    // Pre-remplit avec les donnees deja en main
    setEditName(c.fullName);
    setEditEmail(c.email);
    setEditCompany(c.companyName ?? "");
    setEditSector(c.sector ?? "");
    setEditCity(c.city ?? "");
    setEditPhone(c.phone ?? "");
    // Fetch full client pour adresse complete + tech + notes
    try {
      const res = await fetch(`/api/clients/${c.id}`, { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        const full = data.client;
        setEditCountry(full.country ?? "CA");
        setEditAddress(full.address ?? "");
        setEditProvince(full.province ?? "");
        setEditPostalCode(full.postalCode ?? "");
        setEditTech(full.technologies ?? "");
        setEditNotes(full.internalNotes ?? "");
      }
    } finally { setEditLoading(false); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newName.trim() || !newEmail.trim()) return { success: false, error: "Nom et courriel requis" };
    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newName.trim(),
          email: newEmail.trim(),
          companyName: newCompany.trim() || undefined,
          sector: newSector.trim() || undefined,
          country: newCountry,
          address: newAddress.trim() || undefined,
          city: newCity.trim() || undefined,
          province: newProvince.trim() || undefined,
          postalCode: newPostalCode.trim() || undefined,
          phone: newPhone.trim() || undefined,
          technologies: newTech.trim() || undefined,
          internalNotes: newNotes.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.generatedPassword) {
          setGeneratedCreds({ email: newEmail.trim(), password: data.generatedPassword });
        }
        resetCreate();
        router.refresh();
        return { success: true };
      }
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur réseau" }; }
  };

  // ── Restaurer un client archive ──────────────────────
  const handleRestore = async (c: Client) => {
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/clients/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ archived: false, isActive: true }),
      });
      if (res.ok) { toast.success(`${c.fullName} restauré`); router.refresh(); }
      else { toast.error("Erreur lors de la restauration"); }
    } finally { setBusyId(null); }
  };

  // ── Toggle isActive ──────────────────────────────────
  const handleToggleActive = async (c: Client) => {
    const willActivate = !c.isActive;
    const ok = await confirm({
      title: willActivate ? "Activer ce client ?" : "Désactiver ce client ?",
      description: willActivate
        ? `${c.fullName} pourra de nouveau accéder au portail.`
        : `${c.fullName} ne pourra plus se connecter au portail (compte conservé).`,
      confirmLabel: willActivate ? "Activer" : "Désactiver",
      variant: willActivate ? "default" : "destructive",
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/clients/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: willActivate }),
      });
      if (res.ok) { toast.success(willActivate ? "Client activé" : "Client désactivé"); router.refresh(); }
      else { toast.error("Erreur"); }
    } finally { setBusyId(null); }
  };

  // ── Reset password (genere nouveau MDP) ──────────────
  const handleResetPassword = async (c: Client) => {
    const ok = await confirm({
      title: "Réinitialiser le mot de passe ?",
      description: `Un nouveau mot de passe sera généré pour ${c.fullName}. L'ancien sera invalidé immédiatement. Tu pourras copier le nouveau dans la fenêtre suivante.`,
      confirmLabel: "Générer nouveau",
      variant: "default",
    });
    if (!ok) return;
    setBusyId(c.id);
    try {
      const res = await fetch(`/api/clients/${c.id}/reset-password`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.generatedPassword) {
        setGeneratedCreds({ email: data.email, password: data.generatedPassword, isReset: true });
        router.refresh();
      } else {
        toast.error(data.error || "Erreur");
      }
    } finally { setBusyId(null); }
  };

  // ── Bulk actions ─────────────────────────────────────
  const handleBulkArchive = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Archiver ${selectedIds.size} client(s) ?`,
      description: "Les clients sélectionnés seront archivés. Cette action est réversible.",
      confirmLabel: "Archiver tous",
    });
    if (!ok) return;
    const ids = Array.from(selectedIds);
    let success = 0;
    for (const id of ids) {
      const res = await fetch(`/api/clients/${id}`, { method: "DELETE" });
      if (res.ok) success++;
    }
    toast.success(`${success}/${ids.length} client(s) archivé(s)`);
    setSelectedIds(new Set());
    router.refresh();
  };

  const toggleSelectId = (id: number) => {
    const set = new Set(selectedIds);
    if (set.has(id)) set.delete(id); else set.add(id);
    setSelectedIds(set);
  };

  const toggleSelectAll = (allIds: number[]) => {
    if (allIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editClient || !editName.trim()) return { success: false, error: "Nom requis" };
    try {
      const res = await fetch(`/api/clients/${editClient.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: editName.trim(),
          companyName: editCompany.trim() || null,
          sector: editSector.trim() || null,
          country: editCountry,
          address: editAddress.trim() || null,
          city: editCity.trim() || null,
          province: editProvince.trim() || null,
          postalCode: editPostalCode.trim() || null,
          phone: editPhone.trim() || null,
          technologies: editTech.trim() || null,
          internalNotes: editNotes,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur réseau" }; }
  };

  const handleArchive = async () => {
    if (!deleteClient) return;
    const res = await fetch(`/api/clients/${deleteClient.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Client archivé"); setDeleteClient(null); router.refresh(); }
    else { toast.error("Erreur lors de l'archivage"); }
  };

  // ── Listes distinctes pour filtres avances ───────────
  const availableSectors = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) if (c.sector) set.add(c.sector);
    return Array.from(set).sort();
  }, [clients]);

  const availableCities = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) if (c.city) set.add(c.city);
    return Array.from(set).sort();
  }, [clients]);

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
    if (filterSectors.size > 0) result = result.filter((c) => c.sector && filterSectors.has(c.sector));
    if (filterCities.size > 0) result = result.filter((c) => c.city && filterCities.has(c.city));
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter((c) => new Date(c.createdAt).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86400000;
      result = result.filter((c) => new Date(c.createdAt).getTime() <= to);
    }
    return result;
  }, [clients, statusFilter, searchQuery, filterSectors, filterCities, filterDateFrom, filterDateTo]);

  const totalActiveFilters =
    (filterSectors.size > 0 ? 1 : 0) +
    (filterCities.size > 0 ? 1 : 0) +
    (filterDateFrom ? 1 : 0) +
    (filterDateTo ? 1 : 0);

  const clearAllFilters = () => {
    setFilterSectors(new Set());
    setFilterCities(new Set());
    setFilterDateFrom("");
    setFilterDateTo("");
  };

  // Actions menu pour EntityCard — adaptees selon archived/isActive
  const getActions = useCallback((c: Client) => {
    const actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; variant?: "destructive" }> = [
      { label: "Voir le détail", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("client", c.id) },
    ];
    actions.push({
      label: "Télécharger dossier ZIP",
      icon: <Download className="h-3.5 w-3.5" />,
      onClick: () => {
        const a = document.createElement("a");
        a.href = `/api/clients/${c.id}/export-zip`;
        a.click();
        toast.success("Préparation du dossier ZIP…");
      },
    });
    if (!c.archived) {
      actions.push({ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(c), separator: true });
      actions.push({ label: "Réinitialiser MDP", icon: <KeyRound className="h-3.5 w-3.5" />, onClick: () => handleResetPassword(c) });
      actions.push({
        label: c.isActive ? "Désactiver" : "Activer",
        icon: <Power className="h-3.5 w-3.5" />,
        onClick: () => handleToggleActive(c),
      });
      actions.push({ label: "Archiver", icon: <Archive className="h-3.5 w-3.5" />, onClick: () => setDeleteClient(c), separator: true, variant: "destructive" as const });
    } else {
      actions.push({ label: "Restaurer", icon: <RotateCcw className="h-3.5 w-3.5" />, onClick: () => handleRestore(c), separator: true });
    }
    return actions;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity]);

  // ── Colonnes DataTable ────────────────────────────────
  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const columns: Column<Client>[] = [
    {
      key: "select",
      header: (
        <Checkbox
          checked={allSelected}
          onCheckedChange={() => toggleSelectAll(allFilteredIds)}
          aria-label="Tout sélectionner"
        />
      ),
      accessor: (r) => (
        <Checkbox
          checked={selectedIds.has(r.id)}
          onCheckedChange={() => toggleSelectId(r.id)}
          onClick={(e) => e.stopPropagation()}
          aria-label={`Sélectionner ${r.fullName}`}
        />
      ),
    },
    { key: "client", header: "Client", accessor: (r) => (
      <button onClick={() => openEntity("client", r.id)} className="flex items-center gap-3 text-left hover:opacity-80 transition-opacity">
        <Avatar className="h-9 w-9"><AvatarFallback className="vnk-gradient text-white text-xs">{initials(r.fullName)}</AvatarFallback></Avatar>
        <div><div className="font-medium text-sm">{r.fullName}</div><div className="text-xs text-muted-foreground">{r.email}</div></div>
      </button>
    ), sortable: true, sortBy: (r) => r.fullName },
    { key: "company", header: "Entreprise", accessor: (r) => r.companyName ?? "—", sortable: true, sortBy: (r) => r.companyName ?? "", hiddenOnMobile: true },
    { key: "sector", header: "Secteur", accessor: (r) => r.sector ?? "—", hiddenOnMobile: true },
    { key: "city", header: "Ville", accessor: (r) => r.city ?? "—", hiddenOnMobile: true },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.archived ? "cancelled" : r.isActive ? "active" : "paused"} /> },
    { key: "mandates", header: "Mandats", accessor: (r) => r.mandateCount > 0 ? r.mandateCount : "—", sortable: true, sortBy: (r) => r.mandateCount, hiddenOnMobile: true },
    { key: "last_login", header: "Connexion", accessor: (r) => (r.lastLogin ? formatDate(new Date(r.lastLogin)) : "Jamais"), hiddenOnMobile: true },
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
              <Users className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Clients</h1>
              <p className="text-white/70 text-sm mt-0.5">Gérez vos clients et leurs informations</p>
            </div>
          </div>
          <Button
            className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
            onClick={() => { resetCreate(); setCreateOpen(true); }}
          >
            <Plus className="h-4 w-4" />Nouveau client
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total" value={counts.total} icon={Users} accent="bg-blue-500" />
        <StatCard label="Actifs" value={counts.active} icon={UserCheck} accent="bg-emerald-500" />
        <StatCard label="Inactifs" value={counts.inactive} icon={UserX} accent="bg-amber-500" />
        <StatCard label="Nouveaux ce mois" value={counts.newThisMonth} icon={UserPlus} accent="bg-violet-500" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
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

        {/* Filtres avances popover */}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtres</span>
              {totalActiveFilters > 0 && <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{totalActiveFilters}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-3 space-y-3" align="end">
            {availableSectors.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Secteur</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {availableSectors.map((s) => {
                    const isOn = filterSectors.has(s);
                    return (
                      <button key={s} type="button"
                        onClick={() => {
                          const set = new Set(filterSectors);
                          if (isOn) set.delete(s); else set.add(s);
                          setFilterSectors(set);
                        }}
                        className={cn(
                          "px-2 py-0.5 rounded-full border text-[10px] transition-colors",
                          isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted"
                        )}
                      >{s}</button>
                    );
                  })}
                </div>
              </div>
            )}
            {availableCities.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Ville</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {availableCities.map((s) => {
                    const isOn = filterCities.has(s);
                    return (
                      <button key={s} type="button"
                        onClick={() => {
                          const set = new Set(filterCities);
                          if (isOn) set.delete(s); else set.add(s);
                          setFilterCities(set);
                        }}
                        className={cn(
                          "px-2 py-0.5 rounded-full border text-[10px] transition-colors",
                          isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted"
                        )}
                      >{s}</button>
                    );
                  })}
                </div>
              </div>
            )}
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

        <ViewToggle storageKey="clients" defaultView="list" onChange={setView} />
      </div>

      {/* Bulk actions bar — visible quand selection */}
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
            <Button size="sm" variant="destructive" onClick={handleBulkArchive}>
              <Archive className="h-3.5 w-3.5 mr-1" />Archiver tous
            </Button>
          </div>
        </div>
      )}

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
                { label: c.isActive ? "Actif" : c.archived ? "Archivé" : "Inactif", variant: c.isActive ? "secondary" : "outline" },
                ...(c.sector ? [{ label: c.sector, variant: "outline" as const }] : []),
              ]}
              stats={[
                { label: "Mandats", value: c.mandateCount },
                { label: "Factures", value: c.invoiceCount },
              ]}
              actions={getActions(c)}
              onClick={() => openEntity("client", c.id)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{c.city ?? "—"}</span>
                  <span>{c.lastLogin ? formatDate(new Date(c.lastLogin)) : "Jamais connecté"}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun client trouvé</div>
          )}
        </div>
      ) : (
        /* Vue liste */
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="clients" storageKey="admin-clients" />
      )}

      {/* Modale creation — VNK navy theme avec FormSections */}
      <ClientFormDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        mode="create"
        clientEmail={newEmail}
        loading={false}
        values={{
          name: newName, email: newEmail, company: newCompany, sector: newSector,
          country: newCountry, address: newAddress, city: newCity, province: newProvince,
          postalCode: newPostalCode, phone: newPhone, tech: newTech, notes: newNotes,
        }}
        setters={{
          setName: setNewName, setEmail: setNewEmail, setCompany: setNewCompany, setSector: setNewSector,
          setCountry: (c) => { setNewCountry(c); /* reset province si changement de pays */ setNewProvince(""); },
          setAddress: setNewAddress, setCity: setNewCity, setProvince: setNewProvince,
          setPostalCode: setNewPostalCode, setPhone: setNewPhone, setTech: setNewTech, setNotes: setNewNotes,
        }}
        onSubmit={handleCreate}
      />

      {/* Modale edition — VNK navy theme avec FormSections + adresse multi-pays + tech + notes */}
      <ClientFormDialog
        open={!!editClient}
        onOpenChange={(o) => { if (!o) setEditClient(null); }}
        mode="edit"
        clientEmail={editEmail}
        loading={editLoading}
        values={{
          name: editName, email: editEmail, company: editCompany, sector: editSector,
          country: editCountry, address: editAddress, city: editCity, province: editProvince,
          postalCode: editPostalCode, phone: editPhone, tech: editTech, notes: editNotes,
        }}
        setters={{
          setName: setEditName, setEmail: () => { /* email non editable */ }, setCompany: setEditCompany, setSector: setEditSector,
          setCountry: (c) => { setEditCountry(c); setEditProvince(""); },
          setAddress: setEditAddress, setCity: setEditCity, setProvince: setEditProvince,
          setPostalCode: setEditPostalCode, setPhone: setEditPhone, setTech: setEditTech, setNotes: setEditNotes,
        }}
        onSubmit={handleEdit}
      />

      {/* Confirmation archivage */}
      <ConfirmDialog
        open={!!deleteClient}
        onOpenChange={(o) => { if (!o) setDeleteClient(null); }}
        title="Archiver ce client ?"
        description={`Le client "${deleteClient?.fullName}" sera archivé. Cette action est réversible.`}
        confirmLabel="Archiver"
        onConfirm={handleArchive}
      />

      {ConfirmModal}

      {/* Dialog credentials (creation OU reset) — affiche une seule fois */}
      <Dialog open={!!generatedCreds} onOpenChange={(o) => { if (!o) setGeneratedCreds(null); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-[#0F2D52] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <KeyRound className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">
                  {generatedCreds?.isReset ? "Mot de passe réinitialisé" : "Compte client créé"}
                </DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">
                  Transmettez ces accès au client — ils ne seront plus affichés
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Courriel</Label>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/30 px-3 py-2">
                <Input value={generatedCreds?.email ?? ""} readOnly className="border-0 bg-transparent p-0 h-auto font-mono text-sm focus-visible:ring-0" />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => {
                  navigator.clipboard.writeText(generatedCreds?.email ?? "");
                  toast.success("Courriel copié");
                }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Mot de passe temporaire</Label>
              <div className="flex items-center gap-2 rounded-lg border-2 border-amber-200 bg-amber-50 px-3 py-2">
                <Input value={generatedCreds?.password ?? ""} readOnly className="border-0 bg-transparent p-0 h-auto font-mono text-sm focus-visible:ring-0" />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0 shrink-0" onClick={() => {
                  navigator.clipboard.writeText(generatedCreds?.password ?? "");
                  toast.success("Mot de passe copié");
                }}>
                  <Copy className="h-3.5 w-3.5" />
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Le client devra le changer à la première connexion. Ce mot de passe ne sera plus affiché après fermeture de cette fenêtre.
              </p>
            </div>
          </div>
          <DialogFooter className="px-6 pb-5">
            <Button className="w-full bg-[#0F2D52] hover:bg-[#1a3a66]" onClick={() => {
              navigator.clipboard.writeText(`Courriel : ${generatedCreds?.email}\nMot de passe : ${generatedCreds?.password}`);
              toast.success("Identifiants copiés");
            }}>
              <Copy className="h-4 w-4 mr-1.5" />Copier les deux
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────
// ClientFormDialog — modal create/edit unifie avec theme VNK navy
// ─────────────────────────────────────────────────────────────────
type FormValues = {
  name: string; email: string; company: string; sector: string;
  country: string; address: string; city: string; province: string;
  postalCode: string; phone: string; tech: string; notes: string;
};
type FormSetters = {
  setName: (v: string) => void; setEmail: (v: string) => void;
  setCompany: (v: string) => void; setSector: (v: string) => void;
  setCountry: (v: string) => void; setAddress: (v: string) => void;
  setCity: (v: string) => void; setProvince: (v: string) => void;
  setPostalCode: (v: string) => void; setPhone: (v: string) => void;
  setTech: (v: string) => void; setNotes: (v: string) => void;
};

function ClientFormDialog({
  open, onOpenChange, mode, clientEmail, loading, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  clientEmail: string;
  loading: boolean;
  values: FormValues;
  setters: FormSetters;
  onSubmit: () => Promise<{ success: boolean; error?: string }>;
}) {
  const [submitting, setSubmitting] = useState(false);
  const isCreate = mode === "create";

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const result = await onSubmit();
      if (result.success) {
        toast.success(isCreate ? "Client créé avec succès" : "Client mis à jour");
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
              {isCreate ? <UserPlus className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white text-lg">
                {isCreate ? "Nouveau client" : "Modifier le client"}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {isCreate
                  ? "Un mot de passe sera généré automatiquement après création"
                  : (clientEmail || "Modification du client")}
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
              <FormSection title="Identité" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>}>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Nom complet *</Label>
                    <Input value={values.name} onChange={(e) => setters.setName(e.target.value)} placeholder="Jean Dupont" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Courriel {isCreate && "*"}</Label>
                    <Input
                      type="email"
                      value={values.email}
                      onChange={(e) => setters.setEmail(e.target.value)}
                      placeholder="jean@exemple.com"
                      disabled={!isCreate}
                      className={!isCreate ? "bg-muted" : ""}
                    />
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Entreprise</Label>
                    <Input value={values.company} onChange={(e) => setters.setCompany(e.target.value)} placeholder="Industries XYZ" />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Secteur</Label>
                    <SectorPicker value={values.sector} onChange={setters.setSector} />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Téléphone</Label>
                  <Input value={values.phone} onChange={(e) => setters.setPhone(e.target.value)} placeholder="(819) 555-1234" />
                </div>
              </FormSection>

              <FormSection title="Adresse" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>}>
                <AddressFields
                  country={values.country} onCountryChange={setters.setCountry}
                  address={values.address} onAddressChange={setters.setAddress}
                  city={values.city} onCityChange={setters.setCity}
                  province={values.province} onProvinceChange={setters.setProvince}
                  postal={values.postalCode} onPostalChange={setters.setPostalCode}
                />
              </FormSection>

              <FormSection title="Technologies & notes" icon={<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>}>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Technologies utilisées</Label>
                  <TechPicker value={values.tech} onChange={setters.setTech} />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes internes (privées)</Label>
                  <Textarea
                    value={values.notes}
                    onChange={(e) => setters.setNotes(e.target.value)}
                    rows={3}
                    placeholder="Notes privées, jamais visibles par le client…"
                    className="bg-amber-50/30"
                  />
                </div>
              </FormSection>
            </>
          )}
        </div>

        {/* Footer fixe */}
        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            Annuler
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={submitting || loading || !values.name.trim() || (isCreate && !values.email.trim())}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {submitting ? "Enregistrement…" : (isCreate ? "Créer le client" : "Enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  FileSignature, Plus, Search, Clock, CheckCircle2, PenTool, UserCheck, ShieldCheck,
  Eye, Pencil, Trash2, SlidersHorizontal, X, CheckSquare, MoreHorizontal, FileText, Send,
  DollarSign, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { StatCard } from "@/components/admin/stat-card";
import { EntityCard } from "@/components/admin/entity-card";
import { SignatureDialog } from "@/components/signature/signature-dialog";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormSection } from "@/components/admin/client-form-fields";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Contract = {
  id: number;
  contractNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  quoteId: number | null;
  quoteNumber: string | null;
  title: string;
  status: string;
  amountTtc: number | null;
  clientSignatureData: boolean;
  adminSignatureData: boolean;
  signedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type StatusFilter = "all" | "pending" | "draft" | "signed" | "expired" | "cancelled";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "draft", label: "Brouillon" },
  { key: "signed", label: "Signés" },
  { key: "expired", label: "Expirés" },
  { key: "cancelled", label: "Annulés" },
];

export function ContractsView({
  contracts,
  clients,
  kpis,
}: {
  contracts: Contract[];
  clients: ClientOption[];
  kpis: { total: number; pendingCount: number; signedCount: number; signedThisMonth: number; totalValue: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [view, setView] = useViewMode("contracts", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Filtres avances
  const [filterClients, setFilterClients] = useState<Set<number>>(new Set());
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Bulk
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Edit/Delete + PDF + Sign
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [deleteContract, setDeleteContract] = useState<Contract | null>(null);
  const [pdfContract, setPdfContract] = useState<Contract | null>(null);
  const [signingContract, setSigningContract] = useState<Contract | null>(null);

  // Form state (partage create + edit)
  const [fClientId, setFClientId] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fContent, setFContent] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fStatus, setFStatus] = useState("pending");
  const [fExpiresAt, setFExpiresAt] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFClientId(""); setFTitle(""); setFContent(""); setFAmount("");
    setFStatus("pending"); setFExpiresAt("");
  };

  useEffect(() => {
    const newFor = searchParams.get("newFor");
    if (newFor && clients.some((c) => String(c.id) === newFor)) {
      resetForm();
      setFClientId(newFor);
      setCreateOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("newFor");
      window.history.replaceState({}, "", url.toString());
    }
  }, [searchParams, clients]);

  const openEdit = (c: Contract) => {
    setEditContract(c);
    setFClientId(String(c.clientId));
    setFTitle(c.title);
    setFContent("");
    setFAmount(c.amountTtc != null ? String(c.amountTtc) : "");
    setFStatus(c.status);
    setFExpiresAt(c.expiresAt ? c.expiresAt.slice(0, 10) : "");
  };

  const handleCreate = async () => {
    if (submitting) return;
    if (!fClientId || !fTitle.trim()) { toast.error("Client et titre requis"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(fClientId),
          title: fTitle.trim(),
          content: fContent.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Contrat créé");
        setCreateOpen(false);
        resetForm();
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (submitting || !editContract) return;
    if (!fTitle.trim()) { toast.error("Titre requis"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/contracts/${editContract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle.trim(),
          content: fContent.trim() || undefined,
          status: fStatus,
          amountTtc: fAmount ? Number(fAmount) : null,
          expiresAt: fExpiresAt || null,
        }),
      });
      if (res.ok) { toast.success("Contrat modifié"); setEditContract(null); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteContract) return;
    const res = await fetch(`/api/contracts/${deleteContract.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Contrat supprimé"); setDeleteContract(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleSetStatus = async (c: Contract, status: string, label: string) => {
    const ok = await confirm({
      title: `${label} ce contrat ?`,
      description: `${c.contractNumber} passera au statut « ${status === "cancelled" ? "Annulé" : status === "expired" ? "Expiré" : status === "draft" ? "Brouillon" : status} ».`,
      confirmLabel: label,
      variant: status === "cancelled" ? "destructive" : "default",
    });
    if (!ok) return;
    const res = await fetch(`/api/contracts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success("Statut mis à jour"); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleSendToClient = async (c: Contract) => {
    const ok = await confirm({
      title: "Envoyer ce contrat au client ?",
      description: `Le contrat ${c.contractNumber} sera ajouté dans la catégorie "Contrats" du portail + message chat + notification.`,
      confirmLabel: "Envoyer",
    });
    if (!ok) return;
    const res = await fetch(`/api/contracts/${c.id}/send`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Contrat envoyé à ${data.clientName ?? c.clientName} (portail + chat + notification)`);
      router.refresh();
    } else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  // Bulk
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} contrat(s) ?`,
      description: "Les contrats signés ou liés à des factures seront refusés (409). Cette action est irréversible.",
      confirmLabel: "Supprimer tous",
      variant: "destructive",
    });
    if (!ok) return;
    let success = 0, blocked = 0;
    for (const id of Array.from(selectedIds)) {
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      if (res.ok) success++; else if (res.status === 409) blocked++;
    }
    toast.success(`${success}/${selectedIds.size} supprimé(s)${blocked > 0 ? ` · ${blocked} bloqué(s)` : ""}`);
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

  // Filter
  const filtered = useMemo(() => {
    let result = contracts;
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.contractNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.companyName ?? "").toLowerCase().includes(q)
      );
    }
    if (filterClients.size > 0) result = result.filter((r) => filterClients.has(r.clientId));
    if (filterAmountMin) result = result.filter((r) => (r.amountTtc ?? 0) >= Number(filterAmountMin));
    if (filterAmountMax) result = result.filter((r) => (r.amountTtc ?? 0) <= Number(filterAmountMax));
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86400000;
      result = result.filter((r) => new Date(r.createdAt).getTime() <= to);
    }
    return result;
  }, [contracts, statusFilter, searchQuery, filterClients, filterAmountMin, filterAmountMax, filterDateFrom, filterDateTo]);

  const totalActiveFilters =
    (filterClients.size > 0 ? 1 : 0) +
    (filterAmountMin ? 1 : 0) + (filterAmountMax ? 1 : 0) +
    (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

  const clearAllFilters = () => {
    setFilterClients(new Set());
    setFilterAmountMin(""); setFilterAmountMax("");
    setFilterDateFrom(""); setFilterDateTo("");
  };

  // Actions menu
  const getActions = useCallback((c: Contract) => {
    const editable = !c.clientSignatureData && !c.signedAt && c.status !== "cancelled";
    const a: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; variant?: "destructive" }> = [
      { label: "Voir le détail", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("contract", c.id) },
      { label: "Voir le PDF", icon: <FileText className="h-3.5 w-3.5" />, onClick: () => setPdfContract(c) },
    ];
    if (c.status === "pending" || c.status === "draft") {
      a.push({ label: "Envoyer au client", icon: <Send className="h-3.5 w-3.5" />, onClick: () => handleSendToClient(c) });
    }
    if (c.status === "pending" && !c.adminSignatureData) {
      a.push({ label: "Signer (admin)", icon: <PenTool className="h-3.5 w-3.5" />, onClick: () => setSigningContract(c) });
    }
    if (c.status === "pending") {
      a.push({ label: "Marquer expiré", icon: <AlertTriangle className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(c, "expired", "Marquer expiré") });
    }
    if (editable) {
      a.push({ label: "Annuler", icon: <X className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(c, "cancelled", "Annuler") });
      a.push({ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(c), separator: true });
      a.push({ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteContract(c), variant: "destructive" });
    }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity]);

  // Columns
  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const columns: Column<Contract>[] = [
    {
      key: "select",
      header: <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(allFilteredIds)} aria-label="Tout sélectionner" />,
      accessor: (r) => (
        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelectId(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Sélectionner ${r.contractNumber}`} />
      ),
    },
    { key: "number", header: "Numéro", accessor: (r) => <span className="font-mono text-xs">{r.contractNumber}</span>, sortable: true, sortBy: (r) => r.contractNumber },
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
      key: "title", header: "Titre",
      accessor: (r) => (
        <div>
          <p className="text-sm font-medium">{r.title}</p>
          {r.quoteNumber && <p className="text-[10px] text-muted-foreground">Devis {r.quoteNumber}</p>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.title, hiddenOnMobile: true,
    },
    { key: "amount", header: "Montant", accessor: (r) => r.amountTtc ? <span className="font-semibold tabular-nums">{formatCurrency(r.amountTtc)}</span> : "—", sortable: true, sortBy: (r) => r.amountTtc ?? 0, hiddenOnMobile: true },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "signatures", header: "Signatures", accessor: (r) => (
        <div className="flex items-center gap-2">
          <span className={cn("flex items-center gap-1 text-xs", r.clientSignatureData ? "text-emerald-600" : "text-muted-foreground")}>
            <UserCheck className="h-3 w-3" /> Client
          </span>
          <span className={cn("flex items-center gap-1 text-xs", r.adminSignatureData ? "text-emerald-600" : "text-muted-foreground")}>
            <ShieldCheck className="h-3 w-3" /> Admin
          </span>
        </div>
      ), hiddenOnMobile: true,
    },
    { key: "created", header: "Créé le", accessor: (r) => formatDate(new Date(r.createdAt)), hiddenOnMobile: true },
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
            <DropdownMenuContent align="end" className="w-52">
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
      {/* Hero VNK navy */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <FileSignature className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Contrats</h1>
              <p className="text-white/70 text-sm mt-0.5">Signature électronique double — admin + client — facture auto à la signature complète</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kpis.pendingCount > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-300/30 rounded-lg px-3 py-2 backdrop-blur">
                <Clock className="h-4 w-4 text-amber-200" />
                <span className="text-sm font-semibold text-white">{kpis.pendingCount} en attente</span>
              </div>
            )}
            <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
              onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" />Nouveau contrat
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total contrats" value={kpis.total} icon={FileSignature} accent="bg-indigo-500" />
        <StatCard label="En attente" value={kpis.pendingCount} icon={Clock} accent="bg-amber-500" />
        <StatCard label="Signés" value={kpis.signedCount} icon={CheckCircle2} accent="bg-emerald-500" deltaLabel={`${kpis.signedThisMonth} ce mois`} />
        <StatCard label="Valeur signée" value={formatCurrency(kpis.totalValue)} icon={DollarSign} accent="bg-blue-500" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Numéro, titre, client..." className="pl-9" />
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
                          isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted")}>
                        {c.fullName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Montant TTC</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Min" value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} className="h-8 text-xs" />
                <Input type="number" placeholder="Max" value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Période d&apos;émission</p>
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

        <ViewToggle storageKey="contracts" defaultView="list" onChange={setView} />
      </div>

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
          {filtered.map((c) => (
            <EntityCard
              key={c.id}
              title={c.title}
              subtitle={`${c.contractNumber} — ${c.clientName}`}
              avatarName={c.clientName}
              alert={c.status === "expired"}
              badges={[
                { label: c.status === "pending" ? "En attente" : c.status === "draft" ? "Brouillon" : c.status === "signed" ? "Signé" : c.status === "expired" ? "Expiré" : c.status === "cancelled" ? "Annulé" : c.status, variant: c.status === "signed" ? "secondary" : c.status === "expired" || c.status === "cancelled" ? "destructive" : "outline" },
              ]}
              stats={[{ label: "Montant", value: c.amountTtc ? formatCurrency(c.amountTtc) : "—" }]}
              actions={getActions(c)}
              onClick={() => openEntity("contract", c.id)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <span className={cn(c.clientSignatureData ? "text-emerald-600" : "")}>
                      <UserCheck className="h-3 w-3 inline" /> Client
                    </span>
                    <span className={cn(c.adminSignatureData ? "text-emerald-600" : "")}>
                      <ShieldCheck className="h-3 w-3 inline" /> Admin
                    </span>
                  </div>
                  <span>{formatDate(new Date(c.createdAt))}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun contrat trouvé</div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => openEntity("contract", r.id)}
          searchPlaceholder="Rechercher..."
          exportFilename="contrats"
          storageKey="admin-contracts"
        />
      )}

      {/* Modale création VNK */}
      <ContractFormDialog
        open={createOpen}
        onOpenChange={(o) => { if (!o) { resetForm(); setCreateOpen(false); } else setCreateOpen(true); }}
        mode="create"
        clients={clients}
        submitting={submitting}
        values={{ clientId: fClientId, title: fTitle, content: fContent, amount: fAmount, status: fStatus, expiresAt: fExpiresAt }}
        setters={{
          setClientId: setFClientId, setTitle: setFTitle, setContent: setFContent,
          setAmount: setFAmount, setStatus: setFStatus, setExpiresAt: setFExpiresAt,
        }}
        onSubmit={handleCreate}
      />
      <ContractFormDialog
        open={!!editContract}
        onOpenChange={(o) => { if (!o) setEditContract(null); }}
        mode="edit"
        clients={clients}
        editingContractNumber={editContract?.contractNumber}
        submitting={submitting}
        values={{ clientId: fClientId, title: fTitle, content: fContent, amount: fAmount, status: fStatus, expiresAt: fExpiresAt }}
        setters={{
          setClientId: () => {}, setTitle: setFTitle, setContent: setFContent,
          setAmount: setFAmount, setStatus: setFStatus, setExpiresAt: setFExpiresAt,
        }}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={!!deleteContract}
        onOpenChange={(o) => { if (!o) setDeleteContract(null); }}
        title="Supprimer ce contrat ?"
        description={`Le contrat "${deleteContract?.contractNumber}" sera supprimé définitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      {/* PDF preview VNK */}
      {pdfContract && (
        <PdfViewerModal
          open
          onClose={() => setPdfContract(null)}
          pdfUrl={`/api/contracts/${pdfContract.id}/pdf`}
          title={pdfContract.title}
          documentNumber={pdfContract.contractNumber}
          downloadName={`contrat-${pdfContract.contractNumber}`}
        />
      )}

      {signingContract && (
        <SignatureDialog
          contractId={signingContract.id}
          contractNumber={signingContract.contractNumber}
          contractTitle={signingContract.title}
          contractAmount={signingContract.amountTtc ?? undefined}
          open={true}
          onOpenChange={(o) => { if (!o) setSigningContract(null); }}
        />
      )}

      {ConfirmModal}
    </div>
  );
}

// ─── ContractFormDialog VNK navy ─────────────────────────
type CFormValues = { clientId: string; title: string; content: string; amount: string; status: string; expiresAt: string };
type CFormSetters = {
  setClientId: (v: string) => void; setTitle: (v: string) => void; setContent: (v: string) => void;
  setAmount: (v: string) => void; setStatus: (v: string) => void; setExpiresAt: (v: string) => void;
};

function ContractFormDialog({
  open, onOpenChange, mode, clients, editingContractNumber, submitting, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  clients: ClientOption[];
  editingContractNumber?: string;
  submitting: boolean;
  values: CFormValues;
  setters: CFormSetters;
  onSubmit: () => void | Promise<void>;
}) {
  const isCreate = mode === "create";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isCreate ? <FileSignature className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white text-lg">
                {isCreate ? "Nouveau contrat" : "Modifier le contrat"}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {isCreate ? "Le numéro sera généré automatiquement (CT-AAAA-NNN)" : (editingContractNumber || "Modification")}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          <FormSection title="Identité" icon={<FileSignature className="h-3.5 w-3.5" />}>
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
              <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder="Contrat de service automatisation PLC" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Contenu / Clauses</Label>
              <Textarea value={values.content} onChange={(e) => setters.setContent(e.target.value)} rows={6} placeholder={isCreate ? "Termes et conditions du contrat…" : "Laisser vide pour ne pas modifier"} />
            </div>
          </FormSection>

          <FormSection title="Montant & échéance" icon={<DollarSign className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant TTC (CAD)</Label>
                <Input type="number" min="0" step="0.01" value={values.amount} onChange={(e) => setters.setAmount(e.target.value)} placeholder="0.00" />
              </div>
              {!isCreate && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date d&apos;expiration</Label>
                  <Input type="date" value={values.expiresAt} onChange={(e) => setters.setExpiresAt(e.target.value)} />
                </div>
              )}
            </div>
            {!isCreate && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Statut</Label>
                <Select value={values.status} onValueChange={setters.setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">En attente</SelectItem>
                    <SelectItem value="draft">Brouillon</SelectItem>
                    <SelectItem value="expired">Expiré</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormSection>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !values.title.trim() || (isCreate && !values.clientId)}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {submitting ? "Enregistrement…" : (isCreate ? "Créer le contrat" : "Enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

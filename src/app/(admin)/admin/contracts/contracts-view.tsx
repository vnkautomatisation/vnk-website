"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileSignature,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  PenTool,
  UserCheck,
  ShieldCheck,
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
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Contract = {
  id: number;
  contractNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  title: string;
  status: string;
  amountTtc: number | null;
  clientSignatureData: boolean;
  adminSignatureData: boolean;
  signedAt: string | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type StatusFilter = "all" | "pending" | "draft" | "signed" | "expired";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "draft", label: "Brouillon" },
  { key: "signed", label: "Signes" },
  { key: "expired", label: "Expires" },
];

export function ContractsView({
  contracts,
  clients,
}: {
  contracts: Contract[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const [view, setView] = useViewMode("contracts", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [newClientId, setNewClientId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newContent, setNewContent] = useState("");
  const [newStatus, setNewStatus] = useState("pending");

  // Edit/Delete
  const [editContract, setEditContract] = useState<Contract | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editStatus, setEditStatus] = useState("pending");
  const [editAmount, setEditAmount] = useState("");
  const [deleteContract, setDeleteContract] = useState<Contract | null>(null);

  const resetForm = () => { setNewClientId(""); setNewTitle(""); setNewContent(""); setNewStatus("pending"); };

  const openEdit = (c: Contract) => {
    setEditContract(c);
    setEditTitle(c.title);
    setEditContent("");
    setEditStatus(c.status);
    setEditAmount(c.amountTtc != null ? String(c.amountTtc) : "");
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editContract || !editTitle.trim()) return { success: false, error: "Titre requis" };
    try {
      const res = await fetch(`/api/contracts/${editContract.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim() || undefined,
          status: editStatus,
          amountTtc: editAmount ? Number(editAmount) : undefined,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteContract) return;
    const res = await fetch(`/api/contracts/${deleteContract.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Contrat supprime"); setDeleteContract(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newTitle.trim()) return { success: false, error: "Client et titre requis" };
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(newClientId),
          title: newTitle.trim(),
          content: newContent.trim() || undefined,
          status: newStatus,
        }),
      });
      if (res.ok) { resetForm(); router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const pendingCount = contracts.filter((c) => c.status === "pending").length;
  const signedCount = contracts.filter((c) => c.status === "signed").length;

  const filtered = useMemo(() => {
    let result = contracts;
    if (statusFilter !== "all") result = result.filter((c) => c.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.contractNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [contracts, statusFilter, searchQuery]);

  // Actions menu pour EntityCard
  const getActions = useCallback((c: Contract) => {
    const editable = !c.clientSignatureData && !c.signedAt;
    return [
      { label: "Voir", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => {} },
      ...(c.status === "pending" && !c.adminSignatureData ? [{
        label: "Signer",
        icon: <PenTool className="h-3.5 w-3.5" />,
        onClick: async () => {
          if (!confirm("Signer ce contrat en tant qu'admin ?")) return;
          const res = await fetch(`/api/contracts/${c.id}/sign`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ signatureData: "admin-signed-via-dashboard" }),
          });
          if (res.ok) { toast.success("Contrat signe"); router.refresh(); }
          else { const d = await res.json(); toast.error(d.error); }
        },
      }] : []),
      ...(editable ? [{ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(c) }] : []),
      ...(editable ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteContract(c), separator: true, variant: "destructive" as const }] : []),
    ];
  }, [router]);

  const columns: Column<Contract>[] = [
    { key: "number", header: "Numero", accessor: (r) => <span className="font-mono text-xs">{r.contractNumber}</span>, sortable: true, sortBy: (r) => r.contractNumber },
    { key: "client", header: "Client", accessor: (r) => (<div><div className="font-medium text-sm">{r.clientName}</div>{r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}</div>), sortable: true, sortBy: (r) => r.clientName },
    { key: "title", header: "Titre", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title, hiddenOnMobile: true },
    { key: "amount", header: "Montant", accessor: (r) => r.amountTtc ? formatCurrency(r.amountTtc) : "—", sortable: true, sortBy: (r) => r.amountTtc ?? 0, hiddenOnMobile: true },
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
    { key: "created", header: "Cree le", accessor: (r) => formatDate(new Date(r.createdAt)), hiddenOnMobile: true },
    {
      key: "actions", header: "", accessor: (r) => (
        <div className="flex gap-1">
          {r.status === "pending" && !r.adminSignatureData && (
            <Button variant="ghost" size="sm" title="Signer" className="text-blue-600"
              onClick={async () => {
                if (!confirm("Signer ce contrat en tant qu'admin ?")) return;
                const res = await fetch(`/api/contracts/${r.id}/sign`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ signatureData: "admin-signed-via-dashboard" }),
                });
                if (res.ok) { toast.success("Contrat signe"); router.refresh(); }
                else { const d = await res.json(); toast.error(d.error); }
              }}
            >
              <PenTool className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3"><FileSignature className="h-6 w-6" />Contrats</h1>
          <p className="text-muted-foreground text-sm mt-1">Gerer les contrats clients et leur signature</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4" />Nouveau contrat</Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total" value={contracts.length} icon={FileSignature} accent="bg-indigo-500" />
        <StatCard label="En attente" value={pendingCount} icon={Clock} accent="bg-amber-500" />
        <StatCard label="Signes" value={signedCount} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatCard label="Ce mois" value={contracts.filter((c) => new Date(c.createdAt) >= new Date(new Date().getFullYear(), new Date().getMonth(), 1)).length} icon={Plus} accent="bg-blue-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Numero, titre, client..." className="pl-9" />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)} className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors", statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {tab.label}
            </button>
          ))}
        </div>
        <ViewToggle storageKey="contracts" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((c) => (
            <EntityCard
              key={c.id}
              title={c.title}
              subtitle={`${c.contractNumber} — ${c.clientName}`}
              avatarName={c.clientName}
              badges={[
                { label: c.status === "pending" ? "En attente" : c.status === "draft" ? "Brouillon" : c.status === "signed" ? "Signe" : c.status === "expired" ? "Expire" : c.status, variant: c.status === "signed" ? "secondary" : "outline" },
              ]}
              stats={[
                { label: "Montant", value: c.amountTtc ? formatCurrency(c.amountTtc) : "—" },
              ]}
              actions={getActions(c)}
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
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun contrat trouve</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="contrats" storageKey="admin-contracts" />
      )}

      <EditModal open={!!editContract} onOpenChange={(o) => { if (!o) setEditContract(null); }} title="Modifier le contrat" description={editContract?.contractNumber} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Titre *</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Montant TTC (CAD)</Label><Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>Statut</Label>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
                <SelectItem value="expired">Expire</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Contenu</Label><Textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} rows={5} placeholder="Laisser vide pour ne pas modifier" /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteContract}
        onOpenChange={(o) => { if (!o) setDeleteContract(null); }}
        title="Supprimer ce contrat ?"
        description={`Le contrat "${deleteContract?.contractNumber}" sera supprime definitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouveau contrat" icon={FileSignature} accent="bg-indigo-500" submitLabel="Creer le contrat" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>{clients.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-title">Titre *</Label>
            <Input id="ct-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ct-content">Contenu / Clauses</Label>
            <Textarea id="ct-content" value={newContent} onChange={(e) => setNewContent(e.target.value)} rows={5} placeholder="Termes et conditions du contrat..." />
          </div>
          <div className="space-y-2">
            <Label>Statut initial</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En attente de signature</SelectItem>
                <SelectItem value="draft">Brouillon</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </CreateModal>
    </div>
  );
}

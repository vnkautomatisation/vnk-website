"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Receipt,
  Plus,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle2,
  CreditCard,
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

type Invoice = {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  title: string;
  status: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type StatusFilter = "all" | "unpaid" | "overdue" | "paid" | "cancelled";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "unpaid", label: "Non payees" },
  { key: "overdue", label: "En retard" },
  { key: "paid", label: "Payees" },
  { key: "cancelled", label: "Annulees" },
];

export function InvoicesView({
  invoices,
  clients,
  kpis,
}: {
  invoices: Invoice[];
  clients: ClientOption[];
  kpis: { unpaidTotal: number; overdueTotal: number; paidThisMonth: number; overdueCount: number };
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [view, setView] = useViewMode("invoices", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Edit/Delete
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editDue, setEditDue] = useState("");
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);

  // ── Creation form ────────────────────────────────────
  const [newClientId, setNewClientId] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const resetForm = () => { setNewClientId(""); setNewTitle(""); setNewDesc(""); setNewAmount(""); };

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

  const openEdit = (i: Invoice) => {
    setEditInvoice(i);
    setEditTitle(i.title);
    setEditDesc("");
    setEditAmount(String(i.amountHt));
    setEditDue(i.dueDate ? i.dueDate.slice(0, 10) : "");
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editInvoice || !editTitle.trim() || !editAmount) return { success: false, error: "Titre et montant requis" };
    try {
      const res = await fetch(`/api/invoices/${editInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || undefined,
          amountHt: Number(editAmount),
          dueDate: editDue || undefined,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteInvoice) return;
    const res = await fetch(`/api/invoices/${deleteInvoice.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Facture supprimee"); setDeleteInvoice(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newTitle.trim() || !newAmount) {
      return { success: false, error: "Client, titre et montant requis" };
    }
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(newClientId),
          title: newTitle.trim(),
          description: newDesc.trim() || undefined,
          amountHt: Number(newAmount),
        }),
      });
      if (res.ok) { resetForm(); router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  // Actions
  const handleMarkPaid = async (id: number, num: string) => {
    if (!confirm(`Marquer la facture ${num} comme payee ?`)) return;
    const res = await fetch(`/api/invoices/${id}/mark-paid`, { method: "POST" });
    if (res.ok) { toast.success("Facture marquee comme payee"); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  // ── Filtrage ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = invoices;
    if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.invoiceNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [invoices, statusFilter, searchQuery]);

  // Actions menu pour EntityCard
  const getActions = useCallback((inv: Invoice) => {
    const editable = inv.status !== "paid";
    return [
      { label: "Voir", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => {} },
      ...((inv.status === "unpaid" || inv.status === "overdue") ? [{ label: "Marquer payee", icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => handleMarkPaid(inv.id, inv.invoiceNumber) }] : []),
      ...(editable ? [{ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(inv) }] : []),
      ...(editable ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteInvoice(inv), separator: true, variant: "destructive" as const }] : []),
    ];
  }, []);

  const columns: Column<Invoice>[] = [
    { key: "number", header: "Numero", accessor: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span>, sortable: true, sortBy: (r) => r.invoiceNumber },
    { key: "client", header: "Client", accessor: (r) => (<div><div className="font-medium text-sm">{r.clientName}</div>{r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}</div>), sortable: true, sortBy: (r) => r.clientName },
    { key: "title", header: "Titre", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title, hiddenOnMobile: true },
    { key: "ht", header: "HT", accessor: (r) => formatCurrency(r.amountHt), sortable: true, sortBy: (r) => r.amountHt, hiddenOnMobile: true },
    { key: "ttc", header: "TTC", accessor: (r) => <span className="font-semibold">{formatCurrency(r.amountTtc)}</span>, sortable: true, sortBy: (r) => r.amountTtc },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "due", header: "Echeance", accessor: (r) => r.dueDate ? formatDate(new Date(r.dueDate)) : "—", hiddenOnMobile: true },
    { key: "paid", header: "Paye le", accessor: (r) => r.paidAt ? formatDate(new Date(r.paidAt)) : "—", hiddenOnMobile: true },
    {
      key: "actions", header: "", accessor: (r) => (
        <div className="flex gap-1">
          {(r.status === "unpaid" || r.status === "overdue") && (
            <Button variant="ghost" size="sm" onClick={() => handleMarkPaid(r.id, r.invoiceNumber)} title="Marquer payee" className="text-emerald-600">
              <CreditCard className="h-3.5 w-3.5" />
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
          <h1 className="text-2xl font-bold flex items-center gap-3"><Receipt className="h-6 w-6" />Factures</h1>
          <p className="text-muted-foreground text-sm mt-1">Creer des factures et confirmer les paiements</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4" />Nouvelle facture</Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total impaye" value={formatCurrency(kpis.unpaidTotal)} icon={Clock} accent="bg-amber-500" />
        <StatCard label="En retard" value={formatCurrency(kpis.overdueTotal)} icon={AlertTriangle} accent="bg-red-500" deltaLabel={`${kpis.overdueCount} facture${kpis.overdueCount > 1 ? "s" : ""}`} />
        <StatCard label="Paye ce mois" value={formatCurrency(kpis.paidThisMonth)} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatCard label="Total factures" value={invoices.length} icon={Receipt} accent="bg-blue-500" />
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
        <ViewToggle storageKey="invoices" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((inv) => (
            <EntityCard
              key={inv.id}
              title={inv.title}
              subtitle={`${inv.invoiceNumber} — ${inv.clientName}`}
              avatarName={inv.clientName}
              alert={inv.status === "overdue"}
              badges={[
                { label: inv.status === "unpaid" ? "Non payee" : inv.status === "overdue" ? "En retard" : inv.status === "paid" ? "Payee" : inv.status === "cancelled" ? "Annulee" : inv.status, variant: inv.status === "paid" ? "secondary" : inv.status === "overdue" ? "destructive" : "outline" },
              ]}
              stats={[
                { label: "TTC", value: formatCurrency(inv.amountTtc) },
              ]}
              actions={getActions(inv)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatCurrency(inv.amountHt)} HT</span>
                  <span>{inv.dueDate ? `Echeance ${formatDate(new Date(inv.dueDate))}` : "Pas d'echeance"}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucune facture trouvee</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="factures" storageKey="admin-invoices" />
      )}

      <EditModal open={!!editInvoice} onOpenChange={(o) => { if (!o) setEditInvoice(null); }} title="Modifier la facture" description={editInvoice?.invoiceNumber} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Titre *</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Montant HT (CAD) *</Label><Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>Echeance</Label><Input type="date" value={editDue} onChange={(e) => setEditDue(e.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteInvoice}
        onOpenChange={(o) => { if (!o) setDeleteInvoice(null); }}
        title="Supprimer cette facture ?"
        description={`La facture "${deleteInvoice?.invoiceNumber}" sera supprimee definitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouvelle facture" icon={Receipt} accent="bg-amber-500" submitLabel="Creer la facture" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>{clients.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-title">Titre *</Label>
            <Input id="i-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-amount">Montant HT (CAD) *</Label>
            <Input id="i-amount" type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" />
            {newAmount && Number(newAmount) > 0 && (
              <div className="text-xs text-muted-foreground space-y-0.5 mt-1 p-2 bg-muted rounded-md">
                <div>Sous-total HT : {formatCurrency(Number(newAmount))}</div>
                <div>TPS (5%) : {formatCurrency(Number(newAmount) * 0.05)}</div>
                <div>TVQ (9.975%) : {formatCurrency(Number(newAmount) * 0.09975)}</div>
                <div className="font-semibold">Total TTC : {formatCurrency(Number(newAmount) * 1.14975)}</div>
              </div>
            )}
          </div>
          <div className="space-y-2">
            <Label htmlFor="i-desc">Description</Label>
            <Textarea id="i-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
          </div>
        </div>
      </CreateModal>
    </div>
  );
}

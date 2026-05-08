"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  FileText,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
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
import { useConfirm } from "@/hooks/use-confirm";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import { toast } from "sonner";

type Quote = {
  id: number;
  quoteNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  title: string;
  status: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  expiryDate: string | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type StatusFilter = "all" | "pending" | "accepted" | "declined" | "expired";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "accepted", label: "Acceptes" },
  { key: "declined", label: "Refuses" },
  { key: "expired", label: "Expires" },
];

export function QuotesView({
  quotes,
  clients,
}: {
  quotes: Quote[];
  clients: ClientOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmModal } = useConfirm();
  const [view, setView] = useViewMode("quotes", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Edit/Delete
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDesc, setEditDesc] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editExpiry, setEditExpiry] = useState("");
  const [deleteQuote, setDeleteQuote] = useState<Quote | null>(null);

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

  const openEdit = (q: Quote) => {
    setEditQuote(q);
    setEditTitle(q.title);
    setEditDesc("");
    setEditAmount(String(q.amountHt));
    setEditExpiry(q.expiryDate ? q.expiryDate.slice(0, 10) : "");
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editQuote || !editTitle.trim() || !editAmount) return { success: false, error: "Titre et montant requis" };
    try {
      const res = await fetch(`/api/quotes/${editQuote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDesc.trim() || undefined,
          amountHt: Number(editAmount),
          expiryDate: editExpiry || undefined,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteQuote) return;
    const res = await fetch(`/api/quotes/${deleteQuote.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Devis supprime"); setDeleteQuote(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newTitle.trim() || !newAmount) {
      return { success: false, error: "Client, titre et montant requis" };
    }
    try {
      const res = await fetch("/api/quotes", {
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
  const handleAccept = async (id: number, num: string) => {
    const ok = await confirm({
      title: "Accepter ce devis ?",
      description: `Le devis ${num} sera marque comme accepte et un contrat sera genere automatiquement.`,
      confirmLabel: "Accepter",
      variant: "default",
    });
    if (!ok) return;
    const res = await fetch(`/api/quotes/${id}/accept`, { method: "POST" });
    if (res.ok) { toast.success("Devis accepte, contrat genere"); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error); }
  };

  // ── Compteurs ─────────────────────────────────────────
  const pendingCount = quotes.filter((q) => q.status === "pending").length;
  const acceptedCount = quotes.filter((q) => q.status === "accepted").length;
  const totalHt = quotes.filter((q) => q.status === "pending").reduce((s, q) => s + q.amountHt, 0);

  // ── Filtrage ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = quotes;
    if (statusFilter !== "all") result = result.filter((q) => q.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.quoteNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q)
      );
    }
    return result;
  }, [quotes, statusFilter, searchQuery]);

  // Actions menu pour EntityCard
  const getActions = useCallback((q: Quote) => {
    const editable = q.status !== "accepted";
    return [
      { label: "Voir", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => {} },
      ...(q.status === "pending" ? [{ label: "Accepter", icon: <CheckCircle2 className="h-3.5 w-3.5" />, onClick: () => handleAccept(q.id, q.quoteNumber) }] : []),
      ...(editable ? [{ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(q) }] : []),
      ...(editable ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteQuote(q), separator: true, variant: "destructive" as const }] : []),
    ];
  }, []);

  const columns: Column<Quote>[] = [
    { key: "number", header: "Numero", accessor: (r) => <span className="font-mono text-xs">{r.quoteNumber}</span>, sortable: true, sortBy: (r) => r.quoteNumber },
    { key: "client", header: "Client", accessor: (r) => (<div><div className="font-medium text-sm">{r.clientName}</div>{r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}</div>), sortable: true, sortBy: (r) => r.clientName },
    { key: "title", header: "Titre", accessor: (r) => r.title, sortable: true, sortBy: (r) => r.title, hiddenOnMobile: true },
    { key: "ht", header: "HT", accessor: (r) => formatCurrency(r.amountHt), sortable: true, sortBy: (r) => r.amountHt, hiddenOnMobile: true },
    { key: "ttc", header: "TTC", accessor: (r) => <span className="font-semibold">{formatCurrency(r.amountTtc)}</span>, sortable: true, sortBy: (r) => r.amountTtc },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "expiry", header: "Expiration", accessor: (r) => r.expiryDate ? formatDate(new Date(r.expiryDate)) : "—", hiddenOnMobile: true },
    {
      key: "actions", header: "", accessor: (r) => (
        <div className="flex gap-1">
          {r.status === "pending" && (
            <Button variant="ghost" size="sm" onClick={() => handleAccept(r.id, r.quoteNumber)} title="Accepter" className="text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5" />
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
          <h1 className="text-2xl font-bold flex items-center gap-3"><FileText className="h-6 w-6" />Devis</h1>
          <p className="text-muted-foreground text-sm mt-1">TPS et TVQ calcules automatiquement</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}><Plus className="h-4 w-4" />Nouveau devis</Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total devis" value={quotes.length} icon={FileText} accent="bg-blue-500" />
        <StatCard label="En attente" value={pendingCount} icon={Clock} accent="bg-amber-500" />
        <StatCard label="Acceptes" value={acceptedCount} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatCard label="En attente (HT)" value={formatCurrency(totalHt)} icon={AlertCircle} accent="bg-violet-500" />
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
        <ViewToggle storageKey="quotes" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((q) => (
            <EntityCard
              key={q.id}
              title={q.title}
              subtitle={`${q.quoteNumber} — ${q.clientName}`}
              avatarName={q.clientName}
              badges={[
                { label: q.status === "pending" ? "En attente" : q.status === "accepted" ? "Accepte" : q.status === "declined" ? "Refuse" : q.status === "expired" ? "Expire" : q.status, variant: q.status === "accepted" ? "secondary" : "outline" },
              ]}
              stats={[
                { label: "TTC", value: formatCurrency(q.amountTtc) },
              ]}
              actions={getActions(q)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatCurrency(q.amountHt)} HT</span>
                  <span>{q.expiryDate ? `Expire le ${formatDate(new Date(q.expiryDate))}` : "Pas d'expiration"}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun devis trouve</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="devis" storageKey="admin-quotes" />
      )}

      <EditModal open={!!editQuote} onOpenChange={(o) => { if (!o) setEditQuote(null); }} title="Modifier le devis" description={editQuote?.quoteNumber} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Titre *</Label><Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} /></div>
          <div className="space-y-2"><Label>Montant HT (CAD) *</Label><Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>Date d&apos;expiration</Label><Input type="date" value={editExpiry} onChange={(e) => setEditExpiry(e.target.value)} /></div>
          <div className="space-y-2"><Label>Description</Label><Textarea value={editDesc} onChange={(e) => setEditDesc(e.target.value)} rows={3} /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteQuote}
        onOpenChange={(o) => { if (!o) setDeleteQuote(null); }}
        title="Supprimer ce devis ?"
        description={`Le devis "${deleteQuote?.quoteNumber}" sera supprime definitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouveau devis" icon={FileText} accent="bg-blue-500" submitLabel="Creer le devis" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder="Selectionner" /></SelectTrigger>
              <SelectContent>{clients.map((c) => (<SelectItem key={c.id} value={String(c.id)}>{c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}</SelectItem>))}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-title">Titre *</Label>
            <Input id="q-title" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-amount">Montant HT (CAD) *</Label>
            <Input id="q-amount" type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" />
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
            <Label htmlFor="q-desc">Description</Label>
            <Textarea id="q-desc" value={newDesc} onChange={(e) => setNewDesc(e.target.value)} rows={3} />
          </div>
        </div>
      </CreateModal>

      {ConfirmModal}
    </div>
  );
}

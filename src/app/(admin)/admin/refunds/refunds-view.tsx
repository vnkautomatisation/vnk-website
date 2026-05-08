"use client";
import { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  RotateCcw,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  Eye,
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
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Refund = {
  id: number;
  refundNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
  reason: string;
  amount: number;
  tpsAmount: number;
  tvqAmount: number;
  totalAmount: number;
  status: string;
  notes: string | null;
  processedAt: string | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type InvoiceOption = { id: number; invoiceNumber: string };
type StatusFilter = "all" | "pending" | "processed" | "confirmed";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "processed", label: "Traites" },
  { key: "confirmed", label: "Confirmes" },
];

export function RefundsView({
  refunds,
  clients,
  invoices,
  kpis,
}: {
  refunds: Refund[];
  clients: ClientOption[];
  invoices: InvoiceOption[];
  kpis: { total: number; pending: number; processed: number };
}) {
  const router = useRouter();
  const [view, setView] = useViewMode("refunds", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [newClientId, setNewClientId] = useState("");
  const [newInvoiceId, setNewInvoiceId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const resetForm = () => {
    setNewClientId("");
    setNewInvoiceId("");
    setNewReason("");
    setNewAmount("");
    setNewNotes("");
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newReason.trim() || !newAmount) {
      return { success: false, error: "Client, raison et montant requis" };
    }
    try {
      const res = await fetch("/api/refunds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(newClientId),
          invoiceId: newInvoiceId ? Number(newInvoiceId) : undefined,
          reason: newReason.trim(),
          amount: Number(newAmount),
          notes: newNotes.trim() || undefined,
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
    let result = refunds;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.refundNumber.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      );
    }
    return result;
  }, [refunds, statusFilter, searchQuery]);

  // Actions menu pour EntityCard
  const getActions = useCallback((r: Refund) => [
    { label: "Voir", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => {} },
  ], []);

  const columns: Column<Refund>[] = [
    {
      key: "number",
      header: "Numero",
      accessor: (r) => <span className="font-mono text-xs">{r.refundNumber}</span>,
      sortable: true,
      sortBy: (r) => r.refundNumber,
    },
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
      key: "invoice",
      header: "Facture liee",
      accessor: (r) => r.invoiceNumber ? <span className="font-mono text-xs">{r.invoiceNumber}</span> : "—",
      hiddenOnMobile: true,
    },
    { key: "reason", header: "Raison", accessor: (r) => <span className="text-sm">{r.reason}</span>, hiddenOnMobile: true },
    {
      key: "amount",
      header: "Montant",
      accessor: (r) => <span className="font-semibold">{formatCurrency(r.totalAmount)}</span>,
      sortable: true,
      sortBy: (r) => r.totalAmount,
    },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
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
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <RotateCcw className="h-6 w-6" />
            Remboursements
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Suivi des remboursements clients</p>
        </div>
        <Button onClick={() => { resetForm(); setCreateOpen(true); }}>
          <Plus className="h-4 w-4" />
          Nouveau remboursement
        </Button>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Total" value={kpis.total} icon={RotateCcw} accent="bg-blue-500" />
        <StatCard label="En attente" value={kpis.pending} icon={Clock} accent="bg-amber-500" />
        <StatCard label="Traites" value={kpis.processed} icon={CheckCircle2} accent="bg-emerald-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Numero, client, raison..." className="pl-9" />
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
        <ViewToggle storageKey="refunds" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => (
            <EntityCard
              key={r.id}
              title={r.refundNumber}
              subtitle={r.clientName}
              avatarName={r.clientName}
              badges={[
                { label: r.status === "pending" ? "En attente" : r.status === "processed" ? "Traite" : r.status === "confirmed" ? "Confirme" : r.status, variant: r.status === "confirmed" ? "secondary" : r.status === "pending" ? "destructive" : "outline" },
              ]}
              stats={[
                { label: "Montant TTC", value: formatCurrency(r.totalAmount) },
              ]}
              actions={getActions(r)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span className="truncate max-w-[60%]">{r.reason}</span>
                  <span>{formatDate(new Date(r.createdAt))}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun remboursement trouve</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="remboursements" storageKey="admin-refunds" />
      )}

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouveau remboursement" icon={RotateCcw} accent="bg-amber-500" submitLabel="Creer le remboursement" onSubmit={handleCreate}>
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
            <Label>Facture liee</Label>
            <Select value={newInvoiceId} onValueChange={setNewInvoiceId}>
              <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
              <SelectContent>
                {invoices.map((inv) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>{inv.invoiceNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rf-reason">Raison *</Label>
            <Textarea id="rf-reason" value={newReason} onChange={(e) => setNewReason(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rf-amount">Montant HT (CAD) *</Label>
            <Input id="rf-amount" type="number" step="0.01" value={newAmount} onChange={(e) => setNewAmount(e.target.value)} placeholder="0.00" />
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
            <Label htmlFor="rf-notes">Notes</Label>
            <Textarea id="rf-notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} />
          </div>
        </div>
      </CreateModal>
    </div>
  );
}

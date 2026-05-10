"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RotateCcw,
  Plus,
  Search,
  Clock,
  CheckCircle2,
  Eye,
  Pencil,
  Trash2,
  CreditCard,
  ExternalLink,
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
import { useEntityPanels } from "@/hooks/use-entity-panels";
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
  invoiceStripePaymentIntentId: string | null;
  stripeRefundId: string | null;
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
  const { open: openEntity } = useEntityPanels();
  const [view, setView] = useViewMode("refunds", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [newClientId, setNewClientId] = useState("");
  const [newInvoiceId, setNewInvoiceId] = useState("");
  const [newReason, setNewReason] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newNotes, setNewNotes] = useState("");

  // Sticky scroll detection (Wix pattern)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const obs = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 }
    );
    obs.observe(sentinel);
    return () => obs.disconnect();
  }, []);

  // Edit/Delete
  const [editRefund, setEditRefund] = useState<Refund | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editStatus, setEditStatus] = useState("pending");
  const [editNotes, setEditNotes] = useState("");
  const [deleteRefund, setDeleteRefund] = useState<Refund | null>(null);

  // Stripe processing
  const [stripeRefund, setStripeRefund] = useState<Refund | null>(null);
  const [processingStripe, setProcessingStripe] = useState(false);

  const handleProcessStripe = async () => {
    if (!stripeRefund) return;
    setProcessingStripe(true);
    try {
      const res = await fetch(`/api/refunds/${stripeRefund.id}/process-stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "requested_by_customer" }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Remboursement émis via Stripe — délai bancaire 5–10 jours");
        setStripeRefund(null);
        router.refresh();
      } else {
        toast.error(data.error ?? "Erreur Stripe");
      }
    } catch {
      toast.error("Erreur réseau");
    } finally {
      setProcessingStripe(false);
    }
  };

  const resetForm = () => {
    setNewClientId("");
    setNewInvoiceId("");
    setNewReason("");
    setNewAmount("");
    setNewNotes("");
  };

  const openEdit = (r: Refund) => {
    setEditRefund(r);
    setEditReason(r.reason);
    setEditAmount(String(r.amount));
    setEditStatus(r.status);
    setEditNotes(r.notes ?? "");
  };

  const handleEdit = async (): Promise<{ success: boolean; error?: string }> => {
    if (!editRefund || !editReason.trim() || !editAmount) return { success: false, error: "Raison et montant requis" };
    try {
      const res = await fetch(`/api/refunds/${editRefund.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: editReason.trim(),
          amount: Number(editAmount),
          status: editStatus,
          notes: editNotes.trim() || undefined,
        }),
      });
      if (res.ok) { router.refresh(); return { success: true }; }
      const data = await res.json();
      return { success: false, error: data.error || "Erreur" };
    } catch { return { success: false, error: "Erreur reseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteRefund) return;
    const res = await fetch(`/api/refunds/${deleteRefund.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Remboursement supprime"); setDeleteRefund(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
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
  const getActions = useCallback((r: Refund) => {
    const editable = r.status !== "processed" && !r.processedAt;
    const stripeEligible = r.status === "pending"
      && !r.stripeRefundId
      && !!r.invoiceStripePaymentIntentId;
    return [
      { label: "Voir client", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("client", r.clientId) },
      ...(stripeEligible ? [{ label: "Traiter via Stripe", icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => setStripeRefund(r) }] : []),
      ...(r.stripeRefundId ? [{ label: "Voir sur Stripe", icon: <ExternalLink className="h-3.5 w-3.5" />, onClick: () => window.open(`https://dashboard.stripe.com/refunds/${r.stripeRefundId}`, "_blank") }] : []),
      ...(editable ? [{ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(r) }] : []),
      ...(editable ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteRefund(r), separator: true, variant: "destructive" as const }] : []),
    ];
  }, [openEntity]);

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
      key: "stripe",
      header: "Stripe",
      accessor: (r) => {
        if (r.stripeRefundId) {
          return (
            <a
              href={`https://dashboard.stripe.com/refunds/${r.stripeRefundId}`}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium hover:bg-emerald-100"
              onClick={(e) => e.stopPropagation()}
            >
              <CheckCircle2 className="h-3 w-3" />
              Émis
              <ExternalLink className="h-2.5 w-2.5 opacity-60" />
            </a>
          );
        }
        if (r.status === "pending" && r.invoiceStripePaymentIntentId) {
          return (
            <button
              onClick={(e) => { e.stopPropagation(); setStripeRefund(r); }}
              className="inline-flex items-center gap-1 text-[10px] text-white bg-[#0F2D52] hover:bg-[#15406d] px-2 py-1 rounded font-medium transition-colors"
            >
              <CreditCard className="h-3 w-3" />
              Émettre
            </button>
          );
        }
        if (r.status === "pending" && !r.invoiceStripePaymentIntentId) {
          return <span className="text-[10px] text-muted-foreground italic">Non Stripe</span>;
        }
        return <span className="text-[10px] text-muted-foreground italic">—</span>;
      },
      hiddenOnMobile: true,
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

      {/* Sentinel — détecte quand les StatCards quittent le viewport */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />

      {/* Barre de filtres — devient sticky au scroll, affiche un récap KPI compact quand scrolled */}
      <div
        className={cn(
          "sticky top-[64px] z-20 bg-background -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-shadow",
          scrolled && "shadow-sm border-b"
        )}
      >
        {scrolled && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <RotateCcw className="h-4 w-4" />
              Remboursements
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">Total :</span>
              <span className="font-bold text-[#0F2D52]">{kpis.total}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">En attente :</span>
              <span className="font-bold text-amber-600">{kpis.pending}</span>
            </span>
            <span className="flex items-baseline gap-1.5">
              <span className="text-muted-foreground">Traites :</span>
              <span className="font-bold text-emerald-600">{kpis.processed}</span>
            </span>
            <span className="ml-auto text-muted-foreground">{filtered.length} affichés</span>
          </div>
        )}
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

      <EditModal open={!!editRefund} onOpenChange={(o) => { if (!o) setEditRefund(null); }} title="Modifier le remboursement" description={editRefund?.refundNumber} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>Raison *</Label><Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={3} /></div>
          <div className="space-y-2"><Label>Montant HT (CAD) *</Label><Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>Statut</Label>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">En attente</SelectItem>
                <SelectItem value="processed">Traite</SelectItem>
                <SelectItem value="confirmed">Confirme</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Notes</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteRefund}
        onOpenChange={(o) => { if (!o) setDeleteRefund(null); }}
        title="Supprimer ce remboursement ?"
        description={`Le remboursement "${deleteRefund?.refundNumber}" sera supprime definitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!stripeRefund}
        onOpenChange={(o) => { if (!o) setStripeRefund(null); }}
        title="Émettre le remboursement via Stripe ?"
        description={
          stripeRefund
            ? `${formatCurrency(stripeRefund.totalAmount)} sera remboursé sur la carte du client (facture ${stripeRefund.invoiceNumber ?? "—"}). Cette action appelle directement l'API Stripe — délai bancaire 5 à 10 jours ouvrables avant que le client voie le crédit.`
            : ""
        }
        confirmLabel={processingStripe ? "Émission en cours…" : "Émettre via Stripe"}
        onConfirm={handleProcessStripe}
      />

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

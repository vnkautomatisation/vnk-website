"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle2,
  Eye,
  Pencil,
  Trash2,
  CreditCard,
  ExternalLink,
  Download,
  X,
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
import { CreateModal } from "@/components/admin/create-modal";
import { EditModal } from "@/components/admin/edit-modal";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ActionTooltip } from "@/components/ui/action-tooltip";
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
  { key: "processed", label: "Traités" },
  { key: "confirmed", label: "Confirmés" },
];

function csvEscape(v: string | number | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

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
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
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
        toast.success("Remboursement émis — délai bancaire 5 à 10 jours ouvrables");
        setStripeRefund(null);
        router.refresh();
      } else {
        toast.error(data.error ?? "Erreur lors de l'émission");
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
    } catch { return { success: false, error: "Erreur réseau" }; }
  };

  const handleDelete = async () => {
    if (!deleteRefund) return;
    const res = await fetch(`/api/refunds/${deleteRefund.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Remboursement supprimé"); setDeleteRefund(null); router.refresh(); }
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
      return { success: false, error: "Erreur réseau" };
    }
  };

  const filtered = useMemo(() => {
    let result = refunds;
    if (statusFilter !== "all") result = result.filter((r) => r.status === statusFilter);
    if (dateFrom) result = result.filter((r) => new Date(r.createdAt) >= new Date(dateFrom));
    if (dateTo) {
      const t = new Date(dateTo); t.setDate(t.getDate() + 1);
      result = result.filter((r) => new Date(r.createdAt) <= t);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.refundNumber.toLowerCase().includes(q) ||
          r.clientName.toLowerCase().includes(q) ||
          (r.companyName ?? "").toLowerCase().includes(q) ||
          (r.invoiceNumber ?? "").toLowerCase().includes(q) ||
          r.reason.toLowerCase().includes(q)
      );
    }
    return result;
  }, [refunds, statusFilter, dateFrom, dateTo, searchQuery]);

  // Export CSV des remboursements filtrés
  const exportCsv = () => {
    const headers = [
      "Numéro",
      "Client",
      "Entreprise",
      "Facture liée",
      "Raison",
      "Montant HT",
      "TPS",
      "TVQ",
      "Total TTC",
      "Statut",
      "ID Stripe",
      "Date création",
      "Date traitement",
      "Notes",
    ];
    const lines = [headers.map(csvEscape).join(",")];
    filtered.forEach((r) => {
      const statusLabel = r.status === "pending" ? "En attente" : r.status === "processed" ? "Traité" : r.status === "confirmed" ? "Confirmé" : r.status;
      lines.push([
        r.refundNumber,
        r.clientName,
        r.companyName ?? "",
        r.invoiceNumber ?? "",
        r.reason,
        r.amount.toFixed(2),
        r.tpsAmount.toFixed(2),
        r.tvqAmount.toFixed(2),
        r.totalAmount.toFixed(2),
        statusLabel,
        r.stripeRefundId ?? "",
        r.createdAt.slice(0, 10),
        r.processedAt ? r.processedAt.slice(0, 10) : "",
        r.notes ?? "",
      ].map(csvEscape).join(","));
    });
    const csv = lines.join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `remboursements_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Actions menu pour EntityCard
  const getActions = useCallback((r: Refund) => {
    const editable = r.status !== "processed" && !r.processedAt;
    const stripeEligible = r.status === "pending"
      && !r.stripeRefundId
      && !!r.invoiceStripePaymentIntentId;
    return [
      { label: "Voir client", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("client", r.clientId) },
      ...(stripeEligible ? [{ label: "Émettre via la plateforme", icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => setStripeRefund(r) }] : []),
      ...(r.stripeRefundId ? [{ label: "Voir sur la plateforme", icon: <ExternalLink className="h-3.5 w-3.5" />, onClick: () => window.open(`https://dashboard.stripe.com/refunds/${r.stripeRefundId}`, "_blank") }] : []),
      ...(editable ? [{ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(r) }] : []),
      ...(editable ? [{ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteRefund(r), separator: true, variant: "destructive" as const }] : []),
    ];
  }, [openEntity]);

  const columns: Column<Refund>[] = [
    {
      key: "number",
      header: "Numéro",
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
      header: "Facture liée",
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
      header: "Paiement en ligne",
      accessor: (r) => {
        if (r.stripeRefundId) {
          return (
            <ActionTooltip label="Ouvrir le remboursement sur la plateforme de paiement">
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
            </ActionTooltip>
          );
        }
        if (r.status === "pending" && r.invoiceStripePaymentIntentId) {
          return (
            <ActionTooltip label="Émettre le remboursement automatiquement sur la carte du client">
              <button
                onClick={(e) => { e.stopPropagation(); setStripeRefund(r); }}
                className="inline-flex items-center gap-1 text-[10px] text-white bg-[#0F2D52] hover:bg-[#15406d] px-2 py-1 rounded font-medium transition-colors"
              >
                <CreditCard className="h-3 w-3" />
                Émettre
              </button>
            </ActionTooltip>
          );
        }
        if (r.status === "pending" && !r.invoiceStripePaymentIntentId) {
          return (
            <ActionTooltip label="Pas de paiement en ligne lié — remboursement à traiter manuellement (chèque, virement…)">
              <span className="text-[10px] text-muted-foreground italic cursor-help">Manuel</span>
            </ActionTooltip>
          );
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

  const totalAmount = filtered.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <div className="space-y-5">
      {/* Hero VNK */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              Remboursements
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              {kpis.total} remboursement{kpis.total > 1 ? "s" : ""} · {kpis.pending} en attente · {kpis.processed} traité{kpis.processed > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={exportCsv} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              Exporter CSV
            </Button>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm" variant="secondary" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1" />
              Nouveau remboursement
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Total</p>
          <p className="text-lg font-bold tabular-nums">{kpis.total}</p>
          <p className="text-[10px] text-muted-foreground">remboursements émis</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">En attente</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{kpis.pending}</p>
          <p className="text-[10px] text-muted-foreground">à traiter</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Traités</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{kpis.processed}</p>
          <p className="text-[10px] text-muted-foreground">complétés</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Montant filtré</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
          <p className="text-[10px] text-muted-foreground">{filtered.length} affiché{filtered.length > 1 ? "s" : ""}</p>
        </div>
      </div>

      {/* Sentinel + sticky bar */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />
      <div
        className={cn(
          "sticky top-[64px] z-20 bg-background -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-shadow",
          scrolled && "shadow-sm border-b backdrop-blur"
        )}
      >
        {scrolled && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <RotateCcw className="h-4 w-4" />
              Remboursements
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            <span className="text-muted-foreground">En attente <span className="font-semibold text-amber-600">{kpis.pending}</span></span>
            <span className="text-muted-foreground">Traités <span className="font-semibold text-emerald-600">{kpis.processed}</span></span>
            <span className="ml-auto text-muted-foreground">Montant <span className="font-semibold">{formatCurrency(totalAmount)}</span></span>
          </div>
        )}

        {/* Première ligne : recherche + dates + view toggle */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Label className="text-[10px]">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Numéro, client, facture, raison…"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">Du</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div>
            <Label className="text-[10px]">Au</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
          </div>
          {(dateFrom || dateTo) && (
            <Button onClick={() => { setDateFrom(""); setDateTo(""); }} size="sm" variant="ghost" className="h-9">
              <X className="h-3.5 w-3.5 mr-1" />
              Effacer
            </Button>
          )}
          <ViewToggle storageKey="refunds" defaultView="list" onChange={setView} />
        </div>

        {/* Deuxième ligne : tabs statut */}
        <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto mt-2 w-fit max-w-full">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
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
                { label: r.status === "pending" ? "En attente" : r.status === "processed" ? "Traité" : r.status === "confirmed" ? "Confirmé" : r.status, variant: r.status === "confirmed" ? "secondary" : r.status === "pending" ? "destructive" : "outline" },
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
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun remboursement trouvé</div>
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
                <SelectItem value="processed">Traité</SelectItem>
                <SelectItem value="confirmed">Confirmé</SelectItem>
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
        description={`Le remboursement "${deleteRefund?.refundNumber}" sera supprimé définitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!stripeRefund}
        onOpenChange={(o) => { if (!o) setStripeRefund(null); }}
        title="Émettre le remboursement ?"
        description={
          stripeRefund
            ? `${formatCurrency(stripeRefund.totalAmount)} sera remboursé sur la carte du client (facture ${stripeRefund.invoiceNumber ?? "—"}). Délai bancaire de 5 à 10 jours ouvrables avant que le client voie le crédit.`
            : ""
        }
        confirmLabel={processingStripe ? "Émission en cours…" : "Émettre"}
        onConfirm={handleProcessStripe}
      />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title="Nouveau remboursement" icon={RotateCcw} accent="bg-amber-500" submitLabel="Créer le remboursement" onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Client *</Label>
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
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
            <Label>Facture liée</Label>
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

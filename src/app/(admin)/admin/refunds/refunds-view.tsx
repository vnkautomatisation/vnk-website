"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
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
import { cn, formatDate } from "@/lib/utils";


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

const STATUS_TABS: { key: StatusFilter; labelKey: string }[] = [
  { key: "all", labelKey: "tous" },
  { key: "pending", labelKey: "attente" },
  { key: "processed", labelKey: "traites" },
  { key: "confirmed", labelKey: "confirmes" },
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
  const t = useTranslations("admin.refunds");
  const tc = useTranslations("common");
  const router = useRouter();
  const formatCurrency = useCurrency();
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


  const [editRefund, setEditRefund] = useState<Refund | null>(null);
  const [editReason, setEditReason] = useState("");
  const [editAmount, setEditAmount] = useState("");
  const [editStatus, setEditStatus] = useState("pending");
  const [editNotes, setEditNotes] = useState("");
  const [deleteRefund, setDeleteRefund] = useState<Refund | null>(null);


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
        toast.success(t("remboursement_emis_delai_bancaire_5"));
        setStripeRefund(null);
        router.refresh();
      } else {
        toast.error(data.error ?? t("erreur_lors_emission"));
      }
    } catch {
      toast.error(t("erreur_reseau"));
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
    if (!editRefund || !editReason.trim() || !editAmount) return { success: false, error: t("raison_montant_requis") };
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
      return { success: false, error: data.error || t("erreur") };
    } catch { return { success: false, error: t("erreur_reseau") }; }
  };

  const handleDelete = async () => {
    if (!deleteRefund) return;
    const res = await fetch(`/api/refunds/${deleteRefund.id}`, { method: "DELETE" });
    if (res.ok) { toast.success(t("remboursement_supprime")); setDeleteRefund(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleCreate = async (): Promise<{ success: boolean; error?: string }> => {
    if (!newClientId || !newReason.trim() || !newAmount) {
      return { success: false, error: t("client_raison_montant_requis") };
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
      return { success: false, error: data.error || t("erreur") };
    } catch {
      return { success: false, error: t("erreur_reseau") };
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


  const exportCsv = () => {
    const headers = [
      t("numero"),
      t("client"),
      t("entreprise"),
      t("facture_liee"),
      t("raison"),
      t("montant_ht"),
      "TPS",
      "TVQ",
      t("total_ttc"),
      t("statut"),
      t("id_stripe"),
      t("date_creation"),
      t("date_traitement"),
      t("notes"),
    ];
    const lines = [headers.map(csvEscape).join(",")];
    filtered.forEach((r) => {
      const statusLabel = r.status === "pending" ? t("attente") : r.status === "processed" ? t("traite") : r.status === "confirmed" ? t("confirme") : r.status;
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


  const getActions = useCallback((r: Refund) => {
    const editable = r.status !== "processed" && !r.processedAt;
    const stripeEligible = r.status === "pending"
      && !r.stripeRefundId
      && !!r.invoiceStripePaymentIntentId;
    return [
      { label: t("voir_client"), icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("client", r.clientId) },
      ...(stripeEligible ? [{ label: t("emettre_via_plateforme"), icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => setStripeRefund(r) }] : []),
      ...(r.stripeRefundId ? [{ label: t("voir_plateforme"), icon: <ExternalLink className="h-3.5 w-3.5" />, onClick: () => window.open(`https://dashboard.stripe.com/refunds/${r.stripeRefundId}`, "_blank") }] : []),
      ...(editable ? [{ label: t("modifier"), icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(r) }] : []),
      ...(editable ? [{ label: t("supprimer"), icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteRefund(r), separator: true, variant: "destructive" as const }] : []),
    ];
  }, [openEntity]);

  const columns: Column<Refund>[] = [
    {
      key: "number",
      header: t("numero"),
      accessor: (r) => <span className="font-mono text-xs">{r.refundNumber}</span>,
      sortable: true,
      sortBy: (r) => r.refundNumber,
    },
    {
      key: "client",
      header: t("client"),
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
      header: t("facture_liee"),
      accessor: (r) => r.invoiceNumber ? <span className="font-mono text-xs">{r.invoiceNumber}</span> : "—",
      hiddenOnMobile: true,
    },
    { key: "reason", header: t("raison"), accessor: (r) => <span className="text-sm">{r.reason}</span>, hiddenOnMobile: true },
    {
      key: "amount",
      header: t("montant"),
      accessor: (r) => <span className="font-semibold">{formatCurrency(r.totalAmount)}</span>,
      sortable: true,
      sortBy: (r) => r.totalAmount,
    },
    { key: "status", header: t("statut"), accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "stripe",
      header: t("paiement_ligne"),
      accessor: (r) => {
        if (r.stripeRefundId) {
          return (
            <ActionTooltip label={t("ouvrir_remboursement_plateforme_paiement")}>
              <a
                href={`https://dashboard.stripe.com/refunds/${r.stripeRefundId}`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[10px] text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium hover:bg-emerald-100"
                onClick={(e) => e.stopPropagation()}
              >
                <CheckCircle2 className="h-3 w-3" />
                {t("emis")}
                <ExternalLink className="h-2.5 w-2.5 opacity-60" />
              </a>
            </ActionTooltip>
          );
        }
        if (r.status === "pending" && r.invoiceStripePaymentIntentId) {
          return (
            <ActionTooltip label={t("emettre_remboursement_automatiquement_carte_client")}>
              <button
                onClick={(e) => { e.stopPropagation(); setStripeRefund(r); }}
                className="inline-flex items-center gap-1 text-[10px] text-white bg-[#0F2D52] hover:bg-[#15406d] px-2 py-1 rounded font-medium transition-colors"
              >
                <CreditCard className="h-3 w-3" />
                {t("emettre")}
              </button>
            </ActionTooltip>
          );
        }
        if (r.status === "pending" && !r.invoiceStripePaymentIntentId) {
          return (
            <ActionTooltip label={t("pas_paiement_ligne_lie_remboursement")}>
              <span className="text-[10px] text-muted-foreground italic cursor-help">{t("manuel")}</span>
            </ActionTooltip>
          );
        }
        return <span className="text-[10px] text-muted-foreground italic">—</span>;
      },
      hiddenOnMobile: true,
    },
    {
      key: "date",
      header: t("date"),
      accessor: (r) => formatDate(new Date(r.createdAt)),
      sortable: true,
      sortBy: (r) => r.createdAt,
      hiddenOnMobile: true,
    },
  ];

  const totalAmount = filtered.reduce((s, r) => s + r.totalAmount, 0);

  return (
    <div className="space-y-5">

      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <RotateCcw className="h-5 w-5" />
              {t("remboursements")}
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              {t("n_remboursements_resume", { total: kpis.total, pending: kpis.pending, processed: kpis.processed })}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={exportCsv} size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Download className="h-3.5 w-3.5 mr-1.5" />
              {t("exporter_csv")}
            </Button>
            <Button onClick={() => { resetForm(); setCreateOpen(true); }} size="sm" variant="secondary" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
              <Plus className="h-3.5 w-3.5 mr-1" />
              {t("nouveau_remboursement")}
            </Button>
          </div>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("total")}</p>
          <p className="text-lg font-bold tabular-nums">{kpis.total}</p>
          <p className="text-[10px] text-muted-foreground">{t("remboursements_emis")}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("attente")}</p>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{kpis.pending}</p>
          <p className="text-[10px] text-muted-foreground">{t("traiter")}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("traites")}</p>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{kpis.processed}</p>
          <p className="text-[10px] text-muted-foreground">{t("completes")}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("montant_filtre")}</p>
          <p className="text-lg font-bold tabular-nums">{formatCurrency(totalAmount)}</p>
          <p className="text-[10px] text-muted-foreground">{tc("shown_m", { count: filtered.length })}</p>
        </div>
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />


      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <RotateCcw className="h-4 w-4" />
              {t("remboursements")}
            </span>
            <span className="font-semibold">{tc("shown_m", { count: filtered.length })}</span>
            <span className="text-muted-foreground">{t("attente")} <span className="font-semibold text-amber-600">{kpis.pending}</span></span>
            <span className="text-muted-foreground">{t("traites")} <span className="font-semibold text-emerald-600">{kpis.processed}</span></span>
            <span className="ml-auto text-muted-foreground">{tc("amount")} <span className="font-semibold">{formatCurrency(totalAmount)}</span></span>
          </div>
        </div>
      )}


      <div>

        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Label className="text-[10px]">{t("recherche")}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("numero_client_facture_raison")}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]">{t("du")}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36" />
          </div>
          <div>
            <Label className="text-[10px]">{t("au")}</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36" />
          </div>
          {(dateFrom || dateTo) && (
            <Button onClick={() => { setDateFrom(""); setDateTo(""); }} size="sm" variant="ghost" className="h-9">
              <X className="h-3.5 w-3.5 mr-1" />
              {t("effacer")}
            </Button>
          )}
          <ViewToggle storageKey="refunds" defaultView="list" onChange={setView} />
        </div>


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
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
      </div>


      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((r) => (
            <EntityCard
              key={r.id}
              title={r.refundNumber}
              subtitle={r.clientName}
              avatarName={r.clientName}
              badges={[
                { label: r.status === "pending" ? t("attente") : r.status === "processed" ? t("traite") : r.status === "confirmed" ? t("confirme") : r.status, variant: r.status === "confirmed" ? "secondary" : r.status === "pending" ? "destructive" : "outline" },
              ]}
              stats={[
                { label: t("montant_ttc"), value: formatCurrency(r.totalAmount) },
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
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">{t("aucun_remboursement_trouve")}</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder={t("rechercher")} exportFilename="remboursements" storageKey="admin-refunds" />
      )}

      <EditModal open={!!editRefund} onOpenChange={(o) => { if (!o) setEditRefund(null); }} title={t("modifier_remboursement")} description={editRefund?.refundNumber} icon={Pencil} accent="bg-amber-500" onSubmit={handleEdit}>
        <div className="space-y-4">
          <div className="space-y-2"><Label>{t("raison")}</Label><Textarea value={editReason} onChange={(e) => setEditReason(e.target.value)} rows={3} /></div>
          <div className="space-y-2"><Label>{t("montant_ht_cad")}</Label><Input type="number" step="0.01" value={editAmount} onChange={(e) => setEditAmount(e.target.value)} /></div>
          <div className="space-y-2"><Label>{tc("status")}</Label>
            <Select value={editStatus} onValueChange={setEditStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="pending">{t("attente")}</SelectItem>
                <SelectItem value="processed">{t("traite")}</SelectItem>
                <SelectItem value="confirmed">{t("confirme")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>{t("notes")}</Label><Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} rows={2} /></div>
        </div>
      </EditModal>

      <ConfirmDialog
        open={!!deleteRefund}
        onOpenChange={(o) => { if (!o) setDeleteRefund(null); }}
        title={t("supprimer_remboursement")}
        description={t("refunds_view_le_remboursement_p0_sera_supprime_definitivement", { p0: (deleteRefund?.refundNumber ?? "") })}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
      />

      <ConfirmDialog
        open={!!stripeRefund}
        onOpenChange={(o) => { if (!o) setStripeRefund(null); }}
        title={t("emettre_remboursement")}
        description={
          stripeRefund
            ? t("refunds_view_p0_sera_rembourse_sur_la_carte_du_client", { p0: formatCurrency(stripeRefund.totalAmount), p1: stripeRefund.invoiceNumber ?? "—" })
            : ""
        }
        confirmLabel={processingStripe ? t("emission_cours") : t("emettre")}
        onConfirm={handleProcessStripe}
      />

      <CreateModal open={createOpen} onOpenChange={setCreateOpen} title={t("nouveau_remboursement")} icon={RotateCcw} accent="bg-amber-500" submitLabel={t("creer_remboursement")} onSubmit={handleCreate}>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>{t("client")}</Label>
            <Select value={newClientId} onValueChange={setNewClientId}>
              <SelectTrigger><SelectValue placeholder={t("selectionner")} /></SelectTrigger>
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
            <Label>{t("facture_liee")}</Label>
            <Select value={newInvoiceId} onValueChange={setNewInvoiceId}>
              <SelectTrigger><SelectValue placeholder={t("aucune")} /></SelectTrigger>
              <SelectContent>
                {invoices.map((inv) => (
                  <SelectItem key={inv.id} value={String(inv.id)}>{inv.invoiceNumber}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="rf-reason">{t("raison")}</Label>
            <Textarea id="rf-reason" value={newReason} onChange={(e) => setNewReason(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="rf-amount">{t("montant_ht_cad")}</Label>
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
            <Label htmlFor="rf-notes">{t("notes")}</Label>
            <Textarea id="rf-notes" value={newNotes} onChange={(e) => setNewNotes(e.target.value)} rows={2} />
          </div>
        </div>
      </CreateModal>
    </div>
  );
}

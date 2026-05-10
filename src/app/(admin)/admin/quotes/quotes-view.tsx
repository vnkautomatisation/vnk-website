"use client";
import { useState, useMemo, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  FileText, Plus, Search, Clock, CheckCircle2, AlertCircle, Eye, Pencil, Trash2,
  SlidersHorizontal, X, CheckSquare, MoreHorizontal, XCircle, FileX, Send, Briefcase, DollarSign,
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
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormSection } from "@/components/admin/client-form-fields";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Quote = {
  id: number;
  quoteNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  mandateId: number | null;
  mandateTitle: string | null;
  title: string;
  description: string | null;
  serviceType: string | null;
  status: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  paymentPlan: string | null;
  paymentPct1: number | null;
  paymentPct2: number | null;
  paymentConditions: string | null;
  expiryDate: string | null;
  acceptedAt: string | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type MandateOption = { id: number; title: string; clientId: number };
type StatusFilter = "all" | "pending" | "accepted" | "declined" | "expired";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "pending", label: "En attente" },
  { key: "accepted", label: "Acceptés" },
  { key: "declined", label: "Refusés" },
  { key: "expired", label: "Expirés" },
];

const SERVICE_TYPES = [
  { value: "plc-support", label: "Support PLC" },
  { value: "audit", label: "Audit technique" },
  { value: "documentation", label: "Documentation" },
  { value: "refactoring", label: "Refactorisation" },
  { value: "modernization", label: "Modernisation" },
  { value: "training", label: "Formation" },
];

const PAYMENT_PLANS = [
  { value: "full", label: "Paiement complet à la signature" },
  { value: "split_50_50", label: "50% acompte / 50% livraison" },
  { value: "split_30_70", label: "30% acompte / 70% livraison" },
  { value: "split_60_40", label: "60% acompte / 40% livraison" },
  { value: "milestones", label: "Par jalons (à définir)" },
];

export function QuotesView({
  quotes,
  clients,
  mandates,
}: {
  quotes: Quote[];
  clients: ClientOption[];
  mandates: MandateOption[];
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [view, setView] = useViewMode("quotes", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  // Filtres avances
  const [filterClients, setFilterClients] = useState<Set<number>>(new Set());
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");

  // Bulk select
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // Edit/Delete
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [deleteQuote, setDeleteQuote] = useState<Quote | null>(null);

  // PDF preview
  const [pdfQuote, setPdfQuote] = useState<Quote | null>(null);

  // ── Form state (partage create + edit) ──────────────
  const [fClientId, setFClientId] = useState("");
  const [fMandateId, setFMandateId] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fService, setFService] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fExpiry, setFExpiry] = useState("");
  const [fPaymentPlan, setFPaymentPlan] = useState("split_50_50");
  const [fPaymentConditions, setFPaymentConditions] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFClientId(""); setFMandateId(""); setFTitle(""); setFService("");
    setFDesc(""); setFAmount(""); setFExpiry(""); setFPaymentPlan("split_50_50"); setFPaymentConditions("");
  };

  // Auto-ouvrir creation depuis ?newFor=<id>
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

  // Auto-ouvrir edition depuis ?editId=<id>
  useEffect(() => {
    const editId = searchParams.get("editId");
    if (editId) {
      const target = quotes.find((q) => String(q.id) === editId);
      if (target) {
        openEdit(target);
        const url = new URL(window.location.href);
        url.searchParams.delete("editId");
        window.history.replaceState({}, "", url.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, quotes]);

  const openEdit = (q: Quote) => {
    setEditQuote(q);
    setFClientId(String(q.clientId));
    setFMandateId(q.mandateId ? String(q.mandateId) : "");
    setFTitle(q.title);
    setFService(q.serviceType ?? "");
    setFDesc(q.description ?? "");
    setFAmount(String(q.amountHt));
    setFExpiry(q.expiryDate ? q.expiryDate.slice(0, 10) : "");
    setFPaymentPlan(q.paymentPlan ?? "split_50_50");
    setFPaymentConditions(q.paymentConditions ?? "");
  };

  const handleCreate = async () => {
    if (submitting) return;
    if (!fClientId || !fTitle.trim() || !fAmount) {
      toast.error("Client, titre et montant requis"); return;
    }
    if (Number(fAmount) <= 0) { toast.error("Montant invalide"); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/quotes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(fClientId),
          mandateId: fMandateId ? Number(fMandateId) : undefined,
          title: fTitle.trim(),
          description: fDesc.trim() || undefined,
          serviceType: fService || undefined,
          amountHt: Number(fAmount),
          paymentPlan: fPaymentPlan,
          paymentConditions: fPaymentConditions.trim() || undefined,
        }),
      });
      if (res.ok) {
        toast.success("Devis créé");
        setCreateOpen(false);
        resetForm();
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (submitting || !editQuote) return;
    if (!fTitle.trim() || !fAmount) { toast.error("Titre et montant requis"); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/quotes/${editQuote.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle.trim(),
          description: fDesc.trim() || null,
          serviceType: fService || null,
          amountHt: Number(fAmount),
          expiryDate: fExpiry || null,
          mandateId: fMandateId ? Number(fMandateId) : null,
          paymentPlan: fPaymentPlan,
          paymentConditions: fPaymentConditions.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success("Devis modifié");
        setEditQuote(null);
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteQuote) return;
    const res = await fetch(`/api/quotes/${deleteQuote.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Devis supprimé"); setDeleteQuote(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  // ── Quick actions ────────────────────────────────────
  const handleAccept = async (q: Quote) => {
    const ok = await confirm({
      title: "Accepter ce devis ?",
      description: `Le devis ${q.quoteNumber} sera marqué comme accepté et un contrat sera généré automatiquement.`,
      confirmLabel: "Accepter",
    });
    if (!ok) return;
    const res = await fetch(`/api/quotes/${q.id}/accept`, { method: "POST" });
    if (res.ok) { toast.success("Devis accepté, contrat généré"); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const handleSetStatus = async (q: Quote, status: string, label: string) => {
    const ok = await confirm({
      title: `${label} ce devis ?`,
      description: `Le devis ${q.quoteNumber} passera au statut « ${status === "declined" ? "Refusé" : status === "expired" ? "Expiré" : status === "pending" ? "En attente" : status} ».`,
      confirmLabel: label,
      variant: status === "declined" ? "destructive" : "default",
    });
    if (!ok) return;
    const res = await fetch(`/api/quotes/${q.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success("Statut mis à jour"); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || "Erreur"); }
  };

  const openPdf = (q: Quote) => {
    setPdfQuote(q);
  };

  // ── Envoyer au client : Document + Message + Notification (1 seul endpoint atomique) ──
  const handleSendToClient = async (q: Quote) => {
    const ok = await confirm({
      title: "Envoyer ce devis au client ?",
      description: `Le devis ${q.quoteNumber} sera ajouté dans la catégorie "Devis" du portail client + message chat + notification.`,
      confirmLabel: "Envoyer",
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/quotes/${q.id}/send`, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Devis envoyé à ${data.clientName ?? q.clientName} (portail + chat + notification)`);
        router.refresh();
      } else {
        const d = await res.json();
        toast.error(d.error || "Erreur");
      }
    } catch {
      toast.error("Erreur réseau");
    }
  };

  // ── Bulk actions ─────────────────────────────────────
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} devis ?`,
      description: "Les devis acceptés ou liés à des contrats seront refusés (409). Cette action est irréversible.",
      confirmLabel: "Supprimer tous",
      variant: "destructive",
    });
    if (!ok) return;
    let success = 0, blocked = 0;
    for (const id of Array.from(selectedIds)) {
      const res = await fetch(`/api/quotes/${id}`, { method: "DELETE" });
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

  // ── Filtrage ──────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = quotes;
    if (statusFilter !== "all") result = result.filter((q) => q.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.quoteNumber.toLowerCase().includes(q) ||
        r.title.toLowerCase().includes(q) ||
        r.clientName.toLowerCase().includes(q) ||
        (r.companyName ?? "").toLowerCase().includes(q)
      );
    }
    if (filterClients.size > 0) result = result.filter((r) => filterClients.has(r.clientId));
    if (filterAmountMin) result = result.filter((r) => r.amountTtc >= Number(filterAmountMin));
    if (filterAmountMax) result = result.filter((r) => r.amountTtc <= Number(filterAmountMax));
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter((r) => new Date(r.createdAt).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86400000;
      result = result.filter((r) => new Date(r.createdAt).getTime() <= to);
    }
    return result;
  }, [quotes, statusFilter, searchQuery, filterClients, filterAmountMin, filterAmountMax, filterDateFrom, filterDateTo]);

  const totalActiveFilters =
    (filterClients.size > 0 ? 1 : 0) +
    (filterAmountMin ? 1 : 0) + (filterAmountMax ? 1 : 0) +
    (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

  const clearAllFilters = () => {
    setFilterClients(new Set());
    setFilterAmountMin(""); setFilterAmountMax("");
    setFilterDateFrom(""); setFilterDateTo("");
  };

  // ── KPIs ──────────────────────────────────────────────
  const pendingCount = quotes.filter((q) => q.status === "pending").length;
  const acceptedCount = quotes.filter((q) => q.status === "accepted").length;
  const totalPendingTtc = quotes.filter((q) => q.status === "pending").reduce((s, q) => s + q.amountTtc, 0);
  const totalAcceptedTtc = quotes.filter((q) => q.status === "accepted").reduce((s, q) => s + q.amountTtc, 0);

  // Actions menu
  const getActions = useCallback((q: Quote) => {
    const editable = q.status !== "accepted";
    const a: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; variant?: "destructive" }> = [
      { label: "Voir le détail", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("quote", q.id) },
      { label: "Voir le PDF", icon: <FileText className="h-3.5 w-3.5" />, onClick: () => openPdf(q) },
    ];
    if (q.status === "pending") {
      a.push({ label: "Accepter", icon: <CheckCircle2 className="h-3.5 w-3.5" />, onClick: () => handleAccept(q) });
      a.push({ label: "Refuser", icon: <XCircle className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(q, "declined", "Refuser") });
      a.push({ label: "Marquer expiré", icon: <FileX className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(q, "expired", "Marquer expiré") });
    }
    if (q.status === "declined" || q.status === "expired") {
      a.push({ label: "Remettre en attente", icon: <Clock className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(q, "pending", "Remettre en attente") });
    }
    a.push({ label: "Envoyer au client", icon: <Send className="h-3.5 w-3.5" />, onClick: () => handleSendToClient(q) });
    if (editable) {
      a.push({ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(q), separator: true });
      a.push({ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteQuote(q), variant: "destructive" });
    }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity]);

  // ── Colonnes table ───────────────────────────────────
  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const columns: Column<Quote>[] = [
    {
      key: "select",
      header: <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(allFilteredIds)} aria-label="Tout sélectionner" />,
      accessor: (r) => (
        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelectId(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Sélectionner ${r.quoteNumber}`} />
      ),
    },
    { key: "number", header: "Numéro", accessor: (r) => <span className="font-mono text-xs">{r.quoteNumber}</span>, sortable: true, sortBy: (r) => r.quoteNumber },
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
          {r.serviceType && <p className="text-[10px] text-muted-foreground">{SERVICE_TYPES.find((s) => s.value === r.serviceType)?.label ?? r.serviceType}</p>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.title, hiddenOnMobile: true,
    },
    { key: "ht", header: "HT", accessor: (r) => formatCurrency(r.amountHt), sortable: true, sortBy: (r) => r.amountHt, hiddenOnMobile: true },
    { key: "ttc", header: "TTC", accessor: (r) => <span className="font-semibold">{formatCurrency(r.amountTtc)}</span>, sortable: true, sortBy: (r) => r.amountTtc },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "expiry", header: "Expiration", accessor: (r) => r.expiryDate ? formatDate(new Date(r.expiryDate)) : "—", hiddenOnMobile: true },
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

  // Filter mandates by selected client
  const availableMandates = useMemo(() => {
    if (!fClientId) return [];
    return mandates.filter((m) => m.clientId === Number(fClientId));
  }, [mandates, fClientId]);

  return (
    <div className="space-y-6">
      {/* Hero VNK navy */}
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Devis</h1>
              <p className="text-white/70 text-sm mt-0.5">TPS et TVQ calculés automatiquement — accepter génère un contrat</p>
            </div>
          </div>
          <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
            onClick={() => { resetForm(); setCreateOpen(true); }}>
            <Plus className="h-4 w-4" />Nouveau devis
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total devis" value={quotes.length} icon={FileText} accent="bg-blue-500" />
        <StatCard label="En attente" value={pendingCount} icon={Clock} accent="bg-amber-500" deltaLabel={pendingCount > 0 ? formatCurrency(totalPendingTtc) : undefined} />
        <StatCard label="Acceptés" value={acceptedCount} icon={CheckCircle2} accent="bg-emerald-500" deltaLabel={acceptedCount > 0 ? formatCurrency(totalAcceptedTtc) : undefined} />
        <StatCard label="Pipeline TTC" value={formatCurrency(totalPendingTtc + totalAcceptedTtc)} icon={DollarSign} accent="bg-violet-500" />
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

        {/* Filtres avances */}
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

        <ViewToggle storageKey="quotes" defaultView="list" onChange={setView} />
      </div>

      {/* Bulk actions bar */}
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
          {filtered.map((q) => (
            <EntityCard
              key={q.id}
              title={q.title}
              subtitle={`${q.quoteNumber} — ${q.clientName}`}
              avatarName={q.clientName}
              badges={[
                { label: q.status === "pending" ? "En attente" : q.status === "accepted" ? "Accepté" : q.status === "declined" ? "Refusé" : q.status === "expired" ? "Expiré" : q.status, variant: q.status === "accepted" ? "secondary" : "outline" },
                ...(q.serviceType ? [{ label: SERVICE_TYPES.find((s) => s.value === q.serviceType)?.label ?? q.serviceType, variant: "outline" as const }] : []),
              ]}
              stats={[{ label: "TTC", value: formatCurrency(q.amountTtc) }]}
              actions={getActions(q)}
              onClick={() => openPdf(q)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatCurrency(q.amountHt)} HT</span>
                  <span>{q.expiryDate ? `Expire le ${formatDate(new Date(q.expiryDate))}` : "Pas d'expiration"}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucun devis trouvé</div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => openPdf(r)}
          searchPlaceholder="Rechercher..."
          exportFilename="devis"
          storageKey="admin-quotes"
        />
      )}

      {/* Modale création — VNK navy avec FormSection */}
      <QuoteFormDialog
        open={createOpen}
        onOpenChange={(o) => { if (!o) { resetForm(); setCreateOpen(false); } else setCreateOpen(true); }}
        mode="create"
        clients={clients}
        availableMandates={availableMandates}
        submitting={submitting}
        values={{
          clientId: fClientId, mandateId: fMandateId, title: fTitle, service: fService, desc: fDesc,
          amount: fAmount, expiry: fExpiry, paymentPlan: fPaymentPlan, paymentConditions: fPaymentConditions,
        }}
        setters={{
          setClientId: (v) => { setFClientId(v); setFMandateId(""); }, setMandateId: setFMandateId,
          setTitle: setFTitle, setService: setFService, setDesc: setFDesc,
          setAmount: setFAmount, setExpiry: setFExpiry,
          setPaymentPlan: setFPaymentPlan, setPaymentConditions: setFPaymentConditions,
        }}
        onSubmit={handleCreate}
      />

      {/* Modale édition — VNK navy avec FormSection */}
      <QuoteFormDialog
        open={!!editQuote}
        onOpenChange={(o) => { if (!o) setEditQuote(null); }}
        mode="edit"
        clients={clients}
        availableMandates={availableMandates}
        editingQuoteNumber={editQuote?.quoteNumber}
        submitting={submitting}
        values={{
          clientId: fClientId, mandateId: fMandateId, title: fTitle, service: fService, desc: fDesc,
          amount: fAmount, expiry: fExpiry, paymentPlan: fPaymentPlan, paymentConditions: fPaymentConditions,
        }}
        setters={{
          setClientId: () => {}, setMandateId: setFMandateId,
          setTitle: setFTitle, setService: setFService, setDesc: setFDesc,
          setAmount: setFAmount, setExpiry: setFExpiry,
          setPaymentPlan: setFPaymentPlan, setPaymentConditions: setFPaymentConditions,
        }}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={!!deleteQuote}
        onOpenChange={(o) => { if (!o) setDeleteQuote(null); }}
        title="Supprimer ce devis ?"
        description={`Le devis "${deleteQuote?.quoteNumber}" sera supprimé définitivement.`}
        confirmLabel="Supprimer"
        onConfirm={handleDelete}
      />

      {/* PDF preview modal VNK */}
      {pdfQuote && (
        <PdfViewerModal
          open
          onClose={() => setPdfQuote(null)}
          pdfUrl={`/api/quotes/${pdfQuote.id}/pdf`}
          title={pdfQuote.title}
          documentNumber={pdfQuote.quoteNumber}
          downloadName={`devis-${pdfQuote.quoteNumber}`}
        />
      )}

      {ConfirmModal}
    </div>
  );
}

// ─── QuoteFormDialog — modal create/edit unifié VNK navy ──────────
type QFormValues = {
  clientId: string; mandateId: string; title: string; service: string; desc: string;
  amount: string; expiry: string; paymentPlan: string; paymentConditions: string;
};
type QFormSetters = {
  setClientId: (v: string) => void; setMandateId: (v: string) => void;
  setTitle: (v: string) => void; setService: (v: string) => void; setDesc: (v: string) => void;
  setAmount: (v: string) => void; setExpiry: (v: string) => void;
  setPaymentPlan: (v: string) => void; setPaymentConditions: (v: string) => void;
};

function QuoteFormDialog({
  open, onOpenChange, mode, clients, availableMandates, editingQuoteNumber, submitting, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  clients: ClientOption[];
  availableMandates: MandateOption[];
  editingQuoteNumber?: string;
  submitting: boolean;
  values: QFormValues;
  setters: QFormSetters;
  onSubmit: () => void | Promise<void>;
}) {
  const isCreate = mode === "create";
  const amountNum = Number(values.amount) || 0;
  const tps = amountNum * 0.05;
  const tvq = amountNum * 0.09975;
  const ttc = amountNum + tps + tvq;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        {/* Header VNK navy */}
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isCreate ? <FileText className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white text-lg">
                {isCreate ? "Nouveau devis" : "Modifier le devis"}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {isCreate ? "Le numéro sera généré automatiquement (D-AAAA-NNN)" : (editingQuoteNumber || "Modification")}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Body scrollable */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          <FormSection title="Identité" icon={<FileText className="h-3.5 w-3.5" />}>
            {isCreate && (
              <>
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
                {availableMandates.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mandat associé (optionnel)</Label>
                    <Select value={values.mandateId || "__none__"} onValueChange={(v) => setters.setMandateId(v === "__none__" ? "" : v)}>
                      <SelectTrigger><SelectValue placeholder="Aucun mandat" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">Aucun mandat</SelectItem>
                        {availableMandates.map((m) => (
                          <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </>
            )}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Titre *</Label>
              <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder="Audit PLC Siemens — phase 1" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type de service</Label>
              <Select value={values.service || "__none__"} onValueChange={(v) => setters.setService(v === "__none__" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">Aucun</SelectItem>
                  {SERVICE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description</Label>
              <Textarea value={values.desc} onChange={(e) => setters.setDesc(e.target.value)} rows={3} placeholder="Détails du devis…" />
            </div>
          </FormSection>

          <FormSection title="Montant & taxes" icon={<DollarSign className="h-3.5 w-3.5" />}>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant HT (CAD) *</Label>
              <Input type="number" min="0" step="0.01" value={values.amount} onChange={(e) => setters.setAmount(e.target.value)} placeholder="0.00" />
            </div>
            {amountNum > 0 && (
              <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Sous-total HT</span><span className="tabular-nums">{formatCurrency(amountNum)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TPS (5%)</span><span className="tabular-nums">{formatCurrency(tps)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">TVQ (9.975%)</span><span className="tabular-nums">{formatCurrency(tvq)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-bold text-[#0F2D52]"><span>Total TTC</span><span className="tabular-nums">{formatCurrency(ttc)}</span></div>
              </div>
            )}
          </FormSection>

          <FormSection title="Modalités de paiement" icon={<Briefcase className="h-3.5 w-3.5" />}>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Plan de paiement</Label>
              <Select value={values.paymentPlan} onValueChange={setters.setPaymentPlan}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_PLANS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Conditions particulières</Label>
              <Textarea value={values.paymentConditions} onChange={(e) => setters.setPaymentConditions(e.target.value)} rows={2}
                placeholder="Ex : Délai 30 jours, frais de retard 1.5%/mois…" />
            </div>
            {!isCreate && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date d&apos;expiration</Label>
                <Input type="date" value={values.expiry} onChange={(e) => setters.setExpiry(e.target.value)} />
              </div>
            )}
          </FormSection>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>Annuler</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !values.title.trim() || !values.amount || (isCreate && !values.clientId)}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {submitting ? "Enregistrement…" : (isCreate ? "Créer le devis" : "Enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

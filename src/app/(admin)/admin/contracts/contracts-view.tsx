"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
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
import { cn, formatDate } from "@/lib/utils";


type Contract = {
  id: number;
  contractNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  mandateId: number | null;
  mandateTitle: string | null;
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
type MandateOption = { id: number; title: string; clientId: number; status: string };
type LinkedQuote = { id: number; quoteNumber: string; clientId: number; title: string; amountTtc: number };
type StatusFilter = "all" | "pending" | "draft" | "signed" | "expired" | "cancelled";

const STATUS_TABS: { key: StatusFilter; labelKey: string }[] = [
  { key: "all", labelKey: "tous" },
  { key: "pending", labelKey: "attente" },
  { key: "draft", labelKey: "brouillon" },
  { key: "signed", labelKey: "signes" },
  { key: "expired", labelKey: "expires" },
  { key: "cancelled", labelKey: "annules" },
];

export function ContractsView({
  contracts,
  clients,
  mandates,
  acceptedQuotes,
  kpis,
}: {
  contracts: Contract[];
  clients: ClientOption[];
  mandates: MandateOption[];
  acceptedQuotes: LinkedQuote[];
  kpis: { total: number; pendingCount: number; signedCount: number; signedThisMonth: number; totalValue: number };
}) {
  const t = useTranslations("admin.contracts");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const formatCurrency = useCurrency();
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
  const [pdfRefreshKey, setPdfRefreshKey] = useState(0);
  const [signingContract, setSigningContract] = useState<Contract | null>(null);

  // Form state (partage create + edit)
  const [fClientId, setFClientId] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fContent, setFContent] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fStatus, setFStatus] = useState("pending");
  const [fExpiresAt, setFExpiresAt] = useState("");
  const [fMandateId, setFMandateId] = useState("");
  const [fQuoteId, setFQuoteId] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFClientId(""); setFTitle(""); setFContent(""); setFAmount("");
    setFMandateId(""); setFQuoteId("");
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

  useEffect(() => {
    const editId = searchParams.get("editId");
    if (editId) {
      const target = contracts.find((c) => String(c.id) === editId);
      if (target) {
        openEdit(target);
        const url = new URL(window.location.href);
        url.searchParams.delete("editId");
        window.history.replaceState({}, "", url.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, contracts]);

  const openEdit = (c: Contract) => {
    setEditContract(c);
    setFClientId(String(c.clientId));
    setFTitle(c.title);
    setFContent("");
    setFAmount(c.amountTtc != null ? String(c.amountTtc) : "");
    setFStatus(c.status);
    setFExpiresAt(c.expiresAt ? c.expiresAt.slice(0, 10) : "");
    setFMandateId(c.mandateId ? String(c.mandateId) : "");
    setFQuoteId(c.quoteId ? String(c.quoteId) : "");
  };

  const handleCreate = async () => {
    if (submitting) return;
    if (!fClientId || !fTitle.trim()) { toast.error(t("client_titre_requis")); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/contracts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(fClientId),
          title: fTitle.trim(),
          content: fContent.trim() || undefined,
          amountTtc: fAmount ? Number(fAmount) : undefined,
          expiresAt: fExpiresAt || undefined,
          mandateId: fMandateId ? Number(fMandateId) : undefined,
          quoteId: fQuoteId ? Number(fQuoteId) : undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("contrat_cree"));
        setCreateOpen(false);
        resetForm();
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (submitting || !editContract) return;
    if (!fTitle.trim()) { toast.error(t("titre_requis")); return; }
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
          mandateId: fMandateId ? Number(fMandateId) : null,
          quoteId: fQuoteId ? Number(fQuoteId) : null,
        }),
      });
      if (res.ok) { toast.success(t("contrat_modifie")); setEditContract(null); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteContract) return;
    const res = await fetch(`/api/contracts/${deleteContract.id}`, { method: "DELETE" });
    if (res.ok) { toast.success(t("contrat_supprime")); setDeleteContract(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleSetStatus = async (c: Contract, status: string, label: string) => {
    const ok = await confirm({
      title: `${label} ce contrat ?`,
      description: `${c.contractNumber} passera au statut « ${status === "cancelled" ? t("annule") : status === "expired" ? t("expire") : status === "draft" ? t("brouillon") : status} ».`,
      confirmLabel: label,
      variant: status === "cancelled" ? "destructive" : "default",
    });
    if (!ok) return;
    const res = await fetch(`/api/contracts/${c.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(t("statut_mis_jour")); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleSendToClient = async (c: Contract) => {
    const ok = await confirm({
      title: t("envoyer_contrat_client"),
      description: t("contracts_view_le_contrat_p0_sera_ajoute_dans_la_categorie", { p0: c.contractNumber }),
      confirmLabel: t("envoyer"),
    });
    if (!ok) return;
    const res = await fetch(`/api/contracts/${c.id}/send`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(t("contracts_view_contrat_envoye_a_p0_portail_chat_notification", { p0: data.clientName ?? c.clientName }));
      router.refresh();
    } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  // ── Envoyer pour signature légale (Dropbox Sign) ──────────
  const handleSendForEsign = async (c: Contract) => {
    const ok = await confirm({
      title: t("envoyer_signature_legale"),
      description: t("contracts_view_le_client_recevra_un_courriel_de_dropbox_sign"),
      confirmLabel: t("envoyer_signature"),
    });
    if (!ok) return;
    const res = await fetch(`/api/contracts/${c.id}/send-for-esign`, { method: "POST" });
    if (res.ok) {
      toast.success(t("contracts_view_demande_de_signature_envoyee_a_p0", { p0: c.clientName }));
      router.refresh();
    } else {
      const d = await res.json();
      toast.error(d.error || t("erreur_verifiez_integration_dropbox_sign"));
    }
  };

  // Bulk
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: tc("confirm_delete_contracts", { count: selectedIds.size }),
      description: t("contrats_signes_lies_factures_refuses"),
      confirmLabel: t("supprimer_tous"),
      variant: "destructive",
    });
    if (!ok) return;
    let success = 0, blocked = 0;
    for (const id of Array.from(selectedIds)) {
      const res = await fetch(`/api/contracts/${id}`, { method: "DELETE" });
      if (res.ok) success++; else if (res.status === 409) blocked++;
    }
    toast.success(t("contracts_view_p0_p1_supprime_s_p2", { p0: success, p1: selectedIds.size, p2: blocked > 0 ? tc("blocked_count", { count: blocked }) : "" }));
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

  // Sticky scroll detection (pattern dashboard finance)
  const stickyBarSentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = stickyBarSentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

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
      { label: t("voir_detail"), icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("contract", c.id) },
      { label: t("voir_pdf"), icon: <FileText className="h-3.5 w-3.5" />, onClick: () => setPdfContract(c) },
    ];
    if (c.status === "pending" || c.status === "draft") {
      a.push({ label: t("envoyer_client"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => handleSendToClient(c) });
      a.push({ label: t("envoyer_signature_legale_2"), icon: <PenTool className="h-3.5 w-3.5" />, onClick: () => handleSendForEsign(c) });
    }
    if (c.status === "pending" && !c.adminSignatureData) {
      a.push({ label: t("signer_admin"), icon: <PenTool className="h-3.5 w-3.5" />, onClick: () => setSigningContract(c) });
    }
    if (c.status === "pending") {
      a.push({ label: t("marquer_expire"), icon: <AlertTriangle className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(c, "expired", t("marquer_expire")) });
    }
    if (editable) {
      a.push({ label: t("annuler"), icon: <X className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(c, "cancelled", t("annuler_action")) });
      a.push({ label: t("modifier"), icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(c), separator: true });
      a.push({ label: t("supprimer"), icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteContract(c), variant: "destructive" });
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
      header: <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(allFilteredIds)} aria-label={t("tout_selectionner")} />,
      accessor: (r) => (
        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelectId(r.id)} onClick={(e) => e.stopPropagation()} aria-label={t("contracts_view_selectionner_p0", { p0: r.contractNumber })} />
      ),
    },
    { key: "number", header: t("numero"), accessor: (r) => <span className="font-mono text-xs">{r.contractNumber}</span>, sortable: true, sortBy: (r) => r.contractNumber },
    {
      key: "client", header: t("client"),
      accessor: (r) => (
        <div>
          <div className="font-medium text-sm">{r.clientName}</div>
          {r.companyName && <div className="text-xs text-muted-foreground">{r.companyName}</div>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.clientName,
    },
    {
      key: "title", header: t("titre"),
      accessor: (r) => (
        <div>
          <p className="text-sm font-medium">{r.title}</p>
          {r.quoteNumber && <p className="text-[10px] text-muted-foreground">Devis {r.quoteNumber}</p>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.title, hiddenOnMobile: true,
    },
    { key: "amount", header: t("montant"), accessor: (r) => r.amountTtc ? <span className="font-semibold tabular-nums">{formatCurrency(r.amountTtc)}</span> : "—", sortable: true, sortBy: (r) => r.amountTtc ?? 0, hiddenOnMobile: true },
    { key: "status", header: t("statut"), accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "signatures", header: t("signatures"), accessor: (r) => (
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
    { key: "created", header: t("cree"), accessor: (r) => formatDate(new Date(r.createdAt)), hiddenOnMobile: true },
    {
      key: "actions",
      header: "",
      accessor: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted transition-colors" aria-label={tc("actions")}>
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
              <h1 className="text-xl sm:text-2xl font-bold">{t("contrats")}</h1>
              <p className="text-white/70 text-sm mt-0.5">{t("signature_electronique_double_admin_client")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kpis.pendingCount > 0 && (
              <div className="flex items-center gap-2 bg-amber-500/20 border border-amber-300/30 rounded-lg px-3 py-2 backdrop-blur">
                <Clock className="h-4 w-4 text-amber-200" />
                <span className="text-sm font-semibold text-white">{t("n_en_attente", { count: kpis.pendingCount })}</span>
              </div>
            )}
            <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
              onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" />{t("nouveau_contrat")}
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("total_contrats")} value={kpis.total} icon={FileSignature} accent="bg-indigo-500" />
        <StatCard label={t("attente")} value={kpis.pendingCount} icon={Clock} accent="bg-amber-500" />
        <StatCard label={t("signes")} value={kpis.signedCount} icon={CheckCircle2} accent="bg-emerald-500" deltaLabel={tc("this_month_count", { count: kpis.signedThisMonth })} />
        <StatCard label={t("valeur_signee")} value={formatCurrency(kpis.totalValue)} icon={DollarSign} accent="bg-blue-500" />
      </div>

      {/* Sentinel + Sticky compact bar (pattern dashboard finance) */}
      <div ref={stickyBarSentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <FileSignature className="h-4 w-4" />
              {t("contrats")}
            </span>
            <span className="font-semibold">{tc("shown_m", { count: filtered.length })}</span>
            <span className="text-muted-foreground">{t("attente")} <span className="font-semibold text-amber-600">{kpis.pendingCount}</span></span>
            <span className="text-muted-foreground">{t("signes")} <span className="font-semibold text-emerald-600">{kpis.signedCount}</span></span>
            <span className="ml-auto text-muted-foreground">{t("valeur")} <span className="font-semibold text-blue-600">{formatCurrency(kpis.totalValue)}</span></span>
          </div>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("numero_titre_client")} className="pl-9" />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto">
          {STATUS_TABS.map((tab) => (
            <button key={tab.key} onClick={() => setStatusFilter(tab.key)}
              className={cn("px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}>
              {t(tab.labelKey)}
            </button>
          ))}
        </div>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("filtres")}</span>
              {totalActiveFilters > 0 && <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{totalActiveFilters}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] max-w-[calc(100vw-2rem)] p-3 space-y-3" align="end">
            {clients.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("client")}</p>
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
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("montant_ttc")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder={t("min")} value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} className="h-8 text-xs" />
                <Input type="number" placeholder={t("max")} value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("periode_apos_emission")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-xs" />
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            {totalActiveFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full text-xs">
                <X className="h-3 w-3 mr-1" />{t("contracts_view_effacer_les_filtres")}</Button>
            )}
          </PopoverContent>
        </Popover>

        <ViewToggle storageKey="contracts" defaultView="list" onChange={setView} />
      </div>

      {selectedIds.size > 0 && (
        <div className="rounded-lg border-2 border-[#0F2D52] bg-[#0F2D52]/5 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[#0F2D52]" />
            <span className="text-sm font-medium">{tc("selected_m", { count: selectedIds.size })}</span>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>
              <X className="h-3.5 w-3.5 mr-1" />{tc("cancel")}
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
                { label: c.status === "pending" ? t("attente") : c.status === "draft" ? t("brouillon") : c.status === "signed" ? t("signe") : c.status === "expired" ? t("expire") : c.status === "cancelled" ? t("annule") : c.status, variant: c.status === "signed" ? "secondary" : c.status === "expired" || c.status === "cancelled" ? "destructive" : "outline" },
              ]}
              stats={[{ label: t("montant"), value: c.amountTtc ? formatCurrency(c.amountTtc) : "—" }]}
              actions={getActions(c)}
              onClick={() => setPdfContract(c)}
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
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">{t("aucun_contrat_trouve")}</div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => setPdfContract(r)}
          searchPlaceholder={t("rechercher")}
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
        mandates={mandates}
        acceptedQuotes={acceptedQuotes}
        submitting={submitting}
        values={{ clientId: fClientId, title: fTitle, content: fContent, amount: fAmount, status: fStatus, expiresAt: fExpiresAt, mandateId: fMandateId, quoteId: fQuoteId }}
        setters={{
          setClientId: setFClientId, setTitle: setFTitle, setContent: setFContent,
          setAmount: setFAmount, setStatus: setFStatus, setExpiresAt: setFExpiresAt,
          setMandateId: setFMandateId, setQuoteId: setFQuoteId,
        }}
        onSubmit={handleCreate}
      />
      <ContractFormDialog
        open={!!editContract}
        onOpenChange={(o) => { if (!o) setEditContract(null); }}
        mode="edit"
        clients={clients}
        mandates={mandates}
        acceptedQuotes={acceptedQuotes}
        editingContractNumber={editContract?.contractNumber}
        submitting={submitting}
        values={{ clientId: fClientId, title: fTitle, content: fContent, amount: fAmount, status: fStatus, expiresAt: fExpiresAt, mandateId: fMandateId, quoteId: fQuoteId }}
        setters={{
          setClientId: () => {}, setTitle: setFTitle, setContent: setFContent,
          setAmount: setFAmount, setStatus: setFStatus, setExpiresAt: setFExpiresAt,
          setMandateId: setFMandateId, setQuoteId: setFQuoteId,
        }}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={!!deleteContract}
        onOpenChange={(o) => { if (!o) setDeleteContract(null); }}
        title={t("supprimer_contrat")}
        description={t("contracts_view_le_contrat_p0_sera_supprime_definitivement", { p0: (deleteContract?.contractNumber ?? "") })}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
      />

      {/* PDF preview VNK avec actions de signature */}
      {pdfContract && (
        <PdfViewerModal
          open
          onClose={() => setPdfContract(null)}
          pdfUrl={`/api/contracts/${pdfContract.id}/pdf`}
          title={pdfContract.title}
          documentNumber={pdfContract.contractNumber}
          downloadName={`contrat-${pdfContract.contractNumber}`}
          refreshKey={pdfRefreshKey}
          actions={
            <>
              {!pdfContract.adminSignatureData && pdfContract.status !== "cancelled" && pdfContract.status !== "expired" && (
                <Button
                  size="sm"
                  className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
                  onClick={() => setSigningContract(pdfContract)}
                >
                  <PenTool className="h-3.5 w-3.5 mr-1" />Signer (admin)
                </Button>
              )}
              {pdfContract.status === "pending" && pdfContract.adminSignatureData && !pdfContract.clientSignatureData && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleSendToClient(pdfContract)}
                >
                  <Send className="h-3.5 w-3.5 mr-1" />Envoyer au client
                </Button>
              )}
            </>
          }
        />
      )}

      {signingContract && (
        <SignatureDialog
          contractId={signingContract.id}
          contractNumber={signingContract.contractNumber}
          contractTitle={signingContract.title}
          contractAmount={signingContract.amountTtc ?? undefined}
          open={true}
          onOpenChange={async (o) => {
            if (!o) {
              const just = signingContract;
              setSigningContract(null);
              // Recharge la liste pour avoir le nouvel etat de signature
              router.refresh();
              // Si le PDF preview est ouvert sur ce meme contrat, refresh apres delai
              if (pdfContract && pdfContract.id === just.id) {
                setTimeout(() => {
                  setPdfRefreshKey((k) => k + 1);
                  setPdfContract({ ...pdfContract, adminSignatureData: true });
                }, 500);
              }
              // Auto-send au client si pas encore signe par client
              if (!just.clientSignatureData) {
                fetch(`/api/contracts/${just.id}/send`, { method: "POST" })
                  .then((r) => { if (r.ok) toast.success(t("contrat_envoye_client_automatiquement")); })
                  .catch(() => {});
              }
            }
          }}
        />
      )}

      {ConfirmModal}
    </div>
  );
}

// ─── ContractFormDialog VNK navy ─────────────────────────
type CFormValues = { clientId: string; title: string; content: string; amount: string; status: string; expiresAt: string; mandateId: string; quoteId: string };
type CFormSetters = {
  setClientId: (v: string) => void; setTitle: (v: string) => void; setContent: (v: string) => void;
  setAmount: (v: string) => void; setStatus: (v: string) => void; setExpiresAt: (v: string) => void;
  setMandateId: (v: string) => void; setQuoteId: (v: string) => void;
};

function ContractFormDialog({
  open, onOpenChange, mode, clients, mandates, acceptedQuotes, editingContractNumber, submitting, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  clients: ClientOption[];
  mandates: MandateOption[];
  acceptedQuotes: LinkedQuote[];
  editingContractNumber?: string;
  submitting: boolean;
  values: CFormValues;
  setters: CFormSetters;
  onSubmit: () => void | Promise<void>;
}) {
  const t = useTranslations("admin.contracts");
  const tc = useTranslations("common");
  const isCreate = mode === "create";
  const clientIdNum = Number(values.clientId) || 0;
  const filteredMandates = mandates.filter((m) => m.clientId === clientIdNum);
  const filteredQuotes = acceptedQuotes.filter((q) => q.clientId === clientIdNum);

  const fillFromQuote = (qid: string) => {
    setters.setQuoteId(qid);
    if (!qid) return;
    const q = acceptedQuotes.find((x) => String(x.id) === qid);
    if (q && !values.title.trim()) setters.setTitle(q.title);
    if (q && !values.amount) setters.setAmount(String(q.amountTtc));
  };

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
                {isCreate ? t("nouveau_contrat") : t("modifier_contrat")}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {isCreate ? t("numero_sera_genere_automatiquement_ct") : (editingContractNumber || t("modification"))}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          <FormSection title={t("identite")} icon={<FileSignature className="h-3.5 w-3.5" />}>
            {isCreate && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("client_2")}</Label>
                <Select value={values.clientId} onValueChange={setters.setClientId}>
                  <SelectTrigger><SelectValue placeholder={t("selectionner_client")} /></SelectTrigger>
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
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("titre")}</Label>
              <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder={t("contrat_service_automatisation_plc")} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("description_mandat_optionnel")}</Label>
              <Textarea
                value={values.content}
                onChange={(e) => setters.setContent(e.target.value)}
                rows={5}
                placeholder={isCreate
                  ? t("portee_specifique_contrat_ex_audit")
                  : t("laisser_vide_ne_pas_modifier")}
              />
            </div>
          </FormSection>

          {clientIdNum === 0 && isCreate && (
            <div className="rounded-lg border-2 border-dashed border-[#0F2D52]/20 bg-[#0F2D52]/5 p-3 text-center">
              <p className="text-xs text-[#0F2D52] font-semibold">{t("selectionnez_apos_abord_client")}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{t("voir_mandats_devis_associes_auto")}</p>
            </div>
          )}
          {clientIdNum > 0 && (
            <FormSection title={t("liens_optionnel")} icon={<DollarSign className="h-3.5 w-3.5" />}>
              {filteredMandates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("mandat_associe")}</Label>
                  <Select value={values.mandateId || "none"} onValueChange={(v) => setters.setMandateId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t("aucun_mandat")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("aucun_mandat")}</SelectItem>
                      {filteredMandates.map((m) => (<SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {filteredQuotes.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("devis_source_auto_remplit_titre")}</Label>
                  <Select value={values.quoteId || "none"} onValueChange={(v) => fillFromQuote(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t("aucun_devis")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("aucun_devis")}</SelectItem>
                      {filteredQuotes.map((q) => (<SelectItem key={q.id} value={String(q.id)}>{q.quoteNumber} — {q.title}</SelectItem>))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {filteredMandates.length === 0 && filteredQuotes.length === 0 && (
                <p className="text-[11px] text-muted-foreground">{t("aucun_mandat_devis_accepte_client")}</p>
              )}
            </FormSection>
          )}

          <FormSection title={t("montant_echeance")} icon={<DollarSign className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("montant_ttc_cad")}</Label>
                <Input type="number" min="0" step="0.01" value={values.amount} onChange={(e) => setters.setAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("date_apos_expiration")}</Label>
                <Input type="date" value={values.expiresAt} onChange={(e) => setters.setExpiresAt(e.target.value)} />
                {isCreate && <p className="text-[10px] text-muted-foreground">{t("date_limite_signer_optionnel")}</p>}
              </div>
            </div>
            {!isCreate && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{tc("status")}</Label>
                <Select value={values.status} onValueChange={setters.setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">{t("attente")}</SelectItem>
                    <SelectItem value="draft">{t("brouillon")}</SelectItem>
                    <SelectItem value="expired">{t("expire")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormSection>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{tc("cancel")}</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !values.title.trim() || (isCreate && !values.clientId)}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {submitting ? t("enregistrement") : (isCreate ? t("creer_contrat") : t("enregistrer"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

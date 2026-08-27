"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import {
  Receipt, Plus, Search, Clock, AlertTriangle, CheckCircle2, CreditCard, Eye, Pencil, Trash2,
  SlidersHorizontal, X, CheckSquare, MoreHorizontal, FileText, Send, DollarSign, Bell,
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

type Invoice = {
  id: number;
  invoiceNumber: string;
  clientId: number;
  clientName: string;
  companyName: string | null;
  contractId: number | null;
  contractNumber: string | null;
  quoteId: number | null;
  quoteNumber: string | null;
  title: string;
  description: string | null;
  serviceType: string | null;
  status: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
  paymentMethod: string | null;
  invoicePhase: string | null;
  phaseNumber: number | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type StatusFilter = "all" | "unpaid" | "overdue" | "paid" | "cancelled";

const STATUS_TABS: { key: StatusFilter; labelKey: string }[] = [
  { key: "all", labelKey: "toutes" },
  { key: "unpaid", labelKey: "non_payees" },
  { key: "overdue", labelKey: "retard" },
  { key: "paid", labelKey: "payees" },
  { key: "cancelled", labelKey: "annulees" },
];

const PAYMENT_METHODS = [
  { value: "interac", labelKey: "virement_interac" },
  { value: "bank_transfer", labelKey: "virement_bancaire" },
  { value: "card", labelKey: "carte_stripe" },
  { value: "check", labelKey: "cheque" },
  { value: "cash", labelKey: "especes" },
  { value: "other", labelKey: "autre" },
];

type MandateOption = { id: number; title: string; clientId: number; status: string };
type LinkedQuote = { id: number; quoteNumber: string; clientId: number; title: string; amountTtc: number };
type LinkedContract = { id: number; contractNumber: string; clientId: number; title: string; amountTtc: number | null };

const SERVICE_TYPES = [
  { value: "plc-support", labelKey: "support_plc" },
  { value: "audit", labelKey: "audit_technique" },
  { value: "documentation", labelKey: "documentation" },
  { value: "refactoring", labelKey: "refactorisation" },
  { value: "modernization", labelKey: "modernisation" },
  { value: "training", labelKey: "formation" },
  { value: "other", labelKey: "autre" },
];

const PHASE_OPTIONS = [
  { value: "acompte", labelKey: "acompte" },
  { value: "solde", labelKey: "solde" },
  { value: "phase_1", labelKey: "phase_1" },
  { value: "phase_2", labelKey: "phase_2" },
  { value: "phase_3", labelKey: "phase_3" },
  { value: "honoraires", labelKey: "honoraires" },
  { value: "frais", labelKey: "frais" },
  { value: "autre", labelKey: "autre" },
];

const STATUS_OPTIONS = [
  { value: "unpaid", labelKey: "non_payee" },
  { value: "overdue", labelKey: "retard" },
  { value: "paid", labelKey: "payee" },
  { value: "cancelled", labelKey: "annulee" },
];

export function InvoicesView({
  invoices,
  clients,
  mandates,
  acceptedQuotes,
  signedContracts,
  kpis,
}: {
  invoices: Invoice[];
  clients: ClientOption[];
  mandates: MandateOption[];
  acceptedQuotes: LinkedQuote[];
  signedContracts: LinkedContract[];
  kpis: { unpaidTotal: number; overdueTotal: number; paidThisMonth: number; overdueCount: number; unpaidCount: number };
}) {
  const t = useTranslations("admin.invoices");
  const tc = useTranslations("common");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [view, setView] = useViewMode("invoices", "list");
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

  // Edit/Delete + PDF + Mark paid
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [deleteInvoice, setDeleteInvoice] = useState<Invoice | null>(null);
  const [pdfInvoice, setPdfInvoice] = useState<Invoice | null>(null);
  const [paidDialog, setPaidDialog] = useState<Invoice | null>(null);
  const [paidMethod, setPaidMethod] = useState("interac");
  const [paidNote, setPaidNote] = useState("");

  // Form state (partage create + edit)
  const [fClientId, setFClientId] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fDesc, setFDesc] = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fDueDate, setFDueDate] = useState("");
  const [fDueDays, setFDueDays] = useState("30");
  const [fMandateId, setFMandateId] = useState("");
  const [fQuoteId, setFQuoteId] = useState("");
  const [fContractId, setFContractId] = useState("");
  const [fInvoicePhase, setFInvoicePhase] = useState("");
  const [fPhaseNumber, setFPhaseNumber] = useState("1");
  const [fPaymentMethod, setFPaymentMethod] = useState("");
  const [fStatus, setFStatus] = useState("unpaid");
  const [fServiceType, setFServiceType] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFClientId(""); setFTitle(""); setFDesc(""); setFAmount("");
    setFDueDate(""); setFDueDays("30");
    setFMandateId(""); setFQuoteId(""); setFContractId("");
    setFInvoicePhase(""); setFPhaseNumber("1"); setFPaymentMethod("");
    setFStatus("unpaid"); setFServiceType("");
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
      const target = invoices.find((i) => String(i.id) === editId);
      if (target) {
        openEdit(target);
        const url = new URL(window.location.href);
        url.searchParams.delete("editId");
        window.history.replaceState({}, "", url.toString());
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, invoices]);

  const openEdit = (i: Invoice) => {
    setEditInvoice(i);
    setFClientId(String(i.clientId));
    setFTitle(i.title);
    setFDesc(i.description ?? "");
    setFAmount(String(i.amountHt));
    setFDueDate(i.dueDate ? i.dueDate.slice(0, 10) : "");
    setFDueDays("30");
    setFMandateId(""); // Invoice type doesn't expose mandateId yet, leave blank
    setFQuoteId(i.quoteId ? String(i.quoteId) : "");
    setFContractId(i.contractId ? String(i.contractId) : "");
    setFInvoicePhase(i.invoicePhase ?? "");
    setFPhaseNumber(i.phaseNumber ? String(i.phaseNumber) : "1");
    setFPaymentMethod(i.paymentMethod ?? "");
    setFStatus(i.status ?? "unpaid");
    setFServiceType(i.serviceType ?? "");
  };

  const handleCreate = async () => {
    if (submitting) return;
    if (!fClientId || !fTitle.trim() || !fAmount) { toast.error(t("client_titre_montant_requis")); return; }
    if (Number(fAmount) <= 0) { toast.error(t("montant_invalide")); return; }
    setSubmitting(true);
    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: Number(fClientId),
          title: fTitle.trim(),
          description: fDesc.trim() || undefined,
          serviceType: fServiceType || undefined,
          amountHt: Number(fAmount),
          dueDays: fDueDate ? undefined : (fDueDays ? Number(fDueDays) : undefined),
          dueDate: fDueDate || undefined,
          mandateId: fMandateId ? Number(fMandateId) : undefined,
          quoteId: fQuoteId ? Number(fQuoteId) : undefined,
          contractId: fContractId ? Number(fContractId) : undefined,
          invoicePhase: fInvoicePhase || undefined,
          phaseNumber: fPhaseNumber ? Number(fPhaseNumber) : undefined,
          paymentMethod: fPaymentMethod || undefined,
        }),
      });
      if (res.ok) {
        toast.success(t("facture_creee"));
        setCreateOpen(false);
        resetForm();
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (submitting || !editInvoice) return;
    if (!fTitle.trim() || !fAmount) { toast.error(t("titre_montant_requis")); return; }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${editInvoice.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: fTitle.trim(),
          description: fDesc.trim() || null,
          serviceType: fServiceType || null,
          amountHt: Number(fAmount),
          dueDate: fDueDate || null,
          mandateId: fMandateId ? Number(fMandateId) : null,
          quoteId: fQuoteId ? Number(fQuoteId) : null,
          contractId: fContractId ? Number(fContractId) : null,
          invoicePhase: fInvoicePhase || null,
          phaseNumber: fPhaseNumber ? Number(fPhaseNumber) : null,
          paymentMethod: fPaymentMethod || null,
          status: fStatus,
        }),
      });
      if (res.ok) { toast.success(t("facture_modifiee")); setEditInvoice(null); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteInvoice) return;
    const res = await fetch(`/api/invoices/${deleteInvoice.id}`, { method: "DELETE" });
    if (res.ok) { toast.success(t("facture_supprimee")); setDeleteInvoice(null); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  // Mark paid avec choix méthode
  const openMarkPaid = (inv: Invoice) => {
    setPaidDialog(inv);
    setPaidMethod("interac");
    setPaidNote("");
  };

  const confirmMarkPaid = async () => {
    if (!paidDialog) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/invoices/${paidDialog.id}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentMethod: paidMethod, note: paidNote.trim() || undefined }),
      });
      if (res.ok) {
        toast.success(`Facture ${paidDialog.invoiceNumber} marquée payée`);
        setPaidDialog(null);
        router.refresh();
      } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setSubmitting(false); }
  };

  const handleSetStatus = async (inv: Invoice, status: string, label: string) => {
    const ok = await confirm({
      title: `${label} cette facture ?`,
      description: t("passera_statut", { number: inv.invoiceNumber, status: status === "cancelled" ? t("annulee") : status === "overdue" ? t("retard") : status === "unpaid" ? t("non_payee") : status }),
      confirmLabel: label,
      variant: status === "cancelled" ? "destructive" : "default",
    });
    if (!ok) return;
    const res = await fetch(`/api/invoices/${inv.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success(t("statut_mis_jour")); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleSendToClient = async (inv: Invoice) => {
    const ok = await confirm({
      title: t("envoyer_facture_client"),
      description: `La facture ${inv.invoiceNumber} sera ajoutée dans la catégorie t("factures") du portail + message chat + notification.`,
      confirmLabel: t("envoyer"),
    });
    if (!ok) return;
    const res = await fetch(`/api/invoices/${inv.id}/send`, { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(`Facture envoyée à ${data.clientName ?? inv.clientName} (portail + chat + notification)`);
      router.refresh();
    } else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  const handleSendReminder = async (inv: Invoice) => {
    const ok = await confirm({
      title: t("envoyer_rappel_paiement"),
      description: `Un message de relance sera envoyé à ${inv.clientName} pour la facture ${inv.invoiceNumber}.`,
      confirmLabel: t("envoyer_rappel"),
    });
    if (!ok) return;
    const res = await fetch(`/api/invoices/${inv.id}/remind`, { method: "POST" });
    if (res.ok) { toast.success(t("rappel_envoye")); router.refresh(); }
    else { const d = await res.json(); toast.error(d.error || t("erreur")); }
  };

  // Bulk
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} facture(s) ?`,
      description: t("factures_payees_liees_paiements_refusees"),
      confirmLabel: t("supprimer_tous"),
      variant: "destructive",
    });
    if (!ok) return;
    let success = 0, blocked = 0;
    for (const id of Array.from(selectedIds)) {
      const res = await fetch(`/api/invoices/${id}`, { method: "DELETE" });
      if (res.ok) success++; else if (res.status === 409) blocked++;
    }
    toast.success(`${success}/${selectedIds.size} supprimée(s)${blocked > 0 ? ` · ${blocked} bloquée(s)` : ""}`);
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
    let result = invoices;
    if (statusFilter !== "all") result = result.filter((i) => i.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((r) =>
        r.invoiceNumber.toLowerCase().includes(q) ||
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
  }, [invoices, statusFilter, searchQuery, filterClients, filterAmountMin, filterAmountMax, filterDateFrom, filterDateTo]);

  const totalActiveFilters =
    (filterClients.size > 0 ? 1 : 0) +
    (filterAmountMin ? 1 : 0) + (filterAmountMax ? 1 : 0) +
    (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0);

  const clearAllFilters = () => {
    setFilterClients(new Set());
    setFilterAmountMin(""); setFilterAmountMax("");
    setFilterDateFrom(""); setFilterDateTo("");
  };

  // Actions
  const getActions = useCallback((inv: Invoice) => {
    const editable = inv.status !== "paid" && inv.status !== "cancelled";
    const a: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; variant?: "destructive" }> = [
      { label: t("voir_detail"), icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("invoice", inv.id) },
      { label: t("voir_pdf"), icon: <FileText className="h-3.5 w-3.5" />, onClick: () => setPdfInvoice(inv) },
      { label: t("envoyer_client"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => handleSendToClient(inv) },
    ];
    if (inv.status === "unpaid" || inv.status === "overdue") {
      a.push({ label: t("marquer_payee"), icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => openMarkPaid(inv) });
      a.push({ label: t("envoyer_rappel"), icon: <Bell className="h-3.5 w-3.5" />, onClick: () => handleSendReminder(inv) });
    }
    if (inv.status === "unpaid") {
      a.push({ label: t("marquer_retard"), icon: <AlertTriangle className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(inv, "overdue", t("marquer_retard")) });
    }
    if (inv.status === "overdue") {
      a.push({ label: t("remettre_jour"), icon: <Clock className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(inv, "unpaid", t("remettre_non_payee")) });
    }
    if (editable) {
      a.push({ label: t("annuler"), icon: <X className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(inv, "cancelled", t("annuler_action")) });
      a.push({ label: t("modifier"), icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(inv), separator: true });
      a.push({ label: t("supprimer"), icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteInvoice(inv), variant: "destructive" });
    }
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity]);

  // Columns
  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const columns: Column<Invoice>[] = [
    {
      key: "select",
      header: <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(allFilteredIds)} aria-label={t("tout_selectionner")} />,
      accessor: (r) => (
        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelectId(r.id)} onClick={(e) => e.stopPropagation()} aria-label={`Sélectionner ${r.invoiceNumber}`} />
      ),
    },
    { key: "number", header: t("numero"), accessor: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span>, sortable: true, sortBy: (r) => r.invoiceNumber },
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
          {r.contractNumber && <p className="text-[10px] text-muted-foreground">Contrat {r.contractNumber}</p>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.title, hiddenOnMobile: true,
    },
    { key: "ttc", header: "TTC", accessor: (r) => <span className="font-semibold tabular-nums">{formatCurrency(r.amountTtc)}</span>, sortable: true, sortBy: (r) => r.amountTtc },
    { key: "status", header: t("statut"), accessor: (r) => <StatusBadge status={r.status} /> },
    { key: "due", header: t("echeance"), accessor: (r) => r.dueDate ? formatDate(new Date(r.dueDate)) : "—", sortable: true, sortBy: (r) => r.dueDate ?? "", hiddenOnMobile: true },
    { key: "paid", header: t("paye_le"), accessor: (r) => r.paidAt ? formatDate(new Date(r.paidAt)) : "—", hiddenOnMobile: true },
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
              <Receipt className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">{t("factures")}</h1>
              <p className="text-white/70 text-sm mt-0.5">{t("tps_tvq_calcules_automatiquement_paiement")}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kpis.overdueCount > 0 && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-300/30 rounded-lg px-3 py-2 backdrop-blur">
                <AlertTriangle className="h-4 w-4 text-red-200" />
                <span className="text-sm font-semibold text-white">{kpis.overdueCount} en retard</span>
              </div>
            )}
            <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold"
              onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" />{t("nouvelle_facture")}
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("total_impaye")} value={formatCurrency(kpis.unpaidTotal)} icon={Clock} accent="bg-amber-500" deltaLabel={`${kpis.unpaidCount} facture${kpis.unpaidCount > 1 ? "s" : ""}`} />
        <StatCard label={t("retard")} value={formatCurrency(kpis.overdueTotal)} icon={AlertTriangle} accent="bg-red-500" deltaLabel={`${kpis.overdueCount} facture${kpis.overdueCount > 1 ? "s" : ""}`} />
        <StatCard label={t("encaisse_mois")} value={formatCurrency(kpis.paidThisMonth)} icon={CheckCircle2} accent="bg-emerald-500" />
        <StatCard label={t("total_factures")} value={invoices.length} icon={Receipt} accent="bg-blue-500" />
      </div>

      {/* Sentinel — détecte quand les KPIs quittent le viewport */}
      {/* Sentinel — détecte fin des KPI */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {/* Sticky compact bar — KPI seulement (pattern dashboard finance) */}
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Receipt className="h-4 w-4" />
              {t("factures")}
            </span>
            <span className="font-semibold">{filtered.length} affichées</span>
            <span className="text-muted-foreground">{t("impaye")} <span className="font-semibold text-amber-600">{formatCurrency(kpis.unpaidTotal)}</span></span>
            <span className="text-muted-foreground">{t("retard")} <span className="font-semibold text-red-600">{formatCurrency(kpis.overdueTotal)}</span></span>
            <span className="ml-auto text-muted-foreground">{t("encaisse_mois")} <span className="font-semibold text-emerald-600">{formatCurrency(kpis.paidThisMonth)}</span></span>
          </div>
        </div>
      )}

      {/* Filtres en flow normal */}
      <div>
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
                <X className="h-3 w-3 mr-1" />{t("invoices_view_effacer_les_filtres")}</Button>
            )}
          </PopoverContent>
        </Popover>

        <ViewToggle storageKey="invoices" defaultView="list" onChange={setView} />
      </div>
      </div>

      {selectedIds.size > 0 && (
        <div className="rounded-lg border-2 border-[#0F2D52] bg-[#0F2D52]/5 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[#0F2D52]" />
            <span className="text-sm font-medium">{selectedIds.size} sélectionnée(s)</span>
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
          {filtered.map((inv) => (
            <EntityCard
              key={inv.id}
              title={inv.title}
              subtitle={`${inv.invoiceNumber} — ${inv.clientName}`}
              avatarName={inv.clientName}
              alert={inv.status === "overdue"}
              badges={[
                { label: inv.status === "unpaid" ? t("non_payee") : inv.status === "overdue" ? t("retard") : inv.status === "paid" ? t("payee_statut") : inv.status === "cancelled" ? t("annulee") : inv.status, variant: inv.status === "paid" ? "secondary" : inv.status === "overdue" ? "destructive" : "outline" },
              ]}
              stats={[{ label: "TTC", value: formatCurrency(inv.amountTtc) }]}
              actions={getActions(inv)}
              onClick={() => setPdfInvoice(inv)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatCurrency(inv.amountHt)} HT</span>
                  <span>{inv.dueDate ? `Échéance ${formatDate(new Date(inv.dueDate))}` : t("pas_echeance")}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">{t("aucune_facture_trouvee")}</div>
          )}
        </div>
      ) : (
        <DataTable
          data={filtered}
          columns={columns}
          getRowId={(r) => r.id}
          onRowClick={(r) => setPdfInvoice(r)}
          searchPlaceholder={t("rechercher")}
          exportFilename="factures"
          storageKey="admin-invoices"
        />
      )}

      {/* Modale création VNK */}
      <InvoiceFormDialog
        open={createOpen}
        onOpenChange={(o) => { if (!o) { resetForm(); setCreateOpen(false); } else setCreateOpen(true); }}
        mode="create"
        clients={clients}
        mandates={mandates}
        acceptedQuotes={acceptedQuotes}
        signedContracts={signedContracts}
        submitting={submitting}
        values={{
          clientId: fClientId, title: fTitle, desc: fDesc, amount: fAmount, dueDate: fDueDate, dueDays: fDueDays,
          mandateId: fMandateId, quoteId: fQuoteId, contractId: fContractId,
          invoicePhase: fInvoicePhase, phaseNumber: fPhaseNumber, paymentMethod: fPaymentMethod, status: fStatus,
          serviceType: fServiceType,
        }}
        setters={{
          setClientId: setFClientId, setTitle: setFTitle, setDesc: setFDesc,
          setAmount: setFAmount, setDueDate: setFDueDate, setDueDays: setFDueDays,
          setMandateId: setFMandateId, setQuoteId: setFQuoteId, setContractId: setFContractId,
          setInvoicePhase: setFInvoicePhase, setPhaseNumber: setFPhaseNumber,
          setPaymentMethod: setFPaymentMethod, setStatus: setFStatus,
          setServiceType: setFServiceType,
        }}
        onSubmit={handleCreate}
      />
      <InvoiceFormDialog
        open={!!editInvoice}
        onOpenChange={(o) => { if (!o) setEditInvoice(null); }}
        mode="edit"
        clients={clients}
        mandates={mandates}
        acceptedQuotes={acceptedQuotes}
        signedContracts={signedContracts}
        editingInvoiceNumber={editInvoice?.invoiceNumber}
        submitting={submitting}
        values={{
          clientId: fClientId, title: fTitle, desc: fDesc, amount: fAmount, dueDate: fDueDate, dueDays: fDueDays,
          mandateId: fMandateId, quoteId: fQuoteId, contractId: fContractId,
          invoicePhase: fInvoicePhase, phaseNumber: fPhaseNumber, paymentMethod: fPaymentMethod, status: fStatus,
          serviceType: fServiceType,
        }}
        setters={{
          setClientId: () => {}, setTitle: setFTitle, setDesc: setFDesc,
          setAmount: setFAmount, setDueDate: setFDueDate, setDueDays: setFDueDays,
          setMandateId: setFMandateId, setQuoteId: setFQuoteId, setContractId: setFContractId,
          setInvoicePhase: setFInvoicePhase, setPhaseNumber: setFPhaseNumber,
          setPaymentMethod: setFPaymentMethod, setStatus: setFStatus,
          setServiceType: setFServiceType,
        }}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={!!deleteInvoice}
        onOpenChange={(o) => { if (!o) setDeleteInvoice(null); }}
        title={t("supprimer_facture")}
        description={`La facture "${deleteInvoice?.invoiceNumber}" sera supprimée définitivement.`}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
      />

      {/* Mark paid dialog VNK */}
      <Dialog open={!!paidDialog} onOpenChange={(o) => { if (!o) setPaidDialog(null); }}>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden">
          <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-white/15 flex items-center justify-center shrink-0">
                <CreditCard className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-white">{t("marquer_comme_payee")}</DialogTitle>
                <DialogDescription className="text-white/70 mt-0.5">
                  Facture {paidDialog?.invoiceNumber} — sélectionnez la méthode de paiement utilisée.
                </DialogDescription>
              </div>
            </div>
          </div>
          <div className="px-6 py-5 space-y-3">
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("methode")}</Label>
              <Select value={paidMethod} onValueChange={setPaidMethod}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{t(m.labelKey)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("note_optionnel")}</Label>
              <Input value={paidNote} onChange={(e) => setPaidNote(e.target.value)} placeholder={t("n_transaction_reference")} />
            </div>
          </div>
          <DialogFooter className="px-6 py-4 border-t bg-card sm:gap-2">
            <Button variant="outline" onClick={() => setPaidDialog(null)} disabled={submitting}>{tc("cancel")}</Button>
            <Button onClick={confirmMarkPaid} disabled={submitting} className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md">
              {submitting ? t("enregistrement") : t("confirmer_paiement")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* PDF preview VNK */}
      {pdfInvoice && (
        <PdfViewerModal
          open
          onClose={() => setPdfInvoice(null)}
          pdfUrl={`/api/invoices/${pdfInvoice.id}/pdf`}
          title={pdfInvoice.title}
          documentNumber={pdfInvoice.invoiceNumber}
          downloadName={`facture-${pdfInvoice.invoiceNumber}`}
        />
      )}

      {ConfirmModal}
    </div>
  );
}

// ─── InvoiceFormDialog VNK navy ──────────────────────────
type IFormValues = {
  clientId: string; title: string; desc: string; amount: string; dueDate: string; dueDays: string;
  mandateId: string; quoteId: string; contractId: string;
  invoicePhase: string; phaseNumber: string; paymentMethod: string; status: string;
  serviceType: string;
};
type IFormSetters = {
  setClientId: (v: string) => void; setTitle: (v: string) => void; setDesc: (v: string) => void;
  setAmount: (v: string) => void; setDueDate: (v: string) => void; setDueDays: (v: string) => void;
  setMandateId: (v: string) => void; setQuoteId: (v: string) => void; setContractId: (v: string) => void;
  setInvoicePhase: (v: string) => void; setPhaseNumber: (v: string) => void;
  setPaymentMethod: (v: string) => void; setStatus: (v: string) => void;
  setServiceType: (v: string) => void;
};

function InvoiceFormDialog({
  open, onOpenChange, mode, clients, mandates, acceptedQuotes, signedContracts,
  editingInvoiceNumber, submitting, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  clients: ClientOption[];
  mandates: MandateOption[];
  acceptedQuotes: LinkedQuote[];
  signedContracts: LinkedContract[];
  editingInvoiceNumber?: string;
  submitting: boolean;
  values: IFormValues;
  setters: IFormSetters;
  onSubmit: () => void | Promise<void>;
}) {
  const t = useTranslations("admin.invoices");
  const tc = useTranslations("common");
  const isCreate = mode === "create";
  const amountNum = Number(values.amount) || 0;
  const tps = amountNum * 0.05;
  const tvq = amountNum * 0.09975;
  const ttc = amountNum + tps + tvq;

  const clientIdNum = Number(values.clientId) || 0;
  const filteredMandates = mandates.filter((m) => m.clientId === clientIdNum);
  const filteredQuotes = acceptedQuotes.filter((q) => q.clientId === clientIdNum);
  const filteredContracts = signedContracts.filter((c) => c.clientId === clientIdNum);

  const fillFromQuote = (qid: string) => {
    setters.setQuoteId(qid);
    if (!qid) return;
    const q = acceptedQuotes.find((x) => String(x.id) === qid);
    if (q && !values.title.trim()) setters.setTitle(q.title);
    if (q && !values.amount) {
      const ht = q.amountTtc / 1.14975;
      setters.setAmount(ht.toFixed(2));
    }
  };
  const fillFromContract = (cid: string) => {
    setters.setContractId(cid);
    if (!cid) return;
    const c = signedContracts.find((x) => String(x.id) === cid);
    if (c && !values.title.trim()) setters.setTitle(c.title);
    if (c && !values.amount && c.amountTtc) {
      const ht = c.amountTtc / 1.14975;
      setters.setAmount(ht.toFixed(2));
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "90vh" }}>
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isCreate ? <Receipt className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white text-lg">
                {isCreate ? t("nouvelle_facture") : t("modifier_facture")}
              </DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {isCreate ? t("numero_sera_genere_automatiquement_f") : (editingInvoiceNumber || t("modification"))}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          <FormSection title={t("identite")} icon={<Receipt className="h-3.5 w-3.5" />}>
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
              <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder={t("audit_plc_phase_1")} />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("type_service")}</Label>
              <Select value={values.serviceType || "none"} onValueChange={(v) => setters.setServiceType(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder={t("selectionner_service")} /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{tc("none")}</SelectItem>
                  {SERVICE_TYPES.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("description")}</Label>
              <Textarea value={values.desc} onChange={(e) => setters.setDesc(e.target.value)} rows={3} placeholder={t("details_facturation")} />
            </div>
          </FormSection>

          <FormSection title={t("montant_taxes")} icon={<DollarSign className="h-3.5 w-3.5" />}>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("montant_ht_cad")}</Label>
              <Input type="number" min="0" step="0.01" value={values.amount} onChange={(e) => setters.setAmount(e.target.value)} placeholder="0.00" />
            </div>
            {amountNum > 0 && (
              <div className="rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 space-y-1 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">{t("sous_total_ht")}</span><span className="tabular-nums">{formatCurrency(amountNum)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("tps_5")}</span><span className="tabular-nums">{formatCurrency(tps)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">{t("tvq_9_975")}</span><span className="tabular-nums">{formatCurrency(tvq)}</span></div>
                <div className="flex justify-between border-t pt-1 mt-1 font-bold text-[#0F2D52]"><span>{t("total_ttc")}</span><span className="tabular-nums">{formatCurrency(ttc)}</span></div>
              </div>
            )}
          </FormSection>

          <FormSection title={t("echeance")} icon={<Clock className="h-3.5 w-3.5" />}>
            {isCreate ? (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("delai_paiement_jours")}</Label>
                <Select value={values.dueDays} onValueChange={setters.setDueDays}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="7">{t("7_jours")}</SelectItem>
                    <SelectItem value="15">{t("15_jours")}</SelectItem>
                    <SelectItem value="30">{t("30_jours_standard")}</SelectItem>
                    <SelectItem value="45">{t("45_jours")}</SelectItem>
                    <SelectItem value="60">{t("60_jours")}</SelectItem>
                    <SelectItem value="90">{t("90_jours")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("date_apos_echeance")}</Label>
                <Input type="date" value={values.dueDate} onChange={(e) => setters.setDueDate(e.target.value)} />
              </div>
            )}
            {isCreate && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("date_precise_optionnel_override_delai")}</Label>
                <Input type="date" value={values.dueDate} onChange={(e) => setters.setDueDate(e.target.value)} />
              </div>
            )}
          </FormSection>

          {/* Phase de facturation */}
          <FormSection title={t("phase_facturation")} icon={<Receipt className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("type_phase")}</Label>
                <Select value={values.invoicePhase || "none"} onValueChange={(v) => setters.setInvoicePhase(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={t("aucune_phase")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("aucune_phase")}</SelectItem>
                    {PHASE_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{t(p.labelKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("numero_phase")}</Label>
                <Input type="number" min="1" value={values.phaseNumber} onChange={(e) => setters.setPhaseNumber(e.target.value)} />
              </div>
            </div>
          </FormSection>

          {/* Liens (mandate, quote, contract) */}
          {clientIdNum > 0 && (
            <FormSection title={t("liens_optionnel")} icon={<DollarSign className="h-3.5 w-3.5" />}>
              {filteredMandates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("mandat_associe")}</Label>
                  <Select value={values.mandateId || "none"} onValueChange={(v) => setters.setMandateId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t("aucun_mandat")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("aucun_mandat")}</SelectItem>
                      {filteredMandates.map((m) => (
                        <SelectItem key={m.id} value={String(m.id)}>{m.title}{m.status !== "active" && m.status !== "in_progress" ? ` (${m.status})` : ""}</SelectItem>
                      ))}
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
                      {filteredQuotes.map((q) => (
                        <SelectItem key={q.id} value={String(q.id)}>{q.quoteNumber} — {q.title} ({formatCurrency(q.amountTtc)})</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {filteredContracts.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("contrat_source_auto_remplit_titre")}</Label>
                  <Select value={values.contractId || "none"} onValueChange={(v) => fillFromContract(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={t("aucun_contrat")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t("aucun_contrat")}</SelectItem>
                      {filteredContracts.map((c) => (
                        <SelectItem key={c.id} value={String(c.id)}>{c.contractNumber} — {c.title}{c.amountTtc ? ` (${formatCurrency(c.amountTtc)})` : ""}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {filteredMandates.length === 0 && filteredQuotes.length === 0 && filteredContracts.length === 0 && (
                <p className="text-[11px] text-muted-foreground">{t("aucun_mandat_devis_accepte_contrat")}</p>
              )}
            </FormSection>
          )}

          {/* Méthode de paiement (les deux modes) + Statut (edit only) */}
          <FormSection title={t("paiement")} icon={<CreditCard className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{t("methode_prevue")}</Label>
                <Select value={values.paymentMethod || "none"} onValueChange={(v) => setters.setPaymentMethod(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder={t("definir")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("definir")}</SelectItem>
                    {PAYMENT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{t(m.labelKey)}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              {!isCreate && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">{tc("status")}</Label>
                  <Select value={values.status} onValueChange={setters.setStatus}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{t(s.labelKey)}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
          </FormSection>
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{tc("cancel")}</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !values.title.trim() || !values.amount || (isCreate && !values.clientId)}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white shadow-md"
          >
            {submitting ? t("enregistrement") : (isCreate ? t("creer_facture") : t("enregistrer"))}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

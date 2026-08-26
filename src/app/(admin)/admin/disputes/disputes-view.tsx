"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Scale, Plus, Search, Clock, AlertTriangle, CheckCircle2, X, Pencil, Trash2,
  SlidersHorizontal, CheckSquare, MoreHorizontal, DollarSign, Eye,
  Receipt as ReceiptIcon, Users, Briefcase, CreditCard, Gavel, Award, XCircle, AlertCircle,
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
import { StatCard } from "@/components/admin/stat-card";
import { ViewToggle } from "@/components/admin/view-toggle";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { FormSection } from "@/components/admin/client-form-fields";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Dispute = {
  id: number;
  clientId: number;
  clientName: string;
  companyName: string | null;
  invoiceId: number | null;
  invoiceNumber: string | null;
  invoiceAmount: number | null;
  mandateId: number | null;
  mandateTitle: string | null;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  resolution: string | null;
  type: string;
  category: string | null;
  amountDisputed: number | null;
  currency: string | null;
  stripeDisputeId: string | null;
  stripeReason: string | null;
  evidenceDueBy: string | null;
  evidenceSubmittedAt: string | null;
  outcome: string | null;
  cardBrand: string | null;
  assignedTo: string | null;
  estimatedResolutionDate: string | null;
  escalatedAt: string | null;
  internalNotes: string | null;
  evidenceDocumentIds: number[];
  lastClientContactAt: string | null;
  nextActionDue: string | null;
  contactMethod: string | null;
  lawFirmInvolved: string | null;
  caseNumber: string | null;
  tribunal: string | null;
  smallClaimsFiledAt: string | null;
  openedAt: string;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type InvoiceOption = { id: number; invoiceNumber: string; clientId: number; amountTtc: number; status: string };
type MandateOption = { id: number; title: string; clientId: number };

type StatusFilter = "all" | "open" | "under_review" | "won" | "lost" | "resolved";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "open", label: "Ouverts" },
  { key: "under_review", label: "En examen" },
  { key: "won", label: "Gagnés" },
  { key: "lost", label: "Perdus" },
  { key: "resolved", label: "Résolus" },
];

const TYPE_OPTIONS = [
  { value: "chargeback", label: "Chargeback Stripe", icon: CreditCard, color: "bg-red-100 text-red-700" },
  { value: "invoice", label: "Contestation facture", icon: ReceiptIcon, color: "bg-amber-100 text-amber-700" },
  { value: "service", label: "Plainte service", icon: AlertCircle, color: "bg-orange-100 text-orange-700" },
  { value: "refund", label: "Demande remboursement", icon: DollarSign, color: "bg-blue-100 text-blue-700" },
  { value: "warranty", label: "Garantie", icon: CheckCircle2, color: "bg-purple-100 text-purple-700" },
  { value: "legal", label: "Juridique", icon: Gavel, color: "bg-violet-100 text-violet-700" },
  { value: "other", label: "Autre", icon: AlertTriangle, color: "bg-gray-100 text-gray-700" },
];

const STRIPE_REASONS = [
  { value: "duplicate", label: "Duplicate" },
  { value: "fraudulent", label: "Frauduleux" },
  { value: "subscription_canceled", label: "Abonnement annulé" },
  { value: "product_unacceptable", label: "Produit non acceptable" },
  { value: "product_not_received", label: "Produit non reçu" },
  { value: "unrecognized", label: "Non reconnu" },
  { value: "credit_not_processed", label: "Crédit non traité" },
  { value: "general", label: "Général" },
  { value: "incorrect_account_details", label: "Détails compte incorrects" },
  { value: "insufficient_funds", label: "Fonds insuffisants" },
  { value: "bank_cannot_process", label: "Banque ne peut traiter" },
  { value: "debit_not_authorized", label: "Débit non autorisé" },
];

const TRIBUNAL_OPTIONS = [
  { value: "petites_creances", label: "Cour des petites créances" },
  { value: "regie_logement", label: "Régie du logement" },
  { value: "cour_quebec", label: "Cour du Québec" },
  { value: "cour_superieure", label: "Cour supérieure" },
  { value: "arbitrage", label: "Arbitrage privé" },
  { value: "mediation", label: "Médiation" },
];

const CONTACT_METHODS = [
  { value: "email", label: "Courriel" },
  { value: "phone", label: "Téléphone" },
  { value: "letter", label: "Lettre formelle" },
  { value: "meeting", label: "Rencontre" },
  { value: "lawyer", label: "Via avocat" },
];

const PRIORITY_OPTIONS = [
  { value: "low", label: "Faible", color: "bg-gray-100 text-gray-700" },
  { value: "medium", label: "Moyenne", color: "bg-blue-100 text-blue-700" },
  { value: "high", label: "Haute", color: "bg-amber-100 text-amber-700" },
  { value: "urgent", label: "Urgente", color: "bg-red-100 text-red-700" },
];

const STATUS_OPTIONS = [
  { value: "open", label: "Ouvert" },
  { value: "under_review", label: "En examen" },
  { value: "evidence_submitted", label: "Preuves soumises" },
  { value: "won", label: "Gagné" },
  { value: "lost", label: "Perdu" },
  { value: "resolved", label: "Résolu" },
  { value: "cancelled", label: "Annulé" },
];

export function DisputesView({
  disputes,
  clients,
  invoices,
  mandates,
  kpis,
}: {
  disputes: Dispute[];
  clients: ClientOption[];
  invoices: InvoiceOption[];
  mandates: MandateOption[];
  kpis: { total: number; open: number; won: number; lost: number; overdueEvidence: number; totalAtStake: number };
}) {
  const tc = useTranslations("common");
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [filterClients, setFilterClients] = useState<Set<number>>(new Set());
  const [filterTypes, setFilterTypes] = useState<Set<string>>(new Set());
  const [filterPriorities, setFilterPriorities] = useState<Set<string>>(new Set());
  const [filterAssigned, setFilterAssigned] = useState("");

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [editDispute, setEditDispute] = useState<Dispute | null>(null);
  const [deleteDispute, setDeleteDispute] = useState<Dispute | null>(null);

  const [fClientId, setFClientId] = useState("");
  const [fInvoiceId, setFInvoiceId] = useState("");
  const [fMandateId, setFMandateId] = useState("");
  const [fTitle, setFTitle] = useState("");
  const [fDescription, setFDescription] = useState("");
  const [fStatus, setFStatus] = useState("open");
  const [fPriority, setFPriority] = useState("medium");
  const [fType, setFType] = useState("other");
  const [fCategory, setFCategory] = useState("");
  const [fAmountDisputed, setFAmountDisputed] = useState("");
  const [fCurrency, setFCurrency] = useState("CAD");
  const [fStripeDisputeId, setFStripeDisputeId] = useState("");
  const [fStripeReason, setFStripeReason] = useState("");
  const [fEvidenceDueBy, setFEvidenceDueBy] = useState("");
  const [fEvidenceSubmittedAt, setFEvidenceSubmittedAt] = useState("");
  const [fOutcome, setFOutcome] = useState("");
  const [fCardBrand, setFCardBrand] = useState("");
  const [fAssignedTo, setFAssignedTo] = useState("");
  const [fEstimatedResolutionDate, setFEstimatedResolutionDate] = useState("");
  const [fInternalNotes, setFInternalNotes] = useState("");
  const [fLastClientContactAt, setFLastClientContactAt] = useState("");
  const [fNextActionDue, setFNextActionDue] = useState("");
  const [fContactMethod, setFContactMethod] = useState("");
  const [fLawFirmInvolved, setFLawFirmInvolved] = useState("");
  const [fCaseNumber, setFCaseNumber] = useState("");
  const [fTribunal, setFTribunal] = useState("");
  const [fSmallClaimsFiledAt, setFSmallClaimsFiledAt] = useState("");
  const [fResolution, setFResolution] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const resetForm = () => {
    setFClientId(""); setFInvoiceId(""); setFMandateId("");
    setFTitle(""); setFDescription(""); setFStatus("open"); setFPriority("medium");
    setFType("other"); setFCategory(""); setFAmountDisputed(""); setFCurrency("CAD");
    setFStripeDisputeId(""); setFStripeReason(""); setFEvidenceDueBy(""); setFEvidenceSubmittedAt("");
    setFOutcome(""); setFCardBrand(""); setFAssignedTo(""); setFEstimatedResolutionDate("");
    setFInternalNotes(""); setFLastClientContactAt(""); setFNextActionDue(""); setFContactMethod("");
    setFLawFirmInvolved(""); setFCaseNumber(""); setFTribunal(""); setFSmallClaimsFiledAt("");
    setFResolution("");
  };

  const openEdit = (d: Dispute) => {
    setEditDispute(d);
    setFClientId(String(d.clientId));
    setFInvoiceId(d.invoiceId ? String(d.invoiceId) : "");
    setFMandateId(d.mandateId ? String(d.mandateId) : "");
    setFTitle(d.title);
    setFDescription(d.description ?? "");
    setFStatus(d.status);
    setFPriority(d.priority);
    setFType(d.type);
    setFCategory(d.category ?? "");
    setFAmountDisputed(d.amountDisputed != null ? String(d.amountDisputed) : "");
    setFCurrency(d.currency ?? "CAD");
    setFStripeDisputeId(d.stripeDisputeId ?? "");
    setFStripeReason(d.stripeReason ?? "");
    setFEvidenceDueBy(d.evidenceDueBy ? d.evidenceDueBy.slice(0, 10) : "");
    setFEvidenceSubmittedAt(d.evidenceSubmittedAt ? d.evidenceSubmittedAt.slice(0, 10) : "");
    setFOutcome(d.outcome ?? "");
    setFCardBrand(d.cardBrand ?? "");
    setFAssignedTo(d.assignedTo ?? "");
    setFEstimatedResolutionDate(d.estimatedResolutionDate ? d.estimatedResolutionDate.slice(0, 10) : "");
    setFInternalNotes(d.internalNotes ?? "");
    setFLastClientContactAt(d.lastClientContactAt ? d.lastClientContactAt.slice(0, 10) : "");
    setFNextActionDue(d.nextActionDue ? d.nextActionDue.slice(0, 10) : "");
    setFContactMethod(d.contactMethod ?? "");
    setFLawFirmInvolved(d.lawFirmInvolved ?? "");
    setFCaseNumber(d.caseNumber ?? "");
    setFTribunal(d.tribunal ?? "");
    setFSmallClaimsFiledAt(d.smallClaimsFiledAt ? d.smallClaimsFiledAt.slice(0, 10) : "");
    setFResolution(d.resolution ?? "");
  };

  const buildPayload = () => ({
    clientId: Number(fClientId),
    invoiceId: fInvoiceId ? Number(fInvoiceId) : null,
    mandateId: fMandateId ? Number(fMandateId) : null,
    title: fTitle.trim(),
    description: fDescription.trim() || null,
    priority: fPriority,
    type: fType,
    category: fCategory.trim() || null,
    amountDisputed: fAmountDisputed ? Number(fAmountDisputed) : null,
    currency: fCurrency,
    stripeReason: fStripeReason || null,
    evidenceDueBy: fEvidenceDueBy || null,
    cardBrand: fCardBrand || null,
    assignedTo: fAssignedTo.trim() || null,
    estimatedResolutionDate: fEstimatedResolutionDate || null,
    internalNotes: fInternalNotes.trim() || null,
    contactMethod: fContactMethod || null,
  });

  const handleCreate = async () => {
    if (submitting) return;
    if (!fClientId || !fTitle.trim() || !fDescription.trim()) {
      toast.error("Client, titre et description requis"); return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/disputes", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildPayload()),
      });
      if (res.ok) { toast.success("Litige créé"); setCreateOpen(false); resetForm(); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setSubmitting(false); }
  };

  const handleEdit = async () => {
    if (submitting || !editDispute || !fTitle.trim()) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/disputes/${editDispute.id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...buildPayload(),
          status: fStatus,
          resolution: fResolution.trim() || null,
          stripeDisputeId: fStripeDisputeId.trim() || null,
          evidenceSubmittedAt: fEvidenceSubmittedAt || null,
          outcome: fOutcome || null,
          lastClientContactAt: fLastClientContactAt || null,
          nextActionDue: fNextActionDue || null,
          lawFirmInvolved: fLawFirmInvolved.trim() || null,
          caseNumber: fCaseNumber.trim() || null,
          tribunal: fTribunal || null,
          smallClaimsFiledAt: fSmallClaimsFiledAt || null,
        }),
      });
      if (res.ok) { toast.success("Litige modifié"); setEditDispute(null); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setSubmitting(false); }
  };

  const handleDelete = async () => {
    if (!deleteDispute) return;
    const res = await fetch(`/api/disputes/${deleteDispute.id}`, { method: "DELETE" });
    if (res.ok) { toast.success("Litige supprimé"); setDeleteDispute(null); router.refresh(); }
    else { toast.error("Erreur"); }
  };

  const handleSetStatus = async (d: Dispute, status: string, label: string) => {
    const ok = await confirm({
      title: `${label} ce litige ?`,
      description: `« ${d.title} » passera au statut « ${status} ».`,
      confirmLabel: label,
      variant: status === "lost" || status === "cancelled" ? "destructive" : "default",
    });
    if (!ok) return;
    const res = await fetch(`/api/disputes/${d.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    if (res.ok) { toast.success("Statut mis à jour"); router.refresh(); }
    else { toast.error("Erreur"); }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const ok = await confirm({
      title: `Supprimer ${selectedIds.size} litige(s) ?`,
      description: "Action irréversible.",
      confirmLabel: "Supprimer tous",
      variant: "destructive",
    });
    if (!ok) return;
    let success = 0;
    for (const id of Array.from(selectedIds)) {
      const r = await fetch(`/api/disputes/${id}`, { method: "DELETE" });
      if (r.ok) success++;
    }
    toast.success(`${success}/${selectedIds.size} supprimé(s)`);
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

  const filtered = useMemo(() => {
    let r = disputes;
    if (statusFilter !== "all") r = r.filter((d) => d.status === statusFilter);
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      r = r.filter((d) =>
        d.title.toLowerCase().includes(q) ||
        d.clientName.toLowerCase().includes(q) ||
        (d.companyName ?? "").toLowerCase().includes(q) ||
        (d.invoiceNumber ?? "").toLowerCase().includes(q) ||
        (d.stripeDisputeId ?? "").toLowerCase().includes(q) ||
        (d.caseNumber ?? "").toLowerCase().includes(q)
      );
    }
    if (filterClients.size > 0) r = r.filter((d) => filterClients.has(d.clientId));
    if (filterTypes.size > 0) r = r.filter((d) => filterTypes.has(d.type));
    if (filterPriorities.size > 0) r = r.filter((d) => filterPriorities.has(d.priority));
    if (filterAssigned) r = r.filter((d) => (d.assignedTo ?? "").toLowerCase().includes(filterAssigned.toLowerCase()));
    return r;
  }, [disputes, statusFilter, searchQuery, filterClients, filterTypes, filterPriorities, filterAssigned]);

  const totalActiveFilters = (filterClients.size > 0 ? 1 : 0) + (filterTypes.size > 0 ? 1 : 0) + (filterPriorities.size > 0 ? 1 : 0) + (filterAssigned ? 1 : 0);
  const clearAllFilters = () => { setFilterClients(new Set()); setFilterTypes(new Set()); setFilterPriorities(new Set()); setFilterAssigned(""); };

  const clientIdNum = Number(fClientId) || 0;
  const filteredInvoices = invoices.filter((i) => i.clientId === clientIdNum);
  const filteredMandates = mandates.filter((m) => m.clientId === clientIdNum);

  const fillFromInvoice = (id: string) => {
    setFInvoiceId(id);
    if (!id) return;
    const inv = invoices.find((i) => String(i.id) === id);
    if (inv && !fAmountDisputed) setFAmountDisputed(String(inv.amountTtc));
  };

  const getActions = useCallback((d: Dispute) => {
    const a: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; variant?: "destructive" }> = [
      { label: "Voir client", icon: <Users className="h-3.5 w-3.5" />, onClick: () => openEntity("client", d.clientId) },
    ];
    if (d.invoiceId) a.push({ label: "Voir facture", icon: <ReceiptIcon className="h-3.5 w-3.5" />, onClick: () => openEntity("invoice", d.invoiceId!) });
    if (d.mandateId) a.push({ label: "Voir mandat", icon: <Briefcase className="h-3.5 w-3.5" />, onClick: () => openEntity("mandate", d.mandateId!) });
    if (d.status === "open") a.push({ label: "Marquer en examen", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(d, "under_review", "Marquer en examen") });
    if (d.status === "under_review" || d.status === "evidence_submitted" || d.status === "open") {
      a.push({ label: "Marquer gagné", icon: <Award className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(d, "won", "Marquer gagné") });
      a.push({ label: "Marquer perdu", icon: <XCircle className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(d, "lost", "Marquer perdu") });
      a.push({ label: "Marquer résolu", icon: <CheckCircle2 className="h-3.5 w-3.5" />, onClick: () => handleSetStatus(d, "resolved", "Marquer résolu") });
    }
    a.push({ label: "Modifier", icon: <Pencil className="h-3.5 w-3.5" />, onClick: () => openEdit(d), separator: true });
    a.push({ label: "Supprimer", icon: <Trash2 className="h-3.5 w-3.5" />, onClick: () => setDeleteDispute(d), variant: "destructive" });
    return a;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openEntity]);

  const allFilteredIds = filtered.map((r) => r.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  const columns: Column<Dispute>[] = [
    {
      key: "select",
      header: <Checkbox checked={allSelected} onCheckedChange={() => toggleSelectAll(allFilteredIds)} aria-label="Tout sélectionner" />,
      accessor: (r) => (
        <Checkbox checked={selectedIds.has(r.id)} onCheckedChange={() => toggleSelectId(r.id)} onClick={(e) => e.stopPropagation()} />
      ),
    },
    {
      key: "type", header: "Type",
      accessor: (r) => {
        const t = TYPE_OPTIONS.find((o) => o.value === r.type);
        const Icon = t?.icon ?? AlertTriangle;
        return <div className="flex items-center gap-1.5"><Icon className="h-3.5 w-3.5 text-muted-foreground" /><span className="text-xs">{t?.label ?? r.type}</span></div>;
      },
      hiddenOnMobile: true,
    },
    {
      key: "title", header: "Titre",
      accessor: (r) => (
        <div>
          <p className="text-sm font-medium">{r.title}</p>
          {r.category && <p className="text-[10px] text-muted-foreground">{r.category}</p>}
          {r.invoiceNumber && <p className="text-[10px] text-muted-foreground">Facture {r.invoiceNumber}</p>}
        </div>
      ),
      sortable: true, sortBy: (r) => r.title,
    },
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
      key: "amount", header: "Montant",
      accessor: (r) => r.amountDisputed ? <span className="font-semibold tabular-nums">{formatCurrency(r.amountDisputed)}</span> : <span className="text-muted-foreground">—</span>,
      sortable: true, sortBy: (r) => r.amountDisputed ?? 0, hiddenOnMobile: true,
    },
    {
      key: "priority", header: "Priorité",
      accessor: (r) => {
        const p = PRIORITY_OPTIONS.find((o) => o.value === r.priority);
        return <span className={cn("text-[10px] px-2 py-0.5 rounded-full font-medium", p?.color ?? "bg-gray-100 text-gray-700")}>{p?.label ?? r.priority}</span>;
      },
      hiddenOnMobile: true,
    },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "deadline", header: "Échéance",
      accessor: (r) => {
        if (!r.evidenceDueBy) return <span className="text-muted-foreground text-xs">—</span>;
        const overdue = new Date(r.evidenceDueBy) < new Date() && !r.evidenceSubmittedAt && !r.resolvedAt;
        return <span className={cn("text-xs", overdue ? "text-destructive font-bold" : "")}>{formatDate(new Date(r.evidenceDueBy))}{overdue && " ⚠"}</span>;
      },
      hiddenOnMobile: true,
    },
    { key: "openedAt", header: "Ouvert", accessor: (r) => formatDate(new Date(r.openedAt)), sortable: true, sortBy: (r) => r.openedAt, hiddenOnMobile: true },
    {
      key: "actions", header: "",
      accessor: (r) => (
        <div onClick={(e) => e.stopPropagation()}>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="h-7 w-7 flex items-center justify-center rounded-md hover:bg-muted">
                <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              {getActions(r).map((a, i) => (
                <div key={i}>
                  {a.separator && i > 0 && <DropdownMenuSeparator />}
                  <DropdownMenuItem onSelect={() => a.onClick()} className={a.variant === "destructive" ? "text-destructive" : ""}>
                    <span className="mr-2">{a.icon}</span>{a.label}
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
      <div className="rounded-2xl bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] p-5 sm:p-6 text-white shadow-md relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-32 translate-x-32" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-24 -translate-x-24" />
        <div className="relative flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              <Scale className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">Litiges</h1>
              <p className="text-white/70 text-sm mt-0.5">Chargebacks Stripe · contestations · plaintes · escalade juridique</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {kpis.overdueEvidence > 0 && (
              <div className="flex items-center gap-2 bg-red-500/20 border border-red-300/30 rounded-lg px-3 py-2 backdrop-blur">
                <AlertTriangle className="h-4 w-4 text-red-200" />
                <span className="text-sm font-semibold text-white">{kpis.overdueEvidence} preuve(s) en retard</span>
              </div>
            )}
            <Button className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold" onClick={() => { resetForm(); setCreateOpen(true); }}>
              <Plus className="h-4 w-4" />Nouveau litige
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Total litiges" value={kpis.total} icon={Scale} accent="bg-indigo-500" />
        <StatCard label="Ouverts" value={kpis.open} icon={Clock} accent="bg-amber-500" deltaLabel={`${formatCurrency(kpis.totalAtStake)} en jeu`} />
        <StatCard label="Gagnés" value={kpis.won} icon={Award} accent="bg-emerald-500" />
        <StatCard label="Perdus" value={kpis.lost} icon={XCircle} accent="bg-red-500" />
      </div>

      {/* Sentinel + Sticky compact bar (pattern dashboard finance) */}
      <div ref={stickyBarSentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Scale className="h-4 w-4" />
              Litiges
            </span>
            <span className="font-semibold">{filtered.length} affichés</span>
            {kpis.open > 0 && <span className="text-muted-foreground">Ouverts <span className="font-semibold text-amber-600">{kpis.open}</span></span>}
            <span className="text-muted-foreground">Gagnés <span className="font-semibold text-emerald-600">{kpis.won}</span></span>
            {kpis.lost > 0 && <span className="text-muted-foreground">Perdus <span className="font-semibold text-red-600">{kpis.lost}</span></span>}
            {kpis.totalAtStake > 0 && <span className="ml-auto text-muted-foreground">En jeu <span className="font-semibold">{formatCurrency(kpis.totalAtStake)}</span></span>}
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Titre, client, facture, dossier..." className="pl-9" />
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
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtres</span>
              {totalActiveFilters > 0 && <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{totalActiveFilters}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[340px] max-w-[calc(100vw-2rem)] p-3 space-y-3" align="end">
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type</p>
              <div className="flex flex-wrap gap-1">
                {TYPE_OPTIONS.map((t) => {
                  const isOn = filterTypes.has(t.value);
                  return (
                    <button key={t.value} type="button" onClick={() => { const set = new Set(filterTypes); if (isOn) set.delete(t.value); else set.add(t.value); setFilterTypes(set); }}
                      className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", isOn ? "bg-[#0F2D52] text-white" : t.color)}>
                      {t.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Priorité</p>
              <div className="flex flex-wrap gap-1">
                {PRIORITY_OPTIONS.map((p) => {
                  const isOn = filterPriorities.has(p.value);
                  return (
                    <button key={p.value} type="button" onClick={() => { const set = new Set(filterPriorities); if (isOn) set.delete(p.value); else set.add(p.value); setFilterPriorities(set); }}
                      className={cn("px-2 py-0.5 rounded-full text-[10px] font-medium", isOn ? "bg-[#0F2D52] text-white" : p.color)}>
                      {p.label}
                    </button>
                  );
                })}
              </div>
            </div>
            {clients.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Client</p>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {clients.map((c) => {
                    const isOn = filterClients.has(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => { const set = new Set(filterClients); if (isOn) set.delete(c.id); else set.add(c.id); setFilterClients(set); }}
                        className={cn("px-2 py-0.5 rounded-full border text-[10px]", isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted")}>
                        {c.fullName}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Assigné à</p>
              <Input value={filterAssigned} onChange={(e) => setFilterAssigned(e.target.value)} placeholder="Email admin" className="h-8 text-xs" />
            </div>
            {totalActiveFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="w-full text-xs">
                <X className="h-3 w-3 mr-1" />Effacer les filtres
              </Button>
            )}
          </PopoverContent>
        </Popover>
        <ViewToggle storageKey="disputes" defaultView="list" onChange={() => {}} />
      </div>

      {selectedIds.size > 0 && (
        <div className="rounded-lg border-2 border-[#0F2D52] bg-[#0F2D52]/5 px-3 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <CheckSquare className="h-4 w-4 text-[#0F2D52]" />
            <span className="text-sm font-medium">{selectedIds.size} sélectionné(s)</span>
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

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        onRowClick={(r) => openEdit(r)}
        searchPlaceholder="Rechercher..."
        exportFilename="litiges"
        storageKey="admin-disputes"
      />

      <DisputeFormDialog
        open={createOpen}
        onOpenChange={(o) => { if (!o) { resetForm(); setCreateOpen(false); } else setCreateOpen(true); }}
        mode="create"
        clients={clients}
        invoices={filteredInvoices}
        mandates={filteredMandates}
        submitting={submitting}
        values={{
          clientId: fClientId, invoiceId: fInvoiceId, mandateId: fMandateId,
          title: fTitle, description: fDescription, status: fStatus, priority: fPriority,
          type: fType, category: fCategory, amountDisputed: fAmountDisputed, currency: fCurrency,
          stripeDisputeId: fStripeDisputeId, stripeReason: fStripeReason,
          evidenceDueBy: fEvidenceDueBy, evidenceSubmittedAt: fEvidenceSubmittedAt,
          outcome: fOutcome, cardBrand: fCardBrand, assignedTo: fAssignedTo,
          estimatedResolutionDate: fEstimatedResolutionDate, internalNotes: fInternalNotes,
          lastClientContactAt: fLastClientContactAt, nextActionDue: fNextActionDue, contactMethod: fContactMethod,
          lawFirmInvolved: fLawFirmInvolved, caseNumber: fCaseNumber, tribunal: fTribunal,
          smallClaimsFiledAt: fSmallClaimsFiledAt, resolution: fResolution,
        }}
        setters={{
          setClientId: setFClientId, setInvoiceId: fillFromInvoice, setMandateId: setFMandateId,
          setTitle: setFTitle, setDescription: setFDescription, setStatus: setFStatus, setPriority: setFPriority,
          setType: setFType, setCategory: setFCategory, setAmountDisputed: setFAmountDisputed, setCurrency: setFCurrency,
          setStripeDisputeId: setFStripeDisputeId, setStripeReason: setFStripeReason,
          setEvidenceDueBy: setFEvidenceDueBy, setEvidenceSubmittedAt: setFEvidenceSubmittedAt,
          setOutcome: setFOutcome, setCardBrand: setFCardBrand, setAssignedTo: setFAssignedTo,
          setEstimatedResolutionDate: setFEstimatedResolutionDate, setInternalNotes: setFInternalNotes,
          setLastClientContactAt: setFLastClientContactAt, setNextActionDue: setFNextActionDue, setContactMethod: setFContactMethod,
          setLawFirmInvolved: setFLawFirmInvolved, setCaseNumber: setFCaseNumber, setTribunal: setFTribunal,
          setSmallClaimsFiledAt: setFSmallClaimsFiledAt, setResolution: setFResolution,
        }}
        onSubmit={handleCreate}
      />
      <DisputeFormDialog
        open={!!editDispute}
        onOpenChange={(o) => { if (!o) setEditDispute(null); }}
        mode="edit"
        clients={clients}
        invoices={filteredInvoices}
        mandates={filteredMandates}
        editingTitle={editDispute?.title}
        submitting={submitting}
        values={{
          clientId: fClientId, invoiceId: fInvoiceId, mandateId: fMandateId,
          title: fTitle, description: fDescription, status: fStatus, priority: fPriority,
          type: fType, category: fCategory, amountDisputed: fAmountDisputed, currency: fCurrency,
          stripeDisputeId: fStripeDisputeId, stripeReason: fStripeReason,
          evidenceDueBy: fEvidenceDueBy, evidenceSubmittedAt: fEvidenceSubmittedAt,
          outcome: fOutcome, cardBrand: fCardBrand, assignedTo: fAssignedTo,
          estimatedResolutionDate: fEstimatedResolutionDate, internalNotes: fInternalNotes,
          lastClientContactAt: fLastClientContactAt, nextActionDue: fNextActionDue, contactMethod: fContactMethod,
          lawFirmInvolved: fLawFirmInvolved, caseNumber: fCaseNumber, tribunal: fTribunal,
          smallClaimsFiledAt: fSmallClaimsFiledAt, resolution: fResolution,
        }}
        setters={{
          setClientId: () => {}, setInvoiceId: fillFromInvoice, setMandateId: setFMandateId,
          setTitle: setFTitle, setDescription: setFDescription, setStatus: setFStatus, setPriority: setFPriority,
          setType: setFType, setCategory: setFCategory, setAmountDisputed: setFAmountDisputed, setCurrency: setFCurrency,
          setStripeDisputeId: setFStripeDisputeId, setStripeReason: setFStripeReason,
          setEvidenceDueBy: setFEvidenceDueBy, setEvidenceSubmittedAt: setFEvidenceSubmittedAt,
          setOutcome: setFOutcome, setCardBrand: setFCardBrand, setAssignedTo: setFAssignedTo,
          setEstimatedResolutionDate: setFEstimatedResolutionDate, setInternalNotes: setFInternalNotes,
          setLastClientContactAt: setFLastClientContactAt, setNextActionDue: setFNextActionDue, setContactMethod: setFContactMethod,
          setLawFirmInvolved: setFLawFirmInvolved, setCaseNumber: setFCaseNumber, setTribunal: setFTribunal,
          setSmallClaimsFiledAt: setFSmallClaimsFiledAt, setResolution: setFResolution,
        }}
        onSubmit={handleEdit}
      />

      <ConfirmDialog
        open={!!deleteDispute}
        onOpenChange={(o) => { if (!o) setDeleteDispute(null); }}
        title="Supprimer ce litige ?"
        description={`Le litige "${deleteDispute?.title}" sera supprimé définitivement.`}
        confirmLabel={tc("delete")}
        onConfirm={handleDelete}
      />

      {ConfirmModal}
    </div>
  );
}

// ─── DisputeFormDialog ───────────────────────────────────
type DFormValues = {
  clientId: string; invoiceId: string; mandateId: string;
  title: string; description: string; status: string; priority: string;
  type: string; category: string; amountDisputed: string; currency: string;
  stripeDisputeId: string; stripeReason: string; evidenceDueBy: string; evidenceSubmittedAt: string;
  outcome: string; cardBrand: string; assignedTo: string; estimatedResolutionDate: string;
  internalNotes: string; lastClientContactAt: string; nextActionDue: string; contactMethod: string;
  lawFirmInvolved: string; caseNumber: string; tribunal: string; smallClaimsFiledAt: string;
  resolution: string;
};
type DFormSetters = {
  setClientId: (v: string) => void; setInvoiceId: (v: string) => void; setMandateId: (v: string) => void;
  setTitle: (v: string) => void; setDescription: (v: string) => void; setStatus: (v: string) => void; setPriority: (v: string) => void;
  setType: (v: string) => void; setCategory: (v: string) => void; setAmountDisputed: (v: string) => void; setCurrency: (v: string) => void;
  setStripeDisputeId: (v: string) => void; setStripeReason: (v: string) => void;
  setEvidenceDueBy: (v: string) => void; setEvidenceSubmittedAt: (v: string) => void;
  setOutcome: (v: string) => void; setCardBrand: (v: string) => void; setAssignedTo: (v: string) => void;
  setEstimatedResolutionDate: (v: string) => void; setInternalNotes: (v: string) => void;
  setLastClientContactAt: (v: string) => void; setNextActionDue: (v: string) => void; setContactMethod: (v: string) => void;
  setLawFirmInvolved: (v: string) => void; setCaseNumber: (v: string) => void; setTribunal: (v: string) => void;
  setSmallClaimsFiledAt: (v: string) => void; setResolution: (v: string) => void;
};

function DisputeFormDialog({
  open, onOpenChange, mode, clients, invoices, mandates, editingTitle, submitting, values, setters, onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  mode: "create" | "edit";
  clients: ClientOption[];
  invoices: InvoiceOption[];
  mandates: MandateOption[];
  editingTitle?: string;
  submitting: boolean;
  values: DFormValues;
  setters: DFormSetters;
  onSubmit: () => void | Promise<void>;
}) {
  const tc = useTranslations("common");
  const isCreate = mode === "create";
  const isChargeback = values.type === "chargeback";
  const isLegal = values.type === "legal" || !!values.tribunal || !!values.lawFirmInvolved || !!values.caseNumber;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden flex flex-col" style={{ maxHeight: "92vh" }}>
        <div className="bg-gradient-to-br from-[#0F2D52] via-[#15406d] to-[#0F2D52] px-6 py-5 text-white relative shrink-0">
          <div className="absolute top-0 right-0 w-48 h-48 bg-white/5 rounded-full -translate-y-24 translate-x-24" />
          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 backdrop-blur flex items-center justify-center shrink-0">
              {isCreate ? <Scale className="h-6 w-6 text-white" /> : <Pencil className="h-6 w-6 text-white" />}
            </div>
            <div>
              <DialogTitle className="text-white text-lg">{isCreate ? "Nouveau litige" : "Modifier le litige"}</DialogTitle>
              <DialogDescription className="text-white/70 mt-0.5">
                {isCreate ? "Capturez tous les détails utiles dès le départ" : (editingTitle || "Modification")}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 bg-muted/30">
          <FormSection title="Identification" icon={<Scale className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Client *</Label>
                <Select value={values.clientId} onValueChange={setters.setClientId} disabled={!isCreate}>
                  <SelectTrigger><SelectValue placeholder="Sélectionner" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => <SelectItem key={c.id} value={String(c.id)}>{c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Type *</Label>
                <Select value={values.type} onValueChange={setters.setType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {TYPE_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Titre *</Label>
              <Input value={values.title} onChange={(e) => setters.setTitle(e.target.value)} placeholder="Ex: Chargeback sur facture F-2026-042" />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Description *</Label>
              <Textarea value={values.description} onChange={(e) => setters.setDescription(e.target.value)} rows={3} placeholder="Nature du litige, contexte, faits..." />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Catégorie / sous-type</Label>
                <Input value={values.category} onChange={(e) => setters.setCategory(e.target.value)} placeholder="Ex: Service non conforme" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Priorité</Label>
                <Select value={values.priority} onValueChange={setters.setPriority}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          {Number(values.clientId) > 0 && (invoices.length > 0 || mandates.length > 0) && (
            <FormSection title="Liens (optionnel)" icon={<ReceiptIcon className="h-3.5 w-3.5" />}>
              {invoices.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Facture concernée</Label>
                  <Select value={values.invoiceId || "none"} onValueChange={(v) => setters.setInvoiceId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Aucune" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Aucune</SelectItem>
                      {invoices.map((i) => <SelectItem key={i.id} value={String(i.id)}>{i.invoiceNumber} — {formatCurrency(i.amountTtc)} ({i.status})</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {mandates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Mandat concerné</Label>
                  <Select value={values.mandateId || "none"} onValueChange={(v) => setters.setMandateId(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder={tc("none")} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{tc("none")}</SelectItem>
                      {mandates.map((m) => <SelectItem key={m.id} value={String(m.id)}>{m.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </FormSection>
          )}

          <FormSection title="Montant en jeu" icon={<DollarSign className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2 sm:col-span-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Montant contesté</Label>
                <Input type="number" min="0" step="0.01" value={values.amountDisputed} onChange={(e) => setters.setAmountDisputed(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Devise</Label>
                <Select value={values.currency} onValueChange={setters.setCurrency}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CAD">CAD</SelectItem>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </FormSection>

          {isChargeback && (
            <FormSection title="Détails Stripe (chargeback)" icon={<CreditCard className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Stripe Dispute ID</Label>
                  <Input value={values.stripeDisputeId} onChange={(e) => setters.setStripeDisputeId(e.target.value)} placeholder="dp_xxxxx" className="font-mono text-xs" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Raison Stripe</Label>
                  <Select value={values.stripeReason || "none"} onValueChange={(v) => setters.setStripeReason(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {STRIPE_REASONS.map((r) => <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Marque carte</Label>
                  <Select value={values.cardBrand || "none"} onValueChange={(v) => setters.setCardBrand(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      <SelectItem value="visa">Visa</SelectItem>
                      <SelectItem value="mastercard">Mastercard</SelectItem>
                      <SelectItem value="amex">Amex</SelectItem>
                      <SelectItem value="discover">Discover</SelectItem>
                      <SelectItem value="other">Autre</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Échéance preuves</Label>
                  <Input type="date" value={values.evidenceDueBy} onChange={(e) => setters.setEvidenceDueBy(e.target.value)} />
                </div>
                {!isCreate && (
                  <div className="space-y-2">
                    <Label className="text-xs uppercase tracking-wider text-muted-foreground">Preuves soumises</Label>
                    <Input type="date" value={values.evidenceSubmittedAt} onChange={(e) => setters.setEvidenceSubmittedAt(e.target.value)} />
                  </div>
                )}
              </div>
              {!isCreate && (
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Issue (outcome)</Label>
                  <Select value={values.outcome || "none"} onValueChange={(v) => setters.setOutcome(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="En attente" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">En attente</SelectItem>
                      <SelectItem value="warning_under_review">Warning - en examen</SelectItem>
                      <SelectItem value="warning_closed">Warning - fermé</SelectItem>
                      <SelectItem value="won">Gagné</SelectItem>
                      <SelectItem value="lost">Perdu</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </FormSection>
          )}

          <FormSection title="Gestion interne" icon={<Users className="h-3.5 w-3.5" />}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Assigné à (admin)</Label>
                <Input value={values.assignedTo} onChange={(e) => setters.setAssignedTo(e.target.value)} placeholder="email@vnk.ca" />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date résolution estimée</Label>
                <Input type="date" value={values.estimatedResolutionDate} onChange={(e) => setters.setEstimatedResolutionDate(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Méthode contact</Label>
                <Select value={values.contactMethod || "none"} onValueChange={(v) => setters.setContactMethod(v === "none" ? "" : v)}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">—</SelectItem>
                    {CONTACT_METHODS.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Dernier contact client</Label>
                <Input type="date" value={values.lastClientContactAt} onChange={(e) => setters.setLastClientContactAt(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Prochaine action due</Label>
                <Input type="date" value={values.nextActionDue} onChange={(e) => setters.setNextActionDue(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Notes internes (admin)</Label>
              <Textarea value={values.internalNotes} onChange={(e) => setters.setInternalNotes(e.target.value)} rows={3} placeholder="Notes privées sur le dossier…" className="bg-amber-50/30" />
            </div>
            {!isCreate && (
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">{tc("status")}</Label>
                <Select value={values.status} onValueChange={setters.setStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
          </FormSection>

          {(values.type === "legal" || isLegal) && (
            <FormSection title="Escalade juridique" icon={<Gavel className="h-3.5 w-3.5" />}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Cabinet d&apos;avocat</Label>
                  <Input value={values.lawFirmInvolved} onChange={(e) => setters.setLawFirmInvolved(e.target.value)} placeholder="Nom cabinet ou avocat" />
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Numéro de dossier</Label>
                  <Input value={values.caseNumber} onChange={(e) => setters.setCaseNumber(e.target.value)} placeholder="Ex: 700-22-088xxx-xxx" className="font-mono text-xs" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Tribunal</Label>
                  <Select value={values.tribunal || "none"} onValueChange={(v) => setters.setTribunal(v === "none" ? "" : v)}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">—</SelectItem>
                      {TRIBUNAL_OPTIONS.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Date dépôt petites créances</Label>
                  <Input type="date" value={values.smallClaimsFiledAt} onChange={(e) => setters.setSmallClaimsFiledAt(e.target.value)} />
                </div>
              </div>
            </FormSection>
          )}

          {!isCreate && (
            <FormSection title="Résolution" icon={<CheckCircle2 className="h-3.5 w-3.5" />}>
              <div className="space-y-2">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Résolution / verdict</Label>
                <Textarea value={values.resolution} onChange={(e) => setters.setResolution(e.target.value)} rows={3} placeholder="Décision finale, accord, montant remboursé…" />
              </div>
            </FormSection>
          )}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-card shrink-0 sm:gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>{tc("cancel")}</Button>
          <Button
            onClick={onSubmit}
            disabled={submitting || !values.clientId || !values.title.trim() || (isCreate && !values.description.trim())}
            className="bg-[#0F2D52] hover:bg-[#1a3a66] text-white"
          >
            {submitting ? "Enregistrement…" : (isCreate ? "Créer le litige" : "Enregistrer")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

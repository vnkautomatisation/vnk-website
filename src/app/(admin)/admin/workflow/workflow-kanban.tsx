"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { workflowEventLabel } from "@/lib/workflow-label";
import { useCurrency } from "@/lib/i18n-format";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Workflow,
  UserPlus,
  Briefcase,
  FileText,
  FileSignature,
  CreditCard,
  CheckCircle2,
  Search,
  AlertTriangle,
  MessageSquare,
  Clock,
  MoreHorizontal,
  Plus,
  PenTool,
  Send,
  Eye,
  SlidersHorizontal,
  X,
  ArrowDownUp,
  TrendingUp,
  Activity,
  Download,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { StatCard } from "@/components/admin/stat-card";
import { SignatureDialog } from "@/components/signature/signature-dialog";
import { useConfirm } from "@/hooks/use-confirm";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { cn, formatDate } from "@/lib/utils";


type ClientData = {
  id: number;
  fullName: string;
  companyName: string | null;
  unreadMessages: number;
  createdAt: string;
  mandates: Array<{ id: number; status: string; title: string; progress: number; serviceType: string | null; endDate: string | null; createdAt: string }>;
  quotes: Array<{ id: number; status: string; quoteNumber: string; title: string; amountTtc: number; expiryDate: string | null; createdAt: string }>;
  contracts: Array<{ id: number; status: string; contractNumber: string; title: string; amountTtc: number | null; createdAt: string; adminSigned: boolean; clientSigned: boolean }>;
  invoices: Array<{ id: number; status: string; invoiceNumber: string; amountTtc: number; dueDate: string | null; createdAt: string }>;
};

type EventData = {
  id: number;
  eventType: string;
  eventLabel: string | null;
  metadata?: unknown;
  triggeredBy: string;
  createdAt: string;
  clientId: number;
  mandateId: number | null;
  quoteId: number | null;
  contractId: number | null;
  invoiceId: number | null;
  clientName: string;
  clientCompany: string | null;
};

type Step = "prospect" | "mandate_active" | "quote_pending" | "contract_pending" | "invoice_unpaid" | "complete";
type SortMode = "date_desc" | "date_asc" | "name_asc" | "amount_desc";

const COLUMNS: Array<{
  id: Step;
  labelKey: string;
  icon: React.ComponentType<{ className?: string }>;
  header: string;
  stripe: string;
  iconColor: string;
}> = [
  { id: "prospect", labelKey: "nouveau_client", icon: UserPlus, header: "bg-slate-100 border-slate-300", stripe: "bg-slate-400", iconColor: "text-slate-600" },
  { id: "mandate_active", labelKey: "mandat_cours", icon: Briefcase, header: "bg-blue-100 border-blue-300", stripe: "bg-blue-500", iconColor: "text-blue-600" },
  { id: "quote_pending", labelKey: "devis_envoye", icon: FileText, header: "bg-amber-100 border-amber-300", stripe: "bg-amber-500", iconColor: "text-amber-600" },
  { id: "contract_pending", labelKey: "contrat_signer", icon: FileSignature, header: "bg-violet-100 border-violet-300", stripe: "bg-violet-500", iconColor: "text-violet-600" },
  { id: "invoice_unpaid", labelKey: "paiement_attente", icon: CreditCard, header: "bg-red-100 border-red-300", stripe: "bg-red-500", iconColor: "text-red-600" },
  { id: "complete", labelKey: "complete", icon: CheckCircle2, header: "bg-emerald-100 border-emerald-300", stripe: "bg-emerald-500", iconColor: "text-emerald-600" },
];

// Etape "principale" du client — utilisee pour CSV, filtres et tri par defaut
function getStep(c: ClientData): Step {
  if (c.mandates.length === 0) return "prospect";
  if (c.invoices.some((i) => i.status === "unpaid" || i.status === "overdue")) return "invoice_unpaid";
  if (c.contracts.some((ct) => ct.status === "pending" || ct.status === "draft")) return "contract_pending";
  if (c.quotes.some((q) => q.status === "pending")) return "quote_pending";
  if (c.mandates.length > 0 && c.invoices.length > 0 && c.invoices.every((i) => i.status === "paid")) return "complete";
  return "mandate_active";
}

// Toutes les etapes ou le client est present (un client peut etre dans plusieurs colonnes)
// Logique : un client apparait dans une colonne des qu'il a atteint cette etape, peu importe le statut
function getSteps(c: ClientData): Set<Step> {
  const steps = new Set<Step>();
  if (c.mandates.length === 0) {
    steps.add("prospect");
    return steps;
  }
  if (c.mandates.some((m) => m.status !== "completed")) steps.add("mandate_active");
  if (c.quotes.length > 0) steps.add("quote_pending");
  if (c.contracts.length > 0) steps.add("contract_pending");
  if (c.invoices.some((i) => i.status === "unpaid" || i.status === "overdue")) steps.add("invoice_unpaid");
  if (c.invoices.some((i) => i.status === "paid")) steps.add("complete");

  if (steps.size === 0) steps.add("mandate_active");
  return steps;
}

function hasAlert(c: ClientData): boolean {
  return (
    c.invoices.some((i) => i.status === "overdue") ||
    c.quotes.some((q) => q.expiryDate && new Date(q.expiryDate) < new Date()) ||
    c.mandates.some((m) => m.endDate && new Date(m.endDate) < new Date() && m.status !== "completed") ||
    c.unreadMessages > 0
  );
}

// Valeur $ d'un client selon son etape — utilisee pour forecasting
function getClientStageValue(c: ClientData, step: Step): number {
  switch (step) {
    case "prospect":
      return 0;
    case "mandate_active":

      return 0;
    case "quote_pending":
      return c.quotes.filter((q) => q.status === "pending").reduce((s, q) => s + q.amountTtc, 0);
    case "contract_pending":
      return c.contracts.filter((ct) => ct.status === "pending" || ct.status === "draft")
        .reduce((s, ct) => s + (ct.amountTtc ?? 0), 0);
    case "invoice_unpaid":
      return c.invoices.filter((i) => i.status === "unpaid" || i.status === "overdue")
        .reduce((s, i) => s + i.amountTtc, 0);
    case "complete":
      return c.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountTtc, 0);
  }
}

// Date la plus recente pour tri
function getClientLastActivity(c: ClientData): string {
  const dates = [
    c.createdAt,
    ...c.mandates.map((m) => m.createdAt),
    ...c.quotes.map((q) => q.createdAt),
    ...c.contracts.map((ct) => ct.createdAt),
    ...c.invoices.map((i) => i.createdAt),
  ];
  return dates.reduce((a, b) => (a > b ? a : b), c.createdAt);
}

const SERVICE_TYPE_KEYS: Record<string, string> = {
  "plc-support": "support_plc",
  "audit": "audit",
  "documentation": "documentation",
  "refactoring": "refactorisation",
  "modernization": "modernisation",
  "training": "formation",
};

function eventTypeIcon(type: string): React.ComponentType<{ className?: string }> {
  if (type.startsWith("client")) return UserPlus;
  if (type.startsWith("mandate")) return Briefcase;
  if (type.startsWith("quote")) return FileText;
  if (type.startsWith("contract")) return FileSignature;
  if (type.startsWith("invoice") || type.startsWith("payment")) return CreditCard;
  if (type.startsWith("message")) return MessageSquare;
  return Activity;
}

function eventTypeColor(type: string): string {
  if (type.startsWith("client")) return "text-slate-600 bg-slate-100";
  if (type.startsWith("mandate")) return "text-blue-600 bg-blue-100";
  if (type.startsWith("quote")) return "text-amber-600 bg-amber-100";
  if (type.startsWith("contract")) return "text-violet-600 bg-violet-100";
  if (type.startsWith("invoice") || type.startsWith("payment")) return "text-red-600 bg-red-100";
  if (type.startsWith("message")) return "text-sky-600 bg-sky-100";
  return "text-muted-foreground bg-muted";
}

function timeAgo(iso: string, t: (k: string) => string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return t("instant");
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}j`;
  return formatDate(d);
}

export function WorkflowKanban({ clients, events = [] }: { clients: ClientData[]; events?: EventData[] }) {
  const t = useTranslations("admin.workflow");
  const tRoot = useTranslations();
  const router = useRouter();
  const formatCurrency = useCurrency();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [searchQuery, setSearchQuery] = useState("");
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [busyClientId, setBusyClientId] = useState<number | null>(null);


  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  const [activityOpen, setActivityOpen] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<number | null>(null);
  const [draggedFromStep, setDraggedFromStep] = useState<Step | null>(null);
  const [dragOverStep, setDragOverStep] = useState<Step | null>(null);
  const [signingContract, setSigningContract] = useState<{ id: number; number: string; title: string; amount: number | null } | null>(null);


  const [filterServiceTypes, setFilterServiceTypes] = useState<Set<string>>(new Set());
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");


  const [sortMode, setSortMode] = useState<Record<Step, SortMode>>({
    prospect: "date_desc",
    mandate_active: "date_desc",
    quote_pending: "amount_desc",
    contract_pending: "amount_desc",
    invoice_unpaid: "amount_desc",
    complete: "date_desc",
  });


  const [mobileColumn, setMobileColumn] = useState<Step>("mandate_active");


  const availableServiceTypes = useMemo(() => {
    const set = new Set<string>();
    for (const c of clients) for (const m of c.mandates) if (m.serviceType) set.add(m.serviceType);
    return Array.from(set);
  }, [clients]);

  const filtered = useMemo(() => {
    let result = clients;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) => c.fullName.toLowerCase().includes(q) || c.companyName?.toLowerCase().includes(q));
    }
    if (alertsOnly) result = result.filter(hasAlert);
    if (filterServiceTypes.size > 0) {
      result = result.filter((c) => c.mandates.some((m) => m.serviceType && filterServiceTypes.has(m.serviceType)));
    }
    if (filterDateFrom) {
      const from = new Date(filterDateFrom).getTime();
      result = result.filter((c) => new Date(getClientLastActivity(c)).getTime() >= from);
    }
    if (filterDateTo) {
      const to = new Date(filterDateTo).getTime() + 86400000; // inclusive end day
      result = result.filter((c) => new Date(getClientLastActivity(c)).getTime() <= to);
    }
    if (filterAmountMin) {
      const min = Number(filterAmountMin);
      result = result.filter((c) => getClientStageValue(c, getStep(c)) >= min);
    }
    if (filterAmountMax) {
      const max = Number(filterAmountMax);
      result = result.filter((c) => getClientStageValue(c, getStep(c)) <= max);
    }
    return result;
  }, [clients, searchQuery, alertsOnly, filterServiceTypes, filterDateFrom, filterDateTo, filterAmountMin, filterAmountMax]);

  const columns = useMemo(() => {
    const grouped: Record<Step, ClientData[]> = {
      prospect: [], mandate_active: [], quote_pending: [],
      contract_pending: [], invoice_unpaid: [], complete: [],
    };

    for (const c of filtered) {
      for (const step of getSteps(c)) {
        grouped[step].push(c);
      }
    }

    for (const step of Object.keys(grouped) as Step[]) {
      const mode = sortMode[step];
      grouped[step].sort((a, b) => {
        if (mode === "name_asc") return a.fullName.localeCompare(b.fullName);
        if (mode === "date_asc") return getClientLastActivity(a).localeCompare(getClientLastActivity(b));
        if (mode === "amount_desc") return getClientStageValue(b, step) - getClientStageValue(a, step);

        return getClientLastActivity(b).localeCompare(getClientLastActivity(a));
      });
    }
    return grouped;
  }, [filtered, sortMode]);


  const alertCount = clients.filter(hasAlert).length;

  const overdueTotal = clients.flatMap((c) => c.invoices)
    .filter((i) => i.status === "unpaid" || i.status === "overdue")
    .reduce((s, i) => s + i.amountTtc, 0);

  const pipelineForecast = filtered.reduce((sum, c) => {
    let total = 0;
    for (const step of getSteps(c)) {
      if (step === "complete") continue; // deja encaisse, pas du forecast
      total += getClientStageValue(c, step);
    }
    return sum + total;
  }, 0);


  const totals = useMemo(() => {
    const result = { prospect: 0, mandate: 0, quote: 0, contract: 0, paid: 0, total: clients.length };
    for (const c of clients) {
      if (c.mandates.length > 0) result.mandate++;
      if (c.quotes.length > 0) result.quote++;
      if (c.contracts.length > 0) result.contract++;
      if (c.invoices.some((i) => i.status === "paid")) result.paid++;
    }
    result.prospect = clients.length - result.mandate;
    return result;
  }, [clients]);

  const conversion = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));


  const acceptQuote = async (clientId: number, quoteId: number, num: string) => {
    const ok = await confirm({
      title: t("accepter_devis"),
      description: t("workflow_kanban_le_devis_p0_sera_marque_comme_accepte_et", { p0: num }),
      confirmLabel: t("accepter"),
    });
    if (!ok) return;
    setBusyClientId(clientId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/accept`, { method: "POST" });
      if (res.ok) { toast.success(t("devis_accepte_contrat_genere")); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setBusyClientId(null); }
  };

  const signContract = (c: ClientData) => {
    const contract = c.contracts.find((ct) => (ct.status === "pending" || ct.status === "draft") && !ct.adminSigned);
    if (!contract) { toast.error(t("aucun_contrat_signer")); return; }
    setSigningContract({
      id: contract.id,
      number: contract.contractNumber,
      title: contract.title,
      amount: contract.amountTtc ?? null,
    });
  };

  const markInvoicePaid = async (clientId: number, invoiceId: number, num: string) => {
    const ok = await confirm({
      title: t("marquer_comme_payee"),
      description: t("workflow_kanban_la_facture_p0_sera_marquee_comme_payee", { p0: num }),
      confirmLabel: t("marquer_payee"),
    });
    if (!ok) return;
    setBusyClientId(clientId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, { method: "POST" });
      if (res.ok) { toast.success(t("facture_marquee_comme_payee")); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || t("erreur")); }
    } finally { setBusyClientId(null); }
  };

  const getCardActions = (c: ClientData, step: Step) => {
    const actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean }> = [
      { label: t("voir_client"), icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("client", c.id) },
    ];
    if (step === "prospect") {
      actions.push(
        { label: t("creer_mandat"), icon: <Plus className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/mandates?newFor=${c.id}`) },
        { label: t("envoyer_message"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) },
      );
    } else if (step === "mandate_active") {
      actions.push(
        { label: t("creer_devis"), icon: <Plus className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/quotes?newFor=${c.id}`) },
        { label: t("envoyer_message"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) },
      );
    } else if (step === "quote_pending") {
      const pendingQuote = c.quotes.find((q) => q.status === "pending");
      if (pendingQuote) {
        actions.push({ label: t("marquer_accepte"), icon: <CheckCircle2 className="h-3.5 w-3.5" />, onClick: () => acceptQuote(c.id, pendingQuote.id, pendingQuote.quoteNumber) });
      }
      actions.push({ label: t("relancer_client"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
    } else if (step === "contract_pending") {
      const pendingContract = c.contracts.find((ct) => (ct.status === "pending" || ct.status === "draft") && !ct.adminSigned);
      if (pendingContract) {
        actions.push({ label: t("signer_admin"), icon: <PenTool className="h-3.5 w-3.5" />, onClick: () => signContract(c) });
      }
      actions.push({ label: t("relancer_client"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
    } else if (step === "invoice_unpaid") {
      const unpaid = c.invoices.find((i) => i.status === "unpaid" || i.status === "overdue");
      if (unpaid) {
        actions.push({ label: t("marquer_payee"), icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => markInvoicePaid(c.id, unpaid.id, unpaid.invoiceNumber) });
      }
      actions.push({ label: t("envoyer_relance"), icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
    }
    return actions;
  };

  const totalActiveFilters =
    (filterServiceTypes.size > 0 ? 1 : 0) +
    (filterDateFrom ? 1 : 0) + (filterDateTo ? 1 : 0) +
    (filterAmountMin ? 1 : 0) + (filterAmountMax ? 1 : 0);

  const clearFilters = () => {
    setFilterServiceTypes(new Set());
    setFilterDateFrom("");
    setFilterDateTo("");
    setFilterAmountMin("");
    setFilterAmountMax("");
  };


  const handleDrop = async (targetStep: Step) => {
    setDragOverStep(null);
    if (draggedClientId === null || draggedFromStep === null) return;
    const c = clients.find((x) => x.id === draggedClientId);
    const fromStep = draggedFromStep;
    setDraggedClientId(null);
    setDraggedFromStep(null);
    if (!c) return;
    if (fromStep === targetStep) return;


    if (fromStep === "prospect" && targetStep === "mandate_active") {
      const ok = await confirm({
        title: t("creer_mandat_2"),
        description: t("workflow_kanban_vous_allez_ouvrir_la_creation_d_un_nouveau", { p0: c.fullName }),
        confirmLabel: t("continuer"),
      });
      if (!ok) return;
      router.push(`/admin/mandates?newFor=${c.id}`);
      return;
    }

    if (fromStep === "mandate_active" && targetStep === "quote_pending") {
      const ok = await confirm({
        title: t("creer_devis_2"),
        description: t("workflow_kanban_vous_allez_ouvrir_la_creation_d_un_nouveau_x", { p0: c.fullName }),
        confirmLabel: t("continuer"),
      });
      if (!ok) return;
      router.push(`/admin/quotes?newFor=${c.id}`);
      return;
    }

    if (fromStep === "quote_pending" && targetStep === "contract_pending") {
      const quote = c.quotes.find((q) => q.status === "pending");
      if (!quote) { toast.error(t("aucun_devis_attente")); return; }
      const ok = await confirm({
        title: t("accepter_devis_2"),
        description: t("workflow_kanban_le_devis_p0_sera_accepte_passage_devis_contrat", { p0: quote.quoteNumber }),
        confirmLabel: t("accepter"),
      });
      if (!ok) return;
      setBusyClientId(c.id);
      try {
        const res = await fetch(`/api/quotes/${quote.id}/accept`, { method: "POST" });
        if (res.ok) { toast.success(t("devis_accepte")); router.refresh(); }
        else { const d = await res.json(); toast.error(d.error || t("erreur")); }
      } finally { setBusyClientId(null); }
      return;
    }

    if (fromStep === "contract_pending" && targetStep === "invoice_unpaid") {
      const contract = c.contracts.find((ct) => (ct.status === "pending" || ct.status === "draft") && !ct.adminSigned);
      if (!contract) { toast.error(t("aucun_contrat_signer")); return; }
      setSigningContract({
        id: contract.id,
        number: contract.contractNumber,
        title: contract.title,
        amount: contract.amountTtc ?? null,
      });
      return;
    }

    if (fromStep === "invoice_unpaid" && targetStep === "complete") {
      const unpaid = c.invoices.find((i) => i.status === "unpaid" || i.status === "overdue");
      if (!unpaid) { toast.error(t("aucune_facture_impayee")); return; }
      const ok = await confirm({
        title: t("marquer_payee_2"),
        description: t("workflow_kanban_la_facture_p0_sera_marquee_comme_payee_passage", { p0: unpaid.invoiceNumber }),
        confirmLabel: t("marquer_payee"),
      });
      if (!ok) return;
      setBusyClientId(c.id);
      try {
        const res = await fetch(`/api/invoices/${unpaid.id}/mark-paid`, { method: "POST" });
        if (res.ok) { toast.success(t("facture_marquee_payee")); router.refresh(); }
        else { const d = await res.json(); toast.error(d.error || t("erreur")); }
      } finally { setBusyClientId(null); }
      return;
    }

    toast.info(t("transition_non_supportee_utilisez_menu"));
  };


  const isValidDropTarget = (clientId: number | null, fromStep: Step | null, targetStep: Step): boolean => {
    if (clientId === null || fromStep === null) return false;
    if (fromStep === targetStep) return false;
    return (
      (fromStep === "prospect" && targetStep === "mandate_active") ||
      (fromStep === "mandate_active" && targetStep === "quote_pending") ||
      (fromStep === "quote_pending" && targetStep === "contract_pending") ||
      (fromStep === "contract_pending" && targetStep === "invoice_unpaid") ||
      (fromStep === "invoice_unpaid" && targetStep === "complete")
    );
  };


  const exportCsv = () => {
    const stepLabels: Record<Step, string> = {
      prospect: t("nouveau_client"),
      mandate_active: t("mandat_cours"),
      quote_pending: t("devis_envoye"),
      contract_pending: t("contrat_signer"),
      invoice_unpaid: t("paiement_attente"),
      complete: t("complete"),
    };
    const headers = [t("client_2"), t("entreprise"), t("etape"), t("montant_pipeline_cad"), t("mandats"), t("devis"), t("contrats"), t("factures"), t("impaye_cad"), t("alerte"), t("messages_non_lus"), t("derniere_activite")];
    const rows = filtered.map((c) => {
      const step = getStep(c);
      const unpaid = c.invoices.filter((i) => i.status === "unpaid" || i.status === "overdue").reduce((s, i) => s + i.amountTtc, 0);
      return [
        c.fullName,
        c.companyName ?? "",
        stepLabels[step],
        getClientStageValue(c, step).toFixed(2),
        String(c.mandates.length),
        String(c.quotes.length),
        String(c.contracts.length),
        String(c.invoices.length),
        unpaid.toFixed(2),
        hasAlert(c) ? t("oui") : t("non"),
        String(c.unreadMessages),
        new Date(getClientLastActivity(c)).toISOString().slice(0, 10),
      ];
    });
    const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((row) => row.map(escape).join(",")).join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pipeline-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success(`Export CSV: ${filtered.length} clients`);
  };

  return (
    <div className="space-y-6">

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2 sm:gap-3">
            <Workflow className="h-5 w-5 sm:h-6 sm:w-6" />
            {t("pipeline_workflow")}
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("cycle_vie_complet_chaque_client")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportCsv} title={t("exporter_csv")}>
            <Download className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{t("export_csv")}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
            <Activity className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">{t("activite")}</span>
            {events.length > 0 && <Badge variant="secondary" className="ml-1.5">{events.length}</Badge>}
          </Button>
        </div>
      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label={t("total_clients")} value={clients.length} icon={UserPlus} accent="bg-blue-500" />
        <StatCard
          label={t("forecast_pipeline")}
          value={formatCurrency(pipelineForecast)}
          icon={TrendingUp}
          accent="bg-violet-500"
          deltaLabel={filtered.length < clients.length ? `Filtre: ${filtered.length}/${clients.length}` : undefined}
        />
        <StatCard label={t("alertes")} value={alertCount} icon={AlertTriangle} accent="bg-red-500" />
        <StatCard label={t("impaye_total")} value={formatCurrency(overdueTotal)} icon={CreditCard} accent="bg-amber-500" />
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px" />
      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b animate-overlay-fade-in">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <Activity className="h-4 w-4" />
              {t("workflow")}
            </span>
            <span className="font-semibold">{filtered.length}/{clients.length} clients</span>
            <span className="text-muted-foreground">{t("pipeline")} <span className="font-semibold text-violet-600">{formatCurrency(pipelineForecast)}</span></span>
            {alertCount > 0 && <span className="text-muted-foreground">{t("alertes")} <span className="font-semibold text-red-600">{alertCount}</span></span>}
            <span className="ml-auto text-muted-foreground">{t("impaye")} <span className="font-semibold text-amber-600">{formatCurrency(overdueTotal)}</span></span>
          </div>
        </div>
      )}


      <div className="rounded-lg border bg-card p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">{t("taux_conversion")}</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ConversionStat label={t("prospect_mandat")} pct={conversion(totals.mandate, totals.total)} hint={`${totals.mandate}/${totals.total}`} />
          <ConversionStat label={t("mandat_devis")} pct={conversion(totals.quote, totals.mandate)} hint={`${totals.quote}/${totals.mandate}`} />
          <ConversionStat label={t("devis_contrat")} pct={conversion(totals.contract, totals.quote)} hint={`${totals.contract}/${totals.quote}`} />
          <ConversionStat label={t("contrat_paye")} pct={conversion(totals.paid, totals.contract)} hint={`${totals.paid}/${totals.contract}`} />
        </div>
      </div>


      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder={t("rechercher_client")} className="pl-9" />
        </div>
        <Button variant={alertsOnly ? "default" : "outline"} size="sm" onClick={() => setAlertsOnly(!alertsOnly)} className="gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">{t("alertes")}</span>
          {alertCount > 0 && (
            <Badge variant={alertsOnly ? "secondary" : "destructive"} className="text-[9px] h-4 min-w-4 px-1">{alertCount}</Badge>
          )}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{t("filtres")}</span>
              {totalActiveFilters > 0 && <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{totalActiveFilters}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-3 space-y-3" align="end">

            {availableServiceTypes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("type_service")}</p>
                <div className="flex flex-wrap gap-1">
                  {availableServiceTypes.map((s) => {
                    const isOn = filterServiceTypes.has(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          const set = new Set(filterServiceTypes);
                          if (isOn) set.delete(s); else set.add(s);
                          setFilterServiceTypes(set);
                        }}
                        className={cn(
                          "px-2 py-0.5 rounded-full border text-[10px] transition-colors",
                          isOn ? "border-[#0F2D52] bg-[#0F2D52] text-white" : "border-input hover:bg-muted"
                        )}
                      >
                        {SERVICE_TYPE_KEYS[s] ?? s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("periode_derniere_activite")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-xs" />
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{t("montant_pipeline")}</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder={t("min")} value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} className="h-8 text-xs" />
                <Input type="number" placeholder={t("max")} value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            {totalActiveFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs">
                <X className="h-3 w-3 mr-1" />{t("workflow_kanban_effacer_les_filtres")}</Button>
            )}
          </PopoverContent>
        </Popover>

        {totalActiveFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground hidden sm:flex">
            <X className="h-3 w-3 mr-1" />Effacer
          </Button>
        )}
      </div>


      <div className="lg:hidden">
        <Select value={mobileColumn} onValueChange={(v) => setMobileColumn(v as Step)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {COLUMNS.map((col) => (
              <SelectItem key={col.id} value={col.id}>
                <span className="flex items-center gap-2">
                  <span className={cn("h-2 w-2 rounded-full", col.stripe)} />
                  {t(col.labelKey)} ({columns[col.id].length})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>


      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const ColIcon = col.icon;
          const items = columns[col.id];
          const colTotal = items.reduce((s, c) => s + getClientStageValue(c, col.id), 0);
          const isVisible = col.id === mobileColumn; // affiche sur mobile

          const isDropTarget = isValidDropTarget(draggedClientId, draggedFromStep, col.id);
          const isOver = dragOverStep === col.id && isDropTarget;

          return (
            <div
              key={col.id}
              className={cn(
                "space-y-2 rounded-lg transition-all",
                !isVisible && "hidden lg:block",
                isDropTarget && "ring-2 ring-primary/30 ring-offset-2",
                isOver && "ring-2 ring-primary bg-primary/5"
              )}
              onDragOver={(e) => {
                if (!isDropTarget) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                if (dragOverStep !== col.id) setDragOverStep(col.id);
              }}
              onDragLeave={(e) => {

                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverStep === col.id) setDragOverStep(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col.id);
              }}
            >

              <div className={cn("rounded-lg border p-3 space-y-2", col.header)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ColIcon className={cn("h-3.5 w-3.5 shrink-0", col.iconColor)} />
                    <span className="text-xs font-semibold truncate">{t(col.labelKey)}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary" className="text-[10px] bg-white">{items.length}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-5 w-5 rounded hover:bg-white/50 flex items-center justify-center" aria-label={t("trier_2")}>
                          <ArrowDownUp className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs">{t("trier")}</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={sortMode[col.id]}
                          onValueChange={(v) => setSortMode({ ...sortMode, [col.id]: v as SortMode })}
                        >
                          <DropdownMenuRadioItem value="date_desc" className="text-xs">{t("plus_recent")}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="date_asc" className="text-xs">{t("plus_ancien")}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="amount_desc" className="text-xs">{t("montant_decroissant")}</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="name_asc" className="text-xs">{t("nom_z")}</DropdownMenuRadioItem>
                        </DropdownMenuRadioGroup>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
                {colTotal > 0 && (
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {formatCurrency(colTotal)} <span className="text-[9px]">total</span>
                  </p>
                )}
              </div>


              <div className="space-y-2 min-h-[80px]">
                {items.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed py-8 px-3 text-center">
                    <ColIcon className={cn("h-5 w-5 mx-auto opacity-30", col.iconColor)} />
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">{t("aucun_client")}</p>
                  </div>
                ) : (
                  items.map((c) => {
                    const unpaid = c.invoices
                      .filter((i) => i.status === "unpaid" || i.status === "overdue")
                      .reduce((sum, i) => sum + i.amountTtc, 0);
                    const isOverdue = c.invoices.some((i) => i.status === "overdue");
                    const latestMandate = c.mandates[0];
                    const alert = hasAlert(c);
                    const actions = getCardActions(c, col.id);
                    const busy = busyClientId === c.id;

                    const clientTab: "info" | "mandates" | "quotes" | "invoices" | "contracts" =
                      col.id === "mandate_active" ? "mandates" :
                      col.id === "quote_pending" ? "quotes" :
                      col.id === "contract_pending" ? "contracts" :
                      col.id === "invoice_unpaid" || col.id === "complete" ? "invoices" :
                      "info";
                    const openPanel = () => openEntity("client", c.id, { clientTab });

                    const isDragged = draggedClientId === c.id && draggedFromStep === col.id;
                    return (
                      <Card
                        key={`${c.id}-${col.id}`}
                        draggable={!busy}
                        onDragStart={(e) => {
                          setDraggedClientId(c.id);
                          setDraggedFromStep(col.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggedClientId(null);
                          setDraggedFromStep(null);
                          setDragOverStep(null);
                        }}
                        className={cn(
                          "vnk-card-hover transition-shadow overflow-hidden cursor-grab active:cursor-grabbing",
                          isOverdue && "border-red-400 ring-1 ring-red-200",
                          alert && !isOverdue && "border-amber-300",
                          busy && "opacity-60 pointer-events-none",
                          isDragged && "opacity-0 pointer-events-none"
                        )}
                      >
                        <div className={cn("h-1 w-full", col.stripe)} />
                        <CardContent className="p-3">
                          <div className="flex items-start justify-between gap-1">
                            <button
                              type="button"
                              className="min-w-0 flex-1 text-left bg-transparent border-0 p-0 m-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-sm"
                              onClick={openPanel}
                            >
                              <div className="font-semibold text-sm truncate">{c.fullName}</div>
                              {c.companyName && (
                                <div className="text-[10px] text-muted-foreground truncate">{c.companyName}</div>
                              )}
                            </button>
                            <div className="flex items-center gap-1 shrink-0">
                              {c.unreadMessages > 0 && <MessageSquare className="h-3 w-3 text-blue-500" />}
                              {isOverdue && <AlertTriangle className="h-3 w-3 text-red-500" />}
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <button
                                    type="button"
                                    className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors"
                                  >
                                    <MoreHorizontal className="h-3.5 w-3.5 text-muted-foreground" />
                                  </button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-48">
                                  {actions.map((action, i) => (
                                    <div key={i}>
                                      {i === 1 && <DropdownMenuSeparator />}
                                      <DropdownMenuItem onSelect={() => action.onClick()}>
                                        <span className="mr-2">{action.icon}</span>
                                        {action.label}
                                      </DropdownMenuItem>
                                    </div>
                                  ))}
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          <button
                            type="button"
                            className="w-full text-left bg-transparent border-0 p-0 m-0 cursor-pointer focus-visible:outline-none rounded-sm"
                            onClick={openPanel}
                          >
                            {latestMandate && col.id === "mandate_active" && (
                              <div className="mt-2">
                                <div className="text-[10px] text-muted-foreground truncate">{latestMandate.title}</div>
                                <div className="flex items-center gap-2 mt-1">
                                  <div className="h-1 flex-1 rounded-full bg-muted overflow-hidden">
                                    <div className="h-full bg-primary" style={{ width: `${latestMandate.progress}%` }} />
                                  </div>
                                  <span className="text-[10px] text-muted-foreground">{latestMandate.progress}%</span>
                                </div>
                              </div>
                            )}

                            {c.quotes.length > 0 && col.id === "quote_pending" && (() => {
                              const totalQuotes = c.quotes.reduce((s, q) => s + q.amountTtc, 0);
                              return (
                                <div className="mt-2 text-[10px] flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground truncate">
                                    {c.quotes.length === 1 ? c.quotes[0].quoteNumber : `${c.quotes.length} devis`}
                                  </span>
                                  <span className="font-semibold shrink-0">{formatCurrency(totalQuotes)}</span>
                                </div>
                              );
                            })()}

                            {c.contracts.length > 0 && col.id === "contract_pending" && (() => {
                              const totalContracts = c.contracts.reduce((s, ct) => s + (ct.amountTtc ?? 0), 0);
                              return (
                                <div className="mt-2 text-[10px] flex items-center justify-between gap-2">
                                  <span className="text-muted-foreground truncate">
                                    {c.contracts.length === 1 ? c.contracts[0].contractNumber : `${c.contracts.length} contrats`}
                                  </span>
                                  {totalContracts > 0 && (
                                    <span className="font-semibold shrink-0">{formatCurrency(totalContracts)}</span>
                                  )}
                                </div>
                              );
                            })()}

                            {unpaid > 0 && col.id === "invoice_unpaid" && (
                              <div className="mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3 text-red-500" />
                                <span className={cn("text-xs font-semibold", isOverdue ? "text-red-600" : "text-amber-600")}>
                                  {formatCurrency(unpaid)}
                                </span>
                              </div>
                            )}

                            {col.id === "complete" && c.invoices.some((i) => i.status === "paid") && (
                              <div className="mt-2 text-[10px] text-emerald-600 font-medium">
                                {formatCurrency(c.invoices.filter((i) => i.status === "paid").reduce((s, i) => s + i.amountTtc, 0))} encaissé
                              </div>
                            )}
                          </button>
                        </CardContent>
                      </Card>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>


      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />{t("workflow_kanban_activite_recente")}</SheetTitle>
            <SheetDescription>
              Les {events.length} derniers événements du pipeline workflow.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">{t("aucun_evenement")}</p>
            ) : events.map((e) => {
              const Icon = eventTypeIcon(e.eventType);
              const colorCls = eventTypeColor(e.eventType);

              const handleClick = () => {
                setActivityOpen(false);
                if (e.eventType.startsWith(t("message"))) {
                  router.push(`/admin/messages?clientId=${e.clientId}`);
                  return;
                }
                if (e.eventType.startsWith(t("appointment"))) {
                  router.push("/admin/calendar");
                  return;
                }
                if (e.invoiceId) openEntity("invoice", e.invoiceId);
                else if (e.contractId) openEntity("contract", e.contractId);
                else if (e.quoteId) openEntity("quote", e.quoteId);
                else if (e.mandateId) openEntity("mandate", e.mandateId);
                else openEntity("client", e.clientId);
              };
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={handleClick}
                  className="w-full p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow flex items-start gap-3 text-left"
                >
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", colorCls)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium line-clamp-2">{workflowEventLabel(tRoot, e)}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {e.clientName}{e.clientCompany ? ` · ${e.clientCompany}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(e.createdAt, t)} · {e.triggeredBy}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {ConfirmModal}

      {signingContract && (
        <SignatureDialog
          contractId={signingContract.id}
          contractNumber={signingContract.number}
          contractTitle={signingContract.title}
          contractAmount={signingContract.amount ?? undefined}
          open={true}
          onOpenChange={(o) => { if (!o) setSigningContract(null); }}
        />
      )}
    </div>
  );
}

function ConversionStat({ label, pct, hint }: { label: string; pct: number; hint?: string }) {
  const color = pct >= 70 ? "text-emerald-600" : pct >= 40 ? "text-amber-600" : "text-red-600";
  const bgColor = pct >= 70 ? "bg-emerald-500" : pct >= 40 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[10px] text-muted-foreground truncate">{label}</span>
        {hint && <span className="text-[9px] text-muted-foreground/60 font-mono shrink-0">{hint}</span>}
      </div>
      <div className="flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
          <div className={cn("h-full transition-all", bgColor)} style={{ width: `${pct}%` }} />
        </div>
        <span className={cn("text-xs font-bold tabular-nums", color)}>{pct}%</span>
      </div>
    </div>
  );
}

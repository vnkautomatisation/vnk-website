"use client";
import { useState, useMemo } from "react";
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { StatCard } from "@/components/admin/stat-card";
import { useConfirm } from "@/hooks/use-confirm";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type ClientData = {
  id: number;
  fullName: string;
  companyName: string | null;
  unreadMessages: number;
  createdAt: string;
  mandates: Array<{ id: number; status: string; title: string; progress: number; serviceType: string | null; endDate: string | null; createdAt: string }>;
  quotes: Array<{ id: number; status: string; quoteNumber: string; title: string; amountTtc: number; expiryDate: string | null; createdAt: string }>;
  contracts: Array<{ id: number; status: string; contractNumber: string; title: string; amountTtc: number | null; createdAt: string }>;
  invoices: Array<{ id: number; status: string; invoiceNumber: string; amountTtc: number; dueDate: string | null; createdAt: string }>;
};

type EventData = {
  id: number;
  eventType: string;
  eventLabel: string | null;
  triggeredBy: string;
  createdAt: string;
  clientId: number;
  clientName: string;
  clientCompany: string | null;
};

type Step = "prospect" | "mandate_active" | "quote_pending" | "contract_pending" | "invoice_unpaid" | "complete";
type SortMode = "date_desc" | "date_asc" | "name_asc" | "amount_desc";

const COLUMNS: Array<{
  id: Step;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  header: string;
  stripe: string;
  iconColor: string;
}> = [
  { id: "prospect", label: "Nouveau client", icon: UserPlus, header: "bg-slate-100 border-slate-300", stripe: "bg-slate-400", iconColor: "text-slate-600" },
  { id: "mandate_active", label: "Mandat en cours", icon: Briefcase, header: "bg-blue-100 border-blue-300", stripe: "bg-blue-500", iconColor: "text-blue-600" },
  { id: "quote_pending", label: "Devis envoye", icon: FileText, header: "bg-amber-100 border-amber-300", stripe: "bg-amber-500", iconColor: "text-amber-600" },
  { id: "contract_pending", label: "Contrat a signer", icon: FileSignature, header: "bg-violet-100 border-violet-300", stripe: "bg-violet-500", iconColor: "text-violet-600" },
  { id: "invoice_unpaid", label: "Paiement en attente", icon: CreditCard, header: "bg-red-100 border-red-300", stripe: "bg-red-500", iconColor: "text-red-600" },
  { id: "complete", label: "Complete", icon: CheckCircle2, header: "bg-emerald-100 border-emerald-300", stripe: "bg-emerald-500", iconColor: "text-emerald-600" },
];

function getStep(c: ClientData): Step {
  if (c.mandates.length === 0) return "prospect";
  if (c.invoices.some((i) => i.status === "unpaid" || i.status === "overdue")) return "invoice_unpaid";
  if (c.contracts.some((ct) => ct.status === "pending" || ct.status === "draft")) return "contract_pending";
  if (c.quotes.some((q) => q.status === "pending")) return "quote_pending";
  if (c.mandates.length > 0 && c.invoices.length > 0 && c.invoices.every((i) => i.status === "paid")) return "complete";
  return "mandate_active";
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
      return c.quotes.filter((q) => q.status === "pending").reduce((s, q) => s + q.amountTtc, 0);
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

const SERVICE_TYPE_LABELS: Record<string, string> = {
  "plc-support": "Support PLC",
  "audit": "Audit",
  "documentation": "Documentation",
  "refactoring": "Refactorisation",
  "modernization": "Modernisation",
  "training": "Formation",
};

function eventTypeIcon(type: string): React.ComponentType<{ className?: string }> {
  if (type.startsWith("client_")) return UserPlus;
  if (type.startsWith("mandate_")) return Briefcase;
  if (type.startsWith("quote_")) return FileText;
  if (type.startsWith("contract_")) return FileSignature;
  if (type.startsWith("invoice_") || type.startsWith("payment_")) return CreditCard;
  if (type.startsWith("message_")) return MessageSquare;
  return Activity;
}

function eventTypeColor(type: string): string {
  if (type.startsWith("client_")) return "text-slate-600 bg-slate-100";
  if (type.startsWith("mandate_")) return "text-blue-600 bg-blue-100";
  if (type.startsWith("quote_")) return "text-amber-600 bg-amber-100";
  if (type.startsWith("contract_")) return "text-violet-600 bg-violet-100";
  if (type.startsWith("invoice_") || type.startsWith("payment_")) return "text-red-600 bg-red-100";
  if (type.startsWith("message_")) return "text-sky-600 bg-sky-100";
  return "text-muted-foreground bg-muted";
}

function timeAgo(iso: string): string {
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return "A l'instant";
  if (min < 60) return `${min}min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h`;
  const days = Math.floor(h / 24);
  if (days < 7) return `${days}j`;
  return formatDate(d);
}

export function WorkflowKanban({ clients, events = [] }: { clients: ClientData[]; events?: EventData[] }) {
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const { open: openEntity } = useEntityPanels();
  const [searchQuery, setSearchQuery] = useState("");
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [busyClientId, setBusyClientId] = useState<number | null>(null);
  const [activityOpen, setActivityOpen] = useState(false);
  const [draggedClientId, setDraggedClientId] = useState<number | null>(null);
  const [dragOverStep, setDragOverStep] = useState<Step | null>(null);

  // Filtres avances
  const [filterServiceTypes, setFilterServiceTypes] = useState<Set<string>>(new Set());
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [filterAmountMin, setFilterAmountMin] = useState("");
  const [filterAmountMax, setFilterAmountMax] = useState("");

  // Tri par colonne
  const [sortMode, setSortMode] = useState<Record<Step, SortMode>>({
    prospect: "date_desc",
    mandate_active: "date_desc",
    quote_pending: "amount_desc",
    contract_pending: "amount_desc",
    invoice_unpaid: "amount_desc",
    complete: "date_desc",
  });

  // Mobile: colonne active
  const [mobileColumn, setMobileColumn] = useState<Step>("mandate_active");

  // Service types distincts
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
    for (const c of filtered) grouped[getStep(c)].push(c);
    // Tri per colonne
    for (const step of Object.keys(grouped) as Step[]) {
      const mode = sortMode[step];
      grouped[step].sort((a, b) => {
        if (mode === "name_asc") return a.fullName.localeCompare(b.fullName);
        if (mode === "date_asc") return getClientLastActivity(a).localeCompare(getClientLastActivity(b));
        if (mode === "amount_desc") return getClientStageValue(b, step) - getClientStageValue(a, step);
        // date_desc (default)
        return getClientLastActivity(b).localeCompare(getClientLastActivity(a));
      });
    }
    return grouped;
  }, [filtered, sortMode]);

  // KPIs
  const alertCount = clients.filter(hasAlert).length;
  const overdueTotal = clients.flatMap((c) => c.invoices)
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.amountTtc, 0);
  const pipelineForecast = filtered.reduce((s, c) => s + getClientStageValue(c, getStep(c)), 0);

  // Stats conversion
  const totals = useMemo(() => {
    const result = { prospect: 0, mandate: 0, quote: 0, contract: 0, paying: 0, complete: 0, total: clients.length };
    for (const c of clients) {
      if (c.mandates.length > 0) result.mandate++;
      if (c.quotes.length > 0) result.quote++;
      if (c.contracts.length > 0) result.contract++;
      if (c.invoices.length > 0) result.paying++;
      if (c.invoices.length > 0 && c.invoices.every((i) => i.status === "paid")) result.complete++;
    }
    result.prospect = clients.length - result.mandate;
    return result;
  }, [clients]);

  const conversion = (a: number, b: number) => (b === 0 ? 0 : Math.round((a / b) * 100));

  // Actions API
  const acceptQuote = async (clientId: number, quoteId: number, num: string) => {
    const ok = await confirm({
      title: "Accepter ce devis ?",
      description: `Le devis ${num} sera marque comme accepte et un contrat sera genere automatiquement.`,
      confirmLabel: "Accepter",
    });
    if (!ok) return;
    setBusyClientId(clientId);
    try {
      const res = await fetch(`/api/quotes/${quoteId}/accept`, { method: "POST" });
      if (res.ok) { toast.success("Devis accepte, contrat genere"); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusyClientId(null); }
  };

  const signContract = async (clientId: number, contractId: number) => {
    const ok = await confirm({
      title: "Signer ce contrat ?",
      description: "Vous allez apposer votre signature en tant qu'administrateur.",
      confirmLabel: "Signer",
    });
    if (!ok) return;
    setBusyClientId(clientId);
    try {
      const res = await fetch(`/api/contracts/${contractId}/sign`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureData: "admin-signed-via-pipeline" }),
      });
      if (res.ok) { toast.success("Contrat signe"); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusyClientId(null); }
  };

  const markInvoicePaid = async (clientId: number, invoiceId: number, num: string) => {
    const ok = await confirm({
      title: "Marquer comme payee ?",
      description: `La facture ${num} sera marquee comme payee.`,
      confirmLabel: "Marquer payee",
    });
    if (!ok) return;
    setBusyClientId(clientId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, { method: "POST" });
      if (res.ok) { toast.success("Facture marquee comme payee"); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusyClientId(null); }
  };

  const getCardActions = (c: ClientData, step: Step) => {
    const actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean }> = [
      { label: "Voir le client", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => openEntity("client", c.id) },
    ];
    if (step === "prospect") {
      actions.push(
        { label: "Creer un mandat", icon: <Plus className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/mandates?newFor=${c.id}`) },
        { label: "Envoyer un message", icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) },
      );
    } else if (step === "mandate_active") {
      actions.push(
        { label: "Creer un devis", icon: <Plus className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/quotes?newFor=${c.id}`) },
        { label: "Envoyer un message", icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) },
      );
    } else if (step === "quote_pending") {
      const pendingQuote = c.quotes.find((q) => q.status === "pending");
      if (pendingQuote) {
        actions.push({ label: "Marquer accepte", icon: <CheckCircle2 className="h-3.5 w-3.5" />, onClick: () => acceptQuote(c.id, pendingQuote.id, pendingQuote.quoteNumber) });
      }
      actions.push({ label: "Relancer client", icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
    } else if (step === "contract_pending") {
      const pendingContract = c.contracts.find((ct) => ct.status === "pending" || ct.status === "draft");
      if (pendingContract) {
        actions.push({ label: "Signer admin", icon: <PenTool className="h-3.5 w-3.5" />, onClick: () => signContract(c.id, pendingContract.id) });
      }
      actions.push({ label: "Relancer client", icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
    } else if (step === "invoice_unpaid") {
      const unpaid = c.invoices.find((i) => i.status === "unpaid" || i.status === "overdue");
      if (unpaid) {
        actions.push({ label: "Marquer payee", icon: <CreditCard className="h-3.5 w-3.5" />, onClick: () => markInvoicePaid(c.id, unpaid.id, unpaid.invoiceNumber) });
      }
      actions.push({ label: "Envoyer relance", icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
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

  // Drag-drop entre colonnes — declenche la transition d'etat
  const handleDrop = async (targetStep: Step) => {
    setDragOverStep(null);
    if (draggedClientId === null) return;
    const c = clients.find((x) => x.id === draggedClientId);
    setDraggedClientId(null);
    if (!c) return;
    const fromStep = getStep(c);
    if (fromStep === targetStep) return;

    // Transitions supportees
    if (fromStep === "quote_pending" && targetStep === "contract_pending") {
      const quote = c.quotes.find((q) => q.status === "pending");
      if (!quote) { toast.error("Aucun devis en attente"); return; }
      const ok = await confirm({
        title: "Accepter le devis ?",
        description: `Le devis ${quote.quoteNumber} sera accepte (passage Devis → Contrat).`,
        confirmLabel: "Accepter",
      });
      if (!ok) return;
      setBusyClientId(c.id);
      try {
        const res = await fetch(`/api/quotes/${quote.id}/accept`, { method: "POST" });
        if (res.ok) { toast.success("Devis accepte"); router.refresh(); }
        else { const d = await res.json(); toast.error(d.error || "Erreur"); }
      } finally { setBusyClientId(null); }
      return;
    }

    if (fromStep === "contract_pending" && targetStep === "invoice_unpaid") {
      const contract = c.contracts.find((ct) => ct.status === "pending" || ct.status === "draft");
      if (!contract) { toast.error("Aucun contrat en attente"); return; }
      const ok = await confirm({
        title: "Signer le contrat ?",
        description: `Vous allez signer en admin le contrat ${contract.contractNumber} (passage Contrat → Paiement).`,
        confirmLabel: "Signer",
      });
      if (!ok) return;
      setBusyClientId(c.id);
      try {
        const res = await fetch(`/api/contracts/${contract.id}/sign`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ signatureData: "admin-signed-via-pipeline-dnd" }),
        });
        if (res.ok) { toast.success("Contrat signe"); router.refresh(); }
        else { const d = await res.json(); toast.error(d.error || "Erreur"); }
      } finally { setBusyClientId(null); }
      return;
    }

    if (fromStep === "invoice_unpaid" && targetStep === "complete") {
      const unpaid = c.invoices.find((i) => i.status === "unpaid" || i.status === "overdue");
      if (!unpaid) { toast.error("Aucune facture impayee"); return; }
      const ok = await confirm({
        title: "Marquer payee ?",
        description: `La facture ${unpaid.invoiceNumber} sera marquee comme payee (passage Paiement → Complete).`,
        confirmLabel: "Marquer payee",
      });
      if (!ok) return;
      setBusyClientId(c.id);
      try {
        const res = await fetch(`/api/invoices/${unpaid.id}/mark-paid`, { method: "POST" });
        if (res.ok) { toast.success("Facture marquee payee"); router.refresh(); }
        else { const d = await res.json(); toast.error(d.error || "Erreur"); }
      } finally { setBusyClientId(null); }
      return;
    }

    toast.info("Transition non supportee — utilisez le menu actions de la carte");
  };

  // Step suivant qui est une transition valide depuis le step actuel (highlight visuel)
  const isValidDropTarget = (clientId: number | null, targetStep: Step): boolean => {
    if (clientId === null) return false;
    const c = clients.find((x) => x.id === clientId);
    if (!c) return false;
    const fromStep = getStep(c);
    if (fromStep === targetStep) return false;
    return (
      (fromStep === "quote_pending" && targetStep === "contract_pending") ||
      (fromStep === "contract_pending" && targetStep === "invoice_unpaid") ||
      (fromStep === "invoice_unpaid" && targetStep === "complete")
    );
  };

  // Export CSV des clients filtres avec leur etape pipeline
  const exportCsv = () => {
    const stepLabels: Record<Step, string> = {
      prospect: "Nouveau client",
      mandate_active: "Mandat en cours",
      quote_pending: "Devis envoye",
      contract_pending: "Contrat a signer",
      invoice_unpaid: "Paiement en attente",
      complete: "Complete",
    };
    const headers = ["Client", "Entreprise", "Etape", "Montant pipeline (CAD)", "Mandats", "Devis", "Contrats", "Factures", "Impaye (CAD)", "Alerte", "Messages non lus", "Derniere activite"];
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
        hasAlert(c) ? "Oui" : "Non",
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
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Workflow className="h-6 w-6" />
            Pipeline workflow
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Cycle de vie complet de chaque client — de la prospection au paiement
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={exportCsv} title="Exporter en CSV">
            <Download className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Export CSV</span>
          </Button>
          <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
            <Activity className="h-4 w-4 sm:mr-1.5" />
            <span className="hidden sm:inline">Activite</span>
            {events.length > 0 && <Badge variant="secondary" className="ml-1.5">{events.length}</Badge>}
          </Button>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total clients" value={clients.length} icon={UserPlus} accent="bg-blue-500" />
        <StatCard
          label="Forecast pipeline"
          value={formatCurrency(pipelineForecast)}
          icon={TrendingUp}
          accent="bg-violet-500"
          deltaLabel={filtered.length < clients.length ? `Filtre: ${filtered.length}/${clients.length}` : undefined}
        />
        <StatCard label="Alertes" value={alertCount} icon={AlertTriangle} accent="bg-red-500" />
        <StatCard label="Impaye total" value={formatCurrency(overdueTotal)} icon={CreditCard} accent="bg-amber-500" />
      </div>

      {/* Stats conversion */}
      <div className="rounded-lg border bg-card p-3">
        <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Taux de conversion</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <ConversionStat label="Prospect → Mandat" pct={conversion(totals.mandate, totals.total)} hint={`${totals.mandate}/${totals.total}`} />
          <ConversionStat label="Mandat → Devis" pct={conversion(totals.quote, totals.mandate)} hint={`${totals.quote}/${totals.mandate}`} />
          <ConversionStat label="Devis → Contrat" pct={conversion(totals.contract, totals.quote)} hint={`${totals.contract}/${totals.quote}`} />
          <ConversionStat label="Contrat → Paye" pct={conversion(totals.complete, totals.contract)} hint={`${totals.complete}/${totals.contract}`} />
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Rechercher un client..." className="pl-9" />
        </div>
        <Button variant={alertsOnly ? "default" : "outline"} size="sm" onClick={() => setAlertsOnly(!alertsOnly)} className="gap-1.5">
          <AlertTriangle className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Alertes</span>
          {alertCount > 0 && (
            <Badge variant={alertsOnly ? "secondary" : "destructive"} className="text-[9px] h-4 min-w-4 px-1">{alertCount}</Badge>
          )}
        </Button>

        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1.5">
              <SlidersHorizontal className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Filtres</span>
              {totalActiveFilters > 0 && <Badge variant="secondary" className="text-[9px] h-4 min-w-4 px-1">{totalActiveFilters}</Badge>}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-[320px] max-w-[calc(100vw-2rem)] p-3 space-y-3" align="end">
            {/* Service types */}
            {availableServiceTypes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Type de service</p>
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
                        {SERVICE_TYPE_LABELS[s] ?? s}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {/* Periode */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Periode (derniere activite)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="date" value={filterDateFrom} onChange={(e) => setFilterDateFrom(e.target.value)} className="h-8 text-xs" />
                <Input type="date" value={filterDateTo} onChange={(e) => setFilterDateTo(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            {/* Montant */}
            <div className="space-y-1.5">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Montant pipeline ($)</p>
              <div className="grid grid-cols-2 gap-2">
                <Input type="number" placeholder="Min" value={filterAmountMin} onChange={(e) => setFilterAmountMin(e.target.value)} className="h-8 text-xs" />
                <Input type="number" placeholder="Max" value={filterAmountMax} onChange={(e) => setFilterAmountMax(e.target.value)} className="h-8 text-xs" />
              </div>
            </div>
            {totalActiveFilters > 0 && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="w-full text-xs">
                <X className="h-3 w-3 mr-1" />Effacer les filtres
              </Button>
            )}
          </PopoverContent>
        </Popover>

        {totalActiveFilters > 0 && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs text-muted-foreground hidden sm:flex">
            <X className="h-3 w-3 mr-1" />Effacer
          </Button>
        )}
      </div>

      {/* Mobile: selecteur de colonne */}
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
                  {col.label} ({columns[col.id].length})
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Kanban responsive */}
      <div className="grid grid-cols-1 lg:grid-cols-6 gap-3">
        {COLUMNS.map((col) => {
          const ColIcon = col.icon;
          const items = columns[col.id];
          const colTotal = items.reduce((s, c) => s + getClientStageValue(c, col.id), 0);
          const isVisible = col.id === mobileColumn; // affiche sur mobile

          const isDropTarget = isValidDropTarget(draggedClientId, col.id);
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
                // Seulement si on quitte vraiment la colonne (pas un enfant)
                if (e.currentTarget.contains(e.relatedTarget as Node)) return;
                if (dragOverStep === col.id) setDragOverStep(null);
              }}
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(col.id);
              }}
            >
              {/* Column header */}
              <div className={cn("rounded-lg border p-3 space-y-2", col.header)}>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <ColIcon className={cn("h-3.5 w-3.5 shrink-0", col.iconColor)} />
                    <span className="text-xs font-semibold truncate">{col.label}</span>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Badge variant="secondary" className="text-[10px] bg-white">{items.length}</Badge>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="h-5 w-5 rounded hover:bg-white/50 flex items-center justify-center" aria-label="Trier">
                          <ArrowDownUp className="h-3 w-3" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel className="text-xs">Trier par</DropdownMenuLabel>
                        <DropdownMenuRadioGroup
                          value={sortMode[col.id]}
                          onValueChange={(v) => setSortMode({ ...sortMode, [col.id]: v as SortMode })}
                        >
                          <DropdownMenuRadioItem value="date_desc" className="text-xs">Plus recent</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="date_asc" className="text-xs">Plus ancien</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="amount_desc" className="text-xs">Montant decroissant</DropdownMenuRadioItem>
                          <DropdownMenuRadioItem value="name_asc" className="text-xs">Nom A→Z</DropdownMenuRadioItem>
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

              {/* Cards */}
              <div className="space-y-2 min-h-[80px]">
                {items.length === 0 ? (
                  <div className="rounded-lg border-2 border-dashed py-8 px-3 text-center">
                    <ColIcon className={cn("h-5 w-5 mx-auto opacity-30", col.iconColor)} />
                    <p className="text-[10px] text-muted-foreground/60 mt-1.5">Aucun client</p>
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
                    const openPanel = () => openEntity("client", c.id);

                    const isDragged = draggedClientId === c.id;
                    return (
                      <Card
                        key={c.id}
                        draggable={!busy}
                        onDragStart={(e) => {
                          setDraggedClientId(c.id);
                          e.dataTransfer.effectAllowed = "move";
                        }}
                        onDragEnd={() => {
                          setDraggedClientId(null);
                          setDragOverStep(null);
                        }}
                        className={cn(
                          "vnk-card-hover transition-shadow overflow-hidden cursor-grab active:cursor-grabbing",
                          isOverdue && "border-red-400 ring-1 ring-red-200",
                          alert && !isOverdue && "border-amber-300",
                          busy && "opacity-60 pointer-events-none",
                          isDragged && "opacity-40 scale-95"
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

                            {c.quotes[0] && col.id === "quote_pending" && (
                              <div className="mt-2 text-[10px]">
                                <span className="text-muted-foreground">{c.quotes[0].quoteNumber}</span>
                                <span className="font-semibold ml-2">{formatCurrency(c.quotes[0].amountTtc)}</span>
                              </div>
                            )}

                            {c.contracts[0] && col.id === "contract_pending" && (
                              <div className="mt-2 text-[10px] text-muted-foreground">
                                {c.contracts[0].contractNumber}
                                {c.contracts[0].amountTtc != null && (
                                  <span className="font-semibold ml-2 text-foreground">{formatCurrency(c.contracts[0].amountTtc)}</span>
                                )}
                              </div>
                            )}

                            {unpaid > 0 && col.id === "invoice_unpaid" && (
                              <div className="mt-2 flex items-center gap-1">
                                <Clock className="h-3 w-3 text-red-500" />
                                <span className={cn("text-xs font-semibold", isOverdue ? "text-red-600" : "text-amber-600")}>
                                  {formatCurrency(unpaid)}
                                </span>
                              </div>
                            )}

                            {col.id === "complete" && c.invoices.length > 0 && (
                              <div className="mt-2 text-[10px] text-emerald-600 font-medium">
                                {formatCurrency(c.invoices.reduce((s, i) => s + i.amountTtc, 0))} total
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

      {/* Activite recente — slide-out */}
      <Sheet open={activityOpen} onOpenChange={setActivityOpen}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />Activite recente
            </SheetTitle>
          </SheetHeader>
          <div className="mt-4 space-y-2">
            {events.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Aucun evenement</p>
            ) : events.map((e) => {
              const Icon = eventTypeIcon(e.eventType);
              const colorCls = eventTypeColor(e.eventType);
              return (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => { openEntity("client", e.clientId); setActivityOpen(false); }}
                  className="w-full p-3 rounded-lg border bg-card hover:shadow-sm transition-shadow flex items-start gap-3 text-left"
                >
                  <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", colorCls)}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium line-clamp-2">{e.eventLabel ?? e.eventType}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      {e.clientName}{e.clientCompany ? ` · ${e.clientCompany}` : ""}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{timeAgo(e.createdAt)} · {e.triggeredBy}</p>
                  </div>
                </button>
              );
            })}
          </div>
        </SheetContent>
      </Sheet>

      {ConfirmModal}
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

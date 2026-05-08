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
} from "@/components/ui/dropdown-menu";
import { StatCard } from "@/components/admin/stat-card";
import { ClientDetailPanel } from "@/components/admin/client-detail-panel";
import { useConfirm } from "@/hooks/use-confirm";
import { cn, formatCurrency } from "@/lib/utils";

type ClientData = {
  id: number;
  fullName: string;
  companyName: string | null;
  unreadMessages: number;
  mandates: Array<{ id: number; status: string; title: string; progress: number; serviceType: string | null; endDate: string | null }>;
  quotes: Array<{ id: number; status: string; quoteNumber: string; title: string; amountTtc: number; expiryDate: string | null }>;
  contracts: Array<{ id: number; status: string; contractNumber: string; title: string }>;
  invoices: Array<{ id: number; status: string; invoiceNumber: string; amountTtc: number; dueDate: string | null }>;
};

type Step = "prospect" | "mandate_active" | "quote_pending" | "contract_pending" | "invoice_unpaid" | "complete";

const COLUMNS: Array<{
  id: Step;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  dotColor: string;
  header: string;
  stripe: string;
  iconColor: string;
}> = [
  { id: "prospect", label: "Nouveau client", icon: UserPlus, dotColor: "bg-slate-500", header: "bg-slate-100 border-slate-300", stripe: "bg-slate-400", iconColor: "text-slate-600" },
  { id: "mandate_active", label: "Mandat en cours", icon: Briefcase, dotColor: "bg-blue-500", header: "bg-blue-100 border-blue-300", stripe: "bg-blue-500", iconColor: "text-blue-600" },
  { id: "quote_pending", label: "Devis envoye", icon: FileText, dotColor: "bg-amber-500", header: "bg-amber-100 border-amber-300", stripe: "bg-amber-500", iconColor: "text-amber-600" },
  { id: "contract_pending", label: "Contrat a signer", icon: FileSignature, dotColor: "bg-violet-500", header: "bg-violet-100 border-violet-300", stripe: "bg-violet-500", iconColor: "text-violet-600" },
  { id: "invoice_unpaid", label: "Paiement en attente", icon: CreditCard, dotColor: "bg-red-500", header: "bg-red-100 border-red-300", stripe: "bg-red-500", iconColor: "text-red-600" },
  { id: "complete", label: "Complete", icon: CheckCircle2, dotColor: "bg-emerald-500", header: "bg-emerald-100 border-emerald-300", stripe: "bg-emerald-500", iconColor: "text-emerald-600" },
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

export function WorkflowKanban({ clients }: { clients: ClientData[] }) {
  const router = useRouter();
  const { confirm, ConfirmModal } = useConfirm();
  const [searchQuery, setSearchQuery] = useState("");
  const [alertsOnly, setAlertsOnly] = useState(false);
  const [panelClientId, setPanelClientId] = useState<number | null>(null);
  const [busyClientId, setBusyClientId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    let result = clients;
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((c) =>
        c.fullName.toLowerCase().includes(q) ||
        c.companyName?.toLowerCase().includes(q)
      );
    }
    if (alertsOnly) {
      result = result.filter(hasAlert);
    }
    return result;
  }, [clients, searchQuery, alertsOnly]);

  const columns = useMemo(() => {
    const grouped: Record<Step, ClientData[]> = {
      prospect: [], mandate_active: [], quote_pending: [],
      contract_pending: [], invoice_unpaid: [], complete: [],
    };
    for (const c of filtered) grouped[getStep(c)].push(c);
    return grouped;
  }, [filtered]);

  // KPIs
  const alertCount = clients.filter(hasAlert).length;
  const overdueTotal = clients.flatMap((c) => c.invoices)
    .filter((i) => i.status === "overdue")
    .reduce((s, i) => s + i.amountTtc, 0);

  // Actions API
  const acceptQuote = async (clientId: number, quoteId: number, num: string) => {
    const ok = await confirm({
      title: "Accepter ce devis ?",
      description: `Le devis ${num} sera marque comme accepte et un contrat sera genere automatiquement.`,
      confirmLabel: "Accepter",
      variant: "default",
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
      description: "Vous allez apposer votre signature en tant qu'administrateur. Cette action sera enregistree.",
      confirmLabel: "Signer",
      variant: "default",
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
      variant: "default",
    });
    if (!ok) return;
    setBusyClientId(clientId);
    try {
      const res = await fetch(`/api/invoices/${invoiceId}/mark-paid`, { method: "POST" });
      if (res.ok) { toast.success("Facture marquee comme payee"); router.refresh(); }
      else { const d = await res.json(); toast.error(d.error || "Erreur"); }
    } finally { setBusyClientId(null); }
  };

  // Actions contextuelles selon la colonne
  const getCardActions = (c: ClientData, step: Step) => {
    const actions: Array<{ label: string; icon: React.ReactNode; onClick: () => void; separator?: boolean; destructive?: boolean }> = [
      { label: "Voir le client", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => setPanelClientId(c.id) },
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
        actions.push({
          label: "Marquer accepte",
          icon: <CheckCircle2 className="h-3.5 w-3.5" />,
          onClick: () => acceptQuote(c.id, pendingQuote.id, pendingQuote.quoteNumber),
        });
      }
      actions.push({ label: "Relancer client", icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
    } else if (step === "contract_pending") {
      const pendingContract = c.contracts.find((ct) => ct.status === "pending" || ct.status === "draft");
      if (pendingContract) {
        actions.push({
          label: "Signer admin",
          icon: <PenTool className="h-3.5 w-3.5" />,
          onClick: () => signContract(c.id, pendingContract.id),
        });
      }
      actions.push({ label: "Relancer client", icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
    } else if (step === "invoice_unpaid") {
      const unpaid = c.invoices.find((i) => i.status === "unpaid" || i.status === "overdue");
      if (unpaid) {
        actions.push({
          label: "Marquer payee",
          icon: <CreditCard className="h-3.5 w-3.5" />,
          onClick: () => markInvoicePaid(c.id, unpaid.id, unpaid.invoiceNumber),
        });
      }
      actions.push({ label: "Envoyer relance", icon: <Send className="h-3.5 w-3.5" />, onClick: () => router.push(`/admin/messages?clientId=${c.id}`) });
    }

    return actions;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Workflow className="h-6 w-6" />
          Pipeline workflow
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Cycle de vie complet de chaque client — de la prospection au paiement
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Total clients" value={clients.length} icon={UserPlus} accent="bg-blue-500" />
        <StatCard label="En cours" value={columns.mandate_active.length + columns.quote_pending.length + columns.contract_pending.length} icon={Briefcase} accent="bg-violet-500" />
        <StatCard label="Alertes" value={alertCount} icon={AlertTriangle} accent="bg-red-500" />
        <StatCard label="Impaye total" value={formatCurrency(overdueTotal)} icon={CreditCard} accent="bg-amber-500" />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher un client..."
            className="pl-9"
          />
        </div>
        <Button
          variant={alertsOnly ? "default" : "outline"}
          size="sm"
          onClick={() => setAlertsOnly(!alertsOnly)}
          className="gap-1.5"
        >
          <AlertTriangle className="h-3.5 w-3.5" />
          Alertes uniquement
          {alertCount > 0 && (
            <Badge variant={alertsOnly ? "secondary" : "destructive"} className="text-[9px] h-4 min-w-4 px-1 ml-1">
              {alertCount}
            </Badge>
          )}
        </Button>
      </div>

      {/* Kanban */}
      <div className="overflow-x-auto pb-4">
        <div className="grid grid-cols-6 gap-3 min-w-[1200px]">
          {COLUMNS.map((col) => {
            const ColIcon = col.icon;
            const items = columns[col.id];
            return (
              <div key={col.id} className="space-y-2">
                {/* Column header */}
                <div className={cn("rounded-lg border p-3 flex items-center justify-between", col.header)}>
                  <div className="flex items-center gap-2 min-w-0">
                    <ColIcon className={cn("h-3.5 w-3.5 shrink-0", col.iconColor)} />
                    <span className="text-xs font-semibold truncate">{col.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px] bg-white shrink-0">{items.length}</Badge>
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

                      return (
                        <Card
                          key={c.id}
                          className={cn(
                            "vnk-card-hover cursor-pointer transition-shadow overflow-hidden",
                            isOverdue && "border-red-400 ring-1 ring-red-200",
                            alert && !isOverdue && "border-amber-300",
                            busy && "opacity-60 pointer-events-none"
                          )}
                          onClick={() => setPanelClientId(c.id)}
                        >
                          {/* Accent stripe selon etape */}
                          <div className={cn("h-1 w-full", col.stripe)} />
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <div className="font-semibold text-sm truncate">{c.fullName}</div>
                                {c.companyName && (
                                  <div className="text-[10px] text-muted-foreground truncate">{c.companyName}</div>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {c.unreadMessages > 0 && (
                                  <MessageSquare className="h-3 w-3 text-blue-500" />
                                )}
                                {isOverdue && (
                                  <AlertTriangle className="h-3 w-3 text-red-500" />
                                )}
                                <div onClick={(e) => e.stopPropagation()}>
                                  <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                      <button className="h-6 w-6 flex items-center justify-center rounded hover:bg-muted transition-colors">
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
                            </div>

                            {/* Info contextuelle selon l'etape */}
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
                              </div>
                            )}

                            {unpaid > 0 && (col.id === "invoice_unpaid") && (
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
      </div>

      {/* Detail panel */}
      <ClientDetailPanel
        clientId={panelClientId}
        open={panelClientId !== null}
        onOpenChange={(o) => { if (!o) setPanelClientId(null); }}
      />

      {ConfirmModal}
    </div>
  );
}

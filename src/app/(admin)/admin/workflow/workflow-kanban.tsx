"use client";
import { useState, useMemo } from "react";
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
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/admin/stat-card";
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
  accent: string;
}> = [
  { id: "prospect", label: "Nouveau client", icon: UserPlus, dotColor: "bg-slate-400", accent: "bg-slate-50 border-slate-200" },
  { id: "mandate_active", label: "Mandat en cours", icon: Briefcase, dotColor: "bg-blue-500", accent: "bg-blue-50 border-blue-200" },
  { id: "quote_pending", label: "Devis envoye", icon: FileText, dotColor: "bg-amber-500", accent: "bg-amber-50 border-amber-200" },
  { id: "contract_pending", label: "Contrat a signer", icon: FileSignature, dotColor: "bg-violet-500", accent: "bg-violet-50 border-violet-200" },
  { id: "invoice_unpaid", label: "Paiement en attente", icon: CreditCard, dotColor: "bg-red-500", accent: "bg-red-50 border-red-200" },
  { id: "complete", label: "Complete", icon: CheckCircle2, dotColor: "bg-emerald-500", accent: "bg-emerald-50 border-emerald-200" },
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
  const [searchQuery, setSearchQuery] = useState("");
  const [alertsOnly, setAlertsOnly] = useState(false);

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
            const Icon = col.icon;
            const items = columns[col.id];
            return (
              <div key={col.id} className="space-y-2">
                {/* Column header */}
                <div className={cn("rounded-lg border p-3 flex items-center justify-between", col.accent)}>
                  <div className="flex items-center gap-2">
                    <span className={cn("h-2.5 w-2.5 rounded-full", col.dotColor)} />
                    <span className="text-xs font-semibold">{col.label}</span>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{items.length}</Badge>
                </div>

                {/* Cards */}
                <div className="space-y-2 min-h-[80px]">
                  {items.length === 0 ? (
                    <div className="text-[10px] text-center text-muted-foreground/50 py-8">—</div>
                  ) : (
                    items.map((c) => {
                      const unpaid = c.invoices
                        .filter((i) => i.status === "unpaid" || i.status === "overdue")
                        .reduce((sum, i) => sum + i.amountTtc, 0);
                      const isOverdue = c.invoices.some((i) => i.status === "overdue");
                      const latestMandate = c.mandates[0];
                      const alert = hasAlert(c);

                      return (
                        <Card key={c.id} className={cn(
                          "vnk-card-hover cursor-pointer",
                          isOverdue && "border-red-300",
                          alert && !isOverdue && "border-amber-300"
                        )}>
                          <CardContent className="p-3">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0">
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
    </div>
  );
}

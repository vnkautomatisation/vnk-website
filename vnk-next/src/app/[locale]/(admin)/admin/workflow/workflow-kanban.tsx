"use client";
import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/utils";
import {
  ArrowUp,
  Briefcase,
  FileText,
  FileSignature,
  CreditCard,
  CheckCircle,
} from "lucide-react";

type ClientData = {
  id: number;
  fullName: string;
  companyName: string | null;
  mandates: Array<{ id: number; status: string; title: string; progress: number }>;
  quotes: Array<{ id: number; status: string; quoteNumber: string; amountTtc: any }>;
  contracts: Array<{ id: number; status: string; contractNumber: string }>;
  invoices: Array<{
    id: number;
    status: string;
    invoiceNumber: string;
    amountTtc: any;
    dueDate: Date | null;
  }>;
};

type Step =
  | "prospect"
  | "mandate_active"
  | "quote_pending"
  | "contract_pending"
  | "invoice_unpaid"
  | "complete";

const COLUMNS: Array<{
  id: Step;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  accent: string;
}> = [
  { id: "prospect", label: "Nouveau client", icon: ArrowUp, color: "text-slate-600", accent: "bg-slate-100" },
  { id: "mandate_active", label: "Mandat en cours", icon: Briefcase, color: "text-blue-600", accent: "bg-blue-100" },
  { id: "quote_pending", label: "Devis envoyé", icon: FileText, color: "text-amber-600", accent: "bg-amber-100" },
  { id: "contract_pending", label: "Contrat à signer", icon: FileSignature, color: "text-violet-600", accent: "bg-violet-100" },
  { id: "invoice_unpaid", label: "Paiement en attente", icon: CreditCard, color: "text-red-600", accent: "bg-red-100" },
  { id: "complete", label: "Complété", icon: CheckCircle, color: "text-emerald-600", accent: "bg-emerald-100" },
];

function getStep(c: ClientData): Step {
  if (c.mandates.length === 0) return "prospect";
  if (c.quotes.some((q) => q.status === "pending")) return "quote_pending";
  if (c.contracts.some((ct) => ct.status === "pending" || ct.status === "draft")) {
    return "contract_pending";
  }
  if (c.invoices.some((i) => i.status === "unpaid" || i.status === "overdue")) {
    return "invoice_unpaid";
  }
  if (
    c.mandates.length > 0 &&
    c.quotes.length > 0 &&
    c.contracts.length > 0 &&
    c.invoices.every((i) => i.status === "paid")
  ) {
    return "complete";
  }
  return "mandate_active";
}

export function WorkflowKanban({ clients }: { clients: ClientData[] }) {
  const columns = useMemo(() => {
    const grouped: Record<Step, ClientData[]> = {
      prospect: [],
      mandate_active: [],
      quote_pending: [],
      contract_pending: [],
      invoice_unpaid: [],
      complete: [],
    };
    for (const c of clients) {
      grouped[getStep(c)].push(c);
    }
    return grouped;
  }, [clients]);

  return (
    <div className="overflow-x-auto pb-4">
      <div className="grid grid-cols-6 gap-4 min-w-[1200px]">
        {COLUMNS.map((col) => {
          const Icon = col.icon;
          const items = columns[col.id];
          return (
            <div key={col.id} className="space-y-3">
              <div className={`rounded-lg ${col.accent} p-3 flex items-center justify-between`}>
                <div className="flex items-center gap-2">
                  <Icon className={`h-4 w-4 ${col.color}`} />
                  <span className="text-xs font-semibold">{col.label}</span>
                </div>
                <Badge variant="secondary" className="text-[10px]">
                  {items.length}
                </Badge>
              </div>

              <div className="space-y-2 min-h-[100px]">
                {items.length === 0 ? (
                  <div className="text-xs text-center text-muted-foreground py-6">
                    Aucun client
                  </div>
                ) : (
                  items.map((c) => {
                    const unpaid = c.invoices
                      .filter((i) => i.status === "unpaid" || i.status === "overdue")
                      .reduce((sum, i) => sum + Number(i.amountTtc ?? 0), 0);
                    return (
                      <Card key={c.id} className="vnk-card-hover cursor-pointer">
                        <CardContent className="p-3">
                          <div className="font-semibold text-sm truncate">{c.fullName}</div>
                          {c.companyName && (
                            <div className="text-[10px] text-muted-foreground truncate mt-0.5">
                              {c.companyName}
                            </div>
                          )}
                          {unpaid > 0 && (
                            <div className="mt-2 text-xs font-semibold text-destructive">
                              {formatCurrency(unpaid)} dû
                            </div>
                          )}
                          {c.mandates[0] && (
                            <div className="mt-2">
                              <div className="h-1 rounded-full bg-muted overflow-hidden">
                                <div
                                  className="h-full bg-primary"
                                  style={{ width: `${c.mandates[0].progress}%` }}
                                />
                              </div>
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
  );
}

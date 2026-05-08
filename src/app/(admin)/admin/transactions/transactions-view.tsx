"use client";
import { useState, useMemo, useCallback } from "react";
import {
  CreditCard,
  Search,
  DollarSign,
  RotateCcw,
  Hash,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { StatCard } from "@/components/admin/stat-card";
import { EntityCard } from "@/components/admin/entity-card";
import { useViewMode, ViewToggle } from "@/components/admin/view-toggle";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Payment = {
  id: number;
  invoiceId: number | null;
  clientId: number | null;
  clientName: string;
  companyName: string | null;
  invoiceNumber: string;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
};

type StatusFilter = "all" | "paid" | "refunded";

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "Toutes" },
  { key: "paid", label: "Payees" },
  { key: "refunded", label: "Remboursees" },
];

export function TransactionsView({
  payments,
  kpis,
}: {
  payments: Payment[];
  kpis: { totalPaid: number; totalRefunded: number; count: number };
}) {
  const [view, setView] = useViewMode("transactions", "list");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = useMemo(() => {
    let result = payments;
    if (statusFilter === "paid") result = result.filter((p) => p.status === "succeeded" || p.status === "paid");
    else if (statusFilter === "refunded") result = result.filter((p) => p.status === "refunded");
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.clientName.toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q) ||
          (p.stripePaymentIntentId ?? "").toLowerCase().includes(q)
      );
    }
    return result;
  }, [payments, statusFilter, searchQuery]);

  // Actions menu pour EntityCard (lecture seule)
  const getActions = useCallback((p: Payment) => [
    { label: "Voir", icon: <Eye className="h-3.5 w-3.5" />, onClick: () => {} },
  ], []);

  const columns: Column<Payment>[] = [
    {
      key: "date",
      header: "Date",
      accessor: (r) => formatDate(new Date(r.paidAt ?? r.createdAt)),
      sortable: true,
      sortBy: (r) => r.paidAt ?? r.createdAt,
    },
    {
      key: "client",
      header: "Client",
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
      header: "Facture",
      accessor: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span>,
    },
    {
      key: "amount",
      header: "Montant",
      accessor: (r) => <span className="font-semibold">{formatCurrency(r.amount)}</span>,
      sortable: true,
      sortBy: (r) => r.amount,
    },
    {
      key: "method",
      header: "Methode",
      accessor: (r) => <span className="text-xs capitalize">{r.paymentMethod ?? "—"}</span>,
      hiddenOnMobile: true,
    },
    { key: "status", header: "Statut", accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "stripe",
      header: "Stripe ID",
      accessor: (r) => r.stripePaymentIntentId ? (
        <span className="font-mono text-xs text-muted-foreground truncate max-w-[120px] block">{r.stripePaymentIntentId}</span>
      ) : "—",
      hiddenOnMobile: true,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <CreditCard className="h-6 w-6" />
          Transactions
        </h1>
        <p className="text-muted-foreground text-sm mt-1">Historique des paiements et remboursements Stripe</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        <StatCard label="Total paye" value={formatCurrency(kpis.totalPaid)} icon={DollarSign} accent="bg-emerald-500" />
        <StatCard label="Total rembourse" value={formatCurrency(kpis.totalRefunded)} icon={RotateCcw} accent="bg-red-500" />
        <StatCard label="Nombre transactions" value={kpis.count} icon={Hash} accent="bg-blue-500" />
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Client, facture, Stripe ID..." className="pl-9" />
        </div>
        <div className="flex bg-muted rounded-lg p-0.5">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "px-3 py-1.5 text-xs font-medium rounded-md transition-colors",
                statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <ViewToggle storageKey="transactions" defaultView="list" onChange={setView} />
      </div>

      {/* Vue grille */}
      {view === "grid" ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((p) => (
            <EntityCard
              key={p.id}
              title={p.clientName}
              subtitle={p.invoiceNumber}
              avatarName={p.clientName}
              badges={[
                { label: p.status === "succeeded" || p.status === "paid" ? "Payee" : p.status === "refunded" ? "Remboursee" : p.status, variant: p.status === "succeeded" || p.status === "paid" ? "secondary" : p.status === "refunded" ? "destructive" : "outline" },
                ...(p.paymentMethod ? [{ label: p.paymentMethod, variant: "outline" as const }] : []),
              ]}
              stats={[
                { label: "Montant", value: formatCurrency(p.amount) },
              ]}
              actions={getActions(p)}
              footer={
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{formatDate(new Date(p.paidAt ?? p.createdAt))}</span>
                  <span className="truncate max-w-[50%]">{p.stripePaymentIntentId ?? "—"}</span>
                </div>
              }
            />
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full text-center py-12 text-sm text-muted-foreground">Aucune transaction trouvee</div>
          )}
        </div>
      ) : (
        <DataTable data={filtered} columns={columns} getRowId={(r) => r.id} searchPlaceholder="Rechercher..." exportFilename="transactions" storageKey="admin-transactions" />
      )}
    </div>
  );
}

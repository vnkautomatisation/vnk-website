"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CheckCircle2,
  CheckSquare,
  Square,
  Search,
  CreditCard,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { cn, formatCurrency, formatDate } from "@/lib/utils";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

// Labels FR pour méthodes de paiement (memes labels que receipts/payments)
const METHOD_LABELS: Record<string, string> = {
  stripe: "Carte de crédit",
  interac: "Interac",
  cheque: "Chèque",
  virement: "Virement bancaire",
  comptant: "Comptant",
  manual: "Manuel",
  autre: "Autre",
};

function methodLabel(m: string | null | undefined): string {
  if (!m) return "—";
  return METHOD_LABELS[m] ?? m;
}

type Payment = {
  id: number;
  invoiceId: number | null;
  clientId: number | null;
  clientName: string;
  companyName: string | null;
  invoiceNumber: string;
  invoiceTitle: string | null;
  amount: number;
  currency: string;
  paymentMethod: string | null;
  stripePaymentIntentId: string | null;
  paidAt: string | null;
  createdAt: string;
};

type AdminOption = { id: number; fullName: string | null; email: string };

export function ReconciliationView({
  payments,
  accountants,
  byMethod,
  methodList,
}: {
  payments: Payment[];
  accountants: AdminOption[];
  byMethod: { method: string; count: number; total: number }[];
  methodList: string[];
}) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);

  // Sticky scroll detection (Wix pattern)
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const filtered = useMemo(() => {
    let result = payments;
    if (methodFilter !== "all") result = result.filter((p) => p.paymentMethod === methodFilter);
    if (dateFrom) result = result.filter((p) => new Date(p.paidAt ?? p.createdAt) >= new Date(dateFrom));
    if (dateTo) {
      const t = new Date(dateTo); t.setDate(t.getDate() + 1);
      result = result.filter((p) => new Date(p.paidAt ?? p.createdAt) <= t);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.clientName.toLowerCase().includes(q) ||
          (p.companyName ?? "").toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q) ||
          (p.stripePaymentIntentId ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [payments, methodFilter, dateFrom, dateTo, searchQuery]);

  const allSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const toggleAll = () => {
    if (allSelected) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((p) => p.id)));
  };
  const toggleOne = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reconcileSelected = async () => {
    if (selectedIds.size === 0) return;
    setBusy(true);
    try {
      const res = await fetch("/api/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIds: Array.from(selectedIds), action: "reconcile" }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      const data = await res.json();
      toast.success(`${data.count} paiement(s) confirmé(s) reçu(s)`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const reconcileAll = async () => {
    if (filtered.length === 0) return;
    if (!confirm(`Confirmer la réception de ${filtered.length} paiement(s) ?`)) return;
    setSelectedIds(new Set(filtered.map((p) => p.id)));
    // Petit délai pour permettre la mise à jour state, puis appel
    setTimeout(reconcileSelected, 100);
  };

  const totalPending = filtered.reduce((s, p) => s + p.amount, 0);

  const columns: Column<Payment>[] = [
    {
      key: "select",
      header: (
        <button onClick={toggleAll} className="flex items-center">
          {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
      ),
      accessor: (r) => (
        <button onClick={(e) => { e.stopPropagation(); toggleOne(r.id); }}>
          {selectedIds.has(r.id) ? <CheckSquare className="h-3.5 w-3.5 text-[#0F2D52]" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      ),
    },
    {
      key: "date",
      header: "Date paiement",
      accessor: (r) => formatDate(new Date(r.paidAt ?? r.createdAt)),
      sortable: true,
      sortBy: (r) => r.paidAt ?? r.createdAt,
    },
    {
      key: "client",
      header: "Client",
      accessor: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{r.clientName}</div>
          {r.companyName && <div className="text-xs text-muted-foreground truncate">{r.companyName}</div>}
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.clientName,
    },
    { key: "invoice", header: "Facture", accessor: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
    {
      key: "amount",
      header: "Montant",
      accessor: (r) => <span className="font-bold">{formatCurrency(r.amount, (r.currency || "CAD").toUpperCase())}</span>,
      sortable: true,
      sortBy: (r) => r.amount,
    },
    {
      key: "method",
      header: "Méthode",
      accessor: (r) => <span className="text-xs">{methodLabel(r.paymentMethod)}</span>,
    },
    {
      key: "stripe",
      header: "Référence",
      accessor: (r) => r.stripePaymentIntentId ? (
        <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px] block">{r.stripePaymentIntentId}</span>
      ) : "—",
      hiddenOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      accessor: (r) => (
        <ActionTooltip label="Marquer ce paiement comme vérifié en banque">
          <Button
            size="sm"
            variant="outline"
            className="h-7 px-2 text-xs"
            onClick={async (e) => {
              e.stopPropagation();
              setBusy(true);
              try {
                const res = await fetch(`/api/payments/${r.id}/reconcile`, { method: "POST" });
                if (!res.ok) throw new Error();
                toast.success("Paiement confirmé reçu");
                router.refresh();
              } catch {
                toast.error("Erreur");
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />Confirmer reçu
          </Button>
        </ActionTooltip>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              Confirmation banque
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              {payments.length} paiement{payments.length > 1 ? "s" : ""} à vérifier · {formatCurrency(totalPending)} en attente de vérification
            </p>
          </div>
          {filtered.length > 0 && (
            <Button
              size="sm"
              variant="secondary"
              className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur"
              onClick={reconcileAll}
              disabled={busy}
            >
              <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
              Tout confirmer reçu ({filtered.length})
            </Button>
          )}
        </div>
      </div>

      {/* Sommaire par méthode (aide pour matcher avec relevés bancaires) */}
      {byMethod.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {byMethod.map((m) => (
            <div key={m.method} className="rounded-lg border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{methodLabel(m.method)}</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(m.total)}</p>
              <p className="text-[10px] text-muted-foreground">{m.count} paiement{m.count > 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}

      {/* Aide comptable */}
      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Comment vérifier les paiements reçus en banque</p>
          <p className="mt-0.5">
            1. Filtrer par méthode (ex : carte pour matcher le relevé de la plateforme de paiement)
            · 2. Vérifier que la somme correspond au virement reçu en banque
            · 3. Cocher les paiements vérifiés et cliquer <strong>Confirmer la sélection</strong>.
          </p>
        </div>
      </div>

      {/* Sentinel + sticky bar (filtres + KPI summary au scroll) */}
      <div ref={sentinelRef} aria-hidden className="h-px -mt-2" />
      <div
        className={cn(
          "sticky top-[64px] z-20 bg-background -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-shadow",
          scrolled && "shadow-sm border-b backdrop-blur"
        )}
      >
        {scrolled && (
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <CheckCircle2 className="h-4 w-4" />
              Confirmation banque
            </span>
            <span className="font-semibold text-[#0F2D52]">{filtered.length} à vérifier</span>
            <span className="text-muted-foreground">En attente : <span className="font-bold text-[#0F2D52]">{formatCurrency(totalPending)}</span></span>
            {selectedIds.size > 0 && (
              <span className="text-muted-foreground">Sél. : <span className="font-bold text-emerald-600">{selectedIds.size}</span></span>
            )}
            <span className="ml-auto text-muted-foreground">{methodFilter !== "all" ? `Méthode : ${methodLabel(methodFilter)}` : "Toutes méthodes"}</span>
          </div>
        )}

        {/* Filtres inline (recherche + méthode + dates) */}
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Label className="text-[10px]">Recherche</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Client, facture, référence…"
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]"><CreditCard className="h-3 w-3 inline mr-1" />Méthode</Label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {methodList.map((m) => <SelectItem key={m} value={m}>{methodLabel(m)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">Du</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">Au</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36 text-xs" />
          </div>
        </div>
      </div>

      {/* Bulk actions sticky */}
      {selectedIds.size > 0 && (
        <div className="sticky top-[64px] z-[25] bg-[#0F2D52] text-white rounded-lg p-2.5 flex items-center gap-2 flex-wrap shadow-lg">
          <span className="text-sm font-medium px-2">
            {selectedIds.size} sélectionné(s) — {formatCurrency(filtered.filter((p) => selectedIds.has(p.id)).reduce((s, p) => s + p.amount, 0))}
          </span>
          <div className="flex-1" />
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 h-7 text-xs" onClick={reconcileSelected} disabled={busy}>
            <CheckCircle2 className="h-3 w-3 mr-1" />Confirmer la sélection
          </Button>
          <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            Annuler
          </Button>
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder="Rechercher..."
        exportFilename="confirmation-banque"
        storageKey="admin-reconciliation"
      />

      {filtered.length === 0 && payments.length > 0 && (
        <p className="text-center text-sm text-muted-foreground italic py-6">Aucun paiement ne correspond aux filtres</p>
      )}
      {payments.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
          <p className="font-medium">Tous les paiements sont confirmés reçus</p>
          <p className="text-xs text-muted-foreground mt-1">Aucune vérification banque en attente.</p>
        </div>
      )}
    </div>
  );
}

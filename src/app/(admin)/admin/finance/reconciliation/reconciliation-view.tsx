"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
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
const METHOD_KEYS: Record<string, string> = {
  stripe: "carte_credit",
  interac: "interac",
  cheque: "cheque",
  virement: "virement_bancaire",
  comptant: "comptant",
  manual: "manuel",
  autre: "autre",
};

function methodKey(m: string | null | undefined): string | null {
  return m ? METHOD_KEYS[m] ?? null : null;
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
  const t = useTranslations("admin.reconciliation");
  const tc = useTranslations("common");
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);


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
        throw new Error(err.error || t("erreur"));
      }
      const data = await res.json();
      toast.success(`${data.count} paiement(s) confirmé(s) reçu(s)`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur"));
    } finally {
      setBusy(false);
    }
  };

  const reconcileAll = async () => {
    if (filtered.length === 0) return;
    if (!confirm(`Confirmer la réception de ${filtered.length} paiement(s) ?`)) return;
    setSelectedIds(new Set(filtered.map((p) => p.id)));

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
      header: t("date_paiement"),
      accessor: (r) => formatDate(new Date(r.paidAt ?? r.createdAt)),
      sortable: true,
      sortBy: (r) => r.paidAt ?? r.createdAt,
    },
    {
      key: "client",
      header: t("client"),
      accessor: (r) => (
        <div className="min-w-0">
          <div className="font-medium text-sm truncate">{r.clientName}</div>
          {r.companyName && <div className="text-xs text-muted-foreground truncate">{r.companyName}</div>}
        </div>
      ),
      sortable: true,
      sortBy: (r) => r.clientName,
    },
    { key: "invoice", header: t("facture"), accessor: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span> },
    {
      key: "amount",
      header: t("montant"),
      accessor: (r) => <span className="font-bold">{formatCurrency(r.amount, (r.currency || "CAD").toUpperCase())}</span>,
      sortable: true,
      sortBy: (r) => r.amount,
    },
    {
      key: "method",
      header: t("methode"),
      accessor: (r) => <span className="text-xs">{methodKey(r.paymentMethod) ? t(methodKey(r.paymentMethod)!) : r.paymentMethod ?? "—"}</span>,
    },
    {
      key: "stripe",
      header: t("reference"),
      accessor: (r) => r.stripePaymentIntentId ? (
        <span className="font-mono text-[10px] text-muted-foreground truncate max-w-[140px] block">{r.stripePaymentIntentId}</span>
      ) : "—",
      hiddenOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      accessor: (r) => (
        <ActionTooltip label={t("marquer_paiement_comme_verifie_banque")}>
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
                toast.success(t("paiement_confirme_recu"));
                router.refresh();
              } catch {
                toast.error(t("erreur"));
              } finally {
                setBusy(false);
              }
            }}
          >
            <CheckCircle2 className="h-3 w-3 mr-1" />{t("reconciliation_view_confirmer_recu")}</Button>
        </ActionTooltip>
      ),
    },
  ];

  return (
    <div className="space-y-4">

      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5" />
              {t("confirmation_banque")}
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              {t("n_paiements_a_verifier", { count: payments.length, amount: formatCurrency(totalPending) })}
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


      {byMethod.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {byMethod.map((m) => (
            <div key={m.method} className="rounded-lg border bg-card p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{methodKey(m.method) ? t(methodKey(m.method)!) : m.method ?? "—"}</p>
              <p className="text-lg font-bold mt-1">{formatCurrency(m.total)}</p>
              <p className="text-[10px] text-muted-foreground">{m.count} paiement{m.count > 1 ? "s" : ""}</p>
            </div>
          ))}
        </div>
      )}


      <div className="rounded-lg border bg-blue-50 p-3 text-xs text-blue-900 flex items-start gap-2">
        <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">{t("comment_verifier_paiements_recus_banque")}</p>
          <p className="mt-0.5">{t("reconciliation_view_1_filtrer_par_methode_ex_carte_pour")}<strong>{t("confirmer_selection")}</strong>.
          </p>
        </div>
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px -mt-2" />


      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <CheckCircle2 className="h-4 w-4" />
              {t("confirmation_banque")}
            </span>
            <span className="font-semibold text-[#0F2D52]">{filtered.length} à vérifier</span>
            <span className="text-muted-foreground">{t("attente")} <span className="font-bold text-[#0F2D52]">{formatCurrency(totalPending)}</span></span>
            {selectedIds.size > 0 && (
              <span className="text-muted-foreground">{t("sel")} <span className="font-bold text-emerald-600">{selectedIds.size}</span></span>
            )}
            <span className="ml-auto text-muted-foreground">{methodFilter !== "all" ? t("methode_valeur", { method: methodKey(methodFilter) ? t(methodKey(methodFilter)!) : methodFilter }) : t("toutes_methodes")}</span>
          </div>
        </div>
      )}


      <div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Label className="text-[10px]">{t("recherche")}</Label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("client_facture_reference")}
                className="h-9 pl-8 text-xs"
              />
            </div>
          </div>
          <div>
            <Label className="text-[10px]"><CreditCard className="h-3 w-3 inline mr-1" />{t("methode")}</Label>
            <Select value={methodFilter} onValueChange={setMethodFilter}>
              <SelectTrigger className="h-9 w-[160px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("toutes")}</SelectItem>
                {methodList.map((m) => <SelectItem key={m} value={m}>{methodKey(m) ? t(methodKey(m)!) : m}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-[10px]">{t("du")}</Label>
            <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 w-36 text-xs" />
          </div>
          <div>
            <Label className="text-[10px]">{t("au")}</Label>
            <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 w-36 text-xs" />
          </div>
        </div>
      </div>


      {selectedIds.size > 0 && (
        <div className="sticky top-[64px] z-[25] bg-[#0F2D52] text-white rounded-lg p-2.5 flex items-center gap-2 flex-wrap shadow-lg">
          <span className="text-sm font-medium px-2">
            {selectedIds.size} sélectionné(s) — {formatCurrency(filtered.filter((p) => selectedIds.has(p.id)).reduce((s, p) => s + p.amount, 0))}
          </span>
          <div className="flex-1" />
          <Button size="sm" className="bg-emerald-500 hover:bg-emerald-600 h-7 text-xs" onClick={reconcileSelected} disabled={busy}>
            <CheckCircle2 className="h-3 w-3 mr-1" />{t("reconciliation_view_confirmer_la_selection")}</Button>
          <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            {tc("cancel")}
          </Button>
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder={t("rechercher")}
        exportFilename="confirmation-banque"
        storageKey="admin-reconciliation"
      />

      {filtered.length === 0 && payments.length > 0 && (
        <p className="text-center text-sm text-muted-foreground italic py-6">{t("aucun_paiement_ne_correspond_filtres")}</p>
      )}
      {payments.length === 0 && (
        <div className="text-center py-12">
          <CheckCircle2 className="h-12 w-12 mx-auto text-emerald-500 mb-2" />
          <p className="font-medium">{t("tous_paiements_confirmes_recus")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("aucune_verification_banque_attente")}</p>
        </div>
      )}
    </div>
  );
}

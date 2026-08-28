"use client";
import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useCurrency } from "@/lib/i18n-format";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard,
  Search,
  Eye,
  Download,
  CheckSquare,
  Square,
  CheckCircle2,
  FileSpreadsheet,
  Users,
  MoreHorizontal,
  TrendingUp,
  FileText,
  Filter,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { StatusBadge } from "@/components/admin/status-badge";
import { cn, formatDate } from "@/lib/utils";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PaymentDetailDialog } from "./payment-detail-dialog";

type Payment = {
  id: number;
  invoiceId: number | null;
  clientId: number | null;
  clientName: string;
  companyName: string | null;
  invoiceNumber: string;
  invoiceTitle: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  amount: number;
  currency: string;
  status: string;
  paymentMethod: string | null;
  paidAt: string | null;
  createdAt: string;
  reconciledAt?: string | null;
  reconciledBy?: string | null;
  exportedAt?: string | null;
  exportedBy?: string | null;
  accountingCategory?: string | null;
  fiscalPeriod?: string | null;
  assignedAccountantId?: number | null;
  assignedAccountantName?: string | null;
  accountantNotes?: string | null;
};

type ClientOption = { id: number; fullName: string; companyName: string | null };
type AdminOption = { id: number; fullName: string | null; email: string };

type StatusFilter = "all" | "succeeded" | "failed" | "refunded" | "to_reconcile" | "reconciled" | "exported";

const STATUS_TABS: { key: StatusFilter; labelKey: string }[] = [
  { key: "all", labelKey: "toutes" },
  { key: "to_reconcile", labelKey: "verifier" },
  { key: "reconciled", labelKey: "confirmees_recues" },
  { key: "exported", labelKey: "exportees" },
  { key: "failed", labelKey: "echouees" },
  { key: "refunded", labelKey: "remboursees" },
];

const CATEGORIES = [
  "services_recurrent",
  "services_unique",
  "acompte",
  "solde",
  "consultation",
  "support",
  "autre",
];

export function TransactionsView({
  payments,
  clients,
  methods,
  accountants,
  kpis,
}: {
  payments: Payment[];
  clients: ClientOption[];
  methods: string[];
  accountants: AdminOption[];
  kpis: {
    totalPaid: number;
    thisMonthAmount: number;
    toReconcileCount: number;
    count: number;
  };
}) {
  const t = useTranslations("admin.transactions");
  const tc = useTranslations("common");
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [clientFilter, setClientFilter] = useState<string>("all");
  const [accountantFilter, setAccountantFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [detailId, setDetailId] = useState<number | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const formatCurrency = useCurrency();


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
    if (statusFilter === "to_reconcile") result = result.filter((p) => !p.reconciledAt && (p.status === "succeeded" || p.status === "paid"));
    else if (statusFilter === "reconciled") result = result.filter((p) => p.reconciledAt && !p.exportedAt);
    else if (statusFilter === "exported") result = result.filter((p) => p.exportedAt);
    else if (statusFilter === "succeeded") result = result.filter((p) => p.status === "succeeded" || p.status === "paid");
    else if (statusFilter === "failed") result = result.filter((p) => p.status === "failed");
    else if (statusFilter === "refunded") result = result.filter((p) => p.status === "refunded");
    if (methodFilter !== "all") result = result.filter((p) => p.paymentMethod === methodFilter);
    if (clientFilter !== "all") result = result.filter((p) => p.clientId === Number(clientFilter));
    if (accountantFilter !== "all") {
      if (accountantFilter === "none") result = result.filter((p) => !p.assignedAccountantId);
      else result = result.filter((p) => p.assignedAccountantId === Number(accountantFilter));
    }
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      result = result.filter((p) => new Date(p.paidAt ?? p.createdAt) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setDate(toDate.getDate() + 1);
      result = result.filter((p) => new Date(p.paidAt ?? p.createdAt) <= toDate);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.clientName.toLowerCase().includes(q) ||
          (p.companyName ?? "").toLowerCase().includes(q) ||
          p.invoiceNumber.toLowerCase().includes(q) ||
          (p.invoiceTitle ?? "").toLowerCase().includes(q) ||
          (p.stripePaymentIntentId ?? "").toLowerCase().includes(q) ||
          (p.accountantNotes ?? "").toLowerCase().includes(q),
      );
    }
    return result;
  }, [payments, statusFilter, methodFilter, clientFilter, accountantFilter, dateFrom, dateTo, searchQuery]);


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

  const bulkAction = async (action: string, extra: Record<string, unknown> = {}) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const res = await fetch("/api/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIds: Array.from(selectedIds), action, ...extra }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("erreur"));
      }
      const data = await res.json();
      toast.success(t("transactions_view_p0_paiement_s_mis_a_jour", { p0: data.count }));
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur"));
    } finally {
      setBulkBusy(false);
    }
  };

  const exportComptable = (format: string) => {
    const params = new URLSearchParams({ format });
    if (dateFrom) params.set("from", dateFrom);
    if (dateTo) params.set("to", dateTo);
    const a = document.createElement("a");
    a.href = `/api/payments/export?${params.toString()}`;
    a.click();
    toast.success(`Export ${format}`);
  };

  const accountingStatusBadge = (p: Payment) => {
    if (p.exportedAt) return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-700">{t("exporte")}</span>;
    if (p.reconciledAt) return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-700">{t("confirme_recu")}</span>;
    if (p.status === "succeeded" || p.status === "paid") return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-100 text-amber-700">{t("verifier")}</span>;
    return <span className="text-[10px] text-muted-foreground">—</span>;
  };

  const columns: Column<Payment>[] = [
    {
      key: "select",
      header: (
        <button onClick={toggleAll} className="flex items-center" title={allSelected ? t("tout_deselectionner") : t("tout_selectionner")}>
          {allSelected ? <CheckSquare className="h-3.5 w-3.5" /> : <Square className="h-3.5 w-3.5" />}
        </button>
      ),
      accessor: (r) => (
        <button onClick={(e) => { e.stopPropagation(); toggleOne(r.id); }} className="flex items-center">
          {selectedIds.has(r.id) ? <CheckSquare className="h-3.5 w-3.5 text-[#0F2D52]" /> : <Square className="h-3.5 w-3.5 text-muted-foreground" />}
        </button>
      ),
    },
    {
      key: "date",
      header: t("date"),
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
    {
      key: "invoice",
      header: t("facture"),
      accessor: (r) => <span className="font-mono text-xs">{r.invoiceNumber}</span>,
    },
    {
      key: "amount",
      header: t("montant"),
      accessor: (r) => <span className="font-semibold">{formatCurrency(r.amount, (r.currency || "CAD").toUpperCase())}</span>,
      sortable: true,
      sortBy: (r) => r.amount,
    },
    {
      key: "method",
      header: t("methode"),
      accessor: (r) => <span className="text-xs capitalize">{r.paymentMethod ?? "—"}</span>,
      hiddenOnMobile: true,
    },
    { key: "status", header: t("statut"), accessor: (r) => <StatusBadge status={r.status} /> },
    {
      key: "accounting",
      header: t("compta"),
      accessor: (r) => accountingStatusBadge(r),
    },
    {
      key: "accountant",
      header: t("comptable"),
      accessor: (r) => r.assignedAccountantName ? (
        <span className="text-xs">{r.assignedAccountantName}</span>
      ) : <span className="text-xs text-muted-foreground italic">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "actions",
      header: "",
      accessor: (r) => (
        <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setDetailId(r.id); }} className="h-7 px-2">
          <Eye className="h-3.5 w-3.5" />
        </Button>
      ),
    },
  ];

  const clearFilters = () => {
    setStatusFilter("all");
    setMethodFilter("all");
    setClientFilter("all");
    setAccountantFilter("all");
    setDateFrom("");
    setDateTo("");
    setSearchQuery("");
  };


  const filteredTotalPaid = filtered.filter((p) => p.status === "succeeded" || p.status === "paid").reduce((s, p) => s + p.amount, 0);
  const filteredTotalRefunded = filtered.filter((p) => p.status === "refunded").reduce((s, p) => s + p.amount, 0);
  const filteredNet = filteredTotalPaid - filteredTotalRefunded;


  const stickyHeader = (
    <div className="space-y-2">

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-muted rounded-md p-0.5 flex-wrap">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded transition-colors",
                statusFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t(tab.labelKey)}
            </button>
          ))}
        </div>
        <Button variant="outline" size="sm" onClick={() => setShowAdvanced(!showAdvanced)} className="h-8 text-xs gap-1">
          <Filter className="h-3 w-3" />{t("filtres")}
        </Button>
        {(statusFilter !== "all" || methodFilter !== "all" || clientFilter !== "all" || accountantFilter !== "all" || dateFrom || dateTo || searchQuery) && (
          <button onClick={clearFilters} className="text-xs text-muted-foreground hover:text-foreground">
            {t("effacer_filtres")}
          </button>
        )}
      </div>


      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2 p-2.5 rounded-md border bg-muted/30">
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("methode")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("toutes_methodes")}</SelectItem>
              {methods.map((m) => <SelectItem key={m} value={m} className="capitalize">{m}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={clientFilter} onValueChange={setClientFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("client")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tous_clients")}</SelectItem>
              {clients.map((c) => (
                <SelectItem key={c.id} value={String(c.id)}>{c.fullName}{c.companyName ? ` — ${c.companyName}` : ""}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={accountantFilter} onValueChange={setAccountantFilter}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t("comptable")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("tous_comptables")}</SelectItem>
              <SelectItem value="none">{t("non_assignes")}</SelectItem>
              {accountants.map((a) => <SelectItem key={a.id} value={String(a.id)}>{a.fullName || a.email}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" placeholder={t("du")} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" placeholder={t("au")} />
        </div>
      )}


      {selectedIds.size > 0 && (
        <div className="bg-[#0F2D52] text-white rounded-md p-2 flex items-center gap-2 flex-wrap shadow-md">
          <span className="text-sm font-medium px-2">{tc("selected_f", { count: selectedIds.size })}</span>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-7 text-xs" disabled={bulkBusy} onClick={() => bulkAction("reconcile")}>
            <CheckCircle2 className="h-3 w-3 mr-1" />{t("transactions_view_confirmer_recus")}</Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-7 text-xs" disabled={bulkBusy}>
                <Users className="h-3 w-3 mr-1" />Assigner
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {accountants.map((a) => (
                <DropdownMenuItem key={a.id} onClick={() => bulkAction("assign_accountant", { accountantId: a.id })}>
                  {a.fullName || a.email}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => bulkAction("assign_accountant", { accountantId: null })}>{t("desassigner")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 h-7 text-xs" disabled={bulkBusy}>
                <MoreHorizontal className="h-3 w-3 mr-1" />{t("transactions_view_categoriser")}</Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              {CATEGORIES.map((c) => (
                <DropdownMenuItem key={c} onClick={() => bulkAction("set_category", { category: c })} className="capitalize">
                  {c.replace(/_/g, " ")}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => bulkAction("set_category", { category: null })}>{t("effacer_categorie")}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            {tc("cancel")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <div className="space-y-4">

      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2"><CreditCard className="h-5 w-5" />{t("transactions")}</h1>
            <p className="text-white/70 text-xs mt-0.5">
              {kpis.count} transactions · {formatCurrency(kpis.totalPaid)} encaissés au total · {tc("to_check", { count: kpis.toReconcileCount })}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Link href="/admin/finance"><TrendingUp className="h-3.5 w-3.5 mr-1.5" />{t("tableau_bord")}</Link>
            </Button>
            <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <Link href="/admin/tax-declarations"><FileText className="h-3.5 w-3.5 mr-1.5" />{t("rapports_fiscaux")}</Link>
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
                  <Download className="h-3.5 w-3.5 mr-1.5" />{tc("export")}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>{t("format_comptable")}</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => exportComptable("quickbooks")}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />QuickBooks
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportComptable("sage")}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />Sage 50 Canada
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => exportComptable("acomba")}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />Acomba
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => exportComptable("csv_standard")}>
                  <FileSpreadsheet className="h-3.5 w-3.5 mr-2" />CSV standard
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>


      <div ref={sentinelRef} aria-hidden className="h-px -mt-1" />


      {scrolled && (
        <div className="sticky top-[64px] z-20 -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 bg-background/95 backdrop-blur shadow-sm border-b">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <CreditCard className="h-4 w-4" />
              {t("transactions")}
            </span>
            <span className="font-semibold">{tc("shown_f", { count: filtered.length })}</span>
            <span className="text-muted-foreground">{t("encaisse")} <span className="font-semibold text-[#0F2D52]">{formatCurrency(filteredTotalPaid)}</span></span>
            <span className="text-muted-foreground">{t("rembourse")} <span className="font-semibold text-red-600">{formatCurrency(filteredTotalRefunded)}</span></span>
            <span className="text-muted-foreground">{t("net")} <span className="font-semibold text-emerald-700">{formatCurrency(filteredNet)}</span></span>
            <span className="ml-auto text-muted-foreground">{tc("to_check", { count: kpis.toReconcileCount })}</span>
          </div>
        </div>
      )}


      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(r) => r.id}
        searchPlaceholder={t("client_facture_stripe_id_notes")}
        exportFilename="transactions"
        storageKey="admin-transactions"
        stickyHeader={stickyHeader}
      />

      <PaymentDetailDialog
        paymentId={detailId}
        open={detailId !== null}
        onOpenChange={(open) => { if (!open) setDetailId(null); }}
      />
    </div>
  );
}

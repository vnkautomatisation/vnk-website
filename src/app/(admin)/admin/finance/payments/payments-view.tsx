"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CreditCard, Search, Filter, TrendingUp, RotateCcw, AlertTriangle, Coins, ArrowUpRight, ExternalLink,
  Download, CheckSquare, Square, X, MoreHorizontal, CheckCircle2, Clock, Receipt as ReceiptIcon, FileText, Eye, FolderInput,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { PaymentDetailDialog } from "@/app/(admin)/admin/transactions/payment-detail-dialog";
import { useEntityPanels } from "@/hooks/use-entity-panels";
import { cn, formatCurrency, formatDate } from "@/lib/utils";

type Payment = {
  id: number;
  invoiceId: number | null;
  invoiceNumber: string | null;
  clientId: number | null;
  clientName: string;
  companyName: string | null;
  country: string | null;
  amount: number;
  amountCad: number | null;
  currency: string;
  fxRate: number | null;
  fxRateSource: string | null;
  processingFee: number | null;
  netAmount: number | null;
  status: string;
  type: string;
  paymentMethod: string | null;
  paidAt: string | null;
  settledAt: string | null;
  payoutAt: string | null;
  cardBrand: string | null;
  cardLast4: string | null;
  cardCountry: string | null;
  cardholderName: string | null;
  stripePaymentIntentId: string | null;
  stripeChargeId: string | null;
  stripePayoutId: string | null;
  stripeBalanceTxId: string | null;
  stripeReceiptUrl: string | null;
  reconciledAt: string | null;
  reconciledBy: string | null;
  accountingCategory: string | null;
  assignedAccountantId: number | null;
  assignedAccountantName: string | null;
  accountantNotes: string | null;
  exportedAt: string | null;
  exportFormat: string | null;
  refundedAmount: number;
  refundedStatus: "none" | "partial" | "full";
};

type Kpis = {
  total: number;
  totalNet: number;
  totalFees: number;
  byType: Record<string, { count: number; total: number }>;
  reconciledCount: number;
  unreconciledCount: number;
  reconciledTotal: number;
};

type AccountantOption = { id: number; name: string };
type TypeFilter = "all" | "charge" | "refund" | "chargeback" | "chargeback_fee" | "adjustment" | "topup";
type ReconcileFilter = "all" | "reconciled" | "unreconciled" | "exported";

// Types ENTRANTS (argent arrive chez nous) — eligibles a reconciliation banque
const INBOUND_TYPES = new Set(["charge", "topup"]);

// Adapte le libelle du statut selon le type. Un "Frais retrofact." complete = mauvaise nouvelle (perte).
function getStatusDisplay(type: string, status: string): { label: string; cls: string } {
  const isSuccess = ["succeeded", "complete", "completed", "paid"].includes(status);
  if (isSuccess) {
    switch (type) {
      case "refund":         return { label: "Remboursé émis", cls: "bg-amber-100 text-amber-800 border-amber-200" };
      case "chargeback":     return { label: "Chargeback subi", cls: "bg-red-100 text-red-800 border-red-200" };
      case "chargeback_fee": return { label: "Frais prélevé", cls: "bg-red-100 text-red-800 border-red-200" };
      case "adjustment":     return { label: "Ajustement", cls: "bg-purple-100 text-purple-800 border-purple-200" };
      case "topup":          return { label: "Fonds ajoutés", cls: "bg-blue-100 text-blue-800 border-blue-200" };
      case "charge":
      default:               return { label: "Complété", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" };
    }
  }
  // Status non-success : libelle generique
  const fallback: Record<string, { label: string; cls: string }> = {
    pending: { label: "En attente", cls: "bg-amber-100 text-amber-800 border-amber-200" },
    failed: { label: "Échoué", cls: "bg-red-100 text-red-800 border-red-200" },
    canceled: { label: "Annulé", cls: "bg-gray-100 text-gray-700 border-gray-200" },
    processing: { label: "En traitement", cls: "bg-blue-100 text-blue-800 border-blue-200" },
    refunded: { label: "Remboursé", cls: "bg-gray-100 text-gray-700 border-gray-200" },
  };
  return fallback[status] ?? { label: status, cls: "bg-gray-100 text-gray-700 border-gray-200" };
}

// Type = nature de la ligne (lecture seule). Determine automatiquement par Stripe ou a la creation.
// Modifier le type fausserait les rapports comptables → pas editable depuis la UI.
const TYPE_META: Record<string, { label: string; color: string; description: string }> = {
  charge: {
    label: "Vente",
    color: "bg-emerald-100 text-emerald-700",
    description: "Argent reçu d'un client (paiement entrant)",
  },
  refund: {
    label: "Remboursement",
    color: "bg-amber-100 text-amber-700",
    description: "Argent retourné au client (sortie d'argent)",
  },
  chargeback: {
    label: "Rétrofacturation",
    color: "bg-red-100 text-red-700",
    description: "Forçage par la banque/carte du client (chargeback)",
  },
  chargeback_fee: {
    label: "Frais rétrofact.",
    color: "bg-rose-100 text-rose-700",
    description: "Frais facturés par Stripe lors d'une rétrofacturation",
  },
  adjustment: {
    label: "Ajustement",
    color: "bg-purple-100 text-purple-700",
    description: "Correction manuelle dans Stripe ou comptable",
  },
  topup: {
    label: "Fonds ajoutés",
    color: "bg-blue-100 text-blue-700",
    description: "Approvisionnement manuel du solde Stripe",
  },
};

const METHOD_OPTIONS = ["stripe", "interac", "cheque", "virement", "comptant", "manual", "autre"];

const METHOD_LABELS: Record<string, string> = {
  stripe: "Carte (Stripe)",
  interac: "Interac",
  cheque: "Chèque",
  virement: "Virement bancaire",
  comptant: "Comptant",
  manual: "Manuel",
  autre: "Autre",
};

const TYPE_TABS: { key: TypeFilter; label: string }[] = [
  { key: "all", label: "Tous" },
  { key: "charge", label: "Ventes" },
  { key: "refund", label: "Remboursements" },
  { key: "chargeback", label: "Rétrofacturations" },
  { key: "chargeback_fee", label: "Frais rétrofact." },
  { key: "adjustment", label: "Ajustements" },
  { key: "topup", label: "Fonds ajoutés" },
];

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex",
  discover: "Discover", diners: "Diners", jcb: "JCB", unionpay: "UnionPay",
};

const COUNTRY_NAMES: Record<string, string> = {
  CA: "Canada", US: "États-Unis", FR: "France", DE: "Allemagne", GB: "Royaume-Uni",
  IT: "Italie", ES: "Espagne", BE: "Belgique", CH: "Suisse", LU: "Luxembourg",
  CI: "Côte d'Ivoire", SN: "Sénégal", CM: "Cameroun", MA: "Maroc", TN: "Tunisie",
  BJ: "Bénin", TG: "Togo", BF: "Burkina Faso",
};

// SVG circle flag minimaliste, baseline-aligned avec le texte
function CountryFlag({ code, size = 10 }: { code: string | null; size?: number }) {
  if (!code) return null;
  const country = code.toUpperCase();
  // Couleur dominante adoucie (moins saturée que le drapeau brut)
  const COLORS: Record<string, string> = {
    CA: "#DC2626", US: "#1E40AF", FR: "#1E40AF", GB: "#1E40AF", DE: "#374151",
    IT: "#16A34A", ES: "#DC2626", BE: "#374151", CH: "#DC2626", LU: "#3B82F6",
    CI: "#F59E0B", SN: "#16A34A", CM: "#16A34A", MA: "#DC2626", TN: "#DC2626",
    BJ: "#16A34A", TG: "#16A34A", BF: "#DC2626",
  };
  const fill = COLORS[country] ?? "#94A3B8";
  return (
    <span
      title={COUNTRY_NAMES[country] ?? country}
      className="inline-block rounded-full align-middle shrink-0"
      style={{ width: size, height: size, backgroundColor: fill }}
    />
  );
}

// Cellule éditable inline (clic → select)
function EditableSelectCell({
  value,
  options,
  onChange,
  display,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => Promise<void> | void;
  display: (v: string) => React.ReactNode;
}) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!editing) {
    return (
      <button
        onClick={(e) => { e.stopPropagation(); setEditing(true); }}
        className="text-left hover:ring-1 hover:ring-[#0F2D52]/40 rounded px-1 py-0.5 -mx-1 -my-0.5"
        title="Cliquer pour modifier"
      >
        {display(value)}
      </button>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={value}
        onValueChange={async (v) => {
          if (v === value) { setEditing(false); return; }
          setBusy(true);
          try { await onChange(v); } finally { setBusy(false); setEditing(false); }
        }}
        open
        onOpenChange={(o) => !o && setEditing(false)}
      >
        <SelectTrigger className="h-7 w-[140px] text-xs" disabled={busy}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value} className="text-xs">{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function PaymentsView({
  payments,
  accountants,
  methodList,
  statusList,
  countryList,
  kpis,
}: {
  payments: Payment[];
  accountants: AccountantOption[];
  methodList: string[];
  statusList: string[];
  countryList: string[];
  kpis: Kpis;
}) {
  const router = useRouter();
  const { open: openEntity } = useEntityPanels();

  // Filtres principaux
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [currencyFilter, setCurrencyFilter] = useState<string>("all");

  // Filtres avancés (Popover)
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [methodFilter, setMethodFilter] = useState<string>("all");
  const [reconcileFilter, setReconcileFilter] = useState<ReconcileFilter>("all");
  const [countryFilter, setCountryFilter] = useState<string>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const advancedActive = (dateFrom ? 1 : 0) + (dateTo ? 1 : 0)
    + (statusFilter !== "all" ? 1 : 0) + (methodFilter !== "all" ? 1 : 0)
    + (reconcileFilter !== "all" ? 1 : 0) + (countryFilter !== "all" ? 1 : 0);

  const clearAdvanced = () => {
    setDateFrom(""); setDateTo("");
    setStatusFilter("all"); setMethodFilter("all"); setReconcileFilter("all");
    setCountryFilter("all");
  };

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [assignAccountantId, setAssignAccountantId] = useState<string>("");
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [categoryValue, setCategoryValue] = useState("");

  // Détail paiement (modal réutilisé)
  const [detailPaymentId, setDetailPaymentId] = useState<number | null>(null);

  // Modal preview PDF (facture / reçu)
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; downloadName?: string } | null>(null);

  // Patch d'un paiement (type / méthode)
  const patchPayment = async (id: number, data: Record<string, unknown>) => {
    try {
      const res = await fetch(`/api/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success("Paiement modifié");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  // Sticky scroll
  const sentinelRef = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting), { threshold: 0 });
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const currencies = useMemo(() => {
    const set = new Set<string>();
    payments.forEach((p) => set.add(p.currency));
    return Array.from(set).sort();
  }, [payments]);

  const filtered = useMemo(() => {
    let result = payments;
    if (typeFilter !== "all") result = result.filter((p) => (p.type ?? "charge") === typeFilter);
    if (currencyFilter !== "all") result = result.filter((p) => p.currency === currencyFilter);
    if (statusFilter !== "all") result = result.filter((p) => p.status === statusFilter);
    if (methodFilter !== "all") result = result.filter((p) => p.paymentMethod === methodFilter);
    if (countryFilter !== "all") result = result.filter((p) => (p.country ?? "CA") === countryFilter);
    if (reconcileFilter === "reconciled") result = result.filter((p) => !!p.reconciledAt);
    else if (reconcileFilter === "unreconciled") result = result.filter((p) => !p.reconciledAt);
    else if (reconcileFilter === "exported") result = result.filter((p) => !!p.exportedAt);
    if (dateFrom) {
      const t = new Date(dateFrom).getTime();
      result = result.filter((p) => p.paidAt && new Date(p.paidAt).getTime() >= t);
    }
    if (dateTo) {
      const t = new Date(dateTo).getTime() + 86400000;
      result = result.filter((p) => p.paidAt && new Date(p.paidAt).getTime() <= t);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((p) =>
        p.clientName.toLowerCase().includes(q) ||
        (p.companyName?.toLowerCase().includes(q) ?? false) ||
        (p.invoiceNumber?.toLowerCase().includes(q) ?? false) ||
        (p.stripePaymentIntentId?.toLowerCase().includes(q) ?? false) ||
        (p.cardLast4?.includes(q) ?? false) ||
        (p.cardholderName?.toLowerCase().includes(q) ?? false)
      );
    }
    return result;
  }, [payments, typeFilter, currencyFilter, statusFilter, methodFilter, countryFilter, reconcileFilter, dateFrom, dateTo, searchQuery]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((p) => selectedIds.has(p.id));
  const someFilteredSelected = filtered.some((p) => selectedIds.has(p.id));
  const toggleAll = () => {
    if (allFilteredSelected) {
      const next = new Set(selectedIds);
      filtered.forEach((p) => next.delete(p.id));
      setSelectedIds(next);
    } else {
      setSelectedIds(new Set([...selectedIds, ...filtered.map((p) => p.id)]));
    }
  };
  const toggleOne = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const selectedItems = useMemo(
    () => payments.filter((p) => selectedIds.has(p.id)),
    [payments, selectedIds],
  );
  const selectedTotal = selectedItems.reduce((s, p) => s + Number(p.amountCad ?? p.amount), 0);
  const hasMultipleAdmins = accountants.length > 1; // n'affiche dialog assignation que si pertinent

  // Bulk actions
  const callBulk = async (body: Record<string, unknown>, successMsg: string) => {
    setBusy(true);
    try {
      const res = await fetch("/api/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIds: Array.from(selectedIds), ...body }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      const data = await res.json();
      toast.success(`${successMsg} (${data.count})`);
      setSelectedIds(new Set());
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setBusy(false);
    }
  };

  const bulkReconcile = () => callBulk({ action: "reconcile" }, "Confirmés reçus");
  const bulkUnreconcile = () => callBulk({ action: "unreconcile" }, "Confirmations retirées");
  const bulkMarkExported = (fmt: string) => callBulk({ action: "mark_exported", exportFormat: fmt }, `Marqués exportés (${fmt})`);
  const bulkAssign = () => {
    if (!assignAccountantId) return;
    callBulk({ action: "assign_accountant", accountantId: Number(assignAccountantId) }, "Comptable assigné");
    setAssignDialogOpen(false);
    setAssignAccountantId("");
  };
  const bulkSetCategory = () => {
    if (!categoryValue.trim()) return;
    callBulk({ action: "set_category", category: categoryValue.trim() }, "Catégorie appliquée");
    setCategoryDialogOpen(false);
    setCategoryValue("");
  };

  // Export comptable
  const handleExport = async (format: "csv" | "quickbooks" | "sage" | "acomba") => {
    const ids = selectedIds.size > 0 ? Array.from(selectedIds) : filtered.map((p) => p.id);
    if (ids.length === 0) {
      toast.error("Aucun paiement à exporter");
      return;
    }
    try {
      const res = await fetch(`/api/payments/export?format=${format}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIds: ids }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur export");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `paiements_${format}_${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Export ${format.toUpperCase()} téléchargé (${ids.length} entrées)`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const columns: Column<Payment>[] = [
    {
      key: "select",
      header: (
        <button onClick={toggleAll} aria-label="Tout sélectionner" className="flex items-center">
          {allFilteredSelected ? (
            <CheckSquare className="h-3.5 w-3.5 text-[#0F2D52]" />
          ) : someFilteredSelected ? (
            <CheckSquare className="h-3.5 w-3.5 text-[#0F2D52]/50" />
          ) : (
            <Square className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      ),
      accessor: (p) => (
        <button onClick={(e) => { e.stopPropagation(); toggleOne(p.id); }} aria-label="Sélectionner">
          {selectedIds.has(p.id) ? (
            <CheckSquare className="h-3.5 w-3.5 text-[#0F2D52]" />
          ) : (
            <Square className="h-3.5 w-3.5 text-muted-foreground" />
          )}
        </button>
      ),
    },
    {
      key: "type",
      header: (
        <span
          className="inline-flex items-center gap-1"
          title="Nature de la ligne (déterminée automatiquement par Stripe ou à la création). Lecture seule pour préserver l'intégrité des rapports comptables."
        >
          Type
        </span>
      ),
      accessor: (p) => {
        const meta = TYPE_META[p.type] ?? { label: p.type, color: "bg-gray-100 text-gray-700", description: p.type };
        return (
          <span
            className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-medium", meta.color)}
            title={meta.description}
          >
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "client",
      header: "Client",
      accessor: (p) => (
        <button
          onClick={(e) => { e.stopPropagation(); p.clientId && openEntity("client", p.clientId); }}
          className="text-left hover:underline"
        >
          <div className="font-medium text-sm inline-flex items-center gap-2">
            <CountryFlag code={p.country} />
            <span>{p.clientName}</span>
          </div>
          {p.companyName && <div className="text-[10px] text-muted-foreground pl-[18px]">{p.companyName}</div>}
        </button>
      ),
      sortable: true, sortBy: (p) => p.clientName,
    },
    {
      key: "card",
      header: "Carte / méthode",
      accessor: (p) => p.cardBrand ? (
        <div className="inline-flex items-center gap-1.5">
          <span className="text-xs font-medium">{CARD_BRAND_LABELS[p.cardBrand] ?? p.cardBrand}</span>
          {p.cardLast4 && <span className="text-xs text-muted-foreground">···{p.cardLast4}</span>}
          {p.cardCountry && <CountryFlag code={p.cardCountry} />}
        </div>
      ) : (
        <EditableSelectCell
          value={p.paymentMethod ?? "manual"}
          options={METHOD_OPTIONS.map((m) => ({ value: m, label: METHOD_LABELS[m] ?? m }))}
          onChange={(v) => patchPayment(p.id, { paymentMethod: v })}
          display={(v) => <span className="text-xs">{METHOD_LABELS[v] ?? v}</span>}
        />
      ),
      hiddenOnMobile: true,
    },
    {
      key: "amount",
      header: "Montant",
      accessor: (p) => (
        <div>
          <div className={cn("font-bold tabular-nums", p.amount < 0 ? "text-red-600" : "")}>
            {p.amount < 0 ? "−" : ""}{Math.abs(p.amount).toFixed(2)} {p.currency}
          </div>
          {p.currency !== "CAD" && p.amountCad != null && (
            <div className="text-[10px] text-muted-foreground tabular-nums">
              ≈ {formatCurrency(Math.abs(p.amountCad))}
            </div>
          )}
        </div>
      ),
      sortable: true, sortBy: (p) => Math.abs(p.amount),
    },
    {
      key: "fees",
      header: "Frais",
      accessor: (p) => p.processingFee != null
        ? <span className="text-xs tabular-nums text-muted-foreground">{p.processingFee.toFixed(2)}</span>
        : <span className="text-xs text-muted-foreground italic">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "net",
      header: "Net",
      accessor: (p) => p.netAmount != null
        ? <span className="text-sm font-semibold tabular-nums">{p.netAmount.toFixed(2)}</span>
        : <span className="text-xs text-muted-foreground italic">—</span>,
      hiddenOnMobile: true,
    },
    {
      key: "paidAt",
      header: "Date",
      accessor: (p) => p.paidAt ? <span className="text-xs">{formatDate(new Date(p.paidAt))}</span> : "—",
      sortable: true, sortBy: (p) => p.paidAt ?? "",
    },
    {
      key: "status",
      header: "Statut",
      accessor: (p) => {
        const display = getStatusDisplay(p.type, p.status);
        const isInbound = INBOUND_TYPES.has(p.type);
        return (
          <div className="space-y-0.5">
            <span className={cn(
              "inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border",
              display.cls,
            )}>
              {display.label}
            </span>
            {p.refundedStatus === "full" && (
              <span
                title={`Cette vente a été entièrement remboursée (${p.refundedAmount.toFixed(2)} ${p.currency})`}
                className="inline-flex items-center gap-1 text-[9px] text-red-700 bg-red-50 px-1.5 py-0.5 rounded"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Remboursé total
              </span>
            )}
            {p.refundedStatus === "partial" && (
              <span
                title={`Cette vente a été partiellement remboursée (${p.refundedAmount.toFixed(2)} / ${Math.abs(p.amount).toFixed(2)} ${p.currency})`}
                className="inline-flex items-center gap-1 text-[9px] text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded"
              >
                <RotateCcw className="h-2.5 w-2.5" />
                Remboursé partiel
              </span>
            )}
            {/* "Confirme recu" uniquement pour les types entrants (vente / fonds ajoutes) */}
            {isInbound && p.reconciledAt && (
              <span
                title={`Confirmé reçu en banque le ${formatDate(new Date(p.reconciledAt))} — vérification que le paiement a bien été crédité (utile pour audit comptable)`}
                className="inline-flex items-center gap-1 text-[9px] text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded"
              >
                <CheckCircle2 className="h-2.5 w-2.5" />
                Confirmé reçu
              </span>
            )}
            {p.exportedAt && (
              <span
                title={`Déjà exporté vers la comptabilité (${p.exportFormat ?? "format inconnu"}) le ${formatDate(new Date(p.exportedAt))}`}
                className="inline-flex items-center gap-1 text-[9px] text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded"
              >
                <FolderInput className="h-2.5 w-2.5" />
                Exporté
              </span>
            )}
          </div>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      accessor: (p) => (
        <div className="flex items-center gap-0.5" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setDetailPaymentId(p.id)}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Voir détail du paiement"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          {p.invoiceId && p.invoiceNumber && (
            <button
              onClick={() => setPdfPreview({
                url: `/api/invoices/${p.invoiceId}/pdf`,
                title: `Facture ${p.invoiceNumber}`,
                downloadName: `facture-${p.invoiceNumber}`,
              })}
              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Prévisualiser la facture (PDF)"
            >
              <ReceiptIcon className="h-3.5 w-3.5" />
            </button>
          )}
          <button
            onClick={() => setPdfPreview({
              url: `/api/payments/${p.id}/receipt`,
              title: `Reçu paiement #${p.id}`,
              downloadName: `recu-${p.id}`,
            })}
            className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
            title="Prévisualiser le reçu VNK (PDF)"
          >
            <FileText className="h-3.5 w-3.5" />
          </button>
          {p.stripeReceiptUrl && (
            <a
              href={p.stripeReceiptUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center h-7 w-7 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
              title="Ouvrir reçu Stripe officiel"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      {/* Hero */}
      <div className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] rounded-xl px-5 py-4 text-white">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Tous les paiements
            </h1>
            <p className="text-white/70 text-xs mt-0.5">
              Vue plate de toutes les transactions individuelles · {payments.length} entrées · {currencies.length} devise{currencies.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm" className="bg-white text-[#0F2D52] hover:bg-white/90 shadow-md font-semibold">
                  <Download className="h-3.5 w-3.5 mr-1.5" />
                  Exporter
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuItem onClick={() => handleExport("csv")}>
                  <FileText className="h-3.5 w-3.5 mr-2" />
                  CSV simple
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => handleExport("quickbooks")}>
                  <FolderInput className="h-3.5 w-3.5 mr-2" />
                  QuickBooks (IIF)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("sage")}>
                  <FolderInput className="h-3.5 w-3.5 mr-2" />
                  Sage (CSV)
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExport("acomba")}>
                  <FolderInput className="h-3.5 w-3.5 mr-2" />
                  Acomba (CSV)
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button size="sm" variant="secondary" asChild className="bg-white/10 hover:bg-white/20 text-white border-white/20 backdrop-blur">
              <a href="/admin/finance/settlements">
                Rapport de règlement <ArrowUpRight className="h-3.5 w-3.5 ml-1" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Crédits</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-emerald-600 tabular-nums">{formatCurrency(kpis.byType.charge?.total ?? 0)}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.byType.charge?.count ?? 0} paiement{(kpis.byType.charge?.count ?? 0) > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Remboursés</span>
            <RotateCcw className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-amber-600 tabular-nums">{formatCurrency(Math.abs(kpis.byType.refund?.total ?? 0))}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.byType.refund?.count ?? 0} entrée{(kpis.byType.refund?.count ?? 0) > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Rétrofact.</span>
            <AlertTriangle className="h-3.5 w-3.5 text-red-500" />
          </div>
          <p className="text-lg font-bold text-red-600 tabular-nums">{formatCurrency(Math.abs(kpis.byType.chargeback?.total ?? 0))}</p>
          <p className="text-[10px] text-muted-foreground">{kpis.byType.chargeback?.count ?? 0} entrée{(kpis.byType.chargeback?.count ?? 0) > 1 ? "s" : ""}</p>
        </div>
        <div className="rounded-lg border bg-card p-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Net total</span>
            <Coins className="h-3.5 w-3.5 text-blue-500" />
          </div>
          <p className="text-lg font-bold text-[#0F2D52] tabular-nums">{formatCurrency(kpis.totalNet)}</p>
          <p className="text-[10px] text-muted-foreground">après {formatCurrency(kpis.totalFees)} de frais</p>
        </div>
        <div className="rounded-lg border bg-card p-3" title="Paiements vérifiés comme reçus en banque (utile pour audit comptable)">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Confirmés reçus</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
          </div>
          <p className="text-lg font-bold text-[#0F2D52] tabular-nums">{kpis.reconciledCount}/{kpis.total}</p>
          <p className="text-[10px] text-muted-foreground">
            {kpis.unreconciledCount > 0 ? `${kpis.unreconciledCount} à vérifier` : "Tout est vérifié"}
          </p>
        </div>
      </div>

      <div ref={sentinelRef} aria-hidden className="h-px -mt-3" />

      {/* Sticky compact bar */}
      <div
        className={cn(
          "sticky top-[64px] z-20 bg-background -mx-4 sm:-mx-5 lg:-mx-6 px-4 sm:px-5 lg:px-6 py-2 transition-shadow",
          scrolled && "shadow-sm border-b backdrop-blur"
        )}
      >
        {scrolled && (
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs mb-2 pt-1">
            <span className="font-bold text-sm text-[#0F2D52] inline-flex items-center gap-1.5 pr-3 border-r">
              <CreditCard className="h-4 w-4" />
              Tous les paiements
            </span>
            <span className="font-semibold text-[#0F2D52]">{filtered.length} affichés</span>
            <span className="text-muted-foreground">Crédits : <span className="font-semibold text-emerald-600">{formatCurrency(kpis.byType.charge?.total ?? 0)}</span></span>
            <span className="text-muted-foreground">Remb. : <span className="font-semibold text-amber-600">{formatCurrency(Math.abs(kpis.byType.refund?.total ?? 0))}</span></span>
            <span className="text-muted-foreground">Net : <span className="font-semibold">{formatCurrency(kpis.totalNet)}</span></span>
            <span className="text-muted-foreground">Confirmés : <span className="font-semibold text-emerald-600">{kpis.reconciledCount}/{kpis.total}</span></span>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[200px] max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="Client, facture, ID Stripe, last4…" className="pl-9 h-9" />
          </div>
          <div className="flex bg-muted rounded-lg p-0.5 overflow-x-auto">
            {TYPE_TABS.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setTypeFilter(tab.key)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap",
                  typeFilter === tab.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>
          {currencies.length > 1 && (
            <select
              value={currencyFilter}
              onChange={(e) => setCurrencyFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2 text-xs"
              aria-label="Filtrer par devise"
            >
              <option value="all">Toutes devises</option>
              {currencies.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          )}
          <Popover open={filtersOpen} onOpenChange={setFiltersOpen}>
            <PopoverTrigger asChild>
              <Button size="sm" variant="outline" className="h-9 gap-1.5">
                <Filter className="h-3.5 w-3.5" />
                Filtres
                {advancedActive > 0 && (
                  <span className="ml-0.5 inline-flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-[#0F2D52] text-white text-[9px] font-bold">
                    {advancedActive}
                  </span>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[340px] p-3 space-y-3" align="end">
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Période de paiement</Label>
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
                  <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Pays du client</Label>
                <Select value={countryFilter} onValueChange={setCountryFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les pays</SelectItem>
                    {countryList.map((c) => (
                      <SelectItem key={c} value={c}>
                        <span className="inline-flex items-center gap-2">
                          <CountryFlag code={c} size={10} />
                          {COUNTRY_NAMES[c] ?? c}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Statut</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les statuts</SelectItem>
                    {statusList.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">Moyen de paiement</Label>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Tous" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Toutes méthodes</SelectItem>
                    {methodList.map((m) => <SelectItem key={m} value={m} className="capitalize">{METHOD_LABELS[m] ?? m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label
                  className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold"
                  title="Confirmation que le paiement est bien arrivé en banque (vérification comptable manuelle)"
                >
                  Confirmation banque
                </Label>
                <div className="grid grid-cols-2 gap-1">
                  {(["all", "reconciled", "unreconciled", "exported"] as ReconcileFilter[]).map((k) => (
                    <button
                      key={k}
                      onClick={() => setReconcileFilter(k)}
                      className={cn(
                        "px-2 py-1.5 rounded text-[10px] font-medium border transition-colors",
                        reconcileFilter === k
                          ? "bg-[#0F2D52] text-white border-[#0F2D52]"
                          : "bg-background text-muted-foreground hover:text-foreground hover:border-foreground"
                      )}
                    >
                      {k === "all" ? "Tous" : k === "reconciled" ? "Confirmés reçus" : k === "unreconciled" ? "À vérifier" : "Déjà exportés"}
                    </button>
                  ))}
                </div>
              </div>
              {advancedActive > 0 && (
                <Button variant="ghost" size="sm" onClick={clearAdvanced} className="w-full text-xs">
                  <X className="h-3 w-3 mr-1" />Effacer les filtres
                </Button>
              )}
            </PopoverContent>
          </Popover>
          <span className="ml-auto text-xs text-muted-foreground inline-flex items-center gap-1.5">
            {filtered.length} sur {payments.length}
          </span>
        </div>
      </div>

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-[112px] z-[19] bg-[#0F2D52] text-white rounded-lg p-2.5 flex items-center gap-2 flex-wrap shadow-lg">
          <CheckSquare className="h-4 w-4 shrink-0" />
          <span className="text-sm font-medium">
            {selectedIds.size} sélectionné{selectedIds.size > 1 ? "s" : ""}
            <span className="text-white/70 ml-2 font-normal">— {formatCurrency(selectedTotal)}</span>
          </span>
          <div className="flex-1" />
          <Button size="sm" variant="secondary" className="bg-emerald-500 hover:bg-emerald-600 text-white border-0 h-7 text-xs" onClick={bulkReconcile} disabled={busy} title="Marquer comme confirmé reçu en banque">
            <CheckCircle2 className="h-3 w-3 mr-1" />Confirmer reçus
          </Button>
          <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0 h-7 text-xs" onClick={bulkUnreconcile} disabled={busy}>
            <Clock className="h-3 w-3 mr-1" />Retirer confirmation
          </Button>
          {hasMultipleAdmins && (
            <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0 h-7 text-xs" onClick={() => setAssignDialogOpen(true)} disabled={busy} title="Assigner à un comptable interne pour suivi">
              <FolderInput className="h-3 w-3 mr-1" />Comptable
            </Button>
          )}
          <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0 h-7 text-xs" onClick={() => setCategoryDialogOpen(true)} disabled={busy} title="Catégorie comptable pour export (services_recurrents, acompte...)">
            <FolderInput className="h-3 w-3 mr-1" />Catégorie
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" variant="secondary" className="bg-white/10 hover:bg-white/20 text-white border-0 h-7 text-xs">
                <Download className="h-3 w-3 mr-1" />Exporter <MoreHorizontal className="h-3 w-3 ml-1" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => { handleExport("csv"); bulkMarkExported("csv"); }}>CSV simple</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { handleExport("quickbooks"); bulkMarkExported("quickbooks"); }}>QuickBooks</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { handleExport("sage"); bulkMarkExported("sage"); }}>Sage</DropdownMenuItem>
              <DropdownMenuItem onClick={() => { handleExport("acomba"); bulkMarkExported("acomba"); }}>Acomba</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-7 text-xs" onClick={() => setSelectedIds(new Set())}>
            <X className="h-3 w-3 mr-1" />Annuler
          </Button>
        </div>
      )}

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        getRowId={(p) => p.id}
        searchPlaceholder=""
        exportFilename="paiements"
        storageKey="admin-finance-payments"
        onRowClick={(p) => setDetailPaymentId(p.id)}
      />

      {/* Modal détail paiement */}
      <PaymentDetailDialog
        paymentId={detailPaymentId}
        open={detailPaymentId !== null}
        onOpenChange={(o) => { if (!o) setDetailPaymentId(null); }}
      />

      {/* Modal prévisualisation PDF (facture ou reçu) */}
      {pdfPreview && (
        <PdfViewerModal
          open={!!pdfPreview}
          onClose={() => setPdfPreview(null)}
          pdfUrl={pdfPreview.url}
          title={pdfPreview.title}
          downloadName={pdfPreview.downloadName}
        />
      )}

      {/* Dialog assigner comptable (seulement si plusieurs admins actifs) */}
      <ConfirmDialog
        open={assignDialogOpen}
        onOpenChange={setAssignDialogOpen}
        title="Assigner un comptable"
        description={`Assigner les ${selectedIds.size} paiement(s) sélectionné(s) à un membre de l'équipe pour suivi comptable.`}
        confirmLabel="Assigner"
        variant="default"
        onConfirm={bulkAssign}
        disableConfirm={!assignAccountantId}
      >
        <div className="space-y-2 pt-2">
          <Label>Comptable interne</Label>
          <Select value={assignAccountantId} onValueChange={setAssignAccountantId}>
            <SelectTrigger><SelectValue placeholder="Sélectionner…" /></SelectTrigger>
            <SelectContent>
              {accountants.map((a) => (
                <SelectItem key={a.id} value={String(a.id)}>{a.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </ConfirmDialog>

      {/* Dialog catégorie comptable */}
      <ConfirmDialog
        open={categoryDialogOpen}
        onOpenChange={setCategoryDialogOpen}
        title="Catégorie comptable"
        description={`Appliquer une catégorie comptable sur ${selectedIds.size} paiement(s) — utile pour les exports vers QuickBooks/Sage/Acomba.`}
        confirmLabel="Appliquer"
        variant="default"
        onConfirm={bulkSetCategory}
        disableConfirm={!categoryValue.trim()}
      >
        <div className="space-y-2 pt-2">
          <Label>Catégorie</Label>
          <Input
            value={categoryValue}
            onChange={(e) => setCategoryValue(e.target.value)}
            placeholder="services_recurrents, acompte, solde, frais…"
            list="cat-suggestions"
          />
          <datalist id="cat-suggestions">
            <option value="services_recurrents" />
            <option value="services_unique" />
            <option value="acompte" />
            <option value="solde" />
            <option value="frais" />
            <option value="autre" />
          </datalist>
        </div>
      </ConfirmDialog>
    </div>
  );
}

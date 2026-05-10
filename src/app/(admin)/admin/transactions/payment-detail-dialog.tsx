"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  CreditCard,
  Receipt,
  RotateCcw,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ArrowRight,
  FileText,
  Banknote,
  Globe,
  Calendar,
  Building2,
  User,
  Coins,
  FolderInput,
  Edit3,
  Save,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime, cn } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/status-badge";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";

const TYPE_LABELS: Record<string, string> = {
  charge: "Encaissement",
  refund: "Remboursement",
  chargeback: "Rétrofacturation",
  chargeback_fee: "Frais de rétrofact.",
  adjustment: "Ajustement",
  topup: "Apport de fonds",
};

const METHOD_LABELS: Record<string, string> = {
  stripe: "Carte (Stripe)",
  interac: "Interac",
  cheque: "Chèque",
  virement: "Virement bancaire",
  comptant: "Comptant",
  manual: "Manuel",
  autre: "Autre",
};

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex",
  discover: "Discover", diners: "Diners", jcb: "JCB", unionpay: "UnionPay",
};

const COUNTRY_NAMES: Record<string, string> = {
  CA: "Canada", US: "États-Unis", FR: "France", DE: "Allemagne", GB: "Royaume-Uni",
  IT: "Italie", ES: "Espagne", BE: "Belgique", CH: "Suisse", LU: "Luxembourg",
  CI: "Côte d'Ivoire", SN: "Sénégal", CM: "Cameroun", MA: "Maroc", TN: "Tunisie",
};

type PaymentDetail = {
  payment: {
    id: number;
    amount: number | string;
    currency: string;
    status: string;
    type: string | null;
    paymentMethod: string | null;
    stripePaymentIntentId: string | null;
    stripeChargeId: string | null;
    stripeBalanceTxId: string | null;
    stripePayoutId: string | null;
    stripeReceiptUrl: string | null;
    stripeReceiptNumber: string | null;
    stripeReceiptEmail: string | null;
    paidAt: string | null;
    settledAt: string | null;
    payoutAt: string | null;
    processingFee: number | string | null;
    netAmount: number | string | null;
    amountCad: number | string | null;
    fxRate: number | string | null;
    fxRateSource: string | null;
    fxRateDate: string | null;
    cardBrand: string | null;
    cardLast4: string | null;
    cardCountry: string | null;
    cardholderName: string | null;
    reconciledAt: string | null;
    reconciledBy: string | null;
    accountingCategory: string | null;
    accountantNotes: string | null;
    exportedAt: string | null;
    exportFormat: string | null;
    createdAt: string;
    client?: { id: number; fullName: string; companyName: string | null; email: string } | null;
    invoice?: { id: number; invoiceNumber: string; title: string; amountTtc: number | string } | null;
  };
  orderEvents: Array<{
    id: number;
    type: string;
    amount: number | string | null;
    currency: string | null;
    createdAt: string;
    ipAddress: string | null;
    metadata: unknown;
  }>;
  refunds: Array<{
    id: number;
    refundNumber: string;
    amount: number | string;
    status: string;
    reason: string;
    stripeRefundId: string | null;
    processedAt: string | null;
    createdAt: string;
  }>;
  dispute: {
    id: number;
    title: string;
    status: string;
    priority: string | null;
    openedAt: string;
    stripeDisputeId: string | null;
  } | null;
};

function Section({ title, icon: Icon, children, action }: {
  title: string;
  icon?: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <section className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h3 className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground inline-flex items-center gap-1.5">
          {Icon && <Icon className="h-3 w-3" />}
          {title}
        </h3>
        {action}
      </div>
      <div className="rounded-md border bg-card divide-y">{children}</div>
    </section>
  );
}

function Row({ label, value, mono }: { label: React.ReactNode; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={cn("text-right min-w-0", mono && "font-mono text-[10px] truncate max-w-[60%]")}>{value}</span>
    </div>
  );
}

export function PaymentDetailDialog({
  paymentId,
  open,
  onOpenChange,
}: {
  paymentId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const [data, setData] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; downloadName?: string } | null>(null);

  // Édition des champs comptables inline
  const [editingAccounting, setEditingAccounting] = useState(false);
  const [savingAccounting, setSavingAccounting] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const reload = async () => {
    if (!paymentId) return;
    const r = await fetch(`/api/payments/${paymentId}`);
    if (r.ok) {
      const d = await r.json();
      setData(d);
      setEditCategory(d.payment.accountingCategory ?? "");
      setEditNotes(d.payment.accountantNotes ?? "");
    }
  };

  useEffect(() => {
    if (!open || !paymentId) {
      setData(null);
      setEditingAccounting(false);
      return;
    }
    setLoading(true);
    fetch(`/api/payments/${paymentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d: PaymentDetail) => {
        setData(d);
        setEditCategory(d.payment.accountingCategory ?? "");
        setEditNotes(d.payment.accountantNotes ?? "");
      })
      .catch(() => toast.error("Impossible de charger le détail"))
      .finally(() => setLoading(false));
  }, [open, paymentId]);

  const saveAccounting = async () => {
    if (!paymentId) return;
    setSavingAccounting(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          accountingCategory: editCategory.trim() || null,
          accountantNotes: editNotes.trim() || null,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success("Comptabilité mise à jour");
      setEditingAccounting(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setSavingAccounting(false);
    }
  };

  const toggleReconciled = async () => {
    if (!data || !paymentId) return;
    const action = data.payment.reconciledAt ? "unreconcile" : "reconcile";
    try {
      const res = await fetch("/api/payments/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ paymentIds: [paymentId], action }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Erreur");
      }
      toast.success(action === "reconcile" ? "Confirmé reçu en banque" : "Confirmation retirée");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    }
  };

  const processStripeRefund = async (refundId: number) => {
    if (!confirm("Exécuter le remboursement via Stripe ? L'argent sera vraiment retourné au client.")) return;
    setProcessing(refundId);
    try {
      const res = await fetch(`/api/refunds/${refundId}/process-stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "requested_by_customer" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Erreur");
      toast.success("Remboursement Stripe émis");
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setProcessing(null);
    }
  };

  const eventColor = (type: string): string => {
    if (type === "paid" || type === "succeeded") return "text-emerald-600";
    if (type === "failed") return "text-red-600";
    if (type === "refunded") return "text-amber-600";
    if (type === "dispute_opened" || type === "dispute_updated") return "text-rose-600";
    return "text-slate-600";
  };

  const eventIcon = (type: string) => {
    if (type === "paid" || type === "succeeded") return <CheckCircle2 className="h-3.5 w-3.5" />;
    if (type === "failed") return <XCircle className="h-3.5 w-3.5" />;
    if (type === "refunded") return <RotateCcw className="h-3.5 w-3.5" />;
    if (type === "dispute_opened" || type === "dispute_updated") return <AlertCircle className="h-3.5 w-3.5" />;
    return <Clock className="h-3.5 w-3.5" />;
  };

  const canRefundViaStripe = data?.payment.stripePaymentIntentId
    && (data.payment.status === "succeeded" || data.payment.status === "paid");

  const p = data?.payment;
  const isStripe = !!p?.stripeChargeId || !!p?.stripePaymentIntentId;
  const hasFx = p && p.currency.toUpperCase() !== "CAD" && p.amountCad != null;
  const hasFees = p?.processingFee != null;
  const hasCard = !!p?.cardBrand;
  const isReconciled = !!p?.reconciledAt;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5 space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Détail paiement
            {p && <span className="text-white/60 text-xs font-mono ml-2">#{p.id}</span>}
          </DialogTitle>
          <DialogDescription className="text-white/70 text-xs">
            {p?.type ? TYPE_LABELS[p.type] ?? p.type : "Paiement"}
            {p?.paymentMethod && ` · ${METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod}`}
            {isStripe ? " · Stripe" : " · Manuel"}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {loading && <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>}
          {!loading && !data && <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>}

          {data && p && (
            <>
              {/* Sommaire principal — 3 cartes */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Montant</p>
                  <p className={cn("text-xl font-bold mt-1 tabular-nums", Number(p.amount) < 0 && "text-red-600")}>
                    {Number(p.amount) < 0 ? "−" : ""}{Math.abs(Number(p.amount)).toFixed(2)} {p.currency.toUpperCase()}
                  </p>
                  {hasFx && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
                      ≈ {formatCurrency(Math.abs(Number(p.amountCad)))} CAD
                    </p>
                  )}
                </div>
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Statut</p>
                  <div className="mt-1.5"><StatusBadge status={p.status} /></div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {p.paymentMethod ? METHOD_LABELS[p.paymentMethod] ?? p.paymentMethod : "—"}
                  </p>
                </div>
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Net reçu</p>
                  <p className="text-xl font-bold mt-1 tabular-nums text-emerald-700">
                    {hasFees && p.netAmount != null
                      ? `${Number(p.netAmount).toFixed(2)}`
                      : `${Number(p.amount).toFixed(2)}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {hasFees && p.processingFee != null
                      ? `après ${Number(p.processingFee).toFixed(2)} de frais`
                      : "aucun frais"}
                  </p>
                </div>
              </div>

              {/* Section Client + Facture */}
              <Section title="Client & facture" icon={User}>
                {p.client && (
                  <Row label="Client" value={
                    <a
                      href={`/admin/clients?openClient=${p.client.id}`}
                      className="hover:underline inline-flex items-center gap-1"
                    >
                      {p.client.fullName}
                      <ExternalLink className="h-2.5 w-2.5 opacity-60" />
                    </a>
                  } />
                )}
                {p.client?.companyName && (
                  <Row label="Entreprise" value={<span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {p.client.companyName}</span>} />
                )}
                {p.client?.email && (
                  <Row label="Courriel" value={<a href={`mailto:${p.client.email}`} className="hover:underline">{p.client.email}</a>} />
                )}
                {p.invoice && (
                  <Row label="Facture" value={
                    <button
                      onClick={() => setPdfPreview({
                        url: `/api/invoices/${p.invoice!.id}/pdf`,
                        title: `Facture ${p.invoice!.invoiceNumber}`,
                        downloadName: `facture-${p.invoice!.invoiceNumber}`,
                      })}
                      className="hover:underline font-mono"
                    >
                      {p.invoice.invoiceNumber}
                    </button>
                  } />
                )}
              </Section>

              {/* Section Dates clés */}
              <Section title="Dates clés" icon={Calendar}>
                <Row label="Initié" value={formatDateTime(new Date(p.createdAt))} />
                {p.paidAt && <Row label="Payé" value={formatDateTime(new Date(p.paidAt))} />}
                {p.settledAt && (
                  <Row
                    label={<span title="Date à laquelle Stripe a rendu les fonds disponibles dans le solde">Réglé (Stripe)</span>}
                    value={formatDate(new Date(p.settledAt))}
                  />
                )}
                {p.payoutAt && (
                  <Row
                    label={<span title="Date à laquelle Stripe a versé les fonds vers votre banque">Versé en banque</span>}
                    value={formatDate(new Date(p.payoutAt))}
                  />
                )}
                {!p.settledAt && !p.payoutAt && isStripe && (
                  <p className="px-3 py-2 text-[10px] italic text-muted-foreground">Dates de règlement/versement non encore reçues de Stripe</p>
                )}
              </Section>

              {/* Section Carte (si paiement Stripe avec card details) */}
              {hasCard && (
                <Section title="Identifiants carte" icon={CreditCard}>
                  <Row label="Marque" value={CARD_BRAND_LABELS[p.cardBrand!] ?? p.cardBrand} />
                  {p.cardLast4 && <Row label="4 derniers chiffres" value={<span className="font-mono">···{p.cardLast4}</span>} />}
                  {p.cardCountry && <Row label="Pays émetteur" value={`${COUNTRY_NAMES[p.cardCountry] ?? p.cardCountry} (${p.cardCountry})`} />}
                  {p.cardholderName && <Row label="Titulaire" value={p.cardholderName} />}
                </Section>
              )}

              {/* Section Frais Stripe (si applicable) */}
              {hasFees && (
                <Section title="Frais Stripe & net" icon={Coins}>
                  <Row label="Montant brut" value={<span className="tabular-nums">{Number(p.amount).toFixed(2)} {p.currency.toUpperCase()}</span>} />
                  <Row label="Frais traitement" value={<span className="tabular-nums text-red-600">−{Number(p.processingFee).toFixed(2)}</span>} />
                  <Row label="Net reçu" value={<span className="tabular-nums font-semibold text-emerald-700">{Number(p.netAmount).toFixed(2)}</span>} />
                  {p.amount && p.processingFee && (
                    <Row label="Taux effectif" value={`${((Number(p.processingFee) / Number(p.amount)) * 100).toFixed(2)} %`} />
                  )}
                </Section>
              )}

              {/* Section Devise & change (si non-CAD avec FX) */}
              {hasFx && (
                <Section title="Devise & conversion" icon={Globe}>
                  <Row label="Devise originale" value={`${p.currency.toUpperCase()} · ${Number(p.amount).toFixed(2)}`} />
                  <Row label="Équivalent CAD" value={<span className="tabular-nums font-semibold">{formatCurrency(Number(p.amountCad))}</span>} />
                  {p.fxRate && (
                    <Row label="Taux appliqué" value={<span className="tabular-nums">{Number(p.fxRate).toFixed(6)} {p.currency.toUpperCase()}/CAD</span>} />
                  )}
                  {p.fxRateSource && p.fxRateDate && (
                    <Row label="Source taux" value={`${p.fxRateSource === "BOC" ? "Banque du Canada" : p.fxRateSource} · ${formatDate(new Date(p.fxRateDate))}`} />
                  )}
                </Section>
              )}

              {/* Section Identifiants Stripe (si paiement Stripe) */}
              {isStripe && (
                <Section title="Identifiants Stripe" icon={ExternalLink} action={
                  p.stripePaymentIntentId && (
                    <a
                      href={`https://dashboard.stripe.com/payments/${p.stripePaymentIntentId}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    >
                      Ouvrir Stripe <ExternalLink className="h-2.5 w-2.5" />
                    </a>
                  )
                }>
                  {p.stripePaymentIntentId && <Row label="Payment Intent" value={p.stripePaymentIntentId} mono />}
                  {p.stripeChargeId && <Row label="Charge" value={p.stripeChargeId} mono />}
                  {p.stripeBalanceTxId && <Row label="Balance Tx" value={p.stripeBalanceTxId} mono />}
                  {p.stripePayoutId && (
                    <Row label="Versement" value={
                      <a
                        href={`https://dashboard.stripe.com/payouts/${p.stripePayoutId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-[10px] hover:underline truncate inline-block max-w-[200px]"
                      >
                        {p.stripePayoutId}
                      </a>
                    } />
                  )}
                  {p.stripeReceiptNumber && <Row label="N° reçu Stripe" value={p.stripeReceiptNumber} mono />}
                  {p.stripeReceiptEmail && <Row label="Envoyé à" value={p.stripeReceiptEmail} />}
                </Section>
              )}

              {/* Section Workflow comptable */}
              <Section
                title="Comptabilité & réconciliation"
                icon={FolderInput}
                action={
                  !editingAccounting && (
                    <button onClick={() => setEditingAccounting(true)} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <Edit3 className="h-2.5 w-2.5" />
                      Modifier
                    </button>
                  )
                }
              >
                <div className="px-3 py-2 flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Confirmation banque</span>
                  <button
                    onClick={toggleReconciled}
                    className={cn(
                      "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                      isReconciled
                        ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                    )}
                    title={isReconciled
                      ? "Cliquer pour retirer la confirmation"
                      : "Cliquer pour marquer ce paiement comme confirmé reçu en banque"}
                  >
                    {isReconciled ? (
                      <><CheckCircle2 className="h-3 w-3" /> Confirmé reçu</>
                    ) : (
                      <><Clock className="h-3 w-3" /> À vérifier</>
                    )}
                  </button>
                </div>
                {p.reconciledAt && p.reconciledBy && (
                  <Row label="Confirmé par" value={`${p.reconciledBy} · ${formatDate(new Date(p.reconciledAt))}`} />
                )}
                {editingAccounting ? (
                  <>
                    <div className="px-3 py-2 space-y-1.5">
                      <Label className="text-[10px]">Catégorie comptable</Label>
                      <Input
                        value={editCategory}
                        onChange={(e) => setEditCategory(e.target.value)}
                        placeholder="services_recurrents, acompte, solde…"
                        list="cat-suggestions-modal"
                        className="h-8 text-xs"
                      />
                      <datalist id="cat-suggestions-modal">
                        <option value="services_recurrents" />
                        <option value="services_unique" />
                        <option value="acompte" />
                        <option value="solde" />
                        <option value="frais" />
                        <option value="autre" />
                      </datalist>
                    </div>
                    <div className="px-3 py-2 space-y-1.5">
                      <Label className="text-[10px]">Notes comptable</Label>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder="Ex: référence chèque, numéro Interac, contexte..."
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                    <div className="px-3 py-2 flex gap-2 justify-end">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingAccounting(false); setEditCategory(p.accountingCategory ?? ""); setEditNotes(p.accountantNotes ?? ""); }}>
                        Annuler
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={saveAccounting} disabled={savingAccounting}>
                        <Save className="h-3 w-3 mr-1" />
                        {savingAccounting ? "Enregistrement…" : "Enregistrer"}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Row label="Catégorie" value={p.accountingCategory ?? <span className="text-muted-foreground italic">non catégorisé</span>} />
                    {p.accountantNotes && <Row label="Notes" value={<span className="text-right whitespace-pre-wrap">{p.accountantNotes}</span>} />}
                  </>
                )}
                {p.exportedAt && (
                  <Row label="Exporté" value={
                    <span className="inline-flex items-center gap-1.5">
                      <FolderInput className="h-3 w-3 text-blue-600" />
                      {p.exportFormat?.toUpperCase() ?? "CSV"} · {formatDate(new Date(p.exportedAt))}
                    </span>
                  } />
                )}
              </Section>

              {/* Dispute */}
              {data.dispute && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-rose-900">Litige en cours</p>
                      <p className="text-xs text-rose-800 truncate">{data.dispute.title}</p>
                      <p className="text-[10px] text-rose-700 mt-1">
                        Ouvert le {formatDate(new Date(data.dispute.openedAt))} · Priorité {data.dispute.priority ?? "—"} · {data.dispute.status}
                      </p>
                      <a
                        href={`/admin/disputes?openDispute=${data.dispute.id}`}
                        className="text-[10px] text-rose-700 hover:underline mt-1 inline-flex items-center gap-1"
                      >
                        Voir le litige <ArrowRight className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline événements (seulement si > 0) */}
              {data.orderEvents.length > 0 && (
                <Section title={`Timeline événements (${data.orderEvents.length})`} icon={Clock}>
                  {data.orderEvents.map((e) => (
                    <div key={e.id} className="flex items-start gap-2 px-3 py-2 text-xs">
                      <span className={eventColor(e.type)}>{eventIcon(e.type)}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium capitalize">{e.type.replace(/_/g, " ")}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDateTime(new Date(e.createdAt))}
                          {e.amount != null && ` · ${formatCurrency(Number(e.amount))}`}
                          {e.ipAddress && ` · IP ${e.ipAddress}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </Section>
              )}

              {/* Remboursements (seulement si > 0) */}
              {data.refunds.length > 0 && (
                <Section title={`Remboursements (${data.refunds.length})`} icon={RotateCcw}>
                  {data.refunds.map((r) => (
                    <div key={r.id} className="px-3 py-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium">{r.refundNumber}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.reason}</p>
                          <p className="text-[10px] text-muted-foreground mt-1">
                            {formatDate(new Date(r.createdAt))}
                            {r.processedAt && ` · Traité ${formatDate(new Date(r.processedAt))}`}
                            {r.stripeRefundId && ` · Stripe ${r.stripeRefundId.slice(0, 14)}…`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold text-red-600">−{formatCurrency(Number(r.amount))}</p>
                          <StatusBadge status={r.status} />
                        </div>
                      </div>
                      {!r.stripeRefundId && r.status === "pending" && canRefundViaStripe && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full mt-2 text-xs"
                          disabled={processing === r.id}
                          onClick={() => processStripeRefund(r.id)}
                        >
                          <ExternalLink className="h-3 w-3 mr-1.5" />
                          {processing === r.id ? "Traitement…" : "Exécuter via Stripe"}
                        </Button>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {/* Si paiement manuel sans aucune activité Stripe — indication */}
              {!isStripe && data.orderEvents.length === 0 && data.refunds.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="inline-flex items-center gap-2 font-medium text-foreground mb-1">
                    <Banknote className="h-3.5 w-3.5" />
                    Paiement manuel
                  </p>
                  <p>Ce paiement a été saisi manuellement par l&apos;admin. Aucune trace Stripe — vérifiez la réception en banque via votre relevé puis utilisez le bouton <strong>Confirmer reçu</strong> ci-dessus.</p>
                </div>
              )}

              {/* Actions footer */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[140px]"
                  onClick={() => setPdfPreview({
                    url: `/api/payments/${p.id}/receipt`,
                    title: `Reçu de paiement #${p.id}`,
                    downloadName: `recu-${p.id}`,
                  })}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Voir le reçu VNK
                </Button>
                {p.invoice && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[140px]"
                    onClick={() => setPdfPreview({
                      url: `/api/invoices/${p.invoice!.id}/pdf`,
                      title: `Facture ${p.invoice!.invoiceNumber}`,
                      downloadName: `facture-${p.invoice!.invoiceNumber}`,
                    })}
                  >
                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                    Voir la facture
                  </Button>
                )}
                {canRefundViaStripe && data.refunds.length === 0 && p.invoice && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[160px]"
                    onClick={() => window.location.href = `/admin/refunds?newFor=${p.client?.id}&invoice=${p.invoice?.id}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                    Créer remboursement <ArrowRight className="h-3 w-3 ml-1" />
                  </Button>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
      {pdfPreview && (
        <PdfViewerModal
          open={!!pdfPreview}
          onClose={() => setPdfPreview(null)}
          pdfUrl={pdfPreview.url}
          title={pdfPreview.title}
          downloadName={pdfPreview.downloadName}
        />
      )}
    </Dialog>
  );
}

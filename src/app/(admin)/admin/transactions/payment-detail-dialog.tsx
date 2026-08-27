"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useCountryName } from "@/lib/i18n-format";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ActionTooltip } from "@/components/ui/action-tooltip";
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

const TYPE_KEYS: Record<string, string> = {
  charge: "vente",
  refund: "remboursement",
  chargeback: "retrofacturation",
  chargeback_fee: "frais_retrofact",
  adjustment: "ajustement",
  topup: "apport_fonds",
};

const METHOD_KEYS: Record<string, string> = {
  stripe: "carte_credit",
  interac: "interac",
  cheque: "cheque",
  virement: "virement_bancaire",
  comptant: "comptant",
  manual: "manuel",
  autre: "autre",
};

const CARD_BRAND_LABELS: Record<string, string> = {
  visa: "Visa", mastercard: "Mastercard", amex: "Amex",
  discover: "Discover", diners: "Diners", jcb: "JCB", unionpay: "UnionPay",
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
  const t = useTranslations("admin.transactions");
  const countryName = useCountryName();
  const tc = useTranslations("common");
  const [data, setData] = useState<PaymentDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [processing, setProcessing] = useState<number | null>(null);
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; downloadName?: string } | null>(null);


  const [editingAccounting, setEditingAccounting] = useState(false);
  const [savingAccounting, setSavingAccounting] = useState(false);
  const [editCategory, setEditCategory] = useState("");
  const [editNotes, setEditNotes] = useState("");


  const [editingType, setEditingType] = useState(false);
  const [pendingType, setPendingType] = useState<string>("");
  const [savingType, setSavingType] = useState(false);

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
      .catch(() => toast.error(t("impossible_charger_detail")))
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
        throw new Error(err.error || t("erreur"));
      }
      toast.success(t("comptabilite_mise_jour"));
      setEditingAccounting(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur"));
    } finally {
      setSavingAccounting(false);
    }
  };

  const saveType = async () => {
    if (!paymentId || !pendingType) return;
    setSavingType(true);
    try {
      const res = await fetch(`/api/payments/${paymentId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: pendingType }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || t("erreur"));
      }
      toast.success(t("type_modifie_verifiez_impact_rapports"));
      setEditingType(false);
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur"));
    } finally {
      setSavingType(false);
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
        throw new Error(err.error || t("erreur"));
      }
      toast.success(action === "reconcile" ? t("confirme_recu_banque") : t("confirmation_retiree"));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur"));
    }
  };

  const processStripeRefund = async (refundId: number) => {
    if (!confirm(t("emettre_remboursement_vers_carte_client"))) return;
    setProcessing(refundId);
    try {
      const res = await fetch(`/api/refunds/${refundId}/process-stripe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "requested_by_customer" }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || t("erreur"));
      toast.success(t("remboursement_emis_vers_carte_client"));
      await reload();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("erreur"));
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

  const isInbound = p?.type === "charge" || p?.type === "topup";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col">

        <DialogHeader className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5 space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Détail paiement
            {p && <span className="text-white/60 text-xs font-mono ml-2">#{p.id}</span>}
          </DialogTitle>
          <DialogDescription className="text-white/70 text-xs inline-flex items-center flex-wrap gap-1.5">
            {p && (
              <>
                {!editingType ? (
                  <>
                    <span>{p.type ? TYPE_KEYS[p.type] ?? p.type : t("paiement")}</span>
                    <ActionTooltip label={t("modifier_type_rare_corriger_categorisation")}>
                      <button
                        onClick={() => { setPendingType(p.type ?? "charge"); setEditingType(true); }}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 hover:bg-white/20 text-white/80 text-[10px]"
                        aria-label={t("modifier_type")}
                      >
                        <Edit3 className="h-2.5 w-2.5" />
                        {tc("edit")}
                      </button>
                    </ActionTooltip>
                    {p.paymentMethod && <span>· {METHOD_KEYS[p.paymentMethod] ?? p.paymentMethod}</span>}
                    <span>· {isStripe ? t("carte") : t("manuel")}</span>
                  </>
                ) : (
                  <span className="inline-flex items-center gap-1.5 w-full mt-1 bg-white/10 rounded p-1.5">
                    <Select value={pendingType} onValueChange={setPendingType}>
                      <SelectTrigger className="h-7 text-xs w-[160px] bg-white text-foreground border-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(TYPE_KEYS).map(([key, label]) => (
                          <SelectItem key={key} value={key} className="text-xs">{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button
                      size="sm"
                      className="h-7 text-[10px] px-2 bg-white text-[#0F2D52] hover:bg-white/90"
                      disabled={savingType || pendingType === p.type}
                      onClick={saveType}
                    >
                      {savingType ? "…" : "Enregistrer"}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 text-[10px] px-2 text-white/80 hover:bg-white/20"
                      onClick={() => setEditingType(false)}
                    >
                      {tc("cancel")}
                    </Button>
                    <span className="text-[10px] text-amber-200">{t("impact_comptable")}</span>
                  </span>
                )}
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {loading && <p className="text-sm text-muted-foreground text-center py-8">{tc("loading")}</p>}
          {!loading && !data && <p className="text-sm text-muted-foreground text-center py-8">{tc("no_data")}</p>}

          {data && p && (
            <>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{tc("amount")}</p>
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
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{tc("status")}</p>
                  <div className="mt-1.5"><StatusBadge status={p.status} /></div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {p.paymentMethod ? METHOD_KEYS[p.paymentMethod] ?? p.paymentMethod : "—"}
                  </p>
                </div>
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{t("net_recu")}</p>
                  <p className="text-xl font-bold mt-1 tabular-nums text-emerald-700">
                    {hasFees && p.netAmount != null
                      ? `${Number(p.netAmount).toFixed(2)}`
                      : `${Number(p.amount).toFixed(2)}`}
                  </p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {hasFees && p.processingFee != null
                      ? `après ${Number(p.processingFee).toFixed(2)} de frais`
                      : t("aucun_frais")}
                  </p>
                </div>
              </div>


              <Section title={t("client_facture")} icon={User}>
                {p.client && (
                  <Row label={t("client")} value={
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
                  <Row label={t("entreprise")} value={<span className="inline-flex items-center gap-1"><Building2 className="h-3 w-3" /> {p.client.companyName}</span>} />
                )}
                {p.client?.email && (
                  <Row label={t("courriel")} value={<a href={`mailto:${p.client.email}`} className="hover:underline">{p.client.email}</a>} />
                )}
                {p.invoice && (
                  <Row label={t("facture")} value={
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


              <Section title={t("dates_cles")} icon={Calendar}>
                <Row label={t("initie")} value={formatDateTime(new Date(p.createdAt))} />
                {p.paidAt && <Row label={t("paye")} value={formatDateTime(new Date(p.paidAt))} />}
                {p.settledAt && (
                  <Row
                    label={
                      <ActionTooltip label={t("date_laquelle_fonds_disponibles_solde")}>
                        <span className="cursor-help">{t("regle")}</span>
                      </ActionTooltip>
                    }
                    value={formatDate(new Date(p.settledAt))}
                  />
                )}
                {p.payoutAt && (
                  <Row
                    label={
                      <ActionTooltip label={t("date_laquelle_argent_arrive_compte")}>
                        <span className="cursor-help">{t("verse_banque")}</span>
                      </ActionTooltip>
                    }
                    value={formatDate(new Date(p.payoutAt))}
                  />
                )}
                {!p.settledAt && !p.payoutAt && isStripe && (
                  <p className="px-3 py-2 text-[10px] italic text-muted-foreground">{t("dates_reglement_versement_pas_encore")}</p>
                )}
              </Section>


              {hasCard && (
                <Section title={t("identifiants_carte")} icon={CreditCard}>
                  <Row label={t("marque")} value={CARD_BRAND_LABELS[p.cardBrand!] ?? p.cardBrand} />
                  {p.cardLast4 && <Row label={t("4_derniers_chiffres")} value={<span className="font-mono">···{p.cardLast4}</span>} />}
                  {p.cardCountry && <Row label={t("pays_emetteur")} value={`${countryName(p.cardCountry)} (${p.cardCountry})`} />}
                  {p.cardholderName && <Row label={t("titulaire")} value={p.cardholderName} />}
                </Section>
              )}


              {hasFees && (
                <Section title={t("frais_traitement_net")} icon={Coins}>
                  <Row label={t("montant_brut")} value={<span className="tabular-nums">{Number(p.amount).toFixed(2)} {p.currency.toUpperCase()}</span>} />
                  <Row label={t("frais_traitement")} value={<span className="tabular-nums text-red-600">−{Number(p.processingFee).toFixed(2)}</span>} />
                  <Row label={t("net_recu")} value={<span className="tabular-nums font-semibold text-emerald-700">{Number(p.netAmount).toFixed(2)}</span>} />
                  {p.amount && p.processingFee && (
                    <Row label={t("taux_effectif")} value={`${((Number(p.processingFee) / Number(p.amount)) * 100).toFixed(2)} %`} />
                  )}
                </Section>
              )}


              {hasFx && (
                <Section title={t("devise_conversion")} icon={Globe}>
                  <Row label={t("devise_originale")} value={`${p.currency.toUpperCase()} · ${Number(p.amount).toFixed(2)}`} />
                  <Row label={t("equivalent_cad")} value={<span className="tabular-nums font-semibold">{formatCurrency(Number(p.amountCad))}</span>} />
                  {p.fxRate && (
                    <Row label={t("taux_applique")} value={<span className="tabular-nums">{Number(p.fxRate).toFixed(6)} {p.currency.toUpperCase()}/CAD</span>} />
                  )}
                  {p.fxRateSource && p.fxRateDate && (
                    <Row label={t("source_taux")} value={`${p.fxRateSource === "BOC" ? t("banque_du_canada") : p.fxRateSource} · ${formatDate(new Date(p.fxRateDate))}`} />
                  )}
                </Section>
              )}


              {isStripe && (
                <Section title={t("references_techniques")} icon={ExternalLink} action={
                  p.stripePaymentIntentId && (
                    <ActionTooltip label={t("ouvrir_transaction_plateforme_paiement")}>
                      <a
                        href={`https://dashboard.stripe.com/payments/${p.stripePaymentIntentId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                        aria-label={t("voir_details_plateforme")}
                      >{t("payment_detail_dialog_voir_details_plateforme")}<ExternalLink className="h-2.5 w-2.5" />
                      </a>
                    </ActionTooltip>
                  )
                }>
                  {p.stripePaymentIntentId && <Row label={t("reference_paiement")} value={p.stripePaymentIntentId} mono />}
                  {p.stripeChargeId && <Row label={t("reference_transaction")} value={p.stripeChargeId} mono />}
                  {p.stripeBalanceTxId && <Row label={t("reference_solde")} value={p.stripeBalanceTxId} mono />}
                  {p.stripePayoutId && (
                    <Row label={t("reference_versement")} value={
                      <ActionTooltip label={t("ouvrir_detail_versement_plateforme_paiement")}>
                        <a
                          href={`https://dashboard.stripe.com/payouts/${p.stripePayoutId}`}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono text-[10px] hover:underline truncate inline-block max-w-[200px]"
                          aria-label={t("voir_versement_plateforme")}
                        >
                          {p.stripePayoutId}
                        </a>
                      </ActionTooltip>
                    } />
                  )}
                  {p.stripeReceiptNumber && <Row label={t("n_recu_officiel")} value={p.stripeReceiptNumber} mono />}
                  {p.stripeReceiptEmail && <Row label={t("envoye")} value={p.stripeReceiptEmail} />}
                </Section>
              )}


              <Section
                title={t("comptabilite_confirmation_banque")}
                icon={FolderInput}
                action={
                  !editingAccounting && (
                    <button onClick={() => setEditingAccounting(true)} className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                      <Edit3 className="h-2.5 w-2.5" />
                      {tc("edit")}
                    </button>
                  )
                }
              >

                {isInbound ? (
                  <>
                    <div className="px-3 py-2 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground">{t("confirmation_banque")}</span>
                      <ActionTooltip
                        label={isReconciled
                          ? t("cliquer_retirer_confirmation")
                          : t("cliquer_marquer_paiement_comme_confirme")}
                      >
                        <button
                          onClick={toggleReconciled}
                          className={cn(
                            "inline-flex items-center gap-1.5 px-2 py-1 rounded text-[10px] font-medium transition-colors",
                            isReconciled
                              ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                              : "bg-amber-100 text-amber-700 hover:bg-amber-200"
                          )}
                          aria-label={isReconciled ? t("retirer_confirmation") : t("confirmer_recu")}
                        >
                          {isReconciled ? (
                            <><CheckCircle2 className="h-3 w-3" /> {t("confirme_recu")}</>
                          ) : (
                            <><Clock className="h-3 w-3" /> {t("verifier")}</>
                          )}
                        </button>
                      </ActionTooltip>
                    </div>
                    {p.reconciledAt && p.reconciledBy && (
                      <Row label={t("confirme")} value={`${p.reconciledBy} · ${formatDate(new Date(p.reconciledAt))}`} />
                    )}
                  </>
                ) : (
                  <div className="px-3 py-2 text-[10px] text-muted-foreground italic">
                    Pas de vérification banque pour ce type ({TYPE_KEYS[p.type ?? "charge"] ?? p.type}) — il s&apos;agit d&apos;une sortie d&apos;argent ou d&apos;un frais, pas d&apos;un encaissement à vérifier.
                  </div>
                )}
                {editingAccounting ? (
                  <>
                    <div className="px-3 py-2 space-y-1.5">
                      <Label className="text-[10px]">{t("categorie_comptable")}</Label>
                      <Select value={editCategory || "none"} onValueChange={(v) => setEditCategory(v === "none" ? "" : v)}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue placeholder={t("selectionner_categorie")} />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-xs">{t("non_categorise")}</SelectItem>
                          <SelectItem value="services_recurrents" className="text-xs">{t("services_recurrents")}</SelectItem>
                          <SelectItem value="services_unique" className="text-xs">{t("services_uniques")}</SelectItem>
                          <SelectItem value="acompte" className="text-xs">{t("acompte")}</SelectItem>
                          <SelectItem value="solde" className="text-xs">{t("solde")}</SelectItem>
                          <SelectItem value="frais" className="text-xs">{t("frais")}</SelectItem>
                          <SelectItem value="autre" className="text-xs">{t("autre")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="px-3 py-2 space-y-1.5">
                      <Label className="text-[10px]">{t("notes_comptable")}</Label>
                      <Textarea
                        value={editNotes}
                        onChange={(e) => setEditNotes(e.target.value)}
                        placeholder={t("ex_reference_cheque_numero_interac")}
                        rows={2}
                        className="text-xs"
                      />
                    </div>
                    <div className="px-3 py-2 flex gap-2 justify-end">
                      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setEditingAccounting(false); setEditCategory(p.accountingCategory ?? ""); setEditNotes(p.accountantNotes ?? ""); }}>
                        {tc("cancel")}
                      </Button>
                      <Button size="sm" className="h-7 text-xs" onClick={saveAccounting} disabled={savingAccounting}>
                        <Save className="h-3 w-3 mr-1" />
                        {savingAccounting ? t("enregistrement") : t("enregistrer")}
                      </Button>
                    </div>
                  </>
                ) : (
                  <>
                    <Row label={t("categorie")} value={p.accountingCategory ?? <span className="text-muted-foreground italic">{t("non_categorise_2")}</span>} />
                    {p.accountantNotes && <Row label={t("notes")} value={<span className="text-right whitespace-pre-wrap">{p.accountantNotes}</span>} />}
                  </>
                )}
                {p.exportedAt && (
                  <Row label={t("exporte")} value={
                    <span className="inline-flex items-center gap-1.5">
                      <FolderInput className="h-3 w-3 text-blue-600" />
                      {p.exportFormat?.toUpperCase() ?? "CSV"} · {formatDate(new Date(p.exportedAt))}
                    </span>
                  } />
                )}
              </Section>


              {data.dispute && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-rose-900">{t("litige_cours")}</p>
                      <p className="text-xs text-rose-800 truncate">{data.dispute.title}</p>
                      <p className="text-[10px] text-rose-700 mt-1">
                        Ouvert le {formatDate(new Date(data.dispute.openedAt))} · Priorité {data.dispute.priority ?? "—"} · {data.dispute.status}
                      </p>
                      <a
                        href={`/admin/disputes?openDispute=${data.dispute.id}`}
                        className="text-[10px] text-rose-700 hover:underline mt-1 inline-flex items-center gap-1"
                      >{t("payment_detail_dialog_voir_le_litige")}<ArrowRight className="h-2.5 w-2.5" />
                      </a>
                    </div>
                  </div>
                </div>
              )}


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
                          {processing === r.id ? t("traitement") : t("emettre_remboursement")}
                        </Button>
                      )}
                    </div>
                  ))}
                </Section>
              )}


              {!isStripe && data.orderEvents.length === 0 && data.refunds.length === 0 && (
                <div className="rounded-md border border-dashed bg-muted/30 p-3 text-xs text-muted-foreground">
                  <p className="inline-flex items-center gap-2 font-medium text-foreground mb-1">
                    <Banknote className="h-3.5 w-3.5" />
                    {t("paiement_manuel")}
                  </p>
                  <p>{t("paiement_ete_saisi_manuellement_apos")} <strong>{t("confirmer_recu")}</strong> {t("ci_dessus")}</p>
                </div>
              )}


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
                  {t("voir_recu_vnk")}
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
                    {t("voir_facture")}
                  </Button>
                )}
                {isInbound && canRefundViaStripe && data.refunds.length === 0 && p.invoice && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[160px]"
                    onClick={() => window.location.href = `/admin/refunds?newFor=${p.client?.id}&invoice=${p.invoice?.id}`}
                  >
                    <RotateCcw className="h-3.5 w-3.5 mr-1.5" />{t("payment_detail_dialog_creer_remboursement")}<ArrowRight className="h-3 w-3 ml-1" />
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

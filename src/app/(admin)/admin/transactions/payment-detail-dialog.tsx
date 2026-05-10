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
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { StatusBadge } from "@/components/admin/status-badge";
import { PdfViewerModal } from "@/components/ui/pdf-viewer-modal";

type PaymentDetail = {
  payment: {
    id: number;
    amount: number | string;
    currency: string;
    status: string;
    paymentMethod: string | null;
    stripePaymentIntentId: string | null;
    stripeChargeId: string | null;
    paidAt: string | null;
    createdAt: string;
    client?: { id: number; fullName: string; companyName: string | null; email: string };
    invoice?: { id: number; invoiceNumber: string; title: string; amountTtc: number | string };
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
  const [pdfPreview, setPdfPreview] = useState<{ url: string; title: string; documentNumber?: string; downloadName?: string } | null>(null);

  useEffect(() => {
    if (!open || !paymentId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/payments/${paymentId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setData(d))
      .catch(() => toast.error("Impossible de charger le détail"))
      .finally(() => setLoading(false));
  }, [open, paymentId]);

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
      // Reload
      const reload = await fetch(`/api/payments/${paymentId}`);
      if (reload.ok) setData(await reload.json());
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

  const canRefundViaStripe = data?.payment.stripePaymentIntentId && (data.payment.status === "succeeded" || data.payment.status === "paid");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-0 overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header navy */}
        <DialogHeader className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5 space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5" />
            Détail paiement
          </DialogTitle>
          <DialogDescription className="text-white/70 text-xs">
            Timeline complète des événements Stripe et remboursements liés
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {loading && <p className="text-sm text-muted-foreground text-center py-8">Chargement…</p>}
          {!loading && !data && <p className="text-sm text-muted-foreground text-center py-8">Aucune donnée</p>}

          {data && (
            <>
              {/* Sommaire */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Montant</p>
                  <p className="text-xl font-bold mt-1">{formatCurrency(Number(data.payment.amount))}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{(data.payment.currency || "CAD").toUpperCase()}</p>
                </div>
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Statut</p>
                  <div className="mt-1"><StatusBadge status={data.payment.status} /></div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {data.payment.paymentMethod ?? "—"}
                  </p>
                </div>
              </div>

              {/* Infos */}
              <div className="space-y-1.5 text-sm">
                {data.payment.client && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Client</span>
                    <span className="font-medium text-right">
                      {data.payment.client.fullName}
                      {data.payment.client.companyName && (
                        <span className="block text-xs text-muted-foreground">{data.payment.client.companyName}</span>
                      )}
                    </span>
                  </div>
                )}
                {data.payment.invoice && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Facture</span>
                    <span className="font-mono text-right">{data.payment.invoice.invoiceNumber}</span>
                  </div>
                )}
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Initié</span>
                  <span>{formatDateTime(new Date(data.payment.createdAt))}</span>
                </div>
                {data.payment.paidAt && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Payé</span>
                    <span>{formatDateTime(new Date(data.payment.paidAt))}</span>
                  </div>
                )}
                {data.payment.stripePaymentIntentId && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Stripe Intent</span>
                    <span className="font-mono text-xs truncate max-w-[60%]">{data.payment.stripePaymentIntentId}</span>
                  </div>
                )}
                {data.payment.stripeChargeId && (
                  <div className="flex justify-between gap-2">
                    <span className="text-muted-foreground">Stripe Charge</span>
                    <span className="font-mono text-xs truncate max-w-[60%]">{data.payment.stripeChargeId}</span>
                  </div>
                )}
              </div>

              {/* Dispute lié */}
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
                    </div>
                  </div>
                </div>
              )}

              {/* Timeline Stripe */}
              <div>
                <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground mb-2">
                  Timeline événements ({data.orderEvents.length})
                </p>
                {data.orderEvents.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun événement Stripe enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {data.orderEvents.map((e) => (
                      <div key={e.id} className="flex items-start gap-2 p-2 rounded-md border bg-card text-xs">
                        <span className={eventColor(e.type)}>{eventIcon(e.type)}</span>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium capitalize">{e.type.replace(/_/g, " ")}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {formatDateTime(new Date(e.createdAt))}
                            {e.amount != null && ` · ${formatCurrency(Number(e.amount))}`}
                            {e.ipAddress && ` · ${e.ipAddress}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Remboursements liés */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
                    Remboursements ({data.refunds.length})
                  </p>
                </div>
                {data.refunds.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">Aucun remboursement</p>
                ) : (
                  <div className="space-y-2">
                    {data.refunds.map((r) => (
                      <div key={r.id} className="p-3 rounded-md border bg-card">
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
                            <p className="text-sm font-bold text-red-600">-{formatCurrency(Number(r.amount))}</p>
                            <StatusBadge status={r.status} />
                          </div>
                        </div>
                        {/* Bouton traiter Stripe si pending et Stripe payment */}
                        {!r.stripeRefundId && r.status === "pending" && canRefundViaStripe && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="w-full mt-2 text-xs"
                            disabled={processing === r.id}
                            onClick={() => processStripeRefund(r.id)}
                          >
                            <ExternalLink className="h-3 w-3 mr-1.5" />
                            {processing === r.id ? "Traitement…" : "Exécuter le remboursement via Stripe"}
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 min-w-[140px]"
                  onClick={() => setPdfPreview({
                    url: `/api/payments/${data.payment.id}/receipt`,
                    title: `Reçu de paiement`,
                    documentNumber: data.payment.invoice?.invoiceNumber,
                    downloadName: `recu-${data.payment.id}`,
                  })}
                >
                  <FileText className="h-3.5 w-3.5 mr-1.5" />
                  Voir le reçu
                </Button>
                {data.payment.invoice && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[140px]"
                    onClick={() => setPdfPreview({
                      url: `/api/invoices/${data.payment.invoice!.id}/pdf`,
                      title: `Facture ${data.payment.invoice!.invoiceNumber}`,
                      documentNumber: data.payment.invoice!.invoiceNumber,
                      downloadName: `facture-${data.payment.invoice!.invoiceNumber}`,
                    })}
                  >
                    <Receipt className="h-3.5 w-3.5 mr-1.5" />
                    Voir la facture
                  </Button>
                )}
                {canRefundViaStripe && data.refunds.length === 0 && data.payment.invoice && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 min-w-[160px]"
                    onClick={() => window.location.href = `/admin/refunds?newFor=${data.payment.client?.id}&invoice=${data.payment.invoice?.id}`}
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
          documentNumber={pdfPreview.documentNumber}
          downloadName={pdfPreview.downloadName}
        />
      )}
    </Dialog>
  );
}

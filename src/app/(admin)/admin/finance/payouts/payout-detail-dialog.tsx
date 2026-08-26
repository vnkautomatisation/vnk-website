"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
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
  Banknote,
  CheckCircle2,
  Clock,
  XCircle,
  ArrowDownToLine,
  ExternalLink,
  Building2,
  Calendar,
  Coins,
  AlertTriangle,
  Eye,
} from "lucide-react";
import { formatCurrency, formatDate, cn } from "@/lib/utils";
import { ActionTooltip } from "@/components/ui/action-tooltip";
import { PaymentDetailDialog } from "@/app/(admin)/admin/transactions/payment-detail-dialog";
import { TYPE_META, getStatusDisplay } from "@/lib/payment-status";

type PayoutDetail = {
  payout: {
    id: number;
    stripePayoutId: string;
    amount: number | string;
    currency: string;
    status: string;
    arrivalDate: string | null;
    initiatedAt: string;
    paidAt: string | null;
    method: string | null;
    destinationLast4: string | null;
    destinationBank: string | null;
    failureReason: string | null;
    description: string | null;
    itemCount: number;
    feeTotal: number | string;
  };
  payments: Array<{
    id: number;
    paidAt: string | null;
    settledAt: string | null;
    amount: number | string;
    currency: string;
    type: string | null;
    status: string;
    netAmount: number | string | null;
    processingFee: number | string | null;
    paymentMethod: string | null;
    client: { id: number; fullName: string; companyName: string | null } | null;
    invoice: { id: number; invoiceNumber: string } | null;
  }>;
};

const STATUS_META: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  paid: { label: "Versé", color: "bg-emerald-100 text-emerald-700", icon: CheckCircle2 },
  in_transit: { label: "En transit", color: "bg-blue-100 text-blue-700", icon: ArrowDownToLine },
  pending: { label: "En attente", color: "bg-amber-100 text-amber-700", icon: Clock },
  failed: { label: "Échoué", color: "bg-red-100 text-red-700", icon: XCircle },
  canceled: { label: "Annulé", color: "bg-gray-100 text-gray-700", icon: XCircle },
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

function Row({ label, value }: { label: React.ReactNode; value: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 px-3 py-1.5 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className="text-right min-w-0">{value}</span>
    </div>
  );
}

export function PayoutDetailDialog({
  payoutId,
  open,
  onOpenChange,
}: {
  payoutId: number | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const tc = useTranslations("common");
  const [data, setData] = useState<PayoutDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [drillPaymentId, setDrillPaymentId] = useState<number | null>(null);

  useEffect(() => {
    if (!open || !payoutId) {
      setData(null);
      return;
    }
    setLoading(true);
    fetch(`/api/payouts/${payoutId}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r)))
      .then((d) => setData(d))
      .catch(() => toast.error("Impossible de charger le détail"))
      .finally(() => setLoading(false));
  }, [open, payoutId]);

  const p = data?.payout;
  const statusMeta = p ? STATUS_META[p.status] ?? { label: p.status, color: "bg-gray-100 text-gray-700", icon: Clock } : null;
  const StatusIcon = statusMeta?.icon;
  const totalNet = data?.payments.reduce((s, x) => s + Number(x.netAmount ?? x.amount ?? 0), 0) ?? 0;
  const totalFees = data?.payments.reduce((s, x) => s + Number(x.processingFee ?? 0), 0) ?? 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-3xl p-0 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header */}
        <DialogHeader className="bg-gradient-to-br from-[#0F2D52] to-[#15406d] text-white p-5 space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Banknote className="h-5 w-5" />
            Détail du versement
            {p && <span className="text-white/60 text-xs font-mono ml-2">#{p.id}</span>}
          </DialogTitle>
          <DialogDescription className="text-white/70 text-xs inline-flex items-center flex-wrap gap-1.5">
            {p && (
              <>
                <span>{statusMeta?.label ?? p.status}</span>
                <span>· {p.method === "instant" ? "Instantané" : p.method === "standard" ? "Standard" : p.method ?? "—"}</span>
                <span>· {p.itemCount} {p.itemCount > 1 ? "paiements groupés" : "paiement"}</span>
              </>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto p-5 space-y-4 flex-1">
          {loading && <p className="text-sm text-muted-foreground text-center py-8">{tc("loading")}</p>}
          {!loading && !data && <p className="text-sm text-muted-foreground text-center py-8">{tc("no_data")}</p>}

          {data && p && statusMeta && StatusIcon && (
            <>
              {/* Sommaire — 3 cartes */}
              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Montant versé</p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{formatCurrency(Number(p.amount))}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{p.currency}</p>
                </div>
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{tc("status")}</p>
                  <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium mt-1.5", statusMeta.color)}>
                    <StatusIcon className="h-3 w-3" />
                    {statusMeta.label}
                  </span>
                </div>
                <div className="p-3 rounded-md border bg-card">
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Paiements liés</p>
                  <p className="text-xl font-bold mt-1 tabular-nums">{p.itemCount}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    Net total {formatCurrency(totalNet)}
                  </p>
                </div>
              </div>

              {/* Section : Dates clés */}
              <Section title="Dates" icon={Calendar}>
                <Row label="Initié" value={formatDate(new Date(p.initiatedAt))} />
                {p.arrivalDate && <Row label="Date d'arrivée prévue" value={formatDate(new Date(p.arrivalDate))} />}
                {p.paidAt && <Row label="Versé en banque" value={formatDate(new Date(p.paidAt))} />}
              </Section>

              {/* Section : Destination */}
              <Section title="Destination bancaire" icon={Building2}>
                <Row label="Banque" value={p.destinationBank ?? <span className="italic text-muted-foreground">—</span>} />
                <Row label="Compte" value={p.destinationLast4 ? <span className="font-mono">···{p.destinationLast4}</span> : <span className="italic text-muted-foreground">—</span>} />
                <Row label="Méthode" value={p.method === "instant" ? "Instantané (frais supplémentaires)" : p.method === "standard" ? "Standard (gratuit)" : p.method ?? "—"} />
                {p.description && <Row label="Description" value={p.description} />}
              </Section>

              {/* Section : Frais (si applicable) */}
              {(Number(p.feeTotal) > 0 || totalFees > 0) && (
                <Section title="Frais & totaux" icon={Coins}>
                  {Number(p.feeTotal) > 0 && (
                    <Row label="Frais du versement" value={<span className="tabular-nums text-red-600">−{formatCurrency(Number(p.feeTotal))}</span>} />
                  )}
                  {totalFees > 0 && (
                    <Row label="Frais cumulés des paiements" value={<span className="tabular-nums text-red-600">−{formatCurrency(totalFees)}</span>} />
                  )}
                  <Row label="Net total des paiements" value={<span className="tabular-nums font-semibold text-emerald-700">{formatCurrency(totalNet)}</span>} />
                  <Row label="Montant versé" value={<span className="tabular-nums font-bold">{formatCurrency(Number(p.amount))}</span>} />
                </Section>
              )}

              {/* Section : Échec (si applicable) */}
              {p.status === "failed" && p.failureReason && (
                <div className="p-3 rounded-md bg-rose-50 border border-rose-200">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-rose-900">Versement échoué</p>
                      <p className="text-xs text-rose-800 mt-0.5">{p.failureReason}</p>
                      <p className="text-[10px] text-rose-700 mt-1">
                        Les fonds sont retournés dans votre solde. Vérifiez les informations bancaires sur la plateforme de paiement.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Section : Paiements groupés */}
              <Section title={`Paiements composant ce versement (${data.payments.length})`} icon={Banknote}>
                {data.payments.length === 0 ? (
                  <p className="px-3 py-3 text-xs italic text-muted-foreground">Aucun paiement lié pour le moment</p>
                ) : (
                  data.payments.map((pay) => {
                    const typeMeta = TYPE_META[pay.type ?? "charge"];
                    const statusDisplay = getStatusDisplay(pay.type ?? "charge", pay.status);
                    return (
                      <div key={pay.id} className="px-3 py-2 flex items-center gap-3 hover:bg-muted/40">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="font-medium truncate max-w-[160px]">{pay.client?.fullName ?? "—"}</span>
                            {pay.invoice && <span className="font-mono text-[10px] text-muted-foreground">{pay.invoice.invoiceNumber}</span>}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            {typeMeta && (
                              <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[9px] font-medium", typeMeta.color)}>
                                {typeMeta.label}
                              </span>
                            )}
                            <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[9px] font-semibold border", statusDisplay.cls)}>
                              {statusDisplay.label}
                            </span>
                            <span className="text-[10px] text-muted-foreground">
                              {pay.paidAt ? formatDate(new Date(pay.paidAt)) : "—"}
                            </span>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-sm font-bold tabular-nums">{Number(pay.amount).toFixed(2)} {(pay.currency ?? "CAD").toUpperCase()}</p>
                          {pay.netAmount != null && Number(pay.netAmount) !== Number(pay.amount) && (
                            <p className="text-[10px] text-emerald-700 tabular-nums">Net : {Number(pay.netAmount).toFixed(2)}</p>
                          )}
                        </div>
                        <ActionTooltip label="Voir détail du paiement">
                          <button
                            onClick={() => setDrillPaymentId(pay.id)}
                            className="inline-flex items-center justify-center h-6 w-6 rounded hover:bg-muted text-muted-foreground hover:text-foreground"
                            aria-label="Voir détail du paiement"
                          >
                            <Eye className="h-3 w-3" />
                          </button>
                        </ActionTooltip>
                      </div>
                    );
                  })
                )}
              </Section>

              {/* Référence externe */}
              <Section title="Référence" icon={ExternalLink} action={
                <ActionTooltip label="Ouvrir ce versement sur la plateforme de paiement">
                  <a
                    href={`https://dashboard.stripe.com/payouts/${p.stripePayoutId}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[10px] text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                    aria-label="Ouvrir le versement sur la plateforme"
                  >
                    Voir sur la plateforme <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                </ActionTooltip>
              }>
                <Row label="Référence versement" value={<span className="font-mono text-[10px] truncate inline-block max-w-[260px]">{p.stripePayoutId}</span>} />
              </Section>

              {/* Footer */}
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>{tc("close")}</Button>
                <a
                  href={`/admin/finance/payments?payoutId=${p.stripePayoutId}`}
                  className="inline-flex items-center justify-center text-xs h-9 px-3 rounded-md bg-[#0F2D52] text-white hover:bg-[#15406d] flex-1 min-w-[160px]"
                >
                  Voir tous les paiements liés dans le tableau
                </a>
              </div>
            </>
          )}
        </div>
      </DialogContent>

      {/* Drill-down modal détail paiement */}
      <PaymentDetailDialog
        paymentId={drillPaymentId}
        open={drillPaymentId !== null}
        onOpenChange={(o) => { if (!o) setDrillPaymentId(null); }}
      />
    </Dialog>
  );
}

"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Lock, X, CheckCircle, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "");

type Invoice = {
  id: number;
  invoiceNumber: string;
  title: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
};

// ── Inner form (needs Stripe context) ───────────────────
function PaymentForm({
  invoice,
  clientInfo,
  onSuccess,
  onCancel,
}: {
  invoice: Invoice;
  clientInfo: { fullName: string; email: string; address?: string; city?: string; province?: string; postalCode?: string };
  onSuccess: () => void;
  onCancel: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [paying, setPaying] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;

    setPaying(true);
    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/portail/factures?paid=${invoice.id}`,
        receipt_email: clientInfo.email,
        payment_method_data: {
          billing_details: {
            name: clientInfo.fullName,
            email: clientInfo.email,
            address: {
              line1: clientInfo.address || undefined,
              city: clientInfo.city || undefined,
              state: clientInfo.province || undefined,
              postal_code: clientInfo.postalCode || undefined,
              country: "CA",
            },
          },
        },
      },
      redirect: "if_required",
    });

    if (error) {
      toast.error(error.message ?? "Erreur de paiement");
      setPaying(false);
    } else {
      onSuccess();
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Recap facture */}
      <div className="px-6 py-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Montant HT</span>
          <span>{formatCurrency(invoice.amountHt)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">TPS (5%)</span>
          <span>{formatCurrency(invoice.tpsAmount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">TVQ (9.975%)</span>
          <span>{formatCurrency(invoice.tvqAmount)}</span>
        </div>
        <div className="border-t pt-2 flex justify-between">
          <span className="font-semibold">Total TTC</span>
          <span className="text-xl font-bold text-[#0F2D52]">{formatCurrency(invoice.amountTtc)}</span>
        </div>
      </div>

      {/* Stripe Payment Element */}
      <div className="px-6 py-4 border-t">
        <PaymentElement
          options={{
            layout: "tabs",
            defaultValues: {
              billingDetails: {
                name: clientInfo.fullName,
                email: clientInfo.email,
                address: {
                  line1: clientInfo.address || "",
                  city: clientInfo.city || "",
                  state: clientInfo.province || "",
                  postal_code: clientInfo.postalCode || "",
                  country: "CA",
                },
              },
            },
          }}
        />
      </div>

      {/* Security info */}
      <div className="mx-6 mb-4 rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 px-3 py-2 flex items-center gap-2">
        <ShieldCheck className="h-4 w-4 text-[#0F2D52] shrink-0" />
        <span className="text-xs text-muted-foreground">Paiement securise via Stripe. Vos informations bancaires ne sont jamais stockees sur nos serveurs.</span>
      </div>

      {/* Actions */}
      <div className="px-6 py-4 border-t flex justify-end gap-3">
        <Button type="button" variant="outline" onClick={onCancel} disabled={paying}>
          Annuler
        </Button>
        <Button type="submit" className="bg-[#0F2D52] hover:bg-[#1a3a66]" disabled={!stripe || paying}>
          <Lock className="h-4 w-4 mr-2" />
          {paying ? "Traitement..." : `Payer ${formatCurrency(invoice.amountTtc)}`}
        </Button>
      </div>
    </form>
  );
}

// ── Main modal ──────────────────────────────────────────
export function StripePaymentModal({
  invoice,
  open,
  onClose,
  onPaid,
}: {
  invoice: Invoice | null;
  open: boolean;
  onClose: () => void;
  onPaid: () => void;
}) {
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [clientInfo, setClientInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !invoice) { setClientSecret(null); return; }

    setLoading(true);
    setError(null);
    fetch("/api/payments/create-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ invoiceId: invoice.id }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.clientSecret) {
          setClientSecret(data.clientSecret);
          setClientInfo(data.client);
        } else {
          setError(data.error ?? "Erreur");
        }
      })
      .catch(() => setError("Erreur de connexion"))
      .finally(() => setLoading(false));
  }, [open, invoice]);

  if (!open || !invoice) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-lg mx-4 mb-4 sm:mb-0 bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto no-scrollbar">
        {/* Header */}
        <div className="bg-[#0F2D52] px-6 py-5 text-white relative">
          <button onClick={onClose} className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="h-4 w-4 text-white/70" />
          </button>
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-white/15 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold">Payer la facture</h2>
              <p className="text-white/60 text-sm">{invoice.invoiceNumber} — {invoice.title}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="p-12 text-center">
            <div className="h-8 w-8 border-2 border-[#0F2D52] border-t-transparent rounded-full animate-spin mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">Preparation du paiement...</p>
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={onClose} className="mt-3">Fermer</Button>
          </div>
        ) : clientSecret ? (
          <Elements
            stripe={stripePromise}
            options={{
              clientSecret,
              appearance: {
                theme: "stripe",
                variables: {
                  colorPrimary: "#0F2D52",
                  borderRadius: "8px",
                },
              },
              locale: "fr",
            }}
          >
            <PaymentForm
              invoice={invoice}
              clientInfo={clientInfo}
              onSuccess={onPaid}
              onCancel={onClose}
            />
          </Elements>
        ) : null}
      </div>
    </div>
  );
}

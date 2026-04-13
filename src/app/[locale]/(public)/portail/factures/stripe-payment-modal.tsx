"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Lock, X, ShieldCheck } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

type Invoice = {
  id: number;
  invoiceNumber: string;
  title: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
};

// ── Inner form ──────────────────────────────────────────
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
  const [name, setName] = useState(clientInfo.fullName);
  const [email, setEmail] = useState(clientInfo.email);
  const [address, setAddress] = useState(clientInfo.address ?? "");
  const [city, setCity] = useState(clientInfo.city ?? "");
  const [postalCode, setPostalCode] = useState(clientInfo.postalCode ?? "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setPaying(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/portail/factures?paid=${invoice.id}`,
        receipt_email: email,
        payment_method_data: {
          billing_details: {
            name, email,
            address: { line1: address || undefined, city: city || undefined, state: clientInfo.province || undefined, postal_code: postalCode || undefined, country: "CA" },
          },
        },
      },
      redirect: "if_required",
    });

    if (error) {
      toast.error(error.message ?? "Erreur de paiement");
      setPaying(false);
    } else {
      try {
        await fetch("/api/payments/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ invoiceId: invoice.id, paymentIntentId: "stripe_confirmed" }),
        });
      } catch { /* ignore */ }
      onSuccess();
    }
  };

  const inputCls = "w-full h-9 px-3 rounded-md border bg-background text-sm focus:ring-2 focus:ring-[#0F2D52]/20 focus:border-[#0F2D52] outline-none";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row">
      {/* LEFT — Infos client + Stripe Elements */}
      <div className="flex-1 p-6 space-y-4 border-r-0 lg:border-r overflow-y-auto max-h-[70vh] no-scrollbar">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Informations de facturation</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Nom complet</label>
            <input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Courriel</label>
            <input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </div>
        </div>
        <div>
          <label className="text-xs text-muted-foreground">Adresse</label>
          <input value={address} onChange={(e) => setAddress(e.target.value)} className={inputCls} placeholder="123 rue Exemple" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-muted-foreground">Ville</label>
            <input value={city} onChange={(e) => setCity(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="text-xs text-muted-foreground">Code postal</label>
            <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} className={inputCls} />
          </div>
        </div>

        <div className="pt-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Mode de paiement</p>
          <PaymentElement options={{ layout: "tabs" }} />
        </div>
      </div>

      {/* RIGHT — Recap + bouton payer */}
      <div className="w-full lg:w-[300px] shrink-0 p-6 flex flex-col justify-between bg-muted/20">
        <div>
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-4">Resume</p>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Sous-total HT</span>
              <span>{formatCurrency(invoice.amountHt)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TPS (5%)</span>
              <span>{formatCurrency(invoice.tpsAmount)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">TVQ (9.975%)</span>
              <span>{formatCurrency(invoice.tvqAmount)}</span>
            </div>
            <div className="border-t pt-3 mt-3 flex justify-between">
              <span className="font-bold">Total TTC</span>
              <span className="text-2xl font-bold text-[#0F2D52]">{formatCurrency(invoice.amountTtc)}</span>
            </div>
          </div>

          <div className="mt-6 rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0F2D52] shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Paiement securise via Stripe. Vos donnees bancaires ne sont jamais stockees sur nos serveurs.
            </p>
          </div>
        </div>

        <div className="mt-6 space-y-2">
          <Button type="submit" className="w-full bg-[#0F2D52] hover:bg-[#1a3a66] h-11" disabled={!stripe || paying}>
            <Lock className="h-4 w-4 mr-2" />
            {paying ? "Traitement..." : `Payer ${formatCurrency(invoice.amountTtc)}`}
          </Button>
          <Button type="button" variant="outline" className="w-full" onClick={onCancel} disabled={paying}>
            Annuler
          </Button>
        </div>
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
  const [stripeInstance, setStripeInstance] = useState<ReturnType<typeof loadStripe> | null>(null);
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
        if (data.clientSecret && data.publishableKey) {
          setClientSecret(data.clientSecret);
          setClientInfo(data.client);
          setStripeInstance(loadStripe(data.publishableKey));
        } else {
          setError(data.error ?? "Stripe non configure");
        }
      })
      .catch(() => setError("Erreur de connexion"))
      .finally(() => setLoading(false));
  }, [open, invoice]);

  if (!open || !invoice) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative z-10 w-full max-w-4xl mx-4 mb-4 sm:mb-0 bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-[#0F2D52] px-6 py-4 text-white relative flex items-center gap-4">
          <button onClick={onClose} className="absolute top-3 right-3 h-8 w-8 rounded-lg hover:bg-white/10 flex items-center justify-center">
            <X className="h-4 w-4 text-white/70" />
          </button>
          <div className="h-10 w-10 rounded-xl bg-white/15 flex items-center justify-center">
            <CreditCard className="h-5 w-5 text-white" />
          </div>
          <div>
            <h2 className="font-bold">Payer la facture</h2>
            <p className="text-white/60 text-sm">{invoice.invoiceNumber} — {invoice.title}</p>
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
        ) : clientSecret && stripeInstance ? (
          <Elements
            stripe={stripeInstance}
            options={{
              clientSecret,
              appearance: { theme: "stripe", variables: { colorPrimary: "#0F2D52", borderRadius: "8px" } },
              locale: "fr",
            }}
          >
            <PaymentForm invoice={invoice} clientInfo={clientInfo} onSuccess={onPaid} onCancel={onClose} />
          </Elements>
        ) : null}
      </div>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, PaymentElement, AddressElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CreditCard, Lock, X, ShieldCheck, ChevronRight, ChevronLeft, MapPin, CheckCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Invoice = {
  id: number;
  invoiceNumber: string;
  title: string;
  amountHt: number;
  tpsAmount: number;
  tvqAmount: number;
  amountTtc: number;
};

const STEPS = [
  { label: "Adresse", icon: MapPin },
  { label: "Paiement", icon: CreditCard },
  { label: "Confirmer", icon: CheckCircle },
];

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
  const [step, setStep] = useState(0);
  const [validating, setValidating] = useState(false);

  const handleNext = async () => {
    if (!elements) return;
    setValidating(true);
    // Valider les elements Stripe de l'etape actuelle
    const { error } = await elements.submit();
    setValidating(false);
    if (error) {
      toast.error(error.message ?? "Veuillez completer tous les champs");
      return;
    }
    setStep(step + 1);
  };

  const handleSubmit = async () => {
    if (!stripe || !elements) return;
    setPaying(true);

    const { error } = await stripe.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/portail/factures?paid=${invoice.id}`,
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

  return (
    <div className="flex flex-col lg:flex-row">
      {/* LEFT — Stepper + contenu etape */}
      <div className="flex-1 border-r-0 lg:border-r">
        {/* Stepper dots */}
        <div className="px-6 pt-5 pb-3">
          <div className="flex items-center justify-center gap-0">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < step;
              const active = i === step;
              return (
                <div key={i} className="flex items-center">
                  <button
                    type="button"
                    onClick={() => i < step && setStep(i)}
                    className={cn(
                      "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all",
                      done ? "bg-emerald-50 text-emerald-700 cursor-pointer" :
                      active ? "bg-[#0F2D52] text-white" :
                      "bg-muted text-muted-foreground"
                    )}
                  >
                    {done ? <CheckCircle className="h-3.5 w-3.5" /> : <Icon className="h-3.5 w-3.5" />}
                    <span className="hidden sm:inline">{s.label}</span>
                    <span className="sm:hidden">{i + 1}</span>
                  </button>
                  {i < STEPS.length - 1 && (
                    <div className={cn("w-8 h-0.5 mx-1", done ? "bg-emerald-400" : "bg-muted")} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Contenu etape */}
        <div className="px-6 pb-5 min-h-[300px]">
          {/* Etape 1 — Adresse */}
          <div className={step === 0 ? "block" : "hidden"}>
            <AddressElement
              options={{
                mode: "billing",
                defaultValues: {
                  name: clientInfo.fullName,
                  address: {
                    line1: clientInfo.address ?? "",
                    city: clientInfo.city ?? "",
                    state: clientInfo.province ?? "",
                    postal_code: clientInfo.postalCode ?? "",
                    country: "CA",
                  },
                },
                fields: { phone: "always" },
                display: { name: "full" },
              }}
            />
          </div>

          {/* Etape 2 — Mode de paiement */}
          <div className={step === 1 ? "block" : "hidden"}>
            <PaymentElement options={{ layout: "tabs" }} />
          </div>

          {/* Etape 3 — Verification */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-2 text-sm">
                <p className="font-semibold text-[#0F2D52]">Verification avant paiement</p>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Facture</span>
                  <span className="font-medium">{invoice.invoiceNumber}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Description</span>
                  <span className="font-medium">{invoice.title}</span>
                </div>
                <div className="flex justify-between border-t pt-2">
                  <span className="font-bold">Montant</span>
                  <span className="font-bold text-[#0F2D52]">{formatCurrency(invoice.amountTtc)}</span>
                </div>
              </div>
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700">
                  Vos informations sont pretes. Cliquez sur "Payer" pour finaliser le paiement.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Navigation etapes */}
        <div className="px-6 py-4 border-t flex justify-between">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => step === 0 ? onCancel() : setStep(step - 1)}
          >
            <ChevronLeft className="h-4 w-4 mr-1" />
            {step === 0 ? "Annuler" : "Precedent"}
          </Button>
          {step < 2 ? (
            <Button
              type="button"
              size="sm"
              className="bg-[#0F2D52] hover:bg-[#1a3a66]"
              onClick={handleNext}
              disabled={validating}
            >
              {validating ? "Verification..." : "Suivant"}
              {!validating && <ChevronRight className="h-4 w-4 ml-1" />}
            </Button>
          ) : null}
        </div>
      </div>

      {/* RIGHT — Resume fixe */}
      <div className="w-full lg:w-[280px] shrink-0 p-6 flex flex-col justify-between bg-muted/20">
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
              <span className="font-bold">Total</span>
              <span className="text-2xl font-bold text-[#0F2D52]">{formatCurrency(invoice.amountTtc)}</span>
            </div>
          </div>

          <div className="mt-5 rounded-lg bg-[#0F2D52]/5 border border-[#0F2D52]/10 p-3 flex items-start gap-2">
            <ShieldCheck className="h-4 w-4 text-[#0F2D52] shrink-0 mt-0.5" />
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Securise via Stripe. Vos donnees bancaires ne transitent jamais par nos serveurs.
            </p>
          </div>
        </div>

        <div className="mt-5">
          <Button
            type="button"
            className="w-full bg-[#0F2D52] hover:bg-[#1a3a66] h-11"
            disabled={!stripe || paying || step < 2}
            onClick={handleSubmit}
          >
            <Lock className="h-4 w-4 mr-2" />
            {paying ? "Traitement..." : `Payer ${formatCurrency(invoice.amountTtc)}`}
          </Button>
        </div>
      </div>
    </div>
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

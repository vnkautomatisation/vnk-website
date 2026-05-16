// Stripe service wrapper — lit les clés depuis Integration.credentials (UI), puis Settings, puis ENV
import "server-only";
import { getIntegrationCredential } from "@/lib/integrations/credentials";

// Note : l'import de Stripe est lazy pour éviter d'exiger la clé à l'init
// Le client est invalidé en cas de changement de credentials (via cache TTL)
let _stripeClient: unknown = null;
let _stripeKey: string | null = null;

export async function getStripe() {
  const { value: secretKey } = await getIntegrationCredential("stripe", "secret_key", "STRIPE_SECRET_KEY");
  if (!secretKey) return null;

  // Réinitialise le client si la clé a changé (utilisateur a mis à jour l'intégration)
  if (_stripeClient && _stripeKey === secretKey) return _stripeClient;

  const Stripe = (await import("stripe")).default;
  _stripeClient = new Stripe(secretKey, {
    apiVersion: "2024-12-18.acacia" as any,
  });
  _stripeKey = secretKey;
  return _stripeClient;
}

export function resetStripeClient() {
  _stripeClient = null;
  _stripeKey = null;
}

export async function createPaymentIntent(params: {
  amount: number;
  currency?: string;
  clientEmail: string;
  invoiceId: number;
  description?: string;
}) {
  const stripe = (await getStripe()) as any;
  if (!stripe) throw new Error("Stripe non configuré");

  return stripe.paymentIntents.create({
    amount: Math.round(params.amount * 100),
    currency: (params.currency ?? "cad").toLowerCase(),
    receipt_email: params.clientEmail,
    description: params.description,
    metadata: {
      invoice_id: String(params.invoiceId),
    },
    automatic_payment_methods: { enabled: true },
  });
}

export async function createCheckoutSession(params: {
  amount: number;
  currency?: string;
  clientEmail: string;
  invoiceId: number;
  invoiceNumber: string;
  description?: string;
  successUrl: string;
  cancelUrl: string;
}) {
  const stripe = (await getStripe()) as any;
  if (!stripe) throw new Error("Stripe non configure");

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    customer_email: params.clientEmail,
    line_items: [
      {
        price_data: {
          currency: (params.currency ?? "cad").toLowerCase(),
          product_data: {
            name: `Facture ${params.invoiceNumber}`,
            description: params.description,
          },
          unit_amount: Math.round(params.amount * 100),
        },
        quantity: 1,
      },
    ],
    metadata: {
      invoice_id: String(params.invoiceId),
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });

  return session;
}

export async function refundPayment(params: {
  paymentIntentId: string;
  amount?: number;
  reason?: "duplicate" | "fraudulent" | "requested_by_customer";
}) {
  const stripe = (await getStripe()) as any;
  if (!stripe) throw new Error("Stripe non configuré");

  return stripe.refunds.create({
    payment_intent: params.paymentIntentId,
    amount: params.amount ? Math.round(params.amount * 100) : undefined,
    reason: params.reason ?? "requested_by_customer",
  });
}

export async function verifyWebhookSignature(
  rawBody: string,
  signature: string
) {
  const stripe = (await getStripe()) as any;
  if (!stripe) throw new Error("Stripe non configuré");
  const { value: secret } = await getIntegrationCredential("stripe", "webhook_secret", "STRIPE_WEBHOOK_SECRET");
  if (!secret) throw new Error("Webhook secret manquant");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// ─── Données enrichies pour reporting (CSV style Wix) ───────
// Récupère une Charge avec balance_transaction expand pour avoir frais, net, settled_at, etc.
export async function getEnrichedChargeData(chargeId: string): Promise<{
  fee: number | null;            // frais Stripe en unité majeure (ex: 0.33 $)
  net: number | null;            // montant net après frais
  settledAt: Date | null;        // available_on de la balance transaction
  balanceTxId: string | null;    // ID transaction balance
  payoutId: string | null;       // ID versement (si déjà groupé)
  cardBrand: string | null;
  cardLast4: string | null;
  cardCountry: string | null;
  cardholderName: string | null;
  receiptUrl: string | null;
  receiptNumber: string | null;
  receiptEmail: string | null;
} | null> {
  const stripe = (await getStripe()) as any;
  if (!stripe) return null;
  try {
    const charge = await stripe.charges.retrieve(chargeId, {
      expand: ["balance_transaction", "payment_method_details"],
    });
    const bt = charge.balance_transaction;
    const card = charge.payment_method_details?.card;
    return {
      fee: bt?.fee != null ? bt.fee / 100 : null,
      net: bt?.net != null ? bt.net / 100 : null,
      settledAt: bt?.available_on ? new Date(bt.available_on * 1000) : null,
      balanceTxId: bt?.id ?? null,
      payoutId: typeof bt?.payout === "string" ? bt.payout : (bt?.payout?.id ?? null),
      cardBrand: card?.brand ?? null,
      cardLast4: card?.last4 ?? null,
      cardCountry: card?.country ?? null,
      cardholderName: charge.billing_details?.name ?? null,
      receiptUrl: charge.receipt_url ?? null,
      receiptNumber: charge.receipt_number ?? null,
      receiptEmail: charge.receipt_email ?? null,
    };
  } catch (err) {
    console.error("[stripe] getEnrichedChargeData failed:", err);
    return null;
  }
}

// Récupère détails d'un payout (pour création/MAJ de la table Payout)
export async function getPayoutData(payoutId: string): Promise<{
  amount: number;
  currency: string;
  status: string;
  arrivalDate: Date | null;
  initiatedAt: Date;
  method: string | null;
  failureMessage: string | null;
  description: string | null;
  destinationLast4: string | null;
  destinationBank: string | null;
} | null> {
  const stripe = (await getStripe()) as any;
  if (!stripe) return null;
  try {
    const p = await stripe.payouts.retrieve(payoutId, { expand: ["destination"] });
    const dest = p.destination as { last4?: string; bank_name?: string } | null;
    return {
      amount: p.amount / 100,
      currency: (p.currency ?? "cad").toUpperCase(),
      status: p.status ?? "pending",
      arrivalDate: p.arrival_date ? new Date(p.arrival_date * 1000) : null,
      initiatedAt: new Date(p.created * 1000),
      method: p.method ?? null,
      failureMessage: p.failure_message ?? null,
      description: p.description ?? null,
      destinationLast4: dest?.last4 ?? null,
      destinationBank: dest?.bank_name ?? null,
    };
  } catch (err) {
    console.error("[stripe] getPayoutData failed:", err);
    return null;
  }
}

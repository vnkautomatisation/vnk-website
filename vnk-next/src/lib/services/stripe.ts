// Stripe service wrapper — lit les clés depuis Settings
import "server-only";
import { getSetting } from "@/lib/settings";

// Note : l'import de Stripe est lazy pour éviter d'exiger la clé à l'init
let _stripeClient: unknown = null;

export async function getStripe() {
  if (_stripeClient) return _stripeClient;
  const secretKey = await getSetting<string>("integrations", "stripe_secret_key");
  if (!secretKey) return null;
  const Stripe = (await import("stripe")).default;
  _stripeClient = new Stripe(secretKey, {
    apiVersion: "2024-12-18.acacia" as any,
  });
  return _stripeClient;
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
  const secret = await getSetting<string>("integrations", "stripe_webhook_secret");
  if (!secret) throw new Error("Webhook secret manquant");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

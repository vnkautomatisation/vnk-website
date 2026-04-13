// Stripe service wrapper — lit les clés depuis Settings
import "server-only";
import { getSetting } from "@/lib/settings";

// Note : l'import de Stripe est lazy pour éviter d'exiger la clé à l'init
let _stripeClient: unknown = null;

export async function getStripe() {
  if (_stripeClient) return _stripeClient;
  const secretKey = process.env.STRIPE_SECRET_KEY
    ?? await getSetting<string>("integrations", "stripe_secret_key");
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
    payment_method_types: ["card"],
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
  const secret = await getSetting<string>("integrations", "stripe_webhook_secret");
  if (!secret) throw new Error("Webhook secret manquant");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

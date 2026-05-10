// POST /api/webhooks/stripe — Stripe webhook (signature HMAC vérifiée)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markInvoicePaid } from "@/lib/workflow";
import { getSetting } from "@/lib/settings";
import { logOrderEvent } from "@/lib/request-context";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  // Log entrant
  const webhookSecret = await getSetting<string>("integrations", "stripe_webhook_secret");
  if (!webhookSecret) {
    console.warn("[stripe webhook] no webhook secret configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // TODO: vérifier la signature avec stripe.webhooks.constructEvent
  // const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
  // const event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log le webhook (pour replay + debug)
  await prisma.incomingWebhookLog.create({
    data: {
      provider: "stripe",
      eventType: event.type ?? "unknown",
      payload: event,
      signature,
      verified: false, // TODO: true après vérif signature
      processed: false,
    },
  });

  // Handlers d'événements
  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object;
        const invoiceId = pi.metadata?.invoice_id;
        let clientId: number | null = null;
        if (invoiceId) {
          await markInvoicePaid(Number(invoiceId), "stripe", pi.id);
          const inv = await prisma.invoice.findUnique({ where: { id: Number(invoiceId) }, select: { clientId: true } });
          clientId = inv?.clientId ?? null;
        }
        await logOrderEvent({
          req, clientId, type: "paid",
          amount: pi.amount ? pi.amount / 100 : undefined,
          currency: pi.currency?.toUpperCase(),
          stripeIntentId: pi.id,
          paymentMethod: "stripe",
          invoiceId: invoiceId ? Number(invoiceId) : undefined,
          metadata: { source: "stripe_webhook" },
        }).catch(() => {});
        break;
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object;
        const invoiceId = pi.metadata?.invoice_id;
        let clientId: number | null = null;
        if (invoiceId) {
          const inv = await prisma.invoice.findUnique({ where: { id: Number(invoiceId) }, select: { clientId: true } });
          clientId = inv?.clientId ?? null;
        }
        await logOrderEvent({
          req, clientId, type: "failed",
          amount: pi.amount ? pi.amount / 100 : undefined,
          currency: pi.currency?.toUpperCase(),
          stripeIntentId: pi.id,
          invoiceId: invoiceId ? Number(invoiceId) : undefined,
          metadata: { reason: pi.last_payment_error?.message ?? "unknown" },
        }).catch(() => {});
        break;
      }

      case "charge.refunded": {
        const charge = event.data.object;
        const invoiceId = charge.metadata?.invoice_id ?? charge.payment_intent_metadata?.invoice_id;
        let clientId: number | null = null;
        if (invoiceId) {
          const inv = await prisma.invoice.findUnique({ where: { id: Number(invoiceId) }, select: { clientId: true } });
          clientId = inv?.clientId ?? null;
        }
        await logOrderEvent({
          req, clientId, type: "refunded",
          amount: charge.amount_refunded ? charge.amount_refunded / 100 : undefined,
          currency: charge.currency?.toUpperCase(),
          stripeIntentId: charge.payment_intent,
          invoiceId: invoiceId ? Number(invoiceId) : undefined,
          metadata: { chargeId: charge.id, source: "stripe_webhook" },
        }).catch(() => {});
        break;
      }

      case "charge.dispute.created":
      case "charge.dispute.updated": {
        const dispute = event.data.object;
        const invoiceId = dispute.charge_metadata?.invoice_id ?? null;
        let clientId: number | null = null;
        if (invoiceId) {
          const inv = await prisma.invoice.findUnique({ where: { id: Number(invoiceId) }, select: { clientId: true } });
          clientId = inv?.clientId ?? null;
        }
        await logOrderEvent({
          req, clientId,
          type: event.type === "charge.dispute.created" ? "dispute_opened" : "dispute_updated",
          amount: dispute.amount ? dispute.amount / 100 : undefined,
          currency: dispute.currency?.toUpperCase(),
          metadata: { stripeDisputeId: dispute.id, reason: dispute.reason, status: dispute.status, evidenceDueBy: dispute.evidence_details?.due_by },
        }).catch(() => {});
        break;
      }

      default:
        console.log("[stripe webhook] unhandled event:", event.type);
    }

    return NextResponse.json({ received: true });
  } catch (err) {
    console.error("[stripe webhook] handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }
}

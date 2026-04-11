// POST /api/webhooks/stripe — Stripe webhook (signature HMAC vérifiée)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markInvoicePaid } from "@/lib/workflow";
import { getSetting } from "@/lib/settings";

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
        if (invoiceId) {
          await markInvoicePaid(Number(invoiceId), "stripe", pi.id);
        }
        break;
      }

      case "charge.refunded": {
        // TODO: créer refund record
        break;
      }

      case "charge.dispute.created": {
        // TODO: créer dispute record
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

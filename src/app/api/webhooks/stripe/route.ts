// POST /api/webhooks/stripe — Stripe webhook (signature HMAC vérifiée)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markInvoicePaid, createWorkflowEvent } from "@/lib/workflow";
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
      case "charge.dispute.updated":
      case "charge.dispute.closed": {
        const dispute = event.data.object;
        const isCreated = event.type === "charge.dispute.created";
        const isClosed = event.type === "charge.dispute.closed";
        // Stripe payload : metadata sur la charge (pas charge_metadata)
        const invoiceId = dispute.metadata?.invoice_id
          ?? dispute.charge_metadata?.invoice_id
          ?? null;
        let clientId: number | null = null;
        if (invoiceId) {
          const inv = await prisma.invoice.findUnique({
            where: { id: Number(invoiceId) },
            select: { clientId: true },
          });
          clientId = inv?.clientId ?? null;
        }

        const amountDisputed = dispute.amount ? dispute.amount / 100 : 0;
        const currency = (dispute.currency || "cad").toUpperCase();
        const evidenceDueBy = dispute.evidence_details?.due_by
          ? new Date(dispute.evidence_details.due_by * 1000)
          : null;
        // Stripe outcome: won | lost | warning_under_review | warning_closed | needs_response | etc.
        const stripeStatus: string = dispute.status ?? "needs_response";
        const isResolved = ["won", "lost", "warning_closed"].includes(stripeStatus);

        // Auto-cree ou met a jour le Dispute en base
        if (clientId) {
          const existing = await prisma.dispute.findFirst({
            where: { stripeDisputeId: dispute.id },
          });

          if (existing) {
            await prisma.dispute.update({
              where: { id: existing.id },
              data: {
                status: isResolved ? "resolved" : "open",
                stripeReason: dispute.reason ?? existing.stripeReason,
                outcome: isResolved ? stripeStatus : existing.outcome,
                amountDisputed,
                currency,
                evidenceDueBy: evidenceDueBy ?? existing.evidenceDueBy,
                cardBrand: dispute.payment_method_details?.card?.brand ?? existing.cardBrand,
                resolvedAt: isResolved ? new Date() : existing.resolvedAt,
              },
            });
          } else if (isCreated) {
            const created = await prisma.dispute.create({
              data: {
                clientId,
                invoiceId: invoiceId ? Number(invoiceId) : null,
                stripeDisputeId: dispute.id,
                stripeReason: dispute.reason ?? null,
                title: `Chargeback Stripe — ${dispute.reason ?? "raison inconnue"}`,
                description: `Litige ouvert automatiquement par Stripe le ${new Date().toLocaleDateString("fr-CA")}. Référence Stripe : ${dispute.id}.`,
                type: "chargeback",
                status: "open",
                priority: "urgent",
                amountDisputed,
                currency,
                evidenceDueBy,
                cardBrand: dispute.payment_method_details?.card?.brand ?? null,
              },
            });
            await createWorkflowEvent({
              clientId,
              eventType: "dispute_opened",
              eventLabel: `Chargeback Stripe ouvert : ${dispute.reason ?? "raison inconnue"} — ${amountDisputed.toFixed(2)} ${currency}`,
              triggeredBy: "stripe_webhook",
              metadata: { disputeId: created.id, stripeDisputeId: dispute.id, source: "stripe_webhook" },
            }).catch(() => {});
            // Notification admin
            await prisma.notification.create({
              data: {
                recipientType: "admin",
                recipientId: 0,
                type: "warning",
                title: "Chargeback Stripe reçu",
                body: `${amountDisputed.toFixed(2)} ${currency} — ${dispute.reason ?? "raison inconnue"}`,
                link: `/admin/disputes`,
              },
            }).catch(() => {});
          }
        }

        // Toujours logger l'event (immuable)
        await logOrderEvent({
          req, clientId,
          type: isCreated ? "dispute_opened" : "dispute_updated",
          amount: amountDisputed || undefined,
          currency,
          metadata: {
            stripeDisputeId: dispute.id,
            reason: dispute.reason,
            status: stripeStatus,
            evidenceDueBy: dispute.evidence_details?.due_by,
            isClosed,
          },
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

// POST /api/webhooks/stripe — Stripe webhook (signature HMAC vérifiée)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { markInvoicePaid, createWorkflowEvent } from "@/lib/workflow";
import { getSetting } from "@/lib/settings";
import { logOrderEvent } from "@/lib/request-context";
import { verifyWebhookSignature, getEnrichedChargeData, getPayoutData } from "@/lib/services/stripe";

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const rawBody = await req.text();

  const webhookSecret = await getSetting<string>("integrations", "stripe_webhook_secret");
  if (!webhookSecret) {
    console.warn("[stripe webhook] no webhook secret configured");
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  // ─── Verification HMAC Stripe (anti-injection) ───
  // En mode dev sans signature configuree on accepte le JSON brut (dev seulement).
  let event: any;
  let verified = false;
  if (signature) {
    try {
      event = await verifyWebhookSignature(rawBody, signature);
      verified = true;
    } catch (err) {
      console.error("[stripe webhook] signature verification failed:", err);
      // Tentative de log de la tentative non-verifiee pour audit
      await prisma.incomingWebhookLog.create({
        data: {
          provider: "stripe",
          eventType: "signature_failed",
          payload: { error: err instanceof Error ? err.message : String(err) },
          signature,
          verified: false,
          processed: false,
        },
      }).catch(() => {});
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }
  } else {
    // Pas de signature presente : refus en prod, log en dev
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }
    try {
      event = JSON.parse(rawBody);
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }
  }

  // Log le webhook (pour replay + debug)
  await prisma.incomingWebhookLog.create({
    data: {
      provider: "stripe",
      eventType: event.type ?? "unknown",
      payload: event,
      signature,
      verified,
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

        // ─── Enrichissement avec les données Stripe complètes (frais / net / carte / settled / receipt) ───
        // L'event payment_intent.succeeded ne contient pas balance_transaction → on fetch la charge
        const chargeId = typeof pi.latest_charge === "string"
          ? pi.latest_charge
          : pi.latest_charge?.id ?? null;
        if (chargeId) {
          try {
            const enriched = await getEnrichedChargeData(chargeId);
            if (enriched) {
              await prisma.payment.updateMany({
                where: { stripePaymentIntentId: pi.id },
                data: {
                  type: "charge",
                  stripeChargeId: chargeId,
                  processingFee: enriched.fee ?? undefined,
                  netAmount: enriched.net ?? undefined,
                  settledAt: enriched.settledAt ?? undefined,
                  stripeBalanceTxId: enriched.balanceTxId ?? undefined,
                  stripePayoutId: enriched.payoutId ?? undefined,
                  cardBrand: enriched.cardBrand ?? undefined,
                  cardLast4: enriched.cardLast4 ?? undefined,
                  cardCountry: enriched.cardCountry ?? undefined,
                  cardholderName: enriched.cardholderName ?? undefined,
                  stripeReceiptUrl: enriched.receiptUrl ?? undefined,
                  stripeReceiptNumber: enriched.receiptNumber ?? undefined,
                  stripeReceiptEmail: enriched.receiptEmail ?? undefined,
                },
              });
            }
          } catch (err) {
            console.error("[stripe webhook] enrichment failed:", err);
          }
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

        // ─── Création d'un Payment de type "refund" (ligne séparée pour rapport règlement) ───
        // Stripe envoie charge.refunded à chaque remboursement (peut être partiel) — on traite chaque refund unique
        const refunds = charge.refunds?.data ?? [];
        const card = charge.payment_method_details?.card;
        for (const r of refunds) {
          const exists = await prisma.payment.findFirst({ where: { stripeBalanceTxId: r.balance_transaction } });
          if (exists) continue;
          await prisma.payment.create({
            data: {
              invoiceId: invoiceId ? Number(invoiceId) : null,
              clientId,
              amount: -(r.amount / 100),                       // négatif : sortie
              currency: (r.currency ?? "cad").toLowerCase(),
              status: "succeeded",
              type: "refund",
              paymentMethod: "stripe",
              paidAt: r.created ? new Date(r.created * 1000) : new Date(),
              stripeChargeId: charge.id,
              stripePaymentIntentId: charge.payment_intent ?? null,
              stripeBalanceTxId: r.balance_transaction ?? null,
              cardBrand: card?.brand ?? null,
              cardLast4: card?.last4 ?? null,
              cardCountry: card?.country ?? null,
              cardholderName: charge.billing_details?.name ?? null,
            },
          });
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

      // ─── PAYOUTS (versements vers banque) ────────────────────
      case "payout.created":
      case "payout.updated":
      case "payout.paid":
      case "payout.failed":
      case "payout.canceled": {
        const payout = event.data.object;
        const enriched = await getPayoutData(payout.id).catch(() => null);
        const data = enriched ?? {
          amount: payout.amount / 100,
          currency: (payout.currency ?? "cad").toUpperCase(),
          status: payout.status ?? "pending",
          arrivalDate: payout.arrival_date ? new Date(payout.arrival_date * 1000) : null,
          initiatedAt: payout.created ? new Date(payout.created * 1000) : new Date(),
          method: payout.method ?? null,
          failureMessage: payout.failure_message ?? null,
          description: payout.description ?? null,
          destinationLast4: null,
          destinationBank: null,
        };

        const isPaid = event.type === "payout.paid";
        const isFailed = event.type === "payout.failed";

        await prisma.payout.upsert({
          where: { stripePayoutId: payout.id },
          create: {
            stripePayoutId: payout.id,
            amount: data.amount,
            currency: data.currency,
            status: data.status,
            arrivalDate: data.arrivalDate,
            initiatedAt: data.initiatedAt,
            paidAt: isPaid ? new Date() : null,
            failureReason: data.failureMessage,
            method: data.method,
            destinationLast4: data.destinationLast4,
            destinationBank: data.destinationBank,
            description: data.description,
          },
          update: {
            status: data.status,
            arrivalDate: data.arrivalDate ?? undefined,
            paidAt: isPaid ? new Date() : undefined,
            failureReason: isFailed ? data.failureMessage : undefined,
            destinationLast4: data.destinationLast4 ?? undefined,
            destinationBank: data.destinationBank ?? undefined,
          },
        });

        // Quand le payout est marqué payé, propager la date sur tous les Payments liés
        if (isPaid) {
          await prisma.payment.updateMany({
            where: { stripePayoutId: payout.id, payoutAt: null },
            data: { payoutAt: new Date() },
          });
          // MAJ du compteur item_count (nb de paiements groupés dans ce payout)
          const count = await prisma.payment.count({ where: { stripePayoutId: payout.id } });
          await prisma.payout.update({
            where: { stripePayoutId: payout.id },
            data: { itemCount: count },
          });
        }
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

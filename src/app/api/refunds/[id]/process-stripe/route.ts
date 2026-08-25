// POST /api/refunds/[id]/process-stripe — execute le vrai remboursement via Stripe
// Necessite que le Refund soit lie a une Invoice avec stripePaymentIntentId
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { logOrderEvent } from "@/lib/request-context";
import { refundPayment } from "@/lib/services/stripe";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";

const bodySchema = z.object({
  reason: z.enum(["duplicate", "fraudulent", "requested_by_customer"]).optional(),
}).optional();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  if (await adminApiForbidden("refunds", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const refundId = Number(id);

  const refund = await prisma.refund.findUnique({
    where: { id: refundId },
    include: {
      invoice: { select: { id: true, invoiceNumber: true, stripePaymentIntentId: true } },
      client: { select: { id: true, fullName: true } },
    },
  });
  if (!refund) {
    return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });
  }
  if (refund.stripeRefundId) {
    return NextResponse.json({ error: "Remboursement deja traite via Stripe" }, { status: 409 });
  }
  if (!refund.invoice?.stripePaymentIntentId) {
    return NextResponse.json(
      { error: "Facture liee non payee via Stripe — impossible de rembourser automatiquement" },
      { status: 400 },
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const reason = parsed.success ? parsed.data?.reason : undefined;

  try {
    // Appel API Stripe
    const stripeRefund = await refundPayment({
      paymentIntentId: refund.invoice.stripePaymentIntentId,
      amount: Number(refund.amount),
      reason: reason ?? "requested_by_customer",
    });

    // Maj Refund row
    const updated = await prisma.refund.update({
      where: { id: refundId },
      data: {
        stripeRefundId: (stripeRefund as { id: string }).id,
        status: "processed",
        processedAt: new Date(),
      },
    });

    await logAudit({
      adminId: session.user.adminId,
      action: "update",
      entityType: "refunds",
      entityId: refundId,
      changes: { type: "stripe_refund_processed", stripeRefundId: updated.stripeRefundId, amount: Number(refund.amount) },
    });

    await logOrderEvent({
      req,
      clientId: refund.clientId,
      type: "refunded",
      amount: Number(refund.amount),
      currency: "CAD",
      stripeIntentId: refund.invoice.stripePaymentIntentId,
      invoiceId: refund.invoice.id,
      metadata: { stripeRefundId: updated.stripeRefundId, source: "manual_admin_action" },
    }).catch(() => {});

    await createWorkflowEvent({
      clientId: refund.clientId,
      invoiceId: refund.invoice.id,
      eventType: "invoice_refunded",
      eventLabel: `Remboursement de ${Number(refund.amount).toFixed(2)} CAD émis pour ${refund.invoice.invoiceNumber} via Stripe`,
      triggeredBy: session.user.email ?? "admin",
      metadata: { refundId, stripeRefundId: updated.stripeRefundId },
    }).catch(() => {});

    // Notification client
    await prisma.notification.create({
      data: {
        recipientType: "client",
        recipientId: refund.clientId,
        type: "info",
        title: "Remboursement émis",
        body: `Un remboursement de ${Number(refund.amount).toFixed(2)} $ a été initié sur votre carte. Délai bancaire 5–10 jours ouvrables.`,
        link: `/portail/paiements`,
      },
    }).catch(() => {});

    revalidateAdminViews();

    return NextResponse.json({ success: true, refund: updated, stripeRefund });
  } catch (err) {
    console.error("[refund process-stripe] error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Stripe" },
      { status: 500 },
    );
  }
}

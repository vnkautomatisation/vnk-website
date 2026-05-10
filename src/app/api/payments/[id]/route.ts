// GET /api/payments/[id] — detail paiement avec timeline (OrderEvents lies)
// PATCH /api/payments/[id] — modifier type, paymentMethod, accountingCategory, notes
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const paymentId = Number(id);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      client: { select: { id: true, fullName: true, companyName: true, email: true } },
      invoice: { select: { id: true, invoiceNumber: true, title: true, amountTtc: true } },
    },
  });
  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }

  // Timeline : OrderEvents lies via stripeIntentId
  const orderEvents = payment.stripePaymentIntentId
    ? await prisma.orderEvent.findMany({
        where: { stripeIntentId: payment.stripePaymentIntentId },
        orderBy: { createdAt: "asc" },
      })
    : [];

  // Refunds lies au meme intent
  const refunds = payment.invoiceId
    ? await prisma.refund.findMany({
        where: { invoiceId: payment.invoiceId },
        orderBy: { createdAt: "desc" },
      })
    : [];

  // Dispute lie si applicable
  const dispute = payment.invoiceId
    ? await prisma.dispute.findFirst({
        where: { invoiceId: payment.invoiceId },
        select: { id: true, title: true, status: true, priority: true, openedAt: true, stripeDisputeId: true },
      })
    : null;

  return NextResponse.json({ payment, orderEvents, refunds, dispute });
}

const patchSchema = z.object({
  type: z.enum(["charge", "refund", "chargeback", "chargeback_fee", "adjustment", "topup"]).optional(),
  paymentMethod: z.string().min(1).max(50).optional(),
  accountingCategory: z.string().min(1).max(100).nullable().optional(),
  accountantNotes: z.string().max(2000).nullable().optional(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const paymentId = Number(id);
  if (!Number.isInteger(paymentId) || paymentId <= 0) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const existing = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!existing) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.type !== undefined) data.type = parsed.data.type;
  if (parsed.data.paymentMethod !== undefined) data.paymentMethod = parsed.data.paymentMethod;
  if (parsed.data.accountingCategory !== undefined) data.accountingCategory = parsed.data.accountingCategory;
  if (parsed.data.accountantNotes !== undefined) data.accountantNotes = parsed.data.accountantNotes;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "Aucun champ à modifier" }, { status: 400 });
  }

  const updated = await prisma.payment.update({ where: { id: paymentId }, data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "payments",
    entityId: paymentId,
    changes: { fields: data, before: { type: existing.type, paymentMethod: existing.paymentMethod, accountingCategory: existing.accountingCategory } },
  });

  revalidateAdminViews();
  return NextResponse.json({ success: true, payment: updated });
}

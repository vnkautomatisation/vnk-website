// GET /api/payments/[id] — detail paiement avec timeline (OrderEvents lies)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

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

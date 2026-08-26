// GET /api/payments/[id]/receipt — telecharge le PDF du recu (PDF distinct de la facture)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateReceiptPdf, localeToDocLang } from "@/lib/services/pdf";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const { id } = await params;
  const payment = await prisma.payment.findUnique({
    where: { id: Number(id) },
    include: {
      client: true,
      invoice: { select: { invoiceNumber: true, title: true } },
    },
  });

  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }
  if (!payment.client) {
    return NextResponse.json({ error: "Client lié introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && payment.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }

  // Seuls les paiements reussis ont un recu
  if (payment.status !== "succeeded" && payment.status !== "paid") {
    return NextResponse.json({ error: "Aucun reçu — paiement non confirmé" }, { status: 400 });
  }

  const receiptNumber = `R-${new Date(payment.paidAt ?? payment.createdAt).getFullYear()}-${String(payment.id).padStart(5, "0")}`;

  const pdf = await generateReceiptPdf({
    receiptNumber,
    invoiceNumber: payment.invoice?.invoiceNumber,
    invoiceTitle: payment.invoice?.title,
    client: {
      fullName: payment.client.fullName,
      companyName: payment.client.companyName ?? undefined,
      email: payment.client.email,
    },
    amount: Number(payment.amount),
    paymentMethod: payment.paymentMethod ?? "Stripe",
    stripePaymentIntentId: payment.stripePaymentIntentId ?? undefined,
    paidAt: payment.paidAt ?? payment.createdAt,
    lang: localeToDocLang(payment.client.locale),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${receiptNumber}.pdf"`,
    },
  });
}

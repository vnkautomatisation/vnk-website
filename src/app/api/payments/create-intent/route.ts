// POST /api/payments/create-intent — crée un Stripe PaymentIntent pour une facture
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createPaymentIntent } from "@/lib/services/stripe";

const schema = z.object({
  invoiceId: z.number().int().positive(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    include: { client: { select: { email: true, fullName: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  // Client only allowed on their own invoices
  if (session.user.role === "client" && invoice.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Facture déjà payée" }, { status: 409 });
  }

  try {
    const intent = (await createPaymentIntent({
      amount: Number(invoice.amountTtc),
      currency: invoice.currency,
      clientEmail: invoice.client.email,
      invoiceId: invoice.id,
      description: `${invoice.invoiceNumber} — ${invoice.title}`,
    })) as any;

    return NextResponse.json({
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Stripe" },
      { status: 500 }
    );
  }
}

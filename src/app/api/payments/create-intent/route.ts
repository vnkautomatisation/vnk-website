// POST /api/payments/create-intent — cree un Stripe PaymentIntent pour payer inline
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
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: parsed.data.invoiceId },
    include: { client: { select: { email: true, fullName: true, companyName: true, address: true, city: true, province: true, postalCode: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && invoice.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Facture deja payee" }, { status: 409 });
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
      publishableKey: process.env.STRIPE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY,
      client: {
        fullName: invoice.client.fullName,
        email: invoice.client.email,
        companyName: invoice.client.companyName,
        address: invoice.client.address,
        city: invoice.client.city,
        province: invoice.client.province,
        postalCode: invoice.client.postalCode,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Stripe" },
      { status: 500 }
    );
  }
}

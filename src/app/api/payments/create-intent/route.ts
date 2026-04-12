// POST /api/payments/create-intent — cree un Stripe Checkout Session pour payer une facture
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createCheckoutSession } from "@/lib/services/stripe";
import { headers } from "next/headers";

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
    include: { client: { select: { email: true, fullName: true } } },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  // Client only allowed on their own invoices
  if (session.user.role === "client" && invoice.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Facture deja payee" }, { status: 409 });
  }

  try {
    const headersList = await headers();
    const host = headersList.get("host") ?? "localhost:3000";
    const protocol = headersList.get("x-forwarded-proto") ?? "http";
    const baseUrl = `${protocol}://${host}`;

    const checkoutSession = await createCheckoutSession({
      amount: Number(invoice.amountTtc),
      currency: invoice.currency,
      clientEmail: invoice.client.email,
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      description: `${invoice.invoiceNumber} — ${invoice.title}`,
      successUrl: `${baseUrl}/portail/factures?paid=${invoice.id}`,
      cancelUrl: `${baseUrl}/portail/factures`,
    });

    return NextResponse.json({ url: checkoutSession.url });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Erreur Stripe" },
      { status: 500 }
    );
  }
}

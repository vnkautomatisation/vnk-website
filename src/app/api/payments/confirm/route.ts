// POST /api/payments/confirm — confirme le paiement et marque la facture payee
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { markInvoicePaid } from "@/lib/workflow";

const schema = z.object({
  invoiceId: z.number().int().positive(),
  paymentIntentId: z.string().min(1),
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
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && invoice.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  if (invoice.status === "paid") {
    return NextResponse.json({ success: true, alreadyPaid: true });
  }

  await markInvoicePaid(invoice.id, "stripe", parsed.data.paymentIntentId);

  return NextResponse.json({ success: true });
}

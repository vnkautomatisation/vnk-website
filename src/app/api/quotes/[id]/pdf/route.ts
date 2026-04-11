// GET /api/quotes/:id/pdf
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateQuotePdf } from "@/lib/services/pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const quote = await prisma.quote.findUnique({
    where: { id: Number(id) },
    include: { client: true },
  });

  if (!quote) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && quote.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const pdf = await generateQuotePdf({
    quoteNumber: quote.quoteNumber,
    title: quote.title,
    description: quote.description ?? undefined,
    client: {
      fullName: quote.client.fullName,
      companyName: quote.client.companyName ?? undefined,
      email: quote.client.email,
      address: quote.client.address ?? undefined,
    },
    amountHt: Number(quote.amountHt),
    tpsAmount: Number(quote.tpsAmount),
    tvqAmount: Number(quote.tvqAmount),
    amountTtc: Number(quote.amountTtc),
    expiryDate: quote.expiryDate ?? undefined,
    paymentConditions: quote.paymentConditions ?? undefined,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${quote.quoteNumber}.pdf"`,
    },
  });
}

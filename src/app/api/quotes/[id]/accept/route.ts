// POST /api/quotes/:id/accept — client accepte un devis
// → génère le contrat automatiquement via le workflow engine
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { acceptQuote } from "@/lib/workflow";

const bodySchema = z.object({
  signatureData: z.string().optional(), // base64 canvas
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const quoteId = Number(id);

  const quote = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!quote) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }

  // Vérifier que le client est bien propriétaire du devis
  if (session.user.role === "client" && quote.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  if (quote.status !== "pending") {
    return NextResponse.json(
      { error: `Ce devis ne peut plus être accepté (statut: ${quote.status})` },
      { status: 409 }
    );
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);

  // Enregistrer la signature si fournie
  if (parsed.success && parsed.data.signatureData) {
    await prisma.quote.update({
      where: { id: quoteId },
      data: {
        clientSignatureData: parsed.data.signatureData,
        signedAt: new Date(),
      },
    });
  }

  const result = await acceptQuote(
    quoteId,
    session.user.role === "client" ? "client" : "admin"
  );

  return NextResponse.json({
    success: true,
    quote: result.quote,
    contract: result.contract,
  });
}

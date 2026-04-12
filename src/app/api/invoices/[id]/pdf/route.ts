// GET /api/invoices/:id/pdf
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateInvoicePdf } from "@/lib/services/pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: { client: true },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && invoice.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const pdf = await generateInvoicePdf({
    invoiceNumber: invoice.invoiceNumber,
    title: invoice.title,
    description: invoice.description ?? undefined,
    client: {
      fullName: invoice.client.fullName,
      companyName: invoice.client.companyName ?? undefined,
      email: invoice.client.email,
      address: invoice.client.address ?? undefined,
      city: invoice.client.city ?? undefined,
      province: invoice.client.province ?? undefined,
      postalCode: invoice.client.postalCode ?? undefined,
    },
    amountHt: Number(invoice.amountHt),
    tpsAmount: Number(invoice.tpsAmount),
    tvqAmount: Number(invoice.tvqAmount),
    amountTtc: Number(invoice.amountTtc),
    dueDate: invoice.dueDate ?? undefined,
    paidAt: invoice.paidAt,
    status: invoice.status,
    invoicePhase: invoice.invoicePhase,
    phaseNumber: invoice.phaseNumber,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${invoice.invoiceNumber}.pdf"`,
    },
  });
}

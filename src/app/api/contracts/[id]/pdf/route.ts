// GET /api/contracts/:id/pdf
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContractPdf } from "@/lib/services/pdf";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const contract = await prisma.contract.findUnique({
    where: { id: Number(id) },
    include: { client: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && contract.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  const pdf = await generateContractPdf({
    contractNumber: contract.contractNumber,
    title: contract.title,
    content: contract.content ?? undefined,
    client: {
      fullName: contract.client.fullName,
      companyName: contract.client.companyName ?? undefined,
      email: contract.client.email,
      address: contract.client.address ?? undefined,
      city: contract.client.city ?? undefined,
      province: contract.client.province ?? undefined,
      postalCode: contract.client.postalCode ?? undefined,
    },
    amountTtc: Number(contract.amountTtc),
    clientSignatureData: contract.clientSignatureData,
    adminSignatureData: contract.adminSignatureData,
    signedAt: contract.signedAt,
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${contract.contractNumber}.pdf"`,
    },
  });
}

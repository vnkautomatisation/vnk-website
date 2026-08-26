// GET /api/contracts/:id/pdf
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateContractPdf, localeToDocLang } from "@/lib/services/pdf";
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
  const contract = await prisma.contract.findUnique({
    where: { id: Number(id) },
    include: { client: true },
  });

  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }

  if (session.user.role === "client" && contract.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
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
    createdAt: contract.createdAt,
    clientSignatureData: contract.clientSignatureData,
    clientSignatureIp: contract.clientSignatureIp,
    adminSignatureData: contract.adminSignatureData,
    adminSignedAt: contract.adminSignedAt,
    signedAt: contract.signedAt,
    lang: localeToDocLang(contract.client.locale),
  });

  return new Response(new Uint8Array(pdf), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${contract.contractNumber}.pdf"`,
    },
  });
}

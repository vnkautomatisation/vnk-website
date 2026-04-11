// POST /api/contracts/:id/sign — signer côté client OU côté admin
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent, onContractFullySigned } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";

const schema = z.object({
  signatureData: z.string().min(10),
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
  const contractId = Number(id);

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({ where: { id: contractId } });
  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }

  // Vérifier que le client est propriétaire
  if (session.user.role === "client" && contract.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? "";

  // Mettre à jour selon le rôle
  const updated = await prisma.contract.update({
    where: { id: contractId },
    data:
      session.user.role === "admin"
        ? {
            adminSignatureData: parsed.data.signatureData,
            adminSignedAt: new Date(),
          }
        : {
            clientSignatureData: parsed.data.signatureData,
            clientSignatureIp: ip,
          },
  });

  await createWorkflowEvent({
    clientId: contract.clientId,
    contractId: contract.id,
    eventType: session.user.role === "admin" ? "contract_signed_admin" : "contract_signed_client",
    eventLabel: `Contrat ${contract.contractNumber} signé par ${session.user.role === "admin" ? "admin" : "client"}`,
    triggeredBy: session.user.role,
  });

  // Si les deux ont signé → générer la facture automatiquement
  const fullySigned = !!updated.adminSignatureData && !!updated.clientSignatureData;
  if (fullySigned) {
    await prisma.contract.update({
      where: { id: contractId },
      data: { status: "signed", signedAt: new Date() },
    });
    await onContractFullySigned(contractId);
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "contracts",
    entityId: contract.id,
    changes: { action: "sign", role: session.user.role },
  });

  return NextResponse.json({ success: true, fullySigned });
}

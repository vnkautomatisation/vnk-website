// POST /api/contracts/[id]/send-for-esign
// Envoie le contrat à Dropbox Sign pour signature électronique légale
// (alternative au canvas interne, pour les contrats > 1000 $ ou
// pour clients qui exigent une preuve de signature renforcée).
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSignatureRequest, isDropboxSignAvailable } from "@/lib/integrations/dropbox-sign";
import { logAudit } from "@/lib/audit";
import { logSecurityEvent } from "@/lib/security/security-events";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  if (!(await isDropboxSignAvailable())) {
    return NextResponse.json(
      { error: "Dropbox Sign non configuré. Allez dans Profil > Intégrations." },
      { status: 400 }
    );
  }

  const { id } = await params;
  const contractId = Number(id);

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { client: { select: { id: true, fullName: true, email: true } } },
  });
  if (!contract) return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  if (!contract.client) return NextResponse.json({ error: "Client manquant" }, { status: 400 });

  try {
    // Génère le PDF à signer (utilise le générateur PDF existant)
    const pdfRes = await fetch(new URL(`/api/contracts/${contractId}/pdf`, req.url), {
      headers: { cookie: req.headers.get("cookie") ?? "" },
    });
    if (!pdfRes.ok) {
      return NextResponse.json({ error: "Impossible de générer le PDF du contrat" }, { status: 500 });
    }
    const pdfBuf = Buffer.from(await pdfRes.arrayBuffer());
    const fileBase64 = pdfBuf.toString("base64");

    const result = await sendSignatureRequest({
      title: `Contrat ${contract.contractNumber}`,
      subject: `Signature du contrat ${contract.contractNumber}`,
      message: "Veuillez réviser et signer ce contrat. Une copie signée vous sera retournée automatiquement.",
      signers: [{ email: contract.client.email, name: contract.client.fullName }],
      fileBase64,
      fileName: `contrat-${contract.contractNumber}.pdf`,
      metadata: { contractId: String(contractId), clientId: String(contract.clientId) },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error ?? "Erreur Dropbox Sign" }, { status: 500 });
    }

    await prisma.contract.update({
      where: { id: contractId },
      data: {
        hellosignRequestId: result.signatureRequestId,
        status: "sent",
      },
    });

    await logAudit({
      adminId: session.user.adminId,
      action: "update",
      entityType: "contracts",
      entityId: contractId,
      changes: { sent_for_esign: true, provider: "dropbox_sign", requestId: result.signatureRequestId },
    });
    await logSecurityEvent({
      adminId: session.user.adminId!,
      type: "preferences_updated",
      severity: "info",
      message: `Contrat ${contract.contractNumber} envoyé pour signature via Dropbox Sign`,
    });

    return NextResponse.json({
      success: true,
      signatureRequestId: result.signatureRequestId,
      signingUrl: result.signingUrl,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur inconnue";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/contracts/:id/sign — signer côté client OU côté admin
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent, onContractFullySigned } from "@/lib/workflow";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";
import { logSignatureEvent } from "@/lib/request-context";
import { createHash } from "crypto";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const schema = z.object({
  signatureData: z.string().min(10),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const { id } = await params;
  const contractId = Number(id);

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Signature manquante" }, { status: 400 });
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { client: { select: { fullName: true, email: true } } },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }

  // Vérifier que le client est propriétaire
  if (session.user.role === "client" && contract.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }

  // Bloquer signature si statut non signable
  if (contract.status === "expired") {
    return NextResponse.json({ error: t("ce_contrat_est_expire_et_ne_peut") }, { status: 409 });
  }
  if (contract.status === "cancelled") {
    return NextResponse.json({ error: t("ce_contrat_a_ete_annule_et_ne") }, { status: 409 });
  }
  if (contract.status === "signed" || (contract.adminSignatureData && contract.clientSignatureData)) {
    return NextResponse.json({ error: t("ce_contrat_est_deja_signe_par_les") }, { status: 409 });
  }

  // Auto-expiration si dépassement de la date d'expiration
  if (contract.expiresAt && new Date(contract.expiresAt) < new Date()) {
    await prisma.contract.update({ where: { id: contractId }, data: { status: "expired" } });
    return NextResponse.json({ error: t("ce_contrat_est_expire_et_ne_peut") }, { status: 409 });
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

  const signerName = session.user.role === "admin"
    ? (session.user.email ?? "admin")
    : (contract.client?.fullName ?? "client");

  await createWorkflowEvent({
    clientId: contract.clientId,
    contractId: contract.id,
    eventType: session.user.role === "admin" ? "contract_signed_admin" : "contract_signed_client",
    eventLabel: `Contrat ${contract.contractNumber} signé par ${signerName}`,
    triggeredBy: session.user.role,
  });

  // SignatureEvent immuable avec hash + IP/UA
  const signatureHash = createHash("sha256").update(parsed.data.signatureData).digest("hex");
  await logSignatureEvent({
    req,
    entityType: "contract",
    entityId: contract.id,
    clientId: contract.clientId,
    signedBy: signerName,
    signatureHash,
  }).catch((e) => console.error("signature event log failed", e));

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

  revalidateAdminViews();

  return NextResponse.json({ success: true, fullySigned });
}

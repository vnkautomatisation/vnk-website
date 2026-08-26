// POST /api/contracts/[id]/send — envoie le contrat au client (admin)
// → cree Document portail + Message chat + Notification client + workflow event
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("contracts", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const contractId = Number(id);

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { client: { select: { id: true, fullName: true, email: true } } },
  });
  if (!contract) {
    return NextResponse.json({ error: "Contrat introuvable" }, { status: 404 });
  }

  // 1) Document portail (categorie "contrats")
  const existingDoc = await prisma.document.findFirst({
    where: { clientId: contract.clientId, fileUrl: `/api/contracts/${contract.id}/pdf` },
  });
  if (!existingDoc) {
    await prisma.document.create({
      data: {
        clientId: contract.clientId,
        title: `${contract.title} (${contract.contractNumber})`,
        description: `Contrat ${contract.contractNumber}`,
        fileType: "pdf",
        fileUrl: `/api/contracts/${contract.id}/pdf`,
        category: "contrats",
        uploadedBy: "admin",
        isRead: false,
      },
    });
  }

  // 2) Message chat
  await prisma.message.create({
    data: {
      clientId: contract.clientId,
      sender: "vnk",
      content: `Nouveau contrat à signer : ${contract.contractNumber}${contract.amountTtc ? ` — ${Number(contract.amountTtc).toFixed(2)} $ TTC` : ""}. Consultez et signez via votre portail (/portail/contrats).`,
      channel: "chat",
      isRead: false,
    },
  });

  // 3) Notification in-app pour le client
  await prisma.notification.create({
    data: {
      recipientType: "client",
      recipientId: contract.clientId,
      type: "info",
      title: "Nouveau contrat à signer",
      body: `${contract.contractNumber}${contract.amountTtc ? ` — ${Number(contract.amountTtc).toFixed(2)} $ TTC` : ""}`,
      link: `/portail/contrats`,
    },
  });

  // 4) Workflow event
  await createWorkflowEvent({
    clientId: contract.clientId,
    contractId: contract.id,
    eventType: "contract_sent_for_signature",
    eventLabel: `Contrat ${contract.contractNumber} envoyé pour signature`,
    triggeredBy: "admin",
  });

  // 5) Audit
  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "contracts",
    entityId: contract.id,
    changes: { action: "sent_to_client" },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, clientName: contract.client.fullName });
}

// POST /api/documents/[id]/send — notifie le client qu'un document est disponible
// → Message chat + Notification client + workflow event + audit
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
  if (await adminApiForbidden("documents", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const docId = Number(id);
  const doc = await prisma.document.findUnique({
    where: { id: docId },
    include: { client: { select: { id: true, fullName: true } } },
  });
  if (!doc) {
    return NextResponse.json({ error: "Document introuvable" }, { status: 404 });
  }

  // Message chat
  await prisma.message.create({
    data: {
      clientId: doc.clientId,
      sender: "vnk",
      content: `Nouveau document disponible : **${doc.title}**${doc.category ? ` (${doc.category})` : ""}. Consultez-le dans votre portail (/portail/documents).`,
      channel: "chat",
      isRead: false,
    },
  });

  // Notification in-app
  await prisma.notification.create({
    data: {
      recipientType: "client",
      recipientId: doc.clientId,
      type: "info",
      title: "Nouveau document",
      body: doc.title,
      link: `/portail/documents`,
    },
  });

  await createWorkflowEvent({
    clientId: doc.clientId,
    eventType: "message_from_admin",
    eventLabel: `Document ${doc.title} envoyé à ${doc.client?.fullName ?? "client"}`,
    labelKey: "workflow_events.document_envoye",
    labelParams: { title: doc.title, name: doc.client?.fullName ?? "client" },
    triggeredBy: "admin",
    metadata: { documentId: doc.id, action: "sent_to_client" },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "documents",
    entityId: doc.id,
    changes: { action: "sent_to_client" },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, clientName: doc.client.fullName });
}

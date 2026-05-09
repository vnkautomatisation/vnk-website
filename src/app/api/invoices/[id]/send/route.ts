// POST /api/invoices/[id]/send — envoie la facture au client (admin)
// → cree Document portail + Message chat + Notification client
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const invoiceId = Number(id);

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { client: { select: { id: true, fullName: true, email: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  const existingDoc = await prisma.document.findFirst({
    where: { clientId: invoice.clientId, fileUrl: `/api/invoices/${invoice.id}/pdf` },
  });

  if (!existingDoc) {
    await prisma.document.create({
      data: {
        clientId: invoice.clientId,
        title: `${invoice.title} (${invoice.invoiceNumber})`,
        description: `Facture ${invoice.invoiceNumber}`,
        fileType: "pdf",
        fileUrl: `/api/invoices/${invoice.id}/pdf`,
        category: "factures",
        uploadedBy: "admin",
        isRead: false,
      },
    });
  }

  await prisma.message.create({
    data: {
      clientId: invoice.clientId,
      sender: "admin",
      content: `Nouvelle facture disponible : ${invoice.invoiceNumber} — ${Number(invoice.amountTtc).toFixed(2)} $ TTC. Réglez via votre portail (/portail/factures).`,
      channel: "chat",
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      recipientType: "client",
      recipientId: invoice.clientId,
      type: "info",
      title: "Nouvelle facture",
      body: `${invoice.invoiceNumber} — ${Number(invoice.amountTtc).toFixed(2)} $ TTC`,
      link: `/portail/factures`,
    },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "invoices",
    entityId: invoice.id,
    changes: { action: "sent_to_client" },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, clientName: invoice.client.fullName });
}

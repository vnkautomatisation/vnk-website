// POST /api/quotes/[id]/send — envoie le devis au client (admin)
// → cree Document portail + Message chat + Notification client
// → email sera branche au volet emails plus tard
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
  const quoteId = Number(id);

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { client: { select: { id: true, fullName: true, email: true } } },
  });
  if (!quote) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }

  // Verifie qu'un document n'existe pas deja pour ce devis (evite doublons en cas de double-clic)
  const existingDoc = await prisma.document.findFirst({
    where: { clientId: quote.clientId, fileUrl: `/api/quotes/${quote.id}/pdf` },
  });

  // 1) Document dans le portail client
  if (!existingDoc) {
    await prisma.document.create({
      data: {
        clientId: quote.clientId,
        title: `${quote.title} (${quote.quoteNumber})`,
        description: `Devis ${quote.quoteNumber}`,
        fileType: "pdf",
        fileUrl: `/api/quotes/${quote.id}/pdf`,
        category: "devis",
        uploadedBy: "admin",
        isRead: false,
      },
    });
  }

  // 2) Message chat
  await prisma.message.create({
    data: {
      clientId: quote.clientId,
      sender: "admin",
      content: `Nouveau devis disponible : ${quote.quoteNumber} — ${Number(quote.amountTtc).toFixed(2)} $ TTC. Consultez-le dans votre portail (/portail/devis).`,
      channel: "chat",
      isRead: false,
    },
  });

  // 3) Notification in-app pour le client
  await prisma.notification.create({
    data: {
      recipientType: "client",
      recipientId: quote.clientId,
      type: "quote_sent",
      title: "Nouveau devis disponible",
      message: `${quote.quoteNumber} — ${Number(quote.amountTtc).toFixed(2)} $ TTC`,
      actionUrl: `/portail/devis`,
    },
  });

  // 4) Audit
  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "quotes",
    entityId: quote.id,
    changes: { action: "sent_to_client" },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, clientName: quote.client.fullName });
}

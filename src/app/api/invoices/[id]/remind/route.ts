// POST /api/invoices/[id]/remind — envoyer un rappel manuel (admin)
// → message chat + notification client + bump remindersSent + workflow event
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
  if (await adminApiForbidden("invoices", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: { client: { select: { fullName: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }

  const dueLabel = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString("fr-CA") : null;

  await prisma.message.create({
    data: {
      clientId: invoice.clientId,
      sender: "vnk",
      content: `Rappel de paiement — Facture ${invoice.invoiceNumber} de ${Number(invoice.amountTtc).toFixed(2)} $ TTC${dueLabel ? ` (échéance ${dueLabel})` : ""}. Merci de procéder au règlement via votre portail (/portail/factures).`,
      channel: "chat",
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      recipientType: "client",
      recipientId: invoice.clientId,
      type: "warning",
      title: "Rappel de paiement",
      body: `${invoice.invoiceNumber} — ${Number(invoice.amountTtc).toFixed(2)} $ TTC`,
      link: `/portail/factures`,
    },
  });

  await prisma.invoice.update({
    where: { id: invoice.id },
    data: { remindersSent: { increment: 1 }, lastReminderAt: new Date() },
  });

  await createWorkflowEvent({
    clientId: invoice.clientId,
    invoiceId: invoice.id,
    eventType: "invoice_reminded",
    eventLabel: `Rappel manuel envoyé à ${invoice.client.fullName} — ${invoice.invoiceNumber}`,
    triggeredBy: "admin",
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "invoices",
    entityId: invoice.id,
    changes: { action: "reminder_sent" },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}

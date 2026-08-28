// POST /api/invoices/[id]/remind — envoyer un rappel manuel (admin)
// → message chat + notification client + bump remindersSent + workflow event
import { NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const dateTag = dateLocale(await getLocale());
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

  const dueLabel = invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString(dateTag) : null;

  await prisma.message.create({
    data: {
      clientId: invoice.clientId,
      sender: "vnk",
      content: t("route_rappel_de_paiement_facture_p0_de_p1_ttc", { p0: invoice.invoiceNumber, p1: Number(invoice.amountTtc).toFixed(2), p2: dueLabel ? ` (échéance ${dueLabel})` : "" }),
      channel: "chat",
      isRead: false,
    },
  });

  await prisma.notification.create({
    data: {
      recipientType: "client",
      recipientId: invoice.clientId,
      type: "warning",
      title: t("rappel_de_paiement"),
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
    eventLabel: t("route_rappel_manuel_envoye_a_p0_p1", { p0: invoice.client.fullName, p1: invoice.invoiceNumber }),
    labelKey: "api_errors.route_rappel_manuel_envoye_a_p0_p1",
    labelParams: { p0: invoice.client.fullName, p1: invoice.invoiceNumber },
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

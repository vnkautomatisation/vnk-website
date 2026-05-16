// GET /api/cron/check-overdue-invoices
// Vérifie les factures impayées dépassant l'échéance et déclenche
// notifications Slack + Zapier. À appeler par cron Railway / Vercel
// avec header Authorization: Bearer ${CRON_SECRET}.
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyInvoiceOverdue } from "@/lib/integrations/slack";
import { triggerZap } from "@/lib/integrations/zapier";

export async function GET(req: NextRequest) {
  // Sécurité : vérifier le secret CRON
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const now = new Date();
  const today = new Date(now.toISOString().slice(0, 10));

  // Trouver factures impayées avec dueDate dépassé
  const overdue = await prisma.invoice.findMany({
    where: {
      status: { in: ["unpaid", "sent", "partial"] },
      dueDate: { lt: today, not: null },
    },
    include: { client: { select: { fullName: true, companyName: true } } },
    take: 100,
  });

  let notified = 0;
  for (const inv of overdue) {
    // Limiter le spam : ne notifie que si jamais alertée OU dernière alerte > 7 jours
    const lastReminder = inv.lastReminderAt;
    const daysSinceReminder = lastReminder
      ? (Date.now() - lastReminder.getTime()) / (1000 * 60 * 60 * 24)
      : 999;
    if (daysSinceReminder < 7) continue;

    const clientName = inv.client?.companyName ?? inv.client?.fullName ?? "Client";
    const dueDateStr = inv.dueDate?.toISOString().slice(0, 10) ?? "";

    void notifyInvoiceOverdue({
      invoiceNumber: inv.invoiceNumber,
      amount: Number(inv.amountTtc),
      currency: inv.currency,
      clientName,
      dueDate: dueDateStr,
    });
    void triggerZap("invoices.overdue", {
      id: inv.id, invoiceNumber: inv.invoiceNumber, amount: Number(inv.amountTtc),
      currency: inv.currency, clientId: inv.clientId, clientName,
      dueDate: dueDateStr, daysOverdue: Math.floor((today.getTime() - inv.dueDate!.getTime()) / (1000 * 60 * 60 * 24)),
    });

    await prisma.invoice.update({
      where: { id: inv.id },
      data: { lastReminderAt: now, remindersSent: { increment: 1 } },
    });
    notified++;
  }

  return NextResponse.json({ checked: overdue.length, notified });
}

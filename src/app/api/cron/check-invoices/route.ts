// GET /api/cron/check-invoices — job quotidien (Railway cron 8h00)
// 1) Auto-marque comme "overdue" les factures unpaid dont dueDate < aujourd'hui
// 2) Envoie automatiquement les rappels J+3, J+10, J+20 apres echeance
// → workflow events + notifications admin + messages chat client
//
// ─── Setup Railway ─────────────────────────────────────────
// 1. Generer un secret : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// 2. Dashboard Railway → Variables → ajouter CRON_SECRET=<le secret>
// 3. New Service → Empty → Settings → Cron Schedule : "0 12 * * *" (8h Montreal = 12h UTC)
// 4. Settings → Custom Start Command :
//    curl -fsS -H "Authorization: Bearer $CRON_SECRET" https://<APP>.up.railway.app/api/cron/check-invoices
// 5. Variables : meme CRON_SECRET partage avec le service web
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

const REMINDER_SCHEDULE = [
  { afterDays: 3, max: 0 },   // 1er rappel J+3 (remindersSent === 0)
  { afterDays: 10, max: 1 },  // 2e rappel J+10 (remindersSent === 1)
  { afterDays: 20, max: 2 },  // 3e rappel J+20 (remindersSent === 2)
];

function authorize(req: Request): boolean {
  const expected = process.env.CRON_SECRET;
  if (!expected) return false;
  const header = req.headers.get("authorization") ?? "";
  return header === `Bearer ${expected}`;
}

export async function GET(req: Request) {
  if (!authorize(req)) {
    return unauthorizedJson();
  }

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // ─── 1. Auto-overdue ─────────────────────────────────────
  const toMarkOverdue = await prisma.invoice.findMany({
    where: {
      status: "unpaid",
      dueDate: { lt: today, not: null },
    },
    select: { id: true, clientId: true, invoiceNumber: true, amountTtc: true, title: true },
  });

  for (const inv of toMarkOverdue) {
    await prisma.invoice.update({ where: { id: inv.id }, data: { status: "overdue" } });
    await createWorkflowEvent({
      clientId: inv.clientId,
      invoiceId: inv.id,
      eventType: "invoice_overdue",
      eventLabel: `Facture ${inv.invoiceNumber} marquée en retard automatiquement`,
      triggeredBy: "system",
    });
    await prisma.notification.create({
      data: {
        recipientType: "admin",
        recipientId: 0,
        type: "warning",
        title: "Facture en retard",
        body: `${inv.invoiceNumber} — ${Number(inv.amountTtc).toFixed(2)} $ TTC`,
        link: `/admin/invoices`,
      },
    });
  }

  // ─── 2. Auto-rappels J+3 / J+10 / J+20 ────────────────────
  // Garde-fou anti-spam : 5 jours minimum entre 2 rappels
  const minDaysBetween = new Date(now);
  minDaysBetween.setDate(minDaysBetween.getDate() - 5);

  let remindersSentCount = 0;
  for (const rule of REMINDER_SCHEDULE) {
    const cutoff = new Date(today);
    cutoff.setDate(cutoff.getDate() - rule.afterDays);

    const candidates = await prisma.invoice.findMany({
      where: {
        status: "overdue",
        dueDate: { lt: cutoff, not: null },
        remindersSent: rule.max,
        OR: [{ lastReminderAt: null }, { lastReminderAt: { lt: minDaysBetween } }],
      },
      include: { client: { select: { fullName: true } } },
    });

    for (const inv of candidates) {
      const dueLabel = inv.dueDate ? new Date(inv.dueDate).toLocaleDateString("fr-CA") : "—";
      const stage = rule.max === 0 ? "1er rappel" : rule.max === 1 ? "2e rappel" : "rappel final";

      await prisma.message.create({
        data: {
          clientId: inv.clientId,
          sender: "vnk",
          content: `${stage} — Facture ${inv.invoiceNumber} de ${Number(inv.amountTtc).toFixed(2)} $ TTC échue depuis le ${dueLabel}. Merci de procéder au règlement via votre portail (/portail/factures).`,
          channel: "chat",
          isRead: false,
        },
      });

      await prisma.notification.create({
        data: {
          recipientType: "client",
          recipientId: inv.clientId,
          type: "warning",
          title: `Rappel de paiement (${stage})`,
          body: `${inv.invoiceNumber} — ${Number(inv.amountTtc).toFixed(2)} $ TTC`,
          link: `/portail/factures`,
        },
      });

      await prisma.invoice.update({
        where: { id: inv.id },
        data: { remindersSent: { increment: 1 }, lastReminderAt: now },
      });

      await createWorkflowEvent({
        clientId: inv.clientId,
        invoiceId: inv.id,
        eventType: "invoice_reminded",
        eventLabel: `${stage} envoyé à ${inv.client.fullName} — ${inv.invoiceNumber}`,
        triggeredBy: "system",
      });

      remindersSentCount++;
    }
  }

  if (toMarkOverdue.length > 0 || remindersSentCount > 0) {
    revalidateAdminViews();
  }

  return NextResponse.json({
    success: true,
    markedOverdue: toMarkOverdue.length,
    remindersSent: remindersSentCount,
    timestamp: now.toISOString(),
  });
}

// POST /api/email/inbound — webhook pour emails entrants
// Accepte le format generique avec normalisation Resend / Postmark / Mailgun / SendGrid
//
// Auth : header X-Webhook-Secret = INBOUND_EMAIL_SECRET
// Si l'expediteur correspond a un client.email connu, ajoute un Message au thread
//
// Setup :
// 1. Generer secret : node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
// 2. Variables Railway : INBOUND_EMAIL_SECRET=<secret>
// 3. Provider (ex: Resend Inbound) : webhook URL = https://<APP>/api/email/inbound
//    Header custom : X-Webhook-Secret = <secret>
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { logEmailEvent, captureRequestContext } from "@/lib/request-context";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

type InboundPayload = {
  // Formats divers — on lit ce qu'on trouve
  from?: string | { email?: string; name?: string };
  From?: string;
  sender?: string;
  fromEmail?: string;

  to?: string | string[] | { email?: string }[];
  To?: string;

  subject?: string;
  Subject?: string;

  text?: string;
  TextBody?: string;
  "stripped-text"?: string;
  body_plain?: string;

  html?: string;
  HtmlBody?: string;
  "stripped-html"?: string;

  messageId?: string;
  MessageID?: string;
  "Message-Id"?: string;
};

function extractEmail(value: unknown): string | null {
  if (!value) return null;
  if (typeof value === "string") {
    const m = value.match(/<([^>]+)>/) ?? value.match(/([^\s<>]+@[^\s<>]+)/);
    return m ? m[1].toLowerCase() : value.toLowerCase().trim();
  }
  if (typeof value === "object" && value !== null && "email" in value) {
    return String((value as { email: string }).email).toLowerCase();
  }
  return null;
}

export async function POST(req: Request) {
  const t = await getTranslations("api_errors");
  const secret = process.env.INBOUND_EMAIL_SECRET;
  if (!secret) {
    return NextResponse.json({ error: t("webhook_non_configure") }, { status: 503 });
  }
  const provided = req.headers.get("x-webhook-secret") ?? req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (provided !== secret) {
    return unauthorizedJson();
  }

  const body = (await req.json().catch(() => ({}))) as InboundPayload;

  const fromEmail = extractEmail(body.from ?? body.From ?? body.sender ?? body.fromEmail);
  if (!fromEmail) {
    return NextResponse.json({ error: t("expediteur_introuvable") }, { status: 400 });
  }

  const client = await prisma.client.findUnique({ where: { email: fromEmail } });
  if (!client) {
    // Pas un client connu : on ignore silencieusement (200 pour pas que le provider retry)
    return NextResponse.json({ success: true, ignored: true, reason: "Email inconnu" });
  }

  const text = body.text ?? body.TextBody ?? body["stripped-text"] ?? body.body_plain ?? "";
  const subject = body.subject ?? body.Subject ?? "";
  const messageId = body.messageId ?? body.MessageID ?? body["Message-Id"];

  // Combine subject + text
  const content = subject
    ? `Sujet : ${subject}\n\n${text.trim()}`
    : text.trim();

  if (!content) {
    return NextResponse.json({ success: true, ignored: true, reason: "Contenu vide" });
  }

  // Dedupe via emailMessageId
  if (messageId) {
    const existing = await prisma.message.findUnique({ where: { emailMessageId: messageId } });
    if (existing) {
      return NextResponse.json({ success: true, ignored: true, reason: "Doublon (messageId déjà vu)" });
    }
  }

  const msg = await prisma.message.create({
    data: {
      clientId: client.id,
      sender: "client",
      content,
      channel: "email",
      isRead: false,
      emailMessageId: messageId ?? null,
    },
  });

  await createWorkflowEvent({
    clientId: client.id,
    eventType: "message_from_client",
    eventLabel: `Email entrant de ${client.fullName}`,
    triggeredBy: "email",
  });

  const ctx = captureRequestContext(req);
  await logEmailEvent({
    clientId: client.id,
    messageId: messageId ?? undefined,
    type: "delivered",
    email: fromEmail,
    subject: subject || undefined,
    ipAddress: ctx.ipAddress ?? undefined,
    userAgent: ctx.userAgent ?? undefined,
    metadata: { direction: "inbound", internalMessageId: msg.id },
  }).catch(() => {});

  await prisma.notification.create({
    data: {
      recipientType: "admin",
      recipientId: 0,
      type: "info",
      title: "Email entrant",
      body: `${client.fullName} : ${(text || subject).slice(0, 80)}`,
      link: `/admin/messages?clientId=${client.id}`,
    },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, messageId: msg.id });
}

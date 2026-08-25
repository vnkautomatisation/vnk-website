// GET /api/messages — messages (admin: tous, client: les siens, exclut soft-deleted/internal-notes)
// POST /api/messages — envoyer un message (texte + 0..N pieces jointes, reponse, note interne, programmation)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { sendEmail } from "@/lib/services/email";
import { renderChatEmail } from "@/lib/services/email-message-template";

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);
const MAX_DATAURL_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024 * 1.4);
const MAX_ATTACHMENTS = 10;

const attachmentSchema = z.object({
  kind: z.enum(["image", "audio", "pdf", "file"]),
  name: z.string().min(1).max(255),
  mimeType: z.string().min(1).max(120),
  size: z.number().int().positive(),
  dataUrl: z.string().startsWith("data:"),
  durationSec: z.number().int().nonnegative().optional(),
});

const createSchema = z.object({
  clientId: z.number().int().positive().optional(),
  content: z.string().max(10000).optional(),
  channel: z.enum(["chat", "email", "both"]).default("chat"),
  // Compat ancien : single attachment
  attachmentData: attachmentSchema.optional(),
  // Nouveau : multi attachments
  attachmentsData: z.array(attachmentSchema).max(MAX_ATTACHMENTS).optional(),
  replyToId: z.number().int().positive().optional(),
  isInternalNote: z.boolean().default(false),
  scheduledFor: z.string().datetime().optional(),
}).refine(
  (d) => (d.content && d.content.trim().length > 0) || !!d.attachmentData || (d.attachmentsData && d.attachmentsData.length > 0),
  { message: "Message ou pièce jointe requis" },
);

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientIdParam = searchParams.get("clientId");
  const includeDeleted = searchParams.get("includeDeleted") === "true";

  const where: Record<string, unknown> = {};
  if (session.user.role === "admin") {
    if (clientIdParam) where.clientId = Number(clientIdParam);
  } else {
    where.clientId = session.user.clientId!;
    where.isInternalNote = false; // jamais expose au client
    // Ne pas envoyer les messages programmes futurs au client
    where.OR = [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }];
  }
  if (!includeDeleted) where.deletedAt = null;

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: "asc" },
    include: {
      replyTo: { select: { id: true, sender: true, content: true, attachmentsData: true, attachmentData: true, deletedAt: true } },
    },
  });

  return NextResponse.json({ messages });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message ?? "Données invalides" }, { status: 400 });
  }

  // Note interne reservee admin
  if (parsed.data.isInternalNote && session.user.role !== "admin") {
    return NextResponse.json({ error: "Notes internes réservées admin" }, { status: 403 });
  }
  if (await adminApiForbidden("messages", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  // Validation taille pieces jointes
  const allAtts = [
    ...(parsed.data.attachmentData ? [parsed.data.attachmentData] : []),
    ...(parsed.data.attachmentsData ?? []),
  ];
  for (const att of allAtts) {
    if (att.dataUrl.length > MAX_DATAURL_BYTES) {
      return NextResponse.json({ error: `"${att.name}" trop volumineux (max ${MAX_UPLOAD_MB} Mo)` }, { status: 413 });
    }
  }

  const clientId =
    session.user.role === "admin"
      ? parsed.data.clientId
      : session.user.clientId;
  if (!clientId) {
    return NextResponse.json({ error: "clientId manquant" }, { status: 400 });
  }

  // Verifier que le replyTo appartient a la meme conversation
  if (parsed.data.replyToId) {
    const replyTarget = await prisma.message.findUnique({ where: { id: parsed.data.replyToId } });
    if (!replyTarget || replyTarget.clientId !== clientId) {
      return NextResponse.json({ error: "Message cité introuvable" }, { status: 400 });
    }
  }

  const attachmentsArray = parsed.data.attachmentsData ?? (parsed.data.attachmentData ? [parsed.data.attachmentData] : null);
  const isFutureScheduled = parsed.data.scheduledFor && new Date(parsed.data.scheduledFor) > new Date();

  const message = await prisma.message.create({
    data: {
      clientId,
      sender: session.user.role === "admin" ? "vnk" : "client",
      content: parsed.data.content?.trim() || null,
      channel: parsed.data.channel,
      attachmentsData: attachmentsArray ?? undefined,
      replyToId: parsed.data.replyToId,
      isInternalNote: parsed.data.isInternalNote,
      scheduledFor: parsed.data.scheduledFor ? new Date(parsed.data.scheduledFor) : null,
    },
  });

  // Envoi email SMTP si admin et channel email/both, pas note interne, pas programme futur
  const shouldSendEmail =
    session.user.role === "admin" &&
    !parsed.data.isInternalNote &&
    !isFutureScheduled &&
    (parsed.data.channel === "email" || parsed.data.channel === "both");

  if (shouldSendEmail) {
    const recipient = await prisma.client.findUnique({
      where: { id: clientId },
      select: { email: true, fullName: true },
    });
    if (recipient?.email) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.AUTH_URL ?? "https://vnkautomatisation.ca";
      const trackingPixelUrl = `${baseUrl}/api/email/track/${message.id}`;
      const portalUrl = `${baseUrl}/portail`;
      const tpl = renderChatEmail({
        clientName: recipient.fullName,
        content: parsed.data.content?.trim() || "(message sans texte)",
        attachmentNames: attachmentsArray?.map((a) => a.name) ?? [],
        trackingPixelUrl,
        portalUrl,
      });
      sendEmail({
        to: recipient.email,
        subject: `VNK Automatisation — nouveau message`,
        html: tpl.html,
        text: tpl.text,
      }).catch((err) => console.error("[messages] email send failed:", err));
    }
  }

  // Pas d'event workflow si note interne OU envoi programme dans le futur (libere par cron)
  if (!parsed.data.isInternalNote && !isFutureScheduled) {
    await createWorkflowEvent({
      clientId,
      eventType: session.user.role === "admin" ? "message_from_admin" : "message_from_client",
      eventLabel: attachmentsArray && attachmentsArray.length > 0
        ? `Nouveau message + ${attachmentsArray.length} pièce(s) jointe(s)`
        : "Nouveau message",
      triggeredBy: session.user.role === "admin" ? "admin" : "client",
    });
  }

  if (session.user.role === "admin") revalidateAdminViews();

  return NextResponse.json({ success: true, message });
}

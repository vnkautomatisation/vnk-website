// GET /api/messages — messages (admin: tous, client: les siens)
// POST /api/messages — envoyer un message
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";

const createSchema = z.object({
  clientId: z.number().int().positive().optional(), // requis si admin
  content: z.string().min(1).max(10000),
  channel: z.enum(["chat", "email", "both"]).default("chat"),
  attachmentData: z.any().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientIdParam = searchParams.get("clientId");

  const messages = await prisma.message.findMany({
    where:
      session.user.role === "admin"
        ? clientIdParam
          ? { clientId: Number(clientIdParam) }
          : {}
        : { clientId: session.user.clientId! },
    orderBy: { createdAt: "asc" },
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
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const clientId =
    session.user.role === "admin"
      ? parsed.data.clientId
      : session.user.clientId;

  if (!clientId) {
    return NextResponse.json({ error: "clientId manquant" }, { status: 400 });
  }

  const message = await prisma.message.create({
    data: {
      clientId,
      sender: session.user.role === "admin" ? "vnk" : "client",
      content: parsed.data.content,
      channel: parsed.data.channel,
      attachmentData: parsed.data.attachmentData,
    },
  });

  await createWorkflowEvent({
    clientId,
    eventType: session.user.role === "admin" ? "message_from_admin" : "message_from_client",
    eventLabel: "Nouveau message",
    triggeredBy: session.user.role === "admin" ? "admin" : "client",
  });

  // TODO: push WebSocket + notification email selon settings

  return NextResponse.json({ success: true, message });
}

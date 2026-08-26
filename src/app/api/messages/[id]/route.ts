// PATCH /api/messages/[id] — modifier un message (admin ou auteur, ≤ 5 min)
// DELETE /api/messages/[id] — soft-delete un message
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const EDIT_WINDOW_MS = 5 * 60 * 1000;

const patchSchema = z.object({
  content: z.string().max(10000).optional(),
});

function canMutate(msg: { sender: string; createdAt: Date; deletedAt: Date | null }, role: "admin" | "client", clientId?: number | null) {
  if (msg.deletedAt) return false;
  if (role === "admin") return msg.sender === "vnk";
  return msg.sender === "client" && Date.now() - msg.createdAt.getTime() <= EDIT_WINDOW_MS;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedJson();

  const { id } = await params;
  const msgId = Number(id);
  const msg = await prisma.message.findUnique({ where: { id: msgId } });
  if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

  if (session.user.role === "client" && msg.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }
  if (!canMutate(msg, session.user.role as "admin" | "client", session.user.clientId)) {
    return NextResponse.json({ error: "Modification refusée (auteur ou délai dépassé)" }, { status: 403 });
  }
  if (Date.now() - msg.createdAt.getTime() > EDIT_WINDOW_MS && session.user.role !== "admin") {
    return NextResponse.json({ error: "Délai de modification dépassé (5 min)" }, { status: 409 });
  }
  if (await adminApiForbidden("messages", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });

  const updated = await prisma.message.update({
    where: { id: msgId },
    data: {
      content: parsed.data.content?.trim() ?? msg.content,
      editedAt: new Date(),
    },
  });

  if (session.user.role === "admin") revalidateAdminViews();
  return NextResponse.json({ success: true, message: updated });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedJson();

  const { id } = await params;
  const msgId = Number(id);
  const msg = await prisma.message.findUnique({ where: { id: msgId } });
  if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

  if (session.user.role === "client" && msg.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }
  if (!canMutate(msg, session.user.role as "admin" | "client", session.user.clientId)) {
    return NextResponse.json({ error: "Suppression refusée (auteur ou délai dépassé)" }, { status: 403 });
  }

  await prisma.message.update({
    where: { id: msgId },
    data: { deletedAt: new Date(), content: null, attachmentData: undefined, attachmentsData: undefined },
  });

  if (session.user.role === "admin") revalidateAdminViews();
  return NextResponse.json({ success: true });
}

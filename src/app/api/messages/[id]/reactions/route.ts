// POST /api/messages/[id]/reactions — toggle une reaction emoji sur un message
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const schema = z.object({
  emoji: z.string().min(1).max(8),
});

type ReactionsMap = Record<string, string[]>;

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return unauthorizedJson();

  const { id } = await params;
  const msgId = Number(id);
  const msg = await prisma.message.findUnique({ where: { id: msgId } });
  if (!msg) return NextResponse.json({ error: "Message introuvable" }, { status: 404 });

  if (session.user.role === "client" && msg.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }
  if (msg.deletedAt) return NextResponse.json({ error: "Message supprimé" }, { status: 410 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Emoji requis" }, { status: 400 });

  const actor = session.user.role === "admin" ? "vnk" : "client";
  const current: ReactionsMap = (msg.reactions as ReactionsMap | null) ?? {};
  const list = current[parsed.data.emoji] ?? [];
  const has = list.includes(actor);
  const next: ReactionsMap = { ...current };
  if (has) {
    next[parsed.data.emoji] = list.filter((a) => a !== actor);
    if (next[parsed.data.emoji].length === 0) delete next[parsed.data.emoji];
  } else {
    next[parsed.data.emoji] = [...list, actor];
  }

  await prisma.message.update({
    where: { id: msgId },
    data: { reactions: Object.keys(next).length === 0 ? undefined : next },
  });

  return NextResponse.json({ success: true, reactions: next });
}

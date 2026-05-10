// SSE endpoint — push messages en temps reel
// Client : ecoute ses propres messages (omettre clientId)
// Admin : ecoute la conversation d'un client specifique (?clientId=X)
//         ou toutes les conversations (omettre clientId)
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user) {
    return new Response("Non autorise", { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const clientIdParam = searchParams.get("clientId");

  let watchedClientId: number | null = null;
  if (session.user.role === "client") {
    if (!session.user.clientId) return new Response("Non autorise", { status: 401 });
    watchedClientId = session.user.clientId;
  } else {
    watchedClientId = clientIdParam ? Number(clientIdParam) : null; // null = toutes
  }

  let lastId = 0;
  const role = session.user.role;

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const last = await prisma.message.findFirst({
          where: watchedClientId !== null ? { clientId: watchedClientId } : {},
          orderBy: { id: "desc" },
          select: { id: true },
        });
        lastId = last?.id ?? 0;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", lastId })}\n\n`));
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", lastId: 0 })}\n\n`));
      }

      const interval = setInterval(async () => {
        try {
          const where: Record<string, unknown> = { id: { gt: lastId }, deletedAt: null };
          if (watchedClientId !== null) where.clientId = watchedClientId;
          if (role === "client") {
            where.isInternalNote = false;
            where.OR = [{ scheduledFor: null }, { scheduledFor: { lte: new Date() } }];
          }

          const newMessages = await prisma.message.findMany({
            where,
            orderBy: { id: "asc" },
          });

          for (const msg of newMessages) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "new_message",
                  message: {
                    id: msg.id,
                    clientId: msg.clientId,
                    sender: msg.sender,
                    content: msg.content,
                    channel: msg.channel,
                    isRead: msg.isRead,
                    isInternalNote: msg.isInternalNote,
                    createdAt: msg.createdAt.toISOString(),
                    attachmentsData: msg.attachmentsData ?? null,
                    attachmentData: msg.attachmentData ?? null,
                    replyToId: msg.replyToId,
                  },
                })}\n\n`
              )
            );
            lastId = msg.id;
          }
        } catch { /* DB error skip */ }
      }, 2000);

      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(interval);
          clearInterval(ping);
        }
      }, 15000);

      return () => {
        clearInterval(interval);
        clearInterval(ping);
      };
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}

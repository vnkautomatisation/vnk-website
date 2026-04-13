// SSE endpoint — push messages en temps reel au client
// Le client ouvre une connexion persistante, le serveur envoie les nouveaux messages
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user?.clientId) {
    return new Response("Non autorise", { status: 401 });
  }

  const clientId = session.user.clientId;
  let lastId = 0;

  // Encoder pour le stream
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      // Envoyer le dernier ID connu
      try {
        const last = await prisma.message.findFirst({
          where: { clientId },
          orderBy: { id: "desc" },
          select: { id: true },
        });
        lastId = last?.id ?? 0;
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", lastId })}\n\n`));
      } catch {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ type: "connected", lastId: 0 })}\n\n`));
      }

      // Poll la DB toutes les 2s pour les nouveaux messages (simule le push)
      const interval = setInterval(async () => {
        try {
          const newMessages = await prisma.message.findMany({
            where: { clientId, id: { gt: lastId } },
            orderBy: { id: "asc" },
          });

          for (const msg of newMessages) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({
                  type: "new_message",
                  message: {
                    id: msg.id,
                    sender: msg.sender,
                    content: msg.content,
                    createdAt: msg.createdAt.toISOString(),
                    isRead: msg.isRead,
                  },
                })}\n\n`
              )
            );
            lastId = msg.id;
          }

          // Aussi checker les messages marques comme lus par l'admin
          const readUpdates = await prisma.message.findMany({
            where: { clientId, sender: "client", isRead: true, id: { lte: lastId } },
            select: { id: true },
          });
          if (readUpdates.length > 0) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ type: "read_update", ids: readUpdates.map((m) => m.id) })}\n\n`
              )
            );
          }
        } catch {
          // DB error, skip
        }
      }, 2000);

      // Keepalive ping toutes les 15s
      const ping = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(`: ping\n\n`));
        } catch {
          clearInterval(interval);
          clearInterval(ping);
        }
      }, 15000);

      // Cleanup si le client se deconnecte
      const cleanup = () => {
        clearInterval(interval);
        clearInterval(ping);
      };

      // Le stream se ferme quand le client se deconnecte
      // On ne peut pas detecter ca directement, mais les erreurs d'enqueue le feront
      return cleanup;
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

// GET /api/email/track/[messageId] — pixel transparent 1x1 GIF + flag emailOpenedAt
// Appele automatiquement quand le client ouvre l'email
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { captureRequestContext, logEmailEvent } from "@/lib/request-context";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const id = Number(messageId);
  if (!isNaN(id)) {
    const message = await prisma.message.findUnique({
      where: { id }, select: { id: true, clientId: true, emailOpenedAt: true, emailMessageId: true, client: { select: { email: true } } },
    }).catch(() => null);

    if (message && !message.emailOpenedAt) {
      await prisma.message.updateMany({
        where: { id, emailOpenedAt: null },
        data: { emailOpenedAt: new Date() },
      }).catch(() => {});

      const ctx = captureRequestContext(req);
      await logEmailEvent({
        clientId: message.clientId,
        messageId: message.emailMessageId ?? undefined,
        type: "opened",
        email: message.client?.email ?? "",
        ipAddress: ctx.ipAddress ?? undefined,
        userAgent: ctx.userAgent ?? undefined,
        metadata: { internalMessageId: message.id, country: ctx.country },
      }).catch(() => {});
    }
  }
  return new NextResponse(PIXEL, {
    headers: {
      "Content-Type": "image/gif",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Pragma: "no-cache",
      Expires: "0",
    },
  });
}

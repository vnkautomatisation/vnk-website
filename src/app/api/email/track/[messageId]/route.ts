// GET /api/email/track/[messageId] — pixel transparent 1x1 GIF + flag emailOpenedAt
// Appele automatiquement quand le client ouvre l'email
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

// 1x1 transparent GIF
const PIXEL = Buffer.from(
  "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
  "base64",
);

export async function GET(_req: Request, { params }: { params: Promise<{ messageId: string }> }) {
  const { messageId } = await params;
  const id = Number(messageId);
  if (!isNaN(id)) {
    // Premier ouvert seulement (pas de spam updates)
    prisma.message
      .updateMany({
        where: { id, emailOpenedAt: null },
        data: { emailOpenedAt: new Date() },
      })
      .catch(() => {});
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

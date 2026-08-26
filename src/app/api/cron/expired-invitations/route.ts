// CRON · Purge des invitations admin expirées (> 30 jours sans acceptation)
// + auto-révocation des invitations encore "valides" mais expirées par TTL.
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "CRON_SECRET non configuré" }, { status: 500 });
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) return unauthorizedJson();

  const now = new Date();

  // 1. Marquer comme révoquées toutes les invitations expirées non encore révoquées
  const autoRevoke = await prisma.adminInvitation.updateMany({
    where: {
      acceptedAt: null,
      revokedAt: null,
      expiresAt: { lt: now },
    },
    data: { revokedAt: now },
  });

  return NextResponse.json({
    success: true,
    autoRevoked: autoRevoke.count,
    purgedAt: now.toISOString(),
  });
}

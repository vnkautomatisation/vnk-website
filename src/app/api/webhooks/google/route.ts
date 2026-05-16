// POST /api/webhooks/google — webhook entrant Google Calendar Push Notifications
//
// Google requiert :
// - Endpoint HTTPS public, validé via X-Goog-Channel-Token header
// - Enregistrement d'un channel via watch endpoint, renewal manuel
//
// Pour le moment ce endpoint reçoit les notifications mais l'enregistrement
// de channels n'est pas encore implémenté (Phase 2).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const channelId = req.headers.get("x-goog-channel-id");
  const resourceId = req.headers.get("x-goog-resource-id");
  const resourceState = req.headers.get("x-goog-resource-state");

  await prisma.incomingWebhookLog.create({
    data: {
      provider: "google_calendar",
      eventType: resourceState ?? "unknown",
      payload: { channelId, resourceId, resourceState } as unknown as object,
      verified: false,
      processed: false,
    },
  }).catch(() => null);

  // TODO Phase 2 : sur resourceState=exists, fetch incremental sync via
  // syncToken et appliquer les changements aux Appointments.

  return new NextResponse(null, { status: 200 });
}

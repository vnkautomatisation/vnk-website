// POST /api/webhooks/microsoft — webhook entrant Microsoft Graph Subscriptions
//
// Microsoft Graph requiert :
// 1. Validation initiale : à la création d'une subscription, MS POST ce endpoint
//    avec ?validationToken=xxx, on doit répondre 200 text/plain avec le token.
// 2. Notifications : MS POST avec un body JSON {value: [{...}]}
//
// Pour le moment ce endpoint répond à la validation et log les notifications,
// mais l'enregistrement des subscriptions Graph n'est pas encore implémenté
// (nécessite renewal automatique toutes les 71 h via cron).
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const url = new URL(req.url);
  const validationToken = url.searchParams.get("validationToken");

  // Validation handshake Microsoft
  if (validationToken) {
    return new NextResponse(validationToken, {
      status: 200,
      headers: { "Content-Type": "text/plain" },
    });
  }

  let payload: { value?: Array<{ subscriptionId: string; changeType: string; resource: string; resourceData?: { id: string } }> } | null = null;
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ received: true });
  }

  // Log pour debug
  await prisma.incomingWebhookLog.create({
    data: {
      provider: "microsoft_calendar",
      eventType: payload?.value?.[0]?.changeType ?? "unknown",
      payload: (payload ?? {}) as unknown as object,
      verified: false,
      processed: false,
    },
  }).catch(() => null);

  // TODO Phase 2 : traiter les notifications de changement d'évènement
  // Pour chaque notif: fetch GET /me/events/{id}, retrouver l'Appointment
  // par meetingId préfixé "ms:" et synchroniser date/heure/statut.

  return NextResponse.json({ received: true });
}

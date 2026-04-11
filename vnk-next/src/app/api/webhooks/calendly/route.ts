// POST /api/webhooks/calendly — reçoit les notifications Calendly
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import crypto from "crypto";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const signature = req.headers.get("calendly-webhook-signature");

  const secret = await getSetting<string>("integrations", "calendly_webhook_secret");

  // Validation de signature (si configurée)
  if (secret && signature) {
    const expected = crypto
      .createHmac("sha256", secret)
      .update(rawBody)
      .digest("hex");
    if (expected !== signature) {
      return NextResponse.json({ error: "Signature invalide" }, { status: 401 });
    }
  }

  let event: any;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log pour debug/replay
  await prisma.incomingWebhookLog.create({
    data: {
      provider: "calendly",
      eventType: event.event ?? "unknown",
      payload: event,
      signature,
      verified: !!secret,
      processed: false,
    },
  });

  // TODO: handle invitee.created / invitee.canceled
  // Pour l'instant : log + ack

  return NextResponse.json({ received: true });
}

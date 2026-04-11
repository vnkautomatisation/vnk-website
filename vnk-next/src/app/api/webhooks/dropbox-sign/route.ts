// POST /api/webhooks/dropbox-sign
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyDropboxSignWebhook } from "@/lib/services/dropbox-sign";
import { createWorkflowEvent, onContractFullySigned } from "@/lib/workflow";

export async function POST(req: Request) {
  const formData = await req.formData();
  const json = formData.get("json")?.toString();
  if (!json) {
    return NextResponse.json({ error: "Missing json" }, { status: 400 });
  }

  let event: any;
  try {
    event = JSON.parse(json);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Vérification HMAC
  const hash = event.event?.event_hash;
  const eventTime = event.event?.event_time;
  const signedContent = `${event.event?.event_time}${event.event?.event_type}`;
  const verified = hash ? await verifyDropboxSignWebhook(signedContent, hash) : false;

  await prisma.incomingWebhookLog.create({
    data: {
      provider: "dropbox_sign",
      eventType: event.event?.event_type ?? "unknown",
      payload: event,
      signature: hash,
      verified,
      processed: false,
    },
  });

  // Handle signature_request_signed
  if (event.event?.event_type === "signature_request_signed") {
    const reqId = event.signature_request?.signature_request_id;
    if (reqId) {
      const contract = await prisma.contract.findFirst({
        where: { hellosignRequestId: reqId },
      });
      if (contract) {
        await prisma.contract.update({
          where: { id: contract.id },
          data: { status: "signed", signedAt: new Date() },
        });
        await onContractFullySigned(contract.id, "dropbox_sign");
      }
    }
  }

  // Dropbox Sign requires this exact response
  return new Response("Hello API Event Received", {
    headers: { "Content-Type": "text/plain" },
  });
}

// POST /api/webhooks/dropbox-sign — webhook entrant Dropbox Sign
// Met à jour le contrat associé quand la signature est complétée.
// Doc : https://developers.hellosign.com/api/reference/callbacks-and-events/
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { downloadSignedDocument } from "@/lib/integrations/dropbox-sign";
import { createWorkflowEvent } from "@/lib/workflow";

type DropboxSignEvent = {
  event_type:
    | "signature_request_sent"
    | "signature_request_viewed"
    | "signature_request_signed"
    | "signature_request_all_signed"
    | "signature_request_declined"
    | "signature_request_canceled"
    | string;
  event_time: string;
};

export async function POST(req: Request) {
  // Dropbox Sign envoie un POST multipart avec "json" dans le body
  const contentType = req.headers.get("content-type") ?? "";
  let payload: { event: DropboxSignEvent; signature_request?: { signature_request_id: string; metadata?: Record<string, string> } } | null = null;

  if (contentType.includes("application/json")) {
    payload = await req.json();
  } else {
    // multipart/form-data
    const form = await req.formData();
    const json = form.get("json");
    if (typeof json === "string") payload = JSON.parse(json);
  }

  if (!payload?.event) {
    return new NextResponse("Hello API Event Received", { status: 200 });
  }

  // Log
  await prisma.incomingWebhookLog.create({
    data: {
      provider: "dropbox_sign",
      eventType: payload.event.event_type,
      payload: payload as unknown as object,
      verified: false,
      processed: false,
    },
  }).catch(() => null);

  const sigReq = payload.signature_request;
  if (!sigReq) {
    return new NextResponse("Hello API Event Received", { status: 200 });
  }

  // Retrouver le contrat par hellosignRequestId
  const contract = await prisma.contract.findFirst({
    where: { hellosignRequestId: sigReq.signature_request_id },
    include: { client: { select: { fullName: true } } },
  });
  if (!contract) {
    return new NextResponse("Hello API Event Received", { status: 200 });
  }

  // Traitement selon le type d'évènement
  if (payload.event.event_type === "signature_request_all_signed") {
    // Tous les signataires ont signé — télécharger le PDF final
    const pdfBuf = await downloadSignedDocument(sigReq.signature_request_id);
    let fileUrl: string | undefined;
    if (pdfBuf) {
      // Stocker en base64 data URL ou sur Dropbox — ici on stocke en data URL
      fileUrl = `data:application/pdf;base64,${pdfBuf.toString("base64")}`;
    }

    await prisma.contract.update({
      where: { id: contract.id },
      data: {
        status: "signed",
        signedAt: new Date(),
        ...(fileUrl ? { fileUrl } : {}),
      },
    });

    await createWorkflowEvent({
      clientId: contract.clientId,
      contractId: contract.id,
      eventType: "contract_signed_both",
      eventLabel: `Contrat ${contract.contractNumber} signé via Dropbox Sign`,
      triggeredBy: "client",
      metadata: { provider: "dropbox_sign", requestId: sigReq.signature_request_id },
    });
  } else if (payload.event.event_type === "signature_request_declined" || payload.event.event_type === "signature_request_canceled") {
    await prisma.contract.update({
      where: { id: contract.id },
      data: { status: "cancelled" },
    });
  }

  return new NextResponse("Hello API Event Received", { status: 200 });
}

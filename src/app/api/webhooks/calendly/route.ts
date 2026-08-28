// POST /api/webhooks/calendly — reçoit les notifications Calendly
// Gère invitee.created (création RDV) et invitee.canceled (annulation).
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSetting } from "@/lib/settings";
import { createWorkflowEvent } from "@/lib/workflow";
import crypto from "crypto";

type CalendlyInvitee = {
  email: string;
  name: string;
  text_reminder_number?: string;
};

type CalendlyEventPayload = {
  invitee?: CalendlyInvitee;
  event?: {
    uri: string;
    start_time: string;
    end_time: string;
    name?: string;
    location?: { type: string; join_url?: string; location?: string };
  };
  questions_and_answers?: Array<{ question: string; answer: string }>;
  cancellation?: { canceled_by: string; reason: string };
};

type CalendlyWebhookEvent = {
  event: "invitee.created" | "invitee.canceled" | string;
  payload: CalendlyEventPayload;
  created_at?: string;
};

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

  let event: CalendlyWebhookEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Log pour debug/replay
  const logEntry = await prisma.incomingWebhookLog.create({
    data: {
      provider: "calendly",
      eventType: event.event ?? "unknown",
      payload: event as unknown as object,
      signature,
      verified: !!secret,
      processed: false,
    },
  });

  try {
    if (event.event === "invitee.created") {
      await handleInviteeCreated(event.payload);
    } else if (event.event === "invitee.canceled") {
      await handleInviteeCanceled(event.payload);
    }

    await prisma.incomingWebhookLog.update({
      where: { id: logEntry.id },
      data: { processed: true },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Erreur traitement";
    await prisma.incomingWebhookLog.update({
      where: { id: logEntry.id },
      data: { processed: false, error: msg.slice(0, 500) },
    }).catch(() => null);
  }

  return NextResponse.json({ received: true });
}

// ─────────────────────────────────────────────────────────
// Crée un Appointment dans le portail à partir des données Calendly
// ─────────────────────────────────────────────────────────
async function handleInviteeCreated(payload: CalendlyEventPayload): Promise<void> {
  const invitee = payload.invitee;
  const event = payload.event;
  if (!invitee || !event) return;

  // Parse dates
  const startDate = new Date(event.start_time);
  const endDate = new Date(event.end_time);
  const appointmentDate = new Date(startDate.toISOString().slice(0, 10));
  const startTime = `${String(startDate.getHours()).padStart(2, "0")}:${String(startDate.getMinutes()).padStart(2, "0")}`;
  const endTime = `${String(endDate.getHours()).padStart(2, "0")}:${String(endDate.getMinutes()).padStart(2, "0")}`;
  const durationMin = Math.round((endDate.getTime() - startDate.getTime()) / 60000);

  // Tenter de matcher avec un client existant par email
  const client = await prisma.client.findUnique({ where: { email: invitee.email } });

  // Lien de réunion (Zoom / Google Meet / Teams depuis Calendly)
  const meetingLink = event.location?.join_url ?? event.location?.location ?? null;
  const meetingType: "video" | "phone" | "onsite" = event.location?.type === "physical"
    ? "onsite"
    : event.location?.type === "phone"
      ? "phone"
      : "video";

  // Notes admin avec Q&A Calendly
  const qaNotes = payload.questions_and_answers
    ?.map((qa) => `${qa.question} : ${qa.answer}`)
    .join("\n") ?? "";
  const notesAdmin = [`[Calendly] ${event.uri}`, qaNotes].filter(Boolean).join("\n\n");

  // Création de l'Appointment
  const appointment = await prisma.appointment.create({
    data: {
      clientId: client?.id ?? null,
      clientName: invitee.name,
      clientEmail: invitee.email,
      appointmentDate,
      startTime,
      endTime,
      durationMin,
      subject: event.name ?? null,
      meetingType,
      meetingLink,
      meetingId: `calendly:${event.uri.split("/").pop() ?? Date.now()}`,
      notesAdmin,
      status: "confirmed",
    },
  });

  // Workflow event si client connu
  if (client) {
    await createWorkflowEvent({
      clientId: client.id,
      eventType: "appointment_booked",
      eventLabel: `Rendez-vous Calendly réservé — ${event.name || startTime}`,
      labelKey: "workflow_events.calendly_reserve",
      labelParams: { name: event.name || startTime },
      triggeredBy: "client",
      metadata: { appointmentId: appointment.id, source: "calendly", calendlyUri: event.uri },
    });
  }
}

async function handleInviteeCanceled(payload: CalendlyEventPayload): Promise<void> {
  const event = payload.event;
  if (!event) return;

  // Retrouver l'Appointment par meetingId
  const calendlyId = event.uri.split("/").pop();
  if (!calendlyId) return;

  const appointment = await prisma.appointment.findFirst({
    where: { meetingId: `calendly:${calendlyId}` },
  });
  if (!appointment) return;

  await prisma.appointment.update({
    where: { id: appointment.id },
    data: {
      status: "cancelled",
      cancelledAt: new Date(),
      cancelledBy: "client",
      cancellationReason: payload.cancellation?.reason ?? "Annulé via Calendly",
    },
  });

  if (appointment.clientId) {
    await createWorkflowEvent({
      clientId: appointment.clientId,
      eventType: "appointment_cancelled",
      eventLabel: `Rendez-vous Calendly annulé`,
      labelKey: "workflow_events.calendly_annule",
      triggeredBy: "client",
      metadata: { appointmentId: appointment.id, source: "calendly" },
    });
  }
}

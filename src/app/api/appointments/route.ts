// GET /api/appointments — liste RDV (admin: tous, client: les siens)
// POST /api/appointments — creer un RDV (admin) + auto-creation Teams meeting si MS connecte
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { createOutlookEvent, getMicrosoftStatus } from "@/lib/integrations/microsoft";
import { createGoogleEvent, getGoogleStatus } from "@/lib/integrations/google";
import { notifyAppointmentBooked } from "@/lib/integrations/slack";
import { triggerZap } from "@/lib/integrations/zapier";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const schema = z.object({
  slotId: z.number().optional(),
  clientId: z.number().optional(),
  clientName: z.string().min(1),
  clientEmail: z.string().email().optional(),
  appointmentDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  durationMin: z.number().default(30),
  subject: z.string().optional(),
  meetingType: z.enum(["video", "phone", "onsite"]).default("video"),
  meetingLink: z.string().optional(),
  notesAdmin: z.string().optional(),
});

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const { searchParams } = new URL(req.url);
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");

  const where: Record<string, unknown> = {};
  if (session.user.role === "client") where.clientId = session.user.clientId!;
  if (fromParam || toParam) {
    where.appointmentDate = {
      ...(fromParam ? { gte: new Date(fromParam) } : {}),
      ...(toParam ? { lte: new Date(toParam) } : {}),
    };
  }

  const appointments = await prisma.appointment.findMany({
    where,
    orderBy: [{ appointmentDate: "asc" }, { startTime: "asc" }],
    include: { client: { select: { id: true, fullName: true, email: true, phone: true } } },
  });

  return NextResponse.json({ appointments });
}

export async function POST(req: NextRequest) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("appointments", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t(parsed.error.errors[0].message) }, { status: 400 });
  }

  // Normalise : si endTime <= startTime, force endTime = startTime + 30min (defaut RDV)
  const startTime = parsed.data.startTime;
  let endTime = parsed.data.endTime;
  if (endTime <= startTime) {
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + 30;
    endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  let meetingLink = parsed.data.meetingLink;
  let meetingId: string | null = null;
  let meetingProvider: string | null = null;

  // ── Auto-generation reunion en ligne (Microsoft Teams en priorite, Google Meet en fallback) ──
  if (parsed.data.meetingType === "video" && !meetingLink) {
    const isoDate = new Date(parsed.data.appointmentDate).toISOString().slice(0, 10);
    const startISO = `${isoDate}T${startTime}:00`;
    const endISO = `${isoDate}T${endTime}:00`;
    const attendees = parsed.data.clientEmail
      ? [{ email: parsed.data.clientEmail, name: parsed.data.clientName }]
      : [];
    const subject = parsed.data.subject || t("route_rendez_vous_avec_p0", { p0: parsed.data.clientName });

    // 1. Essayer Microsoft Teams
    try {
      const msStatus = await getMicrosoftStatus();
      if (msStatus.connected) {
        const event = await createOutlookEvent({
          subject, body: parsed.data.notesAdmin ?? "",
          startISO, endISO, timezone: "America/Toronto",
          attendees, isOnlineMeeting: true,
        });
        if (event.joinUrl) {
          meetingLink = event.joinUrl;
          // Prefixe pour identifier le provider au DELETE/CANCEL
          meetingId = `ms:${event.eventId}`;
          meetingProvider = "microsoft";
        }
      }
    } catch (err) {
      console.error("[appointments] Teams meeting auto-gen failed:", err);
    }

    // 2. Sinon Google Meet
    if (!meetingLink) {
      try {
        const gStatus = await getGoogleStatus();
        if (gStatus.connected) {
          // Google Calendar accepte ISO avec offset, on l'ajoute pour America/Toronto (-04:00 ete / -05:00 hiver)
          const startWithOffset = new Date(`${startISO}-04:00`).toISOString();
          const endWithOffset = new Date(`${endISO}-04:00`).toISOString();
          const event = await createGoogleEvent({
            subject, body: parsed.data.notesAdmin ?? "",
            startISO: startWithOffset, endISO: endWithOffset, timezone: "America/Toronto",
            attendees, withMeet: true,
          });
          if (event.joinUrl) {
            meetingLink = event.joinUrl;
            meetingId = `gg:${event.eventId}`;
            meetingProvider = "google";
          }
        }
      } catch (err) {
        console.error("[appointments] Google Meet auto-gen failed:", err);
      }
    }
  }
  void meetingProvider; // tracking uniquement

  const appointment = await prisma.appointment.create({
    data: {
      slotId: parsed.data.slotId,
      clientId: parsed.data.clientId,
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail ?? "",
      appointmentDate: new Date(parsed.data.appointmentDate),
      startTime,
      endTime,
      durationMin: parsed.data.durationMin,
      subject: parsed.data.subject,
      meetingType: parsed.data.meetingType,
      meetingLink,
      meetingId,
      notesAdmin: parsed.data.notesAdmin,
      status: "confirmed",
    },
  });

  if (parsed.data.slotId) {
    await prisma.availabilitySlot.update({
      where: { id: parsed.data.slotId },
      data: { status: "booked" },
    });
  }

  if (parsed.data.clientId) {
    await createWorkflowEvent({
      clientId: parsed.data.clientId,
      eventType: "appointment_booked",
      eventLabel: t("route_rendez_vous_reserve_p0", { p0: parsed.data.subject || parsed.data.startTime }),
      labelKey: "api_errors.route_rendez_vous_reserve_p0",
      labelParams: { p0: parsed.data.subject || parsed.data.startTime },
      triggeredBy: "admin",
      metadata: { appointmentId: appointment.id, date: parsed.data.appointmentDate },
    });
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "appointments",
    entityId: appointment.id,
  });

  // Notifications externes (non bloquantes)
  void notifyAppointmentBooked({
    clientName: parsed.data.clientName,
    subject: parsed.data.subject,
    date: parsed.data.appointmentDate,
    startTime,
    meetingLink,
  });
  void triggerZap("appointments.booked", {
    id: appointment.id,
    clientName: parsed.data.clientName,
    clientEmail: parsed.data.clientEmail,
    date: parsed.data.appointmentDate,
    startTime, endTime,
    meetingLink, meetingType: parsed.data.meetingType,
    subject: parsed.data.subject,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, appointment });
}

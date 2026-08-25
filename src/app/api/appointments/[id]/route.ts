// GET /api/appointments/[id] — detail RDV (admin OU client proprietaire)
// PATCH /api/appointments/[id] — modifier un RDV (admin)
// DELETE /api/appointments/[id] — supprimer un RDV (admin)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent, type WorkflowEventType } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { deleteOutlookEvent, updateOutlookEvent } from "@/lib/integrations/microsoft";
import { deleteGoogleEvent, updateGoogleEvent } from "@/lib/integrations/google";
import { triggerZap } from "@/lib/integrations/zapier";
import { notifyAppointmentCancelled } from "@/lib/integrations/slack";

// Helper: dispatch update event externe selon prefixe
async function updateExternalMeeting(
  meetingId: string | null,
  patch: { subject?: string; body?: string; startISO?: string; endISO?: string; timezone?: string; attendees?: { email: string; name?: string }[] }
): Promise<void> {
  if (!meetingId) return;
  try {
    if (meetingId.startsWith("ms:")) {
      await updateOutlookEvent(meetingId.slice(3), patch);
    } else if (meetingId.startsWith("gg:")) {
      await updateGoogleEvent(meetingId.slice(3), patch);
    }
  } catch (err) {
    console.error("[appointments] external meeting update failed:", err);
  }
}

// Helper: dispatch suppression selon le prefixe du meetingId
async function deleteExternalMeeting(meetingId: string | null): Promise<void> {
  if (!meetingId) return;
  try {
    if (meetingId.startsWith("ms:")) {
      await deleteOutlookEvent(meetingId.slice(3));
    } else if (meetingId.startsWith("gg:")) {
      await deleteGoogleEvent(meetingId.slice(3));
    }
  } catch (err) {
    console.error("[appointments] external meeting delete failed:", err);
  }
}

const updateSchema = z.object({
  appointmentDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  subject: z.string().nullable().optional(),
  meetingType: z.enum(["video", "phone", "onsite"]).optional(),
  meetingLink: z.string().nullable().optional(),
  notesAdmin: z.string().nullable().optional(),
  status: z.enum(["confirmed", "cancelled", "no_show", "completed"]).optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnée à mettre à jour" });

const STATUS_TO_EVENT: Record<string, { type: WorkflowEventType; label: string }> = {
  cancelled: { type: "appointment_cancelled", label: "annulé" },
  completed: { type: "appointment_completed", label: "complété" },
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (Number.isNaN(appointmentId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: { select: { id: true, fullName: true, companyName: true, email: true, phone: true } } },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
  }
  if (session.user.role === "client" && appointment.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  return NextResponse.json({ appointment });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("appointments", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);

  const existing = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!existing) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.appointmentDate) data.appointmentDate = new Date(data.appointmentDate as string);

  // Normalise endTime si <= startTime (force +30min)
  const newStart = (data.startTime as string | undefined) ?? existing.startTime;
  const newEnd = (data.endTime as string | undefined) ?? existing.endTime;
  if (newStart && newEnd && newEnd <= newStart) {
    const [h, m] = newStart.split(":").map(Number);
    const total = h * 60 + m + 30;
    data.endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

  // Si annulation, libere le slot lie + cancelledAt
  const isCancellation = parsed.data.status === "cancelled" && existing.status !== "cancelled";
  if (isCancellation) {
    data.cancelledAt = new Date();
    data.cancelledBy = "admin";
  }

  const appointment = await prisma.appointment.update({
    where: { id: appointmentId },
    data,
  });

  // ── Sync update event externe (Outlook/Google) si changement de date/heure/sujet ──
  const dateChanged = parsed.data.appointmentDate || parsed.data.startTime || parsed.data.endTime;
  if (!isCancellation && dateChanged && existing.meetingId) {
    const isoDate = (appointment.appointmentDate ?? existing.appointmentDate).toISOString().slice(0, 10);
    const startISO = `${isoDate}T${appointment.startTime}:00`;
    const endISO = `${isoDate}T${appointment.endTime}:00`;
    void updateExternalMeeting(existing.meetingId, {
      subject: appointment.subject ?? undefined,
      body: appointment.notesAdmin ?? undefined,
      startISO,
      endISO,
      timezone: "America/Toronto",
      attendees: appointment.clientEmail
        ? [{ email: appointment.clientEmail, name: appointment.clientName }]
        : undefined,
    });
  }

  if (isCancellation && existing.slotId) {
    await prisma.availabilitySlot.update({
      where: { id: existing.slotId },
      data: { status: "available" },
    });
  }

  // ── Supprimer la reunion en ligne (Teams/Meet) si annulation ──
  if (isCancellation) {
    await deleteExternalMeeting(existing.meetingId);
    const isoDate = existing.appointmentDate.toISOString().slice(0, 10);
    void notifyAppointmentCancelled({
      clientName: existing.clientName,
      date: isoDate,
      startTime: existing.startTime,
      reason: existing.cancellationReason,
    });
    void triggerZap("appointments.cancelled", {
      id: existing.id, clientId: existing.clientId,
      date: existing.appointmentDate, startTime: existing.startTime,
      subject: existing.subject,
    });
  }

  // Workflow event sur changement de statut
  if (parsed.data.status && parsed.data.status !== existing.status) {
    const meta = STATUS_TO_EVENT[parsed.data.status];
    if (meta && existing.clientId) {
      await createWorkflowEvent({
        clientId: existing.clientId,
        eventType: meta.type,
        eventLabel: `Rendez-vous ${meta.label} — ${existing.subject || existing.startTime}`,
        triggeredBy: "admin",
        metadata: { appointmentId },
      });
    }
  }

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "appointments",
    entityId: appointmentId,
    changes: parsed.data,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, appointment });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("appointments", "delete")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { id } = await params;
  const appointmentId = Number(id);

  const appt = await prisma.appointment.findUnique({ where: { id: appointmentId } });
  if (!appt) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
  }

  if (appt.slotId) {
    await prisma.availabilitySlot.update({
      where: { id: appt.slotId },
      data: { status: "available" },
    });
  }

  // ── Supprimer la reunion en ligne (Teams/Meet) associee ──
  await deleteExternalMeeting(appt.meetingId);

  await prisma.appointment.delete({ where: { id: appointmentId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "appointments",
    entityId: appointmentId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}

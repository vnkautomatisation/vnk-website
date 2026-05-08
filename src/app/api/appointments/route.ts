// POST /api/appointments — creer un RDV (admin)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";

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

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const appointment = await prisma.appointment.create({
    data: {
      slotId: parsed.data.slotId,
      clientId: parsed.data.clientId,
      clientName: parsed.data.clientName,
      clientEmail: parsed.data.clientEmail ?? "",
      appointmentDate: new Date(parsed.data.appointmentDate),
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      durationMin: parsed.data.durationMin,
      subject: parsed.data.subject,
      meetingType: parsed.data.meetingType,
      meetingLink: parsed.data.meetingLink,
      notesAdmin: parsed.data.notesAdmin,
      status: "confirmed",
    },
  });

  // Marquer le slot comme reserve si lie
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
      eventLabel: `Rendez-vous reserve — ${parsed.data.subject || parsed.data.startTime}`,
      triggeredBy: "admin",
    });
  }

  return NextResponse.json({ success: true, appointment });
}

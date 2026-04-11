// POST /api/calendar/book — réserver un créneau (client authentifié)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";

const bookSchema = z.object({
  slotId: z.number().int().positive(),
  subject: z.string().max(500).optional(),
  notesClient: z.string().optional(),
  meetingType: z.enum(["video", "phone", "onsite"]).default("video"),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "client") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  // Vérifier que le slot est bien disponible + réserver
  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: parsed.data.slotId },
  });
  if (!slot) {
    return NextResponse.json({ error: "Créneau introuvable" }, { status: 404 });
  }
  if (slot.status !== "available") {
    return NextResponse.json({ error: "Créneau déjà réservé" }, { status: 409 });
  }

  const client = await prisma.client.findUniqueOrThrow({
    where: { id: session.user.clientId! },
  });

  // Transaction : créer appointment + bloquer slot
  const [appointment] = await prisma.$transaction([
    prisma.appointment.create({
      data: {
        slotId: slot.id,
        clientId: client.id,
        clientName: client.fullName,
        clientEmail: client.email,
        clientCompany: client.companyName,
        appointmentDate: slot.slotDate,
        startTime: slot.startTime,
        endTime: slot.endTime,
        durationMin: slot.durationMin,
        subject: parsed.data.subject,
        notesClient: parsed.data.notesClient,
        meetingType: parsed.data.meetingType,
        status: "confirmed",
      },
    }),
    prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: { status: "booked" },
    }),
  ]);

  await createWorkflowEvent({
    clientId: client.id,
    eventType: "appointment_booked",
    eventLabel: `RDV réservé — ${slot.slotDate.toLocaleDateString("fr-CA")} ${slot.startTime}`,
    triggeredBy: "client",
  });

  return NextResponse.json({ success: true, appointment });
}

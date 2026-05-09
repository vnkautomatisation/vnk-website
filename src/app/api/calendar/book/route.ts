// POST /api/calendar/book — réserver un créneau (client authentifié via portail)
// → Le slot passe à "booked", l'appointment à "confirmed", workflow event + notification admin
// → L'envoi email sera ajouté quand l'infra mail sera prête
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";

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

  // Transaction : creer appointment confirmé + bloquer slot
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
        status: "confirmed", // auto-confirme la reservation cote portail
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
    eventLabel: `RDV réservé par ${client.fullName} — ${slot.slotDate.toLocaleDateString("fr-CA")} ${slot.startTime}`,
    triggeredBy: "client",
    metadata: { appointmentId: appointment.id, slotId: slot.id },
  });

  // Notification in-app pour les admins (envoyee a tous les admins)
  const admins = await prisma.admin.findMany({ select: { id: true } });
  if (admins.length > 0) {
    await prisma.notification.createMany({
      data: admins.map((a) => ({
        recipientType: "admin" as const,
        recipientId: a.id,
        type: "appointment_booked",
        title: "Nouveau rendez-vous",
        message: `${client.fullName} a réservé un RDV le ${slot.slotDate.toLocaleDateString("fr-CA")} à ${slot.startTime}`,
        actionUrl: `/admin/calendar`,
      })),
    });
  }

  // TODO: envoyer email de confirmation au client + notification email admin
  // (sera branche au volet emails)

  revalidateAdminViews();

  return NextResponse.json({ success: true, appointment });
}

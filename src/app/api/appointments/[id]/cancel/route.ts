// POST /api/appointments/[id]/cancel — annulation par le client (depuis le portail)
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (Number.isNaN(appointmentId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { client: { select: { fullName: true } } },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
  }

  if (appointment.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 403 });
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: "Déjà annulé" }, { status: 400 });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: "cancelled",
      cancelledBy: "client",
      cancelledAt: new Date(),
    },
  });

  // Libere le slot lie pour que d'autres puissent reserver
  if (appointment.slotId) {
    await prisma.availabilitySlot.update({
      where: { id: appointment.slotId },
      data: { status: "available" },
    });
  }

  await createWorkflowEvent({
    clientId: appointment.clientId,
    eventType: "appointment_cancelled",
    eventLabel: `Rendez-vous annulé par ${appointment.client?.fullName ?? "client"} — ${appointment.subject || appointment.startTime}`,
    triggeredBy: "client",
    metadata: { appointmentId },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}

// POST /api/appointments/[id]/cancel — annulation par le client (depuis le portail)
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user?.clientId) {
    return unauthorizedJson();
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
    return NextResponse.json({ error: t("rendez_vous_introuvable") }, { status: 404 });
  }

  if (appointment.clientId !== session.user.clientId) {
    return unauthorizedJson(403);
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: t("deja_annule") }, { status: 400 });
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
    eventLabel: t("route_rendez_vous_annule_par_p0_p1", { p0: appointment.client?.fullName ?? "client", p1: appointment.subject || appointment.startTime }),
    labelKey: "api_errors.route_rendez_vous_annule_par_p0_p1",
    labelParams: { p0: appointment.client?.fullName ?? "client", p1: appointment.subject || appointment.startTime },
    triggeredBy: "client",
    metadata: { appointmentId },
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}

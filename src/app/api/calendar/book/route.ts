// POST /api/calendar/book — réserver un créneau (client authentifié via portail)
// → Le slot passe à "booked", l'appointment à "confirmed", workflow event + notification admin
// → L'envoi email sera ajouté quand l'infra mail sera prête
import { NextResponse } from "next/server";
import { getTranslations, getLocale } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";
import { dateLocale } from "@/lib/i18n-format";

const bookSchema = z.object({
  slotId: z.number().int().positive(),
  subject: z.string().max(500).optional(),
  notesClient: z.string().optional(),
  meetingType: z.enum(["video", "phone", "onsite"]).default("video"),
});

export async function POST(req: Request) {
  const t = await getTranslations("api_errors");
  const dateTag = dateLocale(await getLocale());
  const session = await auth();
  if (!session?.user || session.user.role !== "client") {
    return unauthorizedJson();
  }

  const body = await req.json();
  const parsed = bookSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t("donnees_invalides") }, { status: 400 });
  }

  const slot = await prisma.availabilitySlot.findUnique({
    where: { id: parsed.data.slotId },
  });
  if (!slot) {
    return NextResponse.json({ error: t("creneau_introuvable") }, { status: 404 });
  }
  if (slot.status !== "available") {
    return NextResponse.json({ error: t("creneau_deja_reserve") }, { status: 409 });
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
    eventLabel: t("route_rdv_reserve_par_p0_p1_p2", { p0: client.fullName, p1: slot.slotDate.toLocaleDateString(dateTag), p2: slot.startTime }),
    labelKey: "api_errors.route_rdv_reserve_par_p0_p1_p2",
    labelParams: { p0: client.fullName, p1: slot.slotDate.toLocaleDateString(dateTag), p2: slot.startTime },
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
        title: t("nouveau_rendez_vous"),
        message: t("route_p0_a_reserve_un_rdv_le_p1_a", { p0: client.fullName, p1: slot.slotDate.toLocaleDateString(dateTag), p2: slot.startTime }),
        actionUrl: `/admin/calendar`,
      })),
    });
  }

  // TODO: envoyer email de confirmation au client + notification email admin
  // (sera branche au volet emails)

  revalidateAdminViews();

  return NextResponse.json({ success: true, appointment });
}

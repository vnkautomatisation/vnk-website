// GET /api/appointments — liste RDV (admin: tous, client: les siens)
// POST /api/appointments — creer un RDV (admin)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { revalidateAdminViews } from "@/lib/revalidate";

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
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
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
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Normalise : si endTime <= startTime, force endTime = startTime + 30min (defaut RDV)
  const startTime = parsed.data.startTime;
  let endTime = parsed.data.endTime;
  if (endTime <= startTime) {
    const [h, m] = startTime.split(":").map(Number);
    const total = h * 60 + m + 30;
    endTime = `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  }

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
      meetingLink: parsed.data.meetingLink,
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
      eventLabel: `Rendez-vous réservé — ${parsed.data.subject || parsed.data.startTime}`,
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

  revalidateAdminViews();

  return NextResponse.json({ success: true, appointment });
}

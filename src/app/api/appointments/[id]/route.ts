// PATCH /api/appointments/[id] — modifier un RDV
// DELETE /api/appointments/[id] — supprimer un RDV
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  // Si changement de date, convertir
  if (body.appointmentDate) {
    body.appointmentDate = new Date(body.appointmentDate);
  }

  const appointment = await prisma.appointment.update({
    where: { id: Number(id) },
    data: body,
  });

  return NextResponse.json({ success: true, appointment });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;

  // Liberer le slot si lie
  const appt = await prisma.appointment.findUnique({ where: { id: Number(id) } });
  if (appt?.slotId) {
    await prisma.availabilitySlot.update({
      where: { id: appt.slotId },
      data: { status: "available" },
    });
  }

  await prisma.appointment.delete({ where: { id: Number(id) } });

  return NextResponse.json({ success: true });
}

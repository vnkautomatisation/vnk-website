import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const { id } = await params;
  const appointmentId = Number(id);
  if (isNaN(appointmentId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
  });

  if (!appointment) {
    return NextResponse.json({ error: "Rendez-vous introuvable" }, { status: 404 });
  }

  if (appointment.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }

  if (appointment.status === "cancelled") {
    return NextResponse.json({ error: "Deja annule" }, { status: 400 });
  }

  await prisma.appointment.update({
    where: { id: appointmentId },
    data: {
      status: "cancelled",
      cancelledBy: "client",
      cancelledAt: new Date(),
    },
  });

  return NextResponse.json({ success: true });
}

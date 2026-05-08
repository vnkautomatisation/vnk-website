// PATCH /api/calendar/slots/[id] — modifier/bloquer un creneau
// DELETE /api/calendar/slots/[id] — supprimer un creneau
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

  const slot = await prisma.availabilitySlot.update({
    where: { id: Number(id) },
    data: body,
  });

  return NextResponse.json({ success: true, slot });
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
  await prisma.availabilitySlot.delete({ where: { id: Number(id) } });

  return NextResponse.json({ success: true });
}

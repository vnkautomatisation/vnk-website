// POST /api/calendar/slots — creer un creneau de disponibilite (admin)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const schema = z.object({
  slotDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  durationMin: z.number().optional(),
  status: z.enum(["available", "blocked"]).default("available"),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  const slot = await prisma.availabilitySlot.create({
    data: {
      slotDate: new Date(parsed.data.slotDate),
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      durationMin: parsed.data.durationMin ?? 30,
      status: parsed.data.status,
      notes: parsed.data.notes,
    },
  });

  return NextResponse.json({ success: true, slot });
}

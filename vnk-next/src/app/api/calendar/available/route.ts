// GET /api/calendar/available — créneaux disponibles (public ou client)
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  const fromDate = from ? new Date(from) : new Date();
  const toDate = to ? new Date(to) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const slots = await prisma.availabilitySlot.findMany({
    where: {
      slotDate: { gte: fromDate, lte: toDate },
      status: "available",
    },
    orderBy: [{ slotDate: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json({ slots });
}

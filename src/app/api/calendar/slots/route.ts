// POST /api/calendar/slots — creer un creneau de disponibilite (admin)
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";

const schema = z.object({
  slotDate: z.string().min(1),
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  durationMin: z.number().optional(),
  status: z.enum(["available", "blocked"]).default("available"),
  notes: z.string().optional(),
});

const bulkSchema = z.object({
  bulk: z.literal(true),
  fromDate: z.string().min(1),
  toDate: z.string().min(1),
  daysOfWeek: z.array(z.number().int().min(0).max(6)).min(1), // 0=Sun, 1=Mon, ...
  startTime: z.string().min(1),
  endTime: z.string().min(1),
  durationMin: z.number().optional(),
  status: z.enum(["available", "blocked"]).default("available"),
});

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("calendar", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const body = await req.json();

  // Mode bulk : generation recurrente sur plage de dates
  if (body.bulk === true) {
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }
    const from = new Date(parsed.data.fromDate);
    const to = new Date(parsed.data.toDate);
    const slotsToCreate: Array<{ slotDate: Date; startTime: string; endTime: string; durationMin: number; status: string }> = [];
    const cursor = new Date(from);
    while (cursor <= to) {
      if (parsed.data.daysOfWeek.includes(cursor.getDay())) {
        slotsToCreate.push({
          slotDate: new Date(cursor),
          startTime: parsed.data.startTime,
          endTime: parsed.data.endTime,
          durationMin: parsed.data.durationMin ?? 30,
          status: parsed.data.status,
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }

    const result = await prisma.availabilitySlot.createMany({
      data: slotsToCreate,
      skipDuplicates: true,
    });

    await logAudit({
      adminId: session.user.adminId,
      action: "create",
      entityType: "availability_slots",
      changes: { bulk: true, count: result.count, fromDate: parsed.data.fromDate, toDate: parsed.data.toDate },
    });

    revalidateAdminViews();

    return NextResponse.json({ success: true, count: result.count });
  }

  // Mode unique : un seul slot
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
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

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "availability_slots",
    entityId: slot.id,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, slot });
}

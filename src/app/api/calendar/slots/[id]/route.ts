// PATCH /api/calendar/slots/[id] — modifier/bloquer un creneau (admin)
// DELETE /api/calendar/slots/[id] — supprimer un creneau (admin)
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const updateSchema = z.object({
  slotDate: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  durationMin: z.number().int().positive().optional(),
  status: z.enum(["available", "blocked", "booked"]).optional(),
  notes: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "aucune_donnee_a_mettre_a_jour" });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("calendar", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const slotId = Number(id);

  const existing = await prisma.availabilitySlot.findUnique({ where: { id: slotId } });
  if (!existing) {
    return NextResponse.json({ error: t("creneau_introuvable") }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t(parsed.error.errors[0].message) }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (data.slotDate) data.slotDate = new Date(data.slotDate as string);

  const slot = await prisma.availabilitySlot.update({
    where: { id: slotId },
    data,
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "availability_slots",
    entityId: slotId,
    changes: parsed.data,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, slot });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("calendar", "delete")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const slotId = Number(id);

  // Refuse si slot booked et lie a un appointment confirme
  const linkedAppt = await prisma.appointment.findFirst({
    where: { slotId, status: "confirmed" },
  });
  if (linkedAppt) {
    return NextResponse.json(
      { error: t("creneau_lie_a_un_rendez_vous_confirme") },
      { status: 409 }
    );
  }

  await prisma.availabilitySlot.delete({ where: { id: slotId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "availability_slots",
    entityId: slotId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}

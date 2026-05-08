// GET /api/disputes/[id] — detail litige
// PATCH /api/disputes/[id] — mettre a jour (statut, priorite, resolution)
// DELETE /api/disputes/[id] — supprimer un litige
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  priority: z.enum(["low", "medium", "high"]).optional(),
  resolution: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnee a mettre a jour" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const dispute = await prisma.dispute.findUnique({
    where: { id: Number(id) },
    include: {
      client: { select: { fullName: true, companyName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  });
  if (!dispute) {
    return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
  }
  return NextResponse.json({ dispute });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const disputeId = Number(id);

  const existing = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!existing) {
    return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (parsed.data.status === "resolved" && !existing.resolvedAt) {
    data.resolvedAt = new Date();
  }

  const updated = await prisma.dispute.update({ where: { id: disputeId }, data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "disputes",
    entityId: disputeId,
    changes: parsed.data,
  });

  return NextResponse.json({ success: true, dispute: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const disputeId = Number(id);

  const existing = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!existing) {
    return NextResponse.json({ error: "Litige introuvable" }, { status: 404 });
  }

  await prisma.dispute.delete({ where: { id: disputeId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "disputes",
    entityId: disputeId,
  });

  return NextResponse.json({ success: true });
}

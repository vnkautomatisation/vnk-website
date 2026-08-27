// GET /api/refunds/[id] — detail remboursement
// PATCH /api/refunds/[id] — mettre a jour (interdit apres traitement)
// DELETE /api/refunds/[id] — supprimer un remboursement non traite
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { calculateTaxes } from "@/lib/utils";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const updateSchema = z.object({
  reason: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  status: z.string().optional(),
  notes: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "aucune_donnee_a_mettre_a_jour" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("refunds", "read")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const refund = await prisma.refund.findUnique({
    where: { id: Number(id) },
    include: {
      client: { select: { fullName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  });
  if (!refund) {
    return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });
  }
  return NextResponse.json({ refund });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("refunds", "write")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const refundId = Number(id);

  const existing = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!existing) {
    return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });
  }
  if (existing.status === "processed" || existing.processedAt) {
    return NextResponse.json({ error: "Remboursement deja traite — non modifiable" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t(parsed.error.errors[0].message) }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (typeof parsed.data.amount === "number") {
    const taxes = calculateTaxes(parsed.data.amount);
    data.amount = parsed.data.amount;
    data.tpsAmount = taxes.tps;
    data.tvqAmount = taxes.tvq;
    data.totalAmount = taxes.ttc;
  }
  if (parsed.data.status === "processed" && !existing.processedAt) {
    data.processedAt = new Date();
  }

  const updated = await prisma.refund.update({ where: { id: refundId }, data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "refunds",
    entityId: refundId,
    changes: parsed.data,
  });

  return NextResponse.json({ success: true, refund: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("refunds", "delete")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const refundId = Number(id);

  const existing = await prisma.refund.findUnique({ where: { id: refundId } });
  if (!existing) {
    return NextResponse.json({ error: "Remboursement introuvable" }, { status: 404 });
  }
  if (existing.status === "processed" || existing.processedAt || existing.stripeRefundId) {
    return NextResponse.json(
      { error: t("remboursement_deja_traite_impossible_de_supprimer") },
      { status: 409 }
    );
  }

  await prisma.refund.delete({ where: { id: refundId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "refunds",
    entityId: refundId,
  });

  return NextResponse.json({ success: true });
}

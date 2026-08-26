// POST /api/payments/[id]/reconcile — marque un paiement comme reconcilie (rapprochement bancaire)
// DELETE /api/payments/[id]/reconcile — annule la reconciliation (si pas encore exporte)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const bodySchema = z.object({
  notes: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
}).optional();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("payments", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const paymentId = Number(id);

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  const notes = parsed.success ? parsed.data?.notes : undefined;
  const category = parsed.success ? parsed.data?.category : undefined;

  const periodDate = payment.paidAt ?? payment.createdAt;
  const fiscalPeriod = `${periodDate.getFullYear()}-${String(periodDate.getMonth() + 1).padStart(2, "0")}`;

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: {
      reconciledAt: new Date(),
      reconciledBy: session.user.email ?? "admin",
      fiscalPeriod,
      ...(notes !== undefined ? { accountantNotes: notes } : {}),
      ...(category !== undefined ? { accountingCategory: category } : {}),
    },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "payments",
    entityId: paymentId,
    changes: { type: "payment_reconciled", fiscalPeriod, by: session.user.email },
  });

  revalidateAdminViews();
  return NextResponse.json({ success: true, payment: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("payments", "delete")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const paymentId = Number(id);

  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    return NextResponse.json({ error: "Paiement introuvable" }, { status: 404 });
  }
  if (payment.exportedAt) {
    return NextResponse.json({ error: "Déjà exporté — annulation impossible" }, { status: 409 });
  }

  const updated = await prisma.payment.update({
    where: { id: paymentId },
    data: { reconciledAt: null, reconciledBy: null, fiscalPeriod: null },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "payments",
    entityId: paymentId,
    changes: { type: "payment_unreconciled" },
  });

  revalidateAdminViews();
  return NextResponse.json({ success: true, payment: updated });
}

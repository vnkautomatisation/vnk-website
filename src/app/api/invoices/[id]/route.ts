// GET /api/invoices/[id] — detail facture
// PATCH /api/invoices/[id] — mettre a jour (interdit si payee)
// DELETE /api/invoices/[id] — supprimer une facture non payee
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { calculateTaxes } from "@/lib/utils";
import { getSetting } from "@/lib/settings";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.string().optional(),
  amountHt: z.number().positive().optional(),
  dueDate: z.string().nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnee a mettre a jour" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: Number(id) },
    include: { client: { select: { fullName: true, companyName: true, email: true } } },
  });
  if (!invoice) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }
  if (session.user.role === "client" && invoice.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }
  return NextResponse.json({ invoice });
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
  const invoiceId = Number(id);

  const existing = await prisma.invoice.findUnique({ where: { id: invoiceId } });
  if (!existing) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }
  if (existing.status === "paid") {
    return NextResponse.json({ error: "Facture deja payee — non modifiable" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (typeof data.dueDate === "string") data.dueDate = new Date(data.dueDate);

  if (typeof parsed.data.amountHt === "number") {
    const tpsRate = Number(await getSetting<number>("company", "tps_rate", 5));
    const tvqRate = Number(await getSetting<number>("company", "tvq_rate", 9.975));
    const taxes = calculateTaxes(parsed.data.amountHt, tpsRate, tvqRate);
    data.amountHt = taxes.ht;
    data.tpsAmount = taxes.tps;
    data.tvqAmount = taxes.tvq;
    data.amountTtc = taxes.ttc;
  }

  const updated = await prisma.invoice.update({ where: { id: invoiceId }, data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "invoices",
    entityId: invoiceId,
    changes: parsed.data,
  });

  return NextResponse.json({ success: true, invoice: updated });
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
  const invoiceId = Number(id);

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { status: true, _count: { select: { payments: true, refunds: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Facture introuvable" }, { status: 404 });
  }
  if (existing.status === "paid" || existing._count.payments > 0 || existing._count.refunds > 0) {
    return NextResponse.json(
      { error: "Facture payee ou liee a des paiements/remboursements — impossible de supprimer" },
      { status: 409 }
    );
  }

  await prisma.invoice.delete({ where: { id: invoiceId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "invoices",
    entityId: invoiceId,
  });

  return NextResponse.json({ success: true });
}

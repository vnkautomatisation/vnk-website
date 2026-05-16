// GET /api/expenses/[id] — detail depense
// PATCH /api/expenses/[id] — mettre a jour
// DELETE /api/expenses/[id] — supprimer
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);
const MAX_DATAURL_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024 * 1.4);

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  amount: z.number().positive().optional(),
  tpsPaid: z.number().min(0).optional(),
  tvqPaid: z.number().min(0).optional(),
  vendor: z.string().nullable().optional(),
  expenseDate: z.string().optional().refine((s) => {
    if (!s) return true;
    const d = new Date(s);
    return !isNaN(d.getTime()) && d <= new Date(new Date().toISOString().slice(0, 10) + "T23:59:59");
  }, { message: "La date ne peut pas être dans le futur" }),
  notes: z.string().nullable().optional(),
  receiptData: z.string().startsWith("data:").nullable().optional(),
}).refine((d) => Object.keys(d).length > 0, { message: "Aucune donnée à mettre à jour" });

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const expense = await prisma.expense.findUnique({ where: { id: Number(id) } });
  if (!expense) {
    return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
  }
  return NextResponse.json({ expense });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const expenseId = Number(id);

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) {
    return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  // Validation taille recu si fourni
  if (parsed.data.receiptData && parsed.data.receiptData.length > MAX_DATAURL_BYTES) {
    return NextResponse.json({ error: `Reçu trop volumineux (max ${MAX_UPLOAD_MB} Mo)` }, { status: 413 });
  }

  const { receiptData, ...rest } = parsed.data;
  const data: Record<string, unknown> = { ...rest };
  if (typeof data.expenseDate === "string") data.expenseDate = new Date(data.expenseDate);
  // receiptData: undefined = pas touché, null = supprimer, string = remplacer
  if (receiptData === null) data.receiptUrl = null;
  else if (typeof receiptData === "string") data.receiptUrl = receiptData;

  const updated = await prisma.expense.update({ where: { id: expenseId }, data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "expenses",
    entityId: expenseId,
    changes: parsed.data,
  });

  return NextResponse.json({ success: true, expense: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  const { id } = await params;
  const expenseId = Number(id);

  const existing = await prisma.expense.findUnique({ where: { id: expenseId } });
  if (!existing) {
    return NextResponse.json({ error: "Dépense introuvable" }, { status: 404 });
  }

  await prisma.expense.delete({ where: { id: expenseId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "expenses",
    entityId: expenseId,
  });

  return NextResponse.json({ success: true });
}

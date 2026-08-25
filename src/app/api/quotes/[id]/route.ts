// GET /api/quotes/[id] — detail devis
// PATCH /api/quotes/[id] — mettre a jour (titre, description, statut, etc.) — interdit apres acceptation
// DELETE /api/quotes/[id] — supprimer un devis non accepte
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { calculateTaxes } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { revalidateAdminViews } from "@/lib/revalidate";

const updateSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  serviceType: z.string().nullable().optional(),
  status: z.string().optional(),
  amountHt: z.number().positive().optional(),
  expiryDate: z.string().nullable().optional(),
  mandateId: z.number().int().positive().nullable().optional(),
  paymentPlan: z.string().nullable().optional(),
  paymentPct1: z.number().int().min(0).max(100).nullable().optional(),
  paymentPct2: z.number().int().min(0).max(100).nullable().optional(),
  paymentConditions: z.string().nullable().optional(),
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
  const quote = await prisma.quote.findUnique({
    where: { id: Number(id) },
    include: { client: { select: { fullName: true, companyName: true, email: true } } },
  });
  if (!quote) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }
  if (session.user.role === "client" && quote.clientId !== session.user.clientId) {
    return NextResponse.json({ error: "Non autorise" }, { status: 403 });
  }
  return NextResponse.json({ quote });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  if (await adminApiForbidden("quotes", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }
  const { id } = await params;
  const quoteId = Number(id);

  const existing = await prisma.quote.findUnique({ where: { id: quoteId } });
  if (!existing) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }
  if (existing.status === "accepted") {
    return NextResponse.json({ error: "Devis deja accepte — non modifiable" }, { status: 409 });
  }

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
  }

  const data: Record<string, unknown> = { ...parsed.data };
  if (typeof data.expiryDate === "string") data.expiryDate = new Date(data.expiryDate);

  if (typeof parsed.data.amountHt === "number") {
    const tpsRate = Number(await getSetting<number>("company", "tps_rate", 5));
    const tvqRate = Number(await getSetting<number>("company", "tvq_rate", 9.975));
    const taxes = calculateTaxes(parsed.data.amountHt, tpsRate, tvqRate);
    data.amountHt = taxes.ht;
    data.tpsAmount = taxes.tps;
    data.tvqAmount = taxes.tvq;
    data.amountTtc = taxes.ttc;
  }

  const updated = await prisma.quote.update({ where: { id: quoteId }, data });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "quotes",
    entityId: quoteId,
    changes: parsed.data,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, quote: updated });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }
  if (await adminApiForbidden("quotes", "delete")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }
  const { id } = await params;
  const quoteId = Number(id);

  const existing = await prisma.quote.findUnique({
    where: { id: quoteId },
    select: { status: true, _count: { select: { contracts: true, invoices: true } } },
  });
  if (!existing) {
    return NextResponse.json({ error: "Devis introuvable" }, { status: 404 });
  }
  if (existing.status === "accepted" || existing._count.contracts > 0 || existing._count.invoices > 0) {
    return NextResponse.json(
      { error: "Devis accepte ou lie a des contrats/factures — impossible de supprimer" },
      { status: 409 }
    );
  }

  await prisma.quote.delete({ where: { id: quoteId } });

  await logAudit({
    adminId: session.user.adminId,
    action: "delete",
    entityType: "quotes",
    entityId: quoteId,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true });
}

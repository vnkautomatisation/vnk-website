// GET /api/tax-declarations — liste declarations fiscales
// POST /api/tax-declarations — creer une declaration (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  periodType: z.string().min(1),
  periodLabel: z.string().min(1).max(100),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const declarations = await prisma.taxDeclaration.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ declarations });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Donnees invalides" }, { status: 400 });
  }

  // Calculer le revenu et les taxes pour la periode
  const periodStart = new Date(parsed.data.periodStart);
  const periodEnd = new Date(parsed.data.periodEnd);

  const invoiceAggs = await prisma.invoice.aggregate({
    _sum: { amountHt: true, tpsAmount: true, tvqAmount: true },
    where: {
      status: "paid",
      paidAt: { gte: periodStart, lte: periodEnd },
    },
  });

  const totalRevenueHt = Number(invoiceAggs._sum.amountHt ?? 0);
  const totalTps = Number(invoiceAggs._sum.tpsAmount ?? 0);
  const totalTvq = Number(invoiceAggs._sum.tvqAmount ?? 0);
  const totalTaxes = totalTps + totalTvq;

  const declaration = await prisma.taxDeclaration.create({
    data: {
      periodType: parsed.data.periodType,
      periodLabel: parsed.data.periodLabel,
      periodStart,
      periodEnd,
      totalRevenueHt,
      totalTps,
      totalTvq,
      totalTaxes,
      notes: parsed.data.notes,
      status: "draft",
    },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "tax_declarations",
    entityId: declaration.id,
  });

  return NextResponse.json({ success: true, declaration });
}

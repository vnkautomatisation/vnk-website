// GET /api/tax-declarations — liste declarations fiscales
// POST /api/tax-declarations — creer une declaration (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const createSchema = z.object({
  periodType: z.string().min(1),
  periodLabel: z.string().min(1).max(100),
  periodStart: z.string().min(1),
  periodEnd: z.string().min(1),
  notes: z.string().optional(),
}).refine(
  (d) => new Date(d.periodEnd) >= new Date(d.periodStart),
  { message: "La date de fin doit être après la date de début", path: ["periodEnd"] },
);

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("tax_declarations", "read")) {
    return forbiddenJson();
  }

  const declarations = await prisma.taxDeclaration.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ declarations });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("tax_declarations", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message ?? "Données invalides" }, { status: 400 });
  }

  // Calculer le revenu et les taxes pour la periode
  const periodStart = new Date(parsed.data.periodStart);
  const periodEnd = new Date(parsed.data.periodEnd);
  // Inclusif sur le dernier jour : on borne avec periodEnd + 1 jour exclusif
  const periodEndExclusive = new Date(periodEnd);
  periodEndExclusive.setDate(periodEndExclusive.getDate() + 1);

  // Garde-fou : refuser une declaration qui chevauche une periode existante du meme type
  const overlap = await prisma.taxDeclaration.findFirst({
    where: {
      periodType: parsed.data.periodType,
      OR: [
        { AND: [{ periodStart: { lte: periodEnd } }, { periodEnd: { gte: periodStart } }] },
      ],
    },
  });
  if (overlap) {
    return NextResponse.json(
      { error: `Période déjà couverte par la déclaration "${overlap.periodLabel}"` },
      { status: 409 },
    );
  }

  const invoiceAggs = await prisma.invoice.aggregate({
    _sum: { amountHt: true, tpsAmount: true, tvqAmount: true },
    where: {
      status: "paid",
      paidAt: { gte: periodStart, lt: periodEndExclusive },
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

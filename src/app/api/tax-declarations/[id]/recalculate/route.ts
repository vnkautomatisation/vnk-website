// POST /api/tax-declarations/[id]/recalculate
// Recalcule les montants (revenu HT, TPS, TVQ) d'une declaration depuis les factures payees
// dans sa periode. Utile si des factures ont ete ajoutees/modifiees apres creation.
// Interdit sur declarations soumises.
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("tax_declarations", "write")) {
    return forbiddenJson();
  }
  const { id } = await params;
  const declId = Number(id);

  const existing = await prisma.taxDeclaration.findUnique({ where: { id: declId } });
  if (!existing) {
    return NextResponse.json({ error: t("declaration_introuvable") }, { status: 404 });
  }
  if (existing.status === "submitted" || existing.submittedAt) {
    return NextResponse.json(
      { error: t("declaration_soumise_recalcul_impossible") },
      { status: 409 },
    );
  }

  const periodEndExclusive = new Date(existing.periodEnd);
  periodEndExclusive.setDate(periodEndExclusive.getDate() + 1);

  const invoiceAggs = await prisma.invoice.aggregate({
    _sum: { amountHt: true, tpsAmount: true, tvqAmount: true },
    where: {
      status: "paid",
      paidAt: { gte: existing.periodStart, lt: periodEndExclusive },
    },
  });

  const totalRevenueHt = Number(invoiceAggs._sum.amountHt ?? 0);
  const totalTps = Number(invoiceAggs._sum.tpsAmount ?? 0);
  const totalTvq = Number(invoiceAggs._sum.tvqAmount ?? 0);
  const totalTaxes = totalTps + totalTvq;

  const updated = await prisma.taxDeclaration.update({
    where: { id: declId },
    data: { totalRevenueHt, totalTps, totalTvq, totalTaxes },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "tax_declarations",
    entityId: declId,
    changes: { op: "recalculate", totalRevenueHt, totalTps, totalTvq, totalTaxes },
  });

  return NextResponse.json({ success: true, declaration: updated });
}

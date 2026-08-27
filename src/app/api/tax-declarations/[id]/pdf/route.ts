// GET /api/tax-declarations/[id]/pdf
// Genere le PDF formel d'une declaration fiscale unique (1 page, document officiel).
// Inclut les taxes payees (CTI) sur les depenses de la meme periode pour calculer le net a remettre.
import { NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { generateTaxDeclarationPdf } from "@/lib/services/pdf-export";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const TYPE_LABELS: Record<string, string> = {
  tps_tvq_trimestrielle: "Trimestrielle TPS/TVQ",
  annuelle_impots: "Annuelle impôts",
};

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("tax_declarations", "read")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const declId = Number(id);
  if (!Number.isFinite(declId)) {
    return NextResponse.json({ error: "ID invalide" }, { status: 400 });
  }

  const decl = await prisma.taxDeclaration.findUnique({ where: { id: declId } });
  if (!decl) {
    return NextResponse.json({ error: t("declaration_introuvable") }, { status: 404 });
  }

  // Bornes inclusif sur le dernier jour
  const periodEndExclusive = new Date(decl.periodEnd);
  periodEndExclusive.setDate(periodEndExclusive.getDate() + 1);

  // Taxes payées sur les dépenses de la même période
  const expenseAggs = await prisma.expense.aggregate({
    _sum: { amount: true, tpsPaid: true, tvqPaid: true },
    _count: { _all: true },
    where: { expenseDate: { gte: decl.periodStart, lt: periodEndExclusive } },
  });

  const expenses = {
    totalHt: Number(expenseAggs._sum.amount ?? 0),
    tpsPaid: Number(expenseAggs._sum.tpsPaid ?? 0),
    tvqPaid: Number(expenseAggs._sum.tvqPaid ?? 0),
    count: expenseAggs._count._all,
  };

  const pdf = await generateTaxDeclarationPdf({
    declaration: {
      periodType: TYPE_LABELS[decl.periodType] ?? decl.periodType,
      periodLabel: decl.periodLabel,
      periodStart: decl.periodStart,
      periodEnd: decl.periodEnd,
      totalRevenueHt: Number(decl.totalRevenueHt),
      totalTps: Number(decl.totalTps),
      totalTvq: Number(decl.totalTvq),
      totalTaxes: Number(decl.totalTaxes),
      status: decl.status,
      submittedAt: decl.submittedAt,
      notes: decl.notes,
      createdAt: decl.createdAt,
    },
    expenses,
    lang: "fr",
  });

  const safeName = decl.periodLabel.replace(/[^a-zA-Z0-9-_]/g, "-").toLowerCase();
  const filename = `declaration-${safeName}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}

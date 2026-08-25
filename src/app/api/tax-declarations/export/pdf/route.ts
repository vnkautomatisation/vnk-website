// GET /api/tax-declarations/export/pdf?status=&type=&year=
// Genere le PDF de la liste des declarations filtrees avec KPI annuels + tableau.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { generateTaxDeclarationsListPdf } from "@/lib/services/pdf-export";

const TYPE_LABELS: Record<string, string> = {
  tps_tvq_trimestrielle: "Trimestrielle TPS/TVQ",
  annuelle_impots: "Annuelle impôts",
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }
  if (await adminApiForbidden("tax_declarations", "read")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const type = searchParams.get("type");

  const where: Record<string, unknown> = {};
  if (status && status !== "all") where.status = status;
  if (type && type !== "all") where.periodType = type;

  const declarations = await prisma.taxDeclaration.findMany({
    where,
    orderBy: [{ periodStart: "desc" }, { createdAt: "desc" }],
  });

  // KPIs YTD (année courante)
  const now = new Date();
  const year = now.getFullYear();
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year + 1, 0, 1);

  const [invoiceYtd, expenseYtd] = await Promise.all([
    prisma.invoice.aggregate({
      _sum: { amountHt: true, tpsAmount: true, tvqAmount: true },
      where: { status: "paid", paidAt: { gte: yearStart, lt: yearEnd } },
    }),
    prisma.expense.aggregate({
      _sum: { tpsPaid: true, tvqPaid: true },
      where: { expenseDate: { gte: yearStart, lt: yearEnd } },
    }),
  ]);

  const tpsCollected = Number(invoiceYtd._sum.tpsAmount ?? 0);
  const tvqCollected = Number(invoiceYtd._sum.tvqAmount ?? 0);
  const tpsPaid = Number(expenseYtd._sum.tpsPaid ?? 0);
  const tvqPaid = Number(expenseYtd._sum.tvqPaid ?? 0);

  const kpis = {
    year,
    revenueHt: Number(invoiceYtd._sum.amountHt ?? 0),
    tpsCollected,
    tvqCollected,
    tpsPaid,
    tvqPaid,
    netToRemit: tpsCollected + tvqCollected - tpsPaid - tvqPaid,
  };

  const rows = declarations.map((d) => ({
    periodType: TYPE_LABELS[d.periodType] ?? d.periodType,
    periodLabel: d.periodLabel,
    periodStart: d.periodStart,
    periodEnd: d.periodEnd,
    totalRevenueHt: Number(d.totalRevenueHt),
    totalTps: Number(d.totalTps),
    totalTvq: Number(d.totalTvq),
    totalTaxes: Number(d.totalTaxes),
    status: d.status,
    submittedAt: d.submittedAt,
  }));

  const pdf = await generateTaxDeclarationsListPdf({
    declarations: rows,
    kpis,
    lang: "fr",
  });

  const filename = `declarations-fiscales_${year}_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}

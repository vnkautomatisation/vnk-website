// GET /api/expenses/export/pdf?from=&to=&category=
// Genere un PDF de la liste des depenses filtrees avec KPI summary + tableau detaille.
import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateExpensesPdf } from "@/lib/services/pdf-export";

const EXPENSE_CATEGORIES: Record<string, string> = {
  logiciels_licences: "Logiciels / Licences",
  materiel_informatique: "Matériel informatique",
  telecommunications: "Télécommunications",
  formation: "Formation",
  marketing: "Marketing",
  transport: "Transport",
  fournitures: "Fournitures",
  services_comptables: "Services comptables",
  assurance: "Assurance",
  autre: "Autre",
};

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const category = searchParams.get("category");

  const where: Record<string, unknown> = {};
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from) {
      const d = new Date(from);
      if (!isNaN(d.getTime())) range.gte = d;
    }
    if (to) {
      const d = new Date(to);
      if (!isNaN(d.getTime())) {
        const exclusive = new Date(d);
        exclusive.setDate(exclusive.getDate() + 1);
        range.lt = exclusive;
      }
    }
    where.expenseDate = range;
  }
  if (category && category !== "all") {
    where.category = category;
  }

  const expenses = await prisma.expense.findMany({
    where,
    orderBy: { expenseDate: "desc" },
  });

  const rows = expenses.map((e) => ({
    expenseDate: e.expenseDate,
    category: EXPENSE_CATEGORIES[e.category] ?? e.category.replace(/_/g, " "),
    title: e.title,
    vendor: e.vendor,
    amount: Number(e.amount),
    tpsPaid: Number(e.tpsPaid),
    tvqPaid: Number(e.tvqPaid),
    hasReceipt: !!e.receiptUrl,
  }));

  const kpis = {
    totalHt: rows.reduce((s, r) => s + r.amount, 0),
    totalTps: rows.reduce((s, r) => s + r.tpsPaid, 0),
    totalTvq: rows.reduce((s, r) => s + r.tvqPaid, 0),
    withReceipt: rows.filter((r) => r.hasReceipt).length,
  };

  const pdf = await generateExpensesPdf({
    expenses: rows,
    kpis,
    period: from || to ? { from: from ?? "", to: to ?? "" } : undefined,
    lang: "fr",
  });

  const filename = `depenses_${new Date().toISOString().slice(0, 10)}.pdf`;

  return new NextResponse(new Uint8Array(pdf), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Content-Length": String(pdf.length),
    },
  });
}

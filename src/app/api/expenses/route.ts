// GET /api/expenses — liste depenses
// POST /api/expenses — creer une depense (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const createSchema = z.object({
  expenseDate: z.string().min(1),
  category: z.string().min(1),
  title: z.string().min(1).max(255),
  vendor: z.string().optional(),
  amount: z.number().positive(),
  tpsPaid: z.number().min(0).default(0),
  tvqPaid: z.number().min(0).default(0),
  notes: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorise" }, { status: 401 });
  }

  const expenses = await prisma.expense.findMany({
    orderBy: { expenseDate: "desc" },
  });

  return NextResponse.json({ expenses });
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

  const expense = await prisma.expense.create({
    data: {
      title: parsed.data.title,
      category: parsed.data.category,
      amount: parsed.data.amount,
      tpsPaid: parsed.data.tpsPaid,
      tvqPaid: parsed.data.tvqPaid,
      vendor: parsed.data.vendor,
      expenseDate: new Date(parsed.data.expenseDate),
      notes: parsed.data.notes,
    },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "expenses",
    entityId: expense.id,
  });

  return NextResponse.json({ success: true, expense });
}

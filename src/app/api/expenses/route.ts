// GET /api/expenses — liste depenses
// POST /api/expenses — creer une depense (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";

const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 10);
const MAX_DATAURL_BYTES = Math.floor(MAX_UPLOAD_MB * 1024 * 1024 * 1.4);

const createSchema = z.object({
  expenseDate: z.string().min(1).refine((s) => {
    const d = new Date(s);
    return !isNaN(d.getTime()) && d <= new Date(new Date().toISOString().slice(0, 10) + "T23:59:59");
  }, { message: "La date ne peut pas être dans le futur" }),
  category: z.string().min(1),
  title: z.string().min(1).max(255),
  vendor: z.string().optional(),
  amount: z.number().positive(),
  tpsPaid: z.number().min(0).default(0),
  tvqPaid: z.number().min(0).default(0),
  notes: z.string().optional(),
  receiptData: z.string().startsWith("data:").optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const expenses = await prisma.expense.findMany({
    orderBy: { expenseDate: "desc" },
  });

  return NextResponse.json({ expenses });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.errors[0].message ?? "Données invalides" }, { status: 400 });
  }

  // Validation taille reçu
  let receiptUrl: string | undefined;
  if (parsed.data.receiptData) {
    if (parsed.data.receiptData.length > MAX_DATAURL_BYTES) {
      return NextResponse.json({ error: `Reçu trop volumineux (max ${MAX_UPLOAD_MB} Mo)` }, { status: 413 });
    }
    receiptUrl = parsed.data.receiptData;
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
      receiptUrl,
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

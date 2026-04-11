// GET /api/invoices — liste factures
// POST /api/invoices — créer une facture (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { calculateTaxes, generateDocumentNumber } from "@/lib/utils";
import { getSetting } from "@/lib/settings";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  mandateId: z.number().int().positive().optional(),
  quoteId: z.number().int().positive().optional(),
  contractId: z.number().int().positive().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  amountHt: z.number().positive(),
  dueDays: z.number().int().positive().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const invoices = await prisma.invoice.findMany({
    where:
      session.user.role === "admin"
        ? {}
        : { clientId: session.user.clientId! },
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ invoices });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return NextResponse.json({ error: "Non autorisé" }, { status: 401 });
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  const tpsRate = Number(await getSetting<number>("company", "tps_rate", 5));
  const tvqRate = Number(await getSetting<number>("company", "tvq_rate", 9.975));
  const taxes = calculateTaxes(parsed.data.amountHt, tpsRate, tvqRate);

  const prefix = (await getSetting<string>("billing", "invoice_number_prefix")) ?? "F-{YYYY}-";
  const year = new Date().getFullYear();
  const last = await prisma.invoice.findFirst({
    where: { invoiceNumber: { startsWith: prefix.replace("{YYYY}", String(year)) } },
    orderBy: { createdAt: "desc" },
  });
  const nextSeq = last ? Number(last.invoiceNumber.split("-").pop()) + 1 : 1;
  const invoiceNumber = generateDocumentNumber(prefix, nextSeq);

  const dueDays = parsed.data.dueDays ??
    Number(await getSetting<number>("billing", "default_payment_due_days", 30));
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + dueDays);

  const invoice = await prisma.invoice.create({
    data: {
      clientId: parsed.data.clientId,
      mandateId: parsed.data.mandateId,
      quoteId: parsed.data.quoteId,
      contractId: parsed.data.contractId,
      invoiceNumber,
      title: parsed.data.title,
      description: parsed.data.description,
      amountHt: taxes.ht,
      tpsAmount: taxes.tps,
      tvqAmount: taxes.tvq,
      amountTtc: taxes.ttc,
      dueDate,
    },
  });

  await createWorkflowEvent({
    clientId: invoice.clientId,
    invoiceId: invoice.id,
    eventType: "invoice_created",
    eventLabel: `Facture ${invoiceNumber} créée — ${taxes.ttc.toFixed(2)} $ TTC`,
    triggeredBy: "admin",
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "invoices",
    entityId: invoice.id,
  });

  return NextResponse.json({ success: true, invoice });
}

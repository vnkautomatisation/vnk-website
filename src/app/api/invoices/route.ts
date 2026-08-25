// GET /api/invoices — liste factures
// POST /api/invoices — créer une facture (admin)
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { calculateTaxes, generateDocumentNumber } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { revalidateAdminViews } from "@/lib/revalidate";
import { notifyInvoiceCreated } from "@/lib/integrations/slack";
import { triggerZap } from "@/lib/integrations/zapier";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  mandateId: z.number().int().positive().nullable().optional(),
  quoteId: z.number().int().positive().nullable().optional(),
  contractId: z.number().int().positive().nullable().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  serviceType: z.string().max(60).optional(),
  amountHt: z.number().positive(),
  dueDays: z.number().int().positive().optional(),
  dueDate: z.string().optional(),
  invoicePhase: z.string().max(60).optional(),
  phaseNumber: z.number().int().positive().optional(),
  paymentMethod: z.string().max(60).optional(),
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
  if (await adminApiForbidden("invoices", "write")) {
    return NextResponse.json({ error: "Permission refusée" }, { status: 403 });
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

  let dueDate: Date;
  if (parsed.data.dueDate) {
    dueDate = new Date(parsed.data.dueDate);
  } else {
    const dueDays = parsed.data.dueDays ??
      Number(await getSetting<number>("billing", "default_payment_due_days", 30));
    dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + dueDays);
  }

  const invoice = await prisma.invoice.create({
    data: {
      clientId: parsed.data.clientId,
      mandateId: parsed.data.mandateId ?? undefined,
      quoteId: parsed.data.quoteId ?? undefined,
      contractId: parsed.data.contractId ?? undefined,
      invoiceNumber,
      title: parsed.data.title,
      description: parsed.data.description,
      serviceType: parsed.data.serviceType,
      amountHt: taxes.ht,
      tpsAmount: taxes.tps,
      tvqAmount: taxes.tvq,
      amountTtc: taxes.ttc,
      dueDate,
      invoicePhase: parsed.data.invoicePhase,
      phaseNumber: parsed.data.phaseNumber,
      paymentMethod: parsed.data.paymentMethod,
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

  // Notifications externes (non bloquantes)
  const cli = await prisma.client.findUnique({
    where: { id: invoice.clientId },
    select: { fullName: true, companyName: true },
  });
  const clientName = cli?.companyName ?? cli?.fullName ?? "Client";
  void notifyInvoiceCreated({
    invoiceNumber: invoice.invoiceNumber,
    amount: Number(invoice.amountTtc),
    currency: invoice.currency,
    clientName,
    dueDate: invoice.dueDate ? invoice.dueDate.toISOString().slice(0, 10) : null,
  });
  void triggerZap("invoices.created", {
    id: invoice.id, invoiceNumber: invoice.invoiceNumber, amount: Number(invoice.amountTtc),
    currency: invoice.currency, clientId: invoice.clientId, clientName,
    dueDate: invoice.dueDate?.toISOString() ?? null,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, invoice });
}

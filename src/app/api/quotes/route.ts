// GET /api/quotes — liste devis (admin: tous, client: les siens)
// POST /api/quotes — créer un devis (admin)
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
import { notifyQuoteCreated } from "@/lib/integrations/slack";
import { triggerZap } from "@/lib/integrations/zapier";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const createSchema = z.object({
  clientId: z.number().int().positive(),
  mandateId: z.number().int().positive().optional(),
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  serviceType: z.string().optional(),
  amountHt: z.number().positive(),
  expiryDays: z.number().int().positive().optional(),
  paymentPlan: z.string().optional(),
  paymentPct1: z.number().int().min(0).max(100).optional(),
  paymentPct2: z.number().int().min(0).max(100).optional(),
  paymentConditions: z.string().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session?.user) {
    return unauthorizedJson();
  }

  const quotes = await prisma.quote.findMany({
    where:
      session.user.role === "admin"
        ? {}
        : { clientId: session.user.clientId! },
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ quotes });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("quotes", "write")) {
    return forbiddenJson();
  }

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  }

  // Calcul taxes depuis settings
  const tpsRate = Number(await getSetting<number>("company", "tps_rate", 5));
  const tvqRate = Number(await getSetting<number>("company", "tvq_rate", 9.975));
  const taxes = calculateTaxes(parsed.data.amountHt, tpsRate, tvqRate);

  // Numérotation auto depuis settings
  const prefix = (await getSetting<string>("billing", "quote_number_prefix")) ?? "D-{YYYY}-";
  const year = new Date().getFullYear();
  const last = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: prefix.replace("{YYYY}", String(year)).replace("{YY}", String(year).slice(-2)) } },
    orderBy: { createdAt: "desc" },
  });
  const nextSeq = last ? Number(last.quoteNumber.split("-").pop()) + 1 : 1;
  const quoteNumber = generateDocumentNumber(prefix, nextSeq);

  // Expiry date
  const expiryDays = parsed.data.expiryDays ??
    Number(await getSetting<number>("billing", "default_quote_expiry_days", 30));
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);

  const quote = await prisma.quote.create({
    data: {
      clientId: parsed.data.clientId,
      mandateId: parsed.data.mandateId,
      quoteNumber,
      title: parsed.data.title,
      description: parsed.data.description,
      serviceType: parsed.data.serviceType,
      amountHt: taxes.ht,
      tpsAmount: taxes.tps,
      tvqAmount: taxes.tvq,
      amountTtc: taxes.ttc,
      expiryDate,
      paymentPlan: parsed.data.paymentPlan,
      paymentPct1: parsed.data.paymentPct1,
      paymentPct2: parsed.data.paymentPct2,
      paymentConditions: parsed.data.paymentConditions,
    },
  });

  await createWorkflowEvent({
    clientId: quote.clientId,
    quoteId: quote.id,
    eventType: "quote_created",
    eventLabel: `Devis ${quoteNumber} créé — ${taxes.ttc.toFixed(2)} $ TTC`,
    triggeredBy: "admin",
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "create",
    entityType: "quotes",
    entityId: quote.id,
  });

  // Notifications externes (non bloquantes)
  const cli = await prisma.client.findUnique({
    where: { id: quote.clientId },
    select: { fullName: true, companyName: true },
  });
  const clientName = cli?.companyName ?? cli?.fullName ?? "Client";
  void notifyQuoteCreated({
    quoteNumber: quote.quoteNumber,
    amount: Number(quote.amountTtc),
    currency: quote.currency,
    clientName,
  });
  void triggerZap("quotes.created", {
    id: quote.id, quoteNumber: quote.quoteNumber, amount: Number(quote.amountTtc),
    currency: quote.currency, clientId: quote.clientId, clientName,
  });

  revalidateAdminViews();

  return NextResponse.json({ success: true, quote });
}

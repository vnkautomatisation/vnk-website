// POST /api/project-requests/[id]/convert
// Convertit une demande de projet en mandat OU en devis (selon body.target)
// Le titre/description/serviceType sont copies automatiquement.
// La demande passe au statut "converted" et stocke convertedToMandateId / convertedToQuoteId.
import { NextRequest, NextResponse } from "next/server";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { adminApiForbidden } from "@/lib/permissions";
import { prisma } from "@/lib/prisma";
import { logAudit } from "@/lib/audit";
import { createWorkflowEvent } from "@/lib/workflow";
import { calculateTaxes, generateDocumentNumber } from "@/lib/utils";
import { getSetting } from "@/lib/settings";
import { revalidateAdminViews } from "@/lib/revalidate";
import { unauthorizedJson, forbiddenJson } from "@/lib/refusals";

const schema = z.object({
  target: z.enum(["mandate", "quote"]),
  // Optionnels pour devis : montant et date d'expiration
  amountHt: z.number().positive().optional(),
  expiryDays: z.number().int().positive().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const t = await getTranslations("api_errors");
  const session = await auth();
  if (!session?.user || session.user.role !== "admin") {
    return unauthorizedJson();
  }
  if (await adminApiForbidden("requests", "write")) {
    return forbiddenJson();
  }

  const { id } = await params;
  const requestId = Number(id);

  const existing = await prisma.projectRequest.findUnique({ where: { id: requestId } });
  if (!existing) {
    return NextResponse.json({ error: "Demande introuvable" }, { status: 404 });
  }
  if (existing.status === "converted") {
    return NextResponse.json({ error: t("demande_deja_convertie") }, { status: 409 });
  }

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: t(parsed.error.errors[0].message) }, { status: 400 });
  }

  if (parsed.data.target === "mandate") {
    const mandate = await prisma.mandate.create({
      data: {
        clientId: existing.clientId,
        title: existing.title,
        description: existing.description,
        serviceType: existing.serviceType,
        status: "pending",
        progress: 0,
      },
    });

    await prisma.mandateLog.create({
      data: {
        mandateId: mandate.id,
        action: "CREATED",
        description: `Mandat créé depuis la demande #${existing.id}`,
        createdBy: "admin",
      },
    });

    await prisma.projectRequest.update({
      where: { id: requestId },
      data: { status: "converted", convertedToMandateId: mandate.id },
    });

    await createWorkflowEvent({
      clientId: existing.clientId,
      mandateId: mandate.id,
      eventType: "mandate_created",
      eventLabel: `Mandat ouvert — ${mandate.title} (depuis demande #${existing.id})`,
      triggeredBy: "admin",
      metadata: { fromRequestId: existing.id },
    });

    await createWorkflowEvent({
      clientId: existing.clientId,
      eventType: "project_request_converted",
      eventLabel: `Demande "${existing.title}" convertie en mandat`,
      triggeredBy: "admin",
      metadata: { requestId: existing.id, mandateId: mandate.id },
    });

    await logAudit({
      adminId: session.user.adminId,
      action: "update",
      entityType: "project_requests",
      entityId: existing.id,
      changes: { converted_to_mandate: mandate.id },
    });

    revalidateAdminViews();
    return NextResponse.json({ success: true, target: "mandate", mandateId: mandate.id });
  }

  // target === "quote"
  if (!parsed.data.amountHt) {
    return NextResponse.json({ error: t("montant_ht_requis_pour_conversion_en_devis") }, { status: 400 });
  }

  const tpsRate = Number(await getSetting<number>("company", "tps_rate", 5));
  const tvqRate = Number(await getSetting<number>("company", "tvq_rate", 9.975));
  const taxes = calculateTaxes(parsed.data.amountHt, tpsRate, tvqRate);

  const prefix = (await getSetting<string>("billing", "quote_number_prefix")) ?? "D-{YYYY}-";
  const year = new Date().getFullYear();
  const last = await prisma.quote.findFirst({
    where: { quoteNumber: { startsWith: prefix.replace("{YYYY}", String(year)).replace("{YY}", String(year).slice(-2)) } },
    orderBy: { createdAt: "desc" },
  });
  const nextSeq = last ? Number(last.quoteNumber.split("-").pop()) + 1 : 1;
  const quoteNumber = generateDocumentNumber(prefix, nextSeq);

  const expiryDays = parsed.data.expiryDays ??
    Number(await getSetting<number>("billing", "default_quote_expiry_days", 30));
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + expiryDays);

  const quote = await prisma.quote.create({
    data: {
      clientId: existing.clientId,
      quoteNumber,
      title: existing.title,
      description: existing.description,
      serviceType: existing.serviceType,
      amountHt: taxes.ht,
      tpsAmount: taxes.tps,
      tvqAmount: taxes.tvq,
      amountTtc: taxes.ttc,
      expiryDate,
      status: "pending",
    },
  });

  await prisma.projectRequest.update({
    where: { id: requestId },
    data: { status: "converted", convertedToQuoteId: quote.id },
  });

  await createWorkflowEvent({
    clientId: existing.clientId,
    quoteId: quote.id,
    eventType: "quote_created",
    eventLabel: `Devis ${quoteNumber} créé — ${taxes.ttc.toFixed(2)} $ TTC (depuis demande #${existing.id})`,
    triggeredBy: "admin",
    metadata: { fromRequestId: existing.id },
  });

  await createWorkflowEvent({
    clientId: existing.clientId,
    eventType: "project_request_converted",
    eventLabel: `Demande "${existing.title}" convertie en devis ${quoteNumber}`,
    triggeredBy: "admin",
    metadata: { requestId: existing.id, quoteId: quote.id },
  });

  await logAudit({
    adminId: session.user.adminId,
    action: "update",
    entityType: "project_requests",
    entityId: existing.id,
    changes: { converted_to_quote: quote.id },
  });

  revalidateAdminViews();
  return NextResponse.json({ success: true, target: "quote", quoteId: quote.id, quoteNumber });
}

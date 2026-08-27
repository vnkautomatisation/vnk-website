// Admin · Litiges — KPIs + filtres + creation enrichie + Stripe sync
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { DisputesView } from "./disputes-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("litiges") };
}

export default async function DisputesPage() {
  const now = new Date();

  const [rawDisputes, clients, invoices, mandates] = await Promise.all([
    prisma.dispute.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        invoice: { select: { id: true, invoiceNumber: true, amountTtc: true } },
        mandate: { select: { id: true, title: true } },
      },
      orderBy: { openedAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.invoice.findMany({
      select: { id: true, invoiceNumber: true, clientId: true, amountTtc: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mandate.findMany({
      select: { id: true, title: true, clientId: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const disputes = rawDisputes.map((d) => ({
    id: d.id,
    clientId: d.clientId,
    clientName: d.client.fullName,
    companyName: d.client.companyName,
    invoiceId: d.invoiceId,
    invoiceNumber: d.invoice?.invoiceNumber ?? null,
    invoiceAmount: d.invoice?.amountTtc ? Number(d.invoice.amountTtc) : null,
    mandateId: d.mandateId,
    mandateTitle: d.mandate?.title ?? null,
    title: d.title,
    description: d.description,
    status: d.status,
    priority: d.priority,
    resolution: d.resolution,
    type: d.type,
    category: d.category,
    amountDisputed: d.amountDisputed != null ? Number(d.amountDisputed) : null,
    currency: d.currency,
    stripeDisputeId: d.stripeDisputeId,
    stripeReason: d.stripeReason,
    evidenceDueBy: d.evidenceDueBy?.toISOString() ?? null,
    evidenceSubmittedAt: d.evidenceSubmittedAt?.toISOString() ?? null,
    outcome: d.outcome,
    cardBrand: d.cardBrand,
    assignedTo: d.assignedTo,
    estimatedResolutionDate: d.estimatedResolutionDate?.toISOString() ?? null,
    escalatedAt: d.escalatedAt?.toISOString() ?? null,
    internalNotes: d.internalNotes,
    evidenceDocumentIds: (d.evidenceDocumentIds as number[] | null) ?? [],
    lastClientContactAt: d.lastClientContactAt?.toISOString() ?? null,
    nextActionDue: d.nextActionDue?.toISOString() ?? null,
    contactMethod: d.contactMethod,
    lawFirmInvolved: d.lawFirmInvolved,
    caseNumber: d.caseNumber,
    tribunal: d.tribunal,
    smallClaimsFiledAt: d.smallClaimsFiledAt?.toISOString() ?? null,
    openedAt: d.openedAt.toISOString(),
    resolvedAt: d.resolvedAt?.toISOString() ?? null,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));

  const openCount = disputes.filter((d) => d.status === "open" || d.status === "under_review").length;
  const wonCount = disputes.filter((d) => d.status === "won" || d.outcome === "won").length;
  const lostCount = disputes.filter((d) => d.status === "lost" || d.outcome === "lost").length;
  const overdueEvidence = disputes.filter((d) => d.evidenceDueBy && new Date(d.evidenceDueBy) < now && !d.evidenceSubmittedAt && !d.resolvedAt).length;
  const totalAtStake = disputes.filter((d) => d.status === "open" || d.status === "under_review").reduce((s, d) => s + (d.amountDisputed ?? d.invoiceAmount ?? 0), 0);

  const kpis = {
    total: disputes.length,
    open: openCount,
    won: wonCount,
    lost: lostCount,
    overdueEvidence,
    totalAtStake,
  };

  return (
    <DisputesView
      disputes={disputes}
      clients={clients}
      invoices={invoices.map((i) => ({ id: i.id, invoiceNumber: i.invoiceNumber, clientId: i.clientId, amountTtc: Number(i.amountTtc), status: i.status }))}
      mandates={mandates}
      kpis={kpis}
    />
  );
}

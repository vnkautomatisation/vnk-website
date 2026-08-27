// Pipeline workflow — kanban visuel du cycle de vie client
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { WorkflowKanban } from "./workflow-kanban";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("pipeline_workflow") };
}

export default async function WorkflowPage() {
  const [rawClients, rawEvents] = await Promise.all([
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      include: {
        mandates: {
          select: { id: true, status: true, title: true, progress: true, serviceType: true, endDate: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        quotes: {
          select: { id: true, status: true, quoteNumber: true, title: true, amountTtc: true, expiryDate: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        contracts: {
          select: { id: true, status: true, contractNumber: true, title: true, amountTtc: true, createdAt: true, adminSignatureData: true, clientSignatureData: true },
          orderBy: { createdAt: "desc" },
        },
        invoices: {
          select: { id: true, status: true, invoiceNumber: true, amountTtc: true, dueDate: true, createdAt: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { messages: { where: { isRead: false, sender: "client" } } } },
      },
    }),
    prisma.workflowEvent.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { client: { select: { fullName: true, companyName: true } } },
    }),
  ]);

  const clients = rawClients.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    companyName: c.companyName,
    unreadMessages: c._count.messages,
    createdAt: c.createdAt.toISOString(),
    mandates: c.mandates.map((m) => ({
      ...m,
      endDate: m.endDate?.toISOString() ?? null,
      createdAt: m.createdAt.toISOString(),
    })),
    quotes: c.quotes.map((q) => ({
      ...q,
      amountTtc: Number(q.amountTtc),
      expiryDate: q.expiryDate?.toISOString() ?? null,
      createdAt: q.createdAt.toISOString(),
    })),
    contracts: c.contracts.map((ct) => ({
      id: ct.id,
      status: ct.status,
      contractNumber: ct.contractNumber,
      title: ct.title,
      amountTtc: ct.amountTtc != null ? Number(ct.amountTtc) : null,
      createdAt: ct.createdAt.toISOString(),
      adminSigned: !!ct.adminSignatureData,
      clientSigned: !!ct.clientSignatureData,
    })),
    invoices: c.invoices.map((i) => ({
      ...i,
      amountTtc: Number(i.amountTtc),
      dueDate: i.dueDate?.toISOString() ?? null,
      createdAt: i.createdAt.toISOString(),
    })),
  }));

  const events = rawEvents.map((e) => ({
    id: e.id,
    eventType: e.eventType,
    eventLabel: e.eventLabel,
    triggeredBy: e.triggeredBy,
    createdAt: e.createdAt.toISOString(),
    clientId: e.clientId,
    mandateId: e.mandateId,
    quoteId: e.quoteId,
    contractId: e.contractId,
    invoiceId: e.invoiceId,
    clientName: e.client?.fullName ?? "—",
    clientCompany: e.client?.companyName ?? null,
  }));

  return <WorkflowKanban clients={clients} events={events} />;
}

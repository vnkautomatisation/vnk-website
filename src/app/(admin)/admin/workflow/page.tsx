// Pipeline workflow — kanban visuel du cycle de vie client
import { prisma } from "@/lib/prisma";
import { WorkflowKanban } from "./workflow-kanban";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Pipeline workflow" };

export default async function WorkflowPage() {
  const rawClients = await prisma.client.findMany({
    where: { isActive: true, archived: false },
    include: {
      mandates: {
        select: { id: true, status: true, title: true, progress: true, serviceType: true, endDate: true },
        orderBy: { createdAt: "desc" },
      },
      quotes: {
        select: { id: true, status: true, quoteNumber: true, title: true, amountTtc: true, expiryDate: true },
        orderBy: { createdAt: "desc" },
      },
      contracts: {
        select: { id: true, status: true, contractNumber: true, title: true },
        orderBy: { createdAt: "desc" },
      },
      invoices: {
        select: { id: true, status: true, invoiceNumber: true, amountTtc: true, dueDate: true },
        orderBy: { createdAt: "desc" },
      },
      _count: { select: { messages: { where: { isRead: false, sender: "client" } } } },
    },
  });

  const clients = rawClients.map((c) => ({
    id: c.id,
    fullName: c.fullName,
    companyName: c.companyName,
    unreadMessages: c._count.messages,
    mandates: c.mandates.map((m) => ({
      ...m,
      endDate: m.endDate?.toISOString() ?? null,
    })),
    quotes: c.quotes.map((q) => ({
      ...q,
      amountTtc: Number(q.amountTtc),
      expiryDate: q.expiryDate?.toISOString() ?? null,
    })),
    contracts: c.contracts,
    invoices: c.invoices.map((i) => ({
      ...i,
      amountTtc: Number(i.amountTtc),
      dueDate: i.dueDate?.toISOString() ?? null,
    })),
  }));

  return <WorkflowKanban clients={clients} />;
}

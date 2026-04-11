// Pipeline workflow — kanban visuel du cycle de vie client
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { WorkflowKanban } from "./workflow-kanban";
import { Workflow } from "lucide-react";

export default async function WorkflowPage() {
  // Charger tous les clients actifs avec leurs mandats / devis / contrats / factures
  // Le state machine dans lib/workflow.ts détermine l'étape
  const clients = await prisma.client.findMany({
    where: { isActive: true, archived: false },
    include: {
      mandates: { select: { id: true, status: true, title: true, progress: true } },
      quotes: { select: { id: true, status: true, quoteNumber: true, amountTtc: true } },
      contracts: { select: { id: true, status: true, contractNumber: true } },
      invoices: {
        select: {
          id: true,
          status: true,
          invoiceNumber: true,
          amountTtc: true,
          dueDate: true,
        },
      },
    },
  });

  return (
    <div className="space-y-4">
      <PageHeader
        title="Pipeline workflow"
        subtitle="Cycle de vie complet de chaque client — de la prospection au paiement"
        icon={Workflow}
      />
      <WorkflowKanban clients={clients} />
    </div>
  );
}

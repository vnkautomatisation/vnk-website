// Admin · Audit trail — timeline globale tous evenements
import { prisma } from "@/lib/prisma";
import { AuditTrailView } from "./audit-trail-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Audit trail" };

export default async function AuditTrailPage() {
  const clients = await prisma.client.findMany({
    where: { archived: false },
    select: { id: true, fullName: true, companyName: true },
    orderBy: { fullName: "asc" },
  });

  const [loginCount, orderCount, sigCount, consentCount, emailCount, auditCount, workflowCount] = await Promise.all([
    prisma.loginEvent.count(),
    prisma.orderEvent.count(),
    prisma.signatureEvent.count(),
    prisma.consentLog.count(),
    prisma.emailEvent.count(),
    prisma.auditLog.count(),
    prisma.workflowEvent.count(),
  ]);

  return (
    <AuditTrailView
      clients={clients}
      counts={{ login: loginCount, order: orderCount, signature: sigCount, consent: consentCount, email: emailCount, audit: auditCount, workflow: workflowCount }}
    />
  );
}

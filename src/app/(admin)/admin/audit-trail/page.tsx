// Admin · Audit trail — timeline globale tous evenements
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { AuditTrailView } from "./audit-trail-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("audit_trail") };
}

export default async function AuditTrailPage() {
  const [clients, admins, loginCount, orderCount, sigCount, consentCount, emailCount, auditCount, workflowCount] = await Promise.all([
    prisma.client.findMany({
      where: { archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.admin.findMany({
      where: { isActive: true },
      select: { id: true, fullName: true, email: true },
      orderBy: { fullName: "asc" },
    }),
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
      admins={admins}
      counts={{ login: loginCount, order: orderCount, signature: sigCount, consent: consentCount, email: emailCount, audit: auditCount, workflow: workflowCount }}
    />
  );
}

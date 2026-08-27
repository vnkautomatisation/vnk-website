// Admin · Documents — KPIs + filtres + upload + bulk + envoi client
import { prisma } from "@/lib/prisma";
import { getTranslations } from "next-intl/server";
import { DocumentsView } from "./documents-view";
import type { Metadata } from "next";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("admin.page_titles");
  return { title: t("documents") };
}

export default async function DocumentsPage() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const [rawDocuments, clients, mandates] = await Promise.all([
    prisma.document.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        mandate: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
    prisma.mandate.findMany({
      select: { id: true, title: true, clientId: true },
      orderBy: { title: "asc" },
    }),
  ]);

  const documents = rawDocuments.map((d) => ({
    id: d.id,
    clientId: d.clientId,
    clientName: d.client.fullName,
    companyName: d.client.companyName,
    mandateId: d.mandateId,
    mandateTitle: d.mandate?.title ?? null,
    title: d.title,
    description: d.description,
    fileType: d.fileType,
    fileName: d.fileName,
    fileUrl: d.fileUrl,
    fileSize: d.fileSize,
    category: d.category,
    status: d.status,
    isRead: d.isRead,
    uploadedBy: d.uploadedBy,
    isUploaded: d.fileUrl?.startsWith("data:") ?? false,
    isSystemGenerated: d.fileUrl?.startsWith("/api/") ?? false,
    createdAt: d.createdAt.toISOString(),
    updatedAt: d.updatedAt.toISOString(),
  }));

  const totalThisMonth = documents.filter((d) => new Date(d.createdAt) >= monthStart).length;
  const unreadCount = documents.filter((d) => !d.isRead).length;
  const uniqueClients = new Set(documents.map((d) => d.clientId)).size;
  const totalStorageBytes = documents.reduce((s, d) => s + (d.isUploaded && d.fileSize ? d.fileSize : 0), 0);

  return (
    <DocumentsView
      documents={documents}
      clients={clients}
      mandates={mandates}
      kpis={{
        total: documents.length,
        thisMonth: totalThisMonth,
        unread: unreadCount,
        uniqueClients,
        totalStorageBytes,
      }}
    />
  );
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalDocumentsList } from "./documents-list";

export default async function PortalDocumentsPage() {
  const session = await auth();
  const rawDocuments = await prisma.document.findMany({
    where: { clientId: session!.user.clientId! },
    include: { mandate: { select: { title: true } } },
    orderBy: { createdAt: "desc" },
  });
  const documents = rawDocuments.map((d) => ({
    id: d.id,
    title: d.title,
    category: d.category,
    fileUrl: d.fileUrl,
    isRead: d.isRead,
    createdAt: d.createdAt.toISOString(),
    mandateTitle: d.mandate?.title ?? null,
  }));
  return <PortalDocumentsList documents={documents} />;
}

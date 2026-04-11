import { prisma } from "@/lib/prisma";
import { DocumentsTable } from "./documents-table";

export default async function DocumentsPage() {
  const documents = await prisma.document.findMany({
    include: {
      client: { select: { fullName: true } },
      mandate: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <DocumentsTable documents={documents} />;
}

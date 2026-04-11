import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalDocumentsList } from "./documents-list";

export default async function PortalDocumentsPage() {
  const session = await auth();
  const documents = await prisma.document.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  return <PortalDocumentsList documents={documents} />;
}

import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { DocumentsTable } from "./documents-table";

export default async function DocumentsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const documents = await prisma.document.findMany({
    include: {
      client: { select: { fullName: true } },
      mandate: { select: { title: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <DocumentsTable documents={documents} />;
}

import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { PageHeader } from "@/components/admin/page-header";
import { DataTable, type Column } from "@/components/data-table/data-table";
import { Inbox } from "lucide-react";
import { RequestsTable } from "./requests-table";

export default async function RequestsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const requests = await prisma.projectRequest.findMany({
    orderBy: { createdAt: "desc" },
  });
  return <RequestsTable requests={requests} />;
}

import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ClientsTableClient } from "./clients-table";

export default async function AdminClientsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const clients = await prisma.client.findMany({
    where: { archived: false },
    include: {
      _count: { select: { mandates: true, invoices: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return <ClientsTableClient clients={clients} />;
}

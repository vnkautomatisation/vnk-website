import { prisma } from "@/lib/prisma";
import { ClientsTableClient } from "./clients-table";

export default async function AdminClientsPage() {
  const clients = await prisma.client.findMany({
    where: { archived: false },
    include: {
      _count: { select: { mandates: true, invoices: true } },
    },
    orderBy: { fullName: "asc" },
  });

  return <ClientsTableClient clients={clients} />;
}

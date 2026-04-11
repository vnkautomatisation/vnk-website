import { prisma } from "@/lib/prisma";
import { DisputesTable } from "./disputes-table";

export default async function DisputesPage() {
  const disputes = await prisma.dispute.findMany({
    include: { client: { select: { fullName: true } } },
    orderBy: { openedAt: "desc" },
  });
  return <DisputesTable disputes={disputes} />;
}

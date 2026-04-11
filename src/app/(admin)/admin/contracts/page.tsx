import { prisma } from "@/lib/prisma";
import { ContractsTable } from "./contracts-table";

export default async function ContractsPage() {
  const contracts = await prisma.contract.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return <ContractsTable contracts={contracts} />;
}

import { prisma } from "@/lib/prisma";
import { ContractsTable } from "./contracts-table";

export default async function ContractsPage() {
  const rawContracts = await prisma.contract.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const contracts = rawContracts.map((c) => ({
    ...c,
    amountTtc: c.amountTtc != null ? Number(c.amountTtc) : null,
  }));
  return <ContractsTable contracts={contracts} />;
}

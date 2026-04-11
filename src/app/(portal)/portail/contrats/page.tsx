import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalContractsList } from "./contracts-list";

export default async function PortalContractsPage() {
  const session = await auth();
  const contracts = await prisma.contract.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  return <PortalContractsList contracts={contracts} />;
}

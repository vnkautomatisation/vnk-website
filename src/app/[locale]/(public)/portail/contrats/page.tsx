import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalContractsList } from "./contracts-list";

export default async function PortalContractsPage() {
  const session = await auth();
  const rawContracts = await prisma.contract.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  const contracts = rawContracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    title: c.title,
    status: c.status,
    amountTtc: Number(c.amountTtc),
    fileUrl: c.fileUrl,
    adminSignedAt: c.adminSignedAt?.toISOString() ?? null,
    clientSignatureData: !!c.clientSignatureData,
    signedAt: c.signedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));
  return <PortalContractsList contracts={contracts} />;
}

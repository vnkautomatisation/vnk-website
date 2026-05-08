// Admin · Contrats — filtres + creation + signature + PDF
import { prisma } from "@/lib/prisma";
import { ContractsView } from "./contracts-view";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Contrats" };

export default async function ContractsPage() {
  const [rawContracts, clients] = await Promise.all([
    prisma.contract.findMany({
      include: {
        client: { select: { id: true, fullName: true, companyName: true } },
        mandate: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.client.findMany({
      where: { isActive: true, archived: false },
      select: { id: true, fullName: true, companyName: true },
      orderBy: { fullName: "asc" },
    }),
  ]);

  const contracts = rawContracts.map((c) => ({
    id: c.id,
    contractNumber: c.contractNumber,
    clientId: c.clientId,
    clientName: c.client.fullName,
    companyName: c.client.companyName,
    title: c.title,
    status: c.status,
    amountTtc: c.amountTtc != null ? Number(c.amountTtc) : null,
    clientSignatureData: !!c.clientSignatureData,
    adminSignatureData: !!c.adminSignatureData,
    signedAt: c.signedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
  }));

  return <ContractsView contracts={contracts} clients={clients} />;
}

import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { ContractsTable } from "./contracts-table";

export default async function ContractsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const contracts = await prisma.contract.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  return <ContractsTable contracts={contracts} />;
}

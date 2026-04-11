import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { DisputesTable } from "./disputes-table";

export default async function DisputesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const disputes = await prisma.dispute.findMany({
    include: { client: { select: { fullName: true } } },
    orderBy: { openedAt: "desc" },
  });
  return <DisputesTable disputes={disputes} />;
}

import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { RefundsTable } from "./refunds-table";

export default async function RefundsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const refunds = await prisma.refund.findMany({
    include: {
      client: { select: { fullName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <RefundsTable refunds={refunds} />;
}

import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { TransactionsTable } from "./transactions-table";

export default async function TransactionsPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const payments = await prisma.payment.findMany({
    include: {
      client: { select: { fullName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <TransactionsTable payments={payments} />;
}

import { prisma } from "@/lib/prisma";
import { RefundsTable } from "./refunds-table";

export default async function RefundsPage() {
  const refunds = await prisma.refund.findMany({
    include: {
      client: { select: { fullName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return <RefundsTable refunds={refunds} />;
}

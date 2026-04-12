import { prisma } from "@/lib/prisma";
import { InvoicesTable } from "./invoices-table";

export default async function InvoicesPage() {
  const rawInvoices = await prisma.invoice.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });
  const invoices = rawInvoices.map((i) => ({
    ...i,
    amountHt: Number(i.amountHt),
    tpsAmount: Number(i.tpsAmount),
    tvqAmount: Number(i.tvqAmount),
    amountTtc: Number(i.amountTtc),
  }));

  return <InvoicesTable invoices={invoices} />;
}

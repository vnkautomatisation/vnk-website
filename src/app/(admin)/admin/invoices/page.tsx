import { prisma } from "@/lib/prisma";
import { InvoicesTable } from "./invoices-table";

export default async function InvoicesPage() {
  const invoices = await prisma.invoice.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <InvoicesTable invoices={invoices} />;
}

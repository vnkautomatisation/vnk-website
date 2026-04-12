import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalInvoicesList } from "./invoices-list";

export default async function PortalInvoicesPage() {
  const session = await auth();
  const rawInvoices = await prisma.invoice.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  const invoices = rawInvoices.map((i) => ({
    ...i,
    amountHt: Number(i.amountHt),
    tpsAmount: Number(i.tpsAmount),
    tvqAmount: Number(i.tvqAmount),
    amountTtc: Number(i.amountTtc),
  }));
  return <PortalInvoicesList invoices={invoices} />;
}

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { PortalInvoicesList } from "./invoices-list";

export default async function PortalInvoicesPage() {
  const session = await auth();
  const invoices = await prisma.invoice.findMany({
    where: { clientId: session!.user.clientId! },
    orderBy: { createdAt: "desc" },
  });
  return <PortalInvoicesList invoices={invoices} />;
}

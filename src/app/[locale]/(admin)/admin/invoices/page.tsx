import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { InvoicesTable } from "./invoices-table";

export default async function InvoicesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const invoices = await prisma.invoice.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <InvoicesTable invoices={invoices} />;
}

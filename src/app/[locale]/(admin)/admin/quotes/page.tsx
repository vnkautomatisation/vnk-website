import { setRequestLocale } from "next-intl/server";
import { prisma } from "@/lib/prisma";
import { QuotesTable } from "./quotes-table";

export default async function QuotesPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const quotes = await prisma.quote.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <QuotesTable quotes={quotes} />;
}

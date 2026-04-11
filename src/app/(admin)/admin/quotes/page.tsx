import { prisma } from "@/lib/prisma";
import { QuotesTable } from "./quotes-table";

export default async function QuotesPage() {
  const quotes = await prisma.quote.findMany({
    include: { client: { select: { fullName: true, companyName: true } } },
    orderBy: { createdAt: "desc" },
  });

  return <QuotesTable quotes={quotes} />;
}
